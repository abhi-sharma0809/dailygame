import { DEFAULT_STYLE, flightDuration, progressAt, speedAt, type TravelStyle } from './motion';
import { BEACON_X, LEG, LM_X, X0, clamp, regionIndex, routeY } from './world';

/* ============================================================
 * JourneyEngine — the world's single animation loop.
 *
 * Owns the explorer's position along the route, the camera, and the
 * explorer's attitude (bob, tilt, engine glow). Everything that moves with
 * the world subscribes and writes its own transform straight to the DOM, so
 * React never renders per frame. Gameplay only ever calls `travelTo` / `jump`.
 *
 * A travel has three beats:
 *   charge  — the ship holds position, rears back and its engine glows
 *   flight  — it accelerates along the route on the style's velocity curve
 *   settle  — it lands, bobs once and the glow fades
 *
 * Guarantees:
 *   • the destination is always the x the caller asked for (derived from the
 *     score), and the ship ends exactly there;
 *   • x never decreases during travel; a new travel requested mid-flight is
 *     queued and chained, never overlapped;
 *   • motion is time-based, so a dropped frame or a background tab can't
 *     desynchronise anything — travel simply finishes on time.
 * ============================================================ */

export type TravelPhase = 'idle' | 'charge' | 'flight' | 'settle';

export interface Frame {
  /** seconds since the engine started */
  t: number;
  dt: number;
  /** explorer world position */
  ex: number;
  ey: number;
  /** smoothed horizontal speed, units/s */
  vx: number;
  /** camera centre (world units) incl. idle drift and shake */
  camX: number;
  camY: number;
  /** explorer pitch in degrees (negative = nose up) and vertical bob */
  tilt: number;
  bob: number;
  travelling: boolean;
  phase: TravelPhase;
  /** engine glow / effect intensity right now, 0–1 */
  boost: number;
  /** the current travel's style */
  style: TravelStyle;
  /** charge progress 0–1 (squash before launch) */
  charge: number;
  /** soft light bloom around the ship, 0–1 */
  flash: number;
}

type Listener = (f: Frame) => void;

const approach = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth = (t: number) => t * t * (3 - 2 * t);

const SETTLE_MS = 750;
const MISS_MS = 1100;

interface Travel { from: number; to: number; style: TravelStyle; start: number; charge: number; dur: number }

export class JourneyEngine {
  frame: Frame;
  reduced: boolean;
  onLandmark?: (i: number) => void;
  onRegion?: (i: number) => void;
  /** the ship leaves after its wind-up (or, for a miss, sputters in place) */
  onLaunch?: (style: TravelStyle, moving: boolean) => void;
  /** the ship reaches its destination */
  onArrive?: (style: TravelStyle) => void;
  /** the ship has landed and come to rest: the travel sequence is over */
  onSettle?: () => void;
  /** how far ahead (world units) the camera may lean while travelling */
  maxLead = 320;
  /** where the camera should frame the ship, as an offset in world units (eased towards) */
  focus = { x: 0, y: 0 };
  /** injectable clock (tests) */
  clock: () => number = () => performance.now();

  private listeners = new Set<Listener>();
  private raf = 0;
  private last = 0;
  private t0 = 0;
  private travel: Travel | null = null;
  private pending: { x: number; style: TravelStyle } | null = null;
  private settle: { start: number; dur: number; boost: number; miss: boolean } | null = null;
  private launched = false;
  private shake: { start: number; amp: number } | null = null;
  private flashAt: { start: number; amp: number } | null = null;
  private lead = 0;
  private camBaseX: number;
  private camBaseY: number;
  private region: number;
  private running = false;
  private settleBob = 0;
  private focusCur = { x: 0, y: 0 };

  constructor(x: number, reduced: boolean) {
    this.reduced = reduced;
    const y = routeY(x);
    this.camBaseX = x;
    this.camBaseY = y;
    this.region = regionIndex(x);
    this.frame = { t: 0, dt: 0, ex: x, ey: y, vx: 0, camX: x, camY: y, tilt: 0, bob: 0, travelling: false, phase: 'idle', boost: 0, style: DEFAULT_STYLE, charge: 0, flash: 0 };
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.frame);
    return () => { this.listeners.delete(fn); };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = this.clock();
    if (!this.t0) this.t0 = this.last;
    const loop = (now: number) => {
      if (!this.running) return;
      this.tick(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Where the ship will be once every requested travel has finished. */
  get target(): number {
    return this.pending?.x ?? this.travel?.to ?? this.frame.ex;
  }

  get busy(): boolean {
    return !!(this.travel || this.pending || this.settle);
  }

  /**
   * Travel to world x in the given style. If the ship is already travelling,
   * the request is queued and chained onto the current flight.
   */
  travelTo(x: number, style: TravelStyle = DEFAULT_STYLE) {
    if (this.reduced) { this.jump(Math.max(x, this.target)); queueMicrotask(() => { this.onArrive?.(style); this.onSettle?.(); }); return; }
    if (x < this.target - 0.5) { this.jump(x); queueMicrotask(() => this.onSettle?.()); return; } // never fly backwards
    if (this.travel) {
      // chain: keep the furthest target and the most recent style
      this.pending = { x: Math.max(x, this.pending?.x ?? x), style };
      return;
    }
    this.begin(x, style, this.settle ? 0 : style.charge);
  }

  /** Teleport (used on load and reduced motion). Clears any travel in progress. */
  jump(x: number) {
    this.travel = null;
    this.pending = null;
    this.settle = null;
    const y = routeY(x);
    Object.assign(this.frame, { ex: x, ey: y, vx: 0, travelling: false, phase: 'idle', boost: 0, charge: 0, flash: 0 });
    this.camBaseX = x;
    this.camBaseY = y;
    this.lead = 0;
    this.frame.camX = x;
    this.frame.camY = y;
    this.region = regionIndex(x);
    this.emit();
  }

  private begin(x: number, style: TravelStyle, charge: number) {
    const now = this.clock();
    const from = this.frame.ex;
    const d = x - from;
    this.settle = null;
    this.frame.style = style;
    if (d < 1) {
      // nothing to travel: a miss sputters in place, then the sequence is over
      this.travel = null;
      this.settle = { start: now, dur: style.power === 0 ? MISS_MS : SETTLE_MS * 0.5, boost: 0, miss: style.power === 0 };
      this.onLaunch?.(style, false);
      return;
    }
    this.launched = false;
    this.travel = { from, to: x, style, start: now, charge, dur: flightDuration(style, d, LEG) };
  }

  /** Advance one frame. Public so tests can drive time explicitly. */
  tick(now: number) {
    const f = this.frame;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.t0) this.t0 = now;
    f.t = (now - this.t0) / 1000;
    f.dt = dt;

    const prevX = f.ex;
    let boost = 0;
    f.charge = 0;

    if (this.travel) {
      const tr = this.travel;
      const el = now - tr.start;
      if (el < tr.charge) {
        // wind-up: hold position, glow builds
        f.phase = 'charge';
        const c = smooth(el / tr.charge);
        f.charge = c;
        boost = tr.style.power * 0.55 * c;
      } else {
        if (!this.launched) {
          this.launched = true;
          if (tr.style.shake > 0) this.shake = { start: now, amp: tr.style.shake };
          if (tr.style.flash > 0) this.flashAt = { start: now, amp: tr.style.flash };
          this.onLaunch?.(tr.style, true);
        }
        f.phase = 'flight';
        const u = clamp((el - tr.charge) / tr.dur, 0, 1);
        // monotonic by construction (progressAt never decreases); clamp guards against float noise
        f.ex = Math.max(prevX, tr.from + (tr.to - tr.from) * progressAt(tr.style, u));
        const sp = speedAt(tr.style, u);
        const kick = Math.max(0, 1 - u * 5); // the first fifth of the flight is the burst
        boost = tr.style.power * Math.max(0.3 + 0.7 * sp, kick);
        if (u >= 1) {
          f.ex = tr.to;
          this.travel = null;
          const arrived = tr.style;
          queueMicrotask(() => this.onArrive?.(arrived));
          if (this.pending) {
            const p = this.pending;
            this.pending = null;
            this.begin(p.x, p.style, 0);
          } else {
            this.settle = { start: now, dur: SETTLE_MS, boost, miss: false };
            this.settleBob = Math.min(14, 4 + Math.abs(f.vx) * 0.006);
          }
        }
      }
    }

    if (!this.travel && this.settle) {
      const st = this.settle;
      const p = clamp((now - st.start) / st.dur, 0, 1);
      f.phase = 'settle';
      boost = st.boost * (1 - smooth(p));
      if (p >= 1) {
        this.settle = null;
        f.phase = 'idle';
        queueMicrotask(() => this.onSettle?.());
      }
    } else if (!this.travel) f.phase = 'idle';

    f.ey = routeY(f.ex);
    f.travelling = !!this.travel;
    f.boost = approach(f.boost, boost, 14, dt);
    const v = dt > 0 ? (f.ex - prevX) / dt : 0;
    f.vx = approach(f.vx, v, 10, dt);

    // landmarks passed on this frame
    if (f.ex > prevX) {
      for (let i = 0; i <= 7; i++) {
        const lx = i === 7 ? BEACON_X : LM_X[i];
        if (prevX < lx - 0.5 && f.ex >= lx - 0.5) this.onLandmark?.(i);
      }
    }

    // camera: eases after the explorer and leans ahead while travelling
    this.lead = approach(this.lead, clamp(f.vx * 0.32, -120, this.maxLead), 2.2, dt);
    this.camBaseX = approach(this.camBaseX, f.ex + this.lead, 3.4, dt);
    this.camBaseY = approach(this.camBaseY, f.ey, 2.6, dt);
    const drift = this.reduced ? 0 : 1;
    let sx = 0, sy = 0;
    if (this.shake) {
      const k = (now - this.shake.start) / 520;
      if (k >= 1) this.shake = null;
      else { const a = this.shake.amp * (1 - k) * (1 - k); sx = Math.sin(k * 61) * a; sy = Math.cos(k * 47) * a * 0.7; }
    }
    // reframing (e.g. making room for the results) is a slow camera pan, or a cut with reduced motion
    this.focusCur.x = this.reduced ? this.focus.x : approach(this.focusCur.x, this.focus.x, 2, dt);
    this.focusCur.y = this.reduced ? this.focus.y : approach(this.focusCur.y, this.focus.y, 2, dt);
    f.camX = this.camBaseX + drift * (Math.sin(f.t * 0.21) * 9 + Math.sin(f.t * 0.53 + 1) * 3) + sx + this.focusCur.x;
    f.camY = this.camBaseY + drift * (Math.sin(f.t * 0.17 + 2) * 6) + sy + this.focusCur.y;

    f.flash = 0;
    if (this.flashAt) {
      const k = (now - this.flashAt.start) / 900;
      if (k >= 1) this.flashAt = null;
      else f.flash = this.flashAt.amp * Math.min(1, k * 8) * Math.pow(1 - k, 2);
    }

    // attitude: pitch follows the route's slope and speed; rears back while charging
    const slope = (routeY(f.ex + 30) - routeY(f.ex - 30)) / 60;
    const speedK = clamp(Math.abs(f.vx) / 900, 0, 1);
    const rear = -f.charge * (3 + 6 * f.style.power);
    const pitch = (Math.atan(slope) * 180) / Math.PI * 0.55 * speedK + clamp(f.vx * 0.0035, -3, 6) + rear;
    f.tilt = approach(f.tilt, clamp(pitch, -16, 12), f.phase === 'charge' ? 9 : 4, dt);

    // bob: idle float, a dip while charging, one damped bounce on landing, a wobble on a miss
    let bob = this.reduced ? 0 : Math.sin(f.t * 1.6) * 5 + Math.sin(f.t * 0.61 + 0.4) * 2.5;
    bob += f.charge * (4 + 6 * f.style.power);
    if (this.settle && !this.reduced) {
      const ms = now - this.settle.start;
      if (this.settle.miss) bob += Math.sin(ms / 70) * 3 * Math.exp(-ms / 400) + 6 * Math.sin(Math.PI * Math.min(1, ms / this.settle.dur));
      else bob += this.settleBob * Math.sin(ms / 95) * Math.exp(-ms / 260);
    }
    f.bob = bob;

    // region changes use the undrifted camera with hysteresis, so resting near a border never flickers
    const rc = (this.camBaseX - X0) / LEG;
    if (rc > this.region + 0.56 || rc < this.region - 0.56) {
      const r = regionIndex(this.camBaseX);
      if (r !== this.region) { this.region = r; this.onRegion?.(r); }
    }
    this.emit();
  }

  private emit() {
    for (const l of this.listeners) l(this.frame);
  }
}
