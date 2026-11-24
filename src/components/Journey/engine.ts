import { BEACON_X, LEG, LM_X, X0, clamp, regionIndex, routeY } from './world';

/* ============================================================
 * JourneyEngine — the world's single animation loop.
 *
 * Owns the explorer's position along the route, the camera, and the
 * explorer's attitude (bob, tilt). Everything that moves with the world
 * subscribes and writes its own transform straight to the DOM, so React
 * never renders per frame. Gameplay only ever calls `travelTo` / `jump`.
 *
 * Time-based (not frame-based) motion: a dropped frame or a background tab
 * never desynchronises anything; travel simply finishes on time.
 * ============================================================ */

export interface Frame {
  /** seconds since the engine started */
  t: number;
  dt: number;
  /** explorer world position */
  ex: number;
  ey: number;
  /** smoothed horizontal speed, units/s */
  vx: number;
  /** camera centre (world units) incl. idle drift */
  camX: number;
  camY: number;
  /** explorer pitch in degrees (negative = nose up) and idle bob */
  tilt: number;
  bob: number;
  travelling: boolean;
}

type Listener = (f: Frame) => void;

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const approach = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export class JourneyEngine {
  frame: Frame;
  reduced: boolean;
  onLandmark?: (i: number) => void;
  onRegion?: (i: number) => void;
  onArrive?: () => void;
  /** how far ahead (world units) the camera may lean while travelling */
  maxLead = 320;

  private listeners = new Set<Listener>();
  private raf = 0;
  private last = 0;
  private t0 = 0;
  private travel: { from: number; to: number; start: number; dur: number } | null = null;
  private lead = 0;
  private camBaseX: number;
  private camBaseY: number;
  private region: number;
  private running = false;

  constructor(x: number, reduced: boolean) {
    this.reduced = reduced;
    const y = routeY(x);
    this.camBaseX = x;
    this.camBaseY = y;
    this.region = regionIndex(x);
    this.frame = { t: 0, dt: 0, ex: x, ey: y, vx: 0, camX: x, camY: y, tilt: 0, bob: 0, travelling: false };
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.frame);
    return () => { this.listeners.delete(fn); };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    if (!this.t0) this.t0 = this.last;
    const loop = (now: number) => {
      if (!this.running) return;
      this.step(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Fly to world x. Duration scales with distance; short hops still feel like a journey. */
  travelTo(x: number) {
    const from = this.frame.ex;
    const d = Math.abs(x - from);
    if (d < 1) { this.onArrive?.(); return; }
    if (this.reduced) { this.jump(x); this.onArrive?.(); return; }
    const dur = clamp(1100 + d * 1.25, 1300, 3600);
    this.travel = { from, to: x, start: performance.now(), dur };
  }

  /** Teleport (used on load, reduced motion and when an endless journey loops). */
  jump(x: number) {
    this.travel = null;
    const y = routeY(x);
    Object.assign(this.frame, { ex: x, ey: y, vx: 0, travelling: false });
    this.camBaseX = x;
    this.camBaseY = y;
    this.lead = 0;
    this.frame.camX = x;
    this.frame.camY = y;
    this.region = regionIndex(x);
    this.emit();
  }

  private step(now: number) {
    const f = this.frame;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    f.t = (now - this.t0) / 1000;
    f.dt = dt;

    const prevX = f.ex;
    if (this.travel) {
      const p = clamp((now - this.travel.start) / this.travel.dur, 0, 1);
      f.ex = this.travel.from + (this.travel.to - this.travel.from) * easeInOut(p);
      if (p >= 1) { this.travel = null; queueMicrotask(() => this.onArrive?.()); }
    }
    f.ey = routeY(f.ex);
    f.travelling = !!this.travel;
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
    f.camX = this.camBaseX + drift * (Math.sin(f.t * 0.21) * 9 + Math.sin(f.t * 0.53 + 1) * 3);
    f.camY = this.camBaseY + drift * (Math.sin(f.t * 0.17 + 2) * 6);

    // attitude: pitch follows the route's slope and speed; a gentle idle bob
    const slope = (routeY(f.ex + 30) - routeY(f.ex - 30)) / 60;
    const speedK = clamp(Math.abs(f.vx) / 900, 0, 1);
    const pitch = (Math.atan(slope) * 180) / Math.PI * 0.55 * speedK + clamp(f.vx * 0.0035, -3, 5);
    f.tilt = approach(f.tilt, clamp(pitch, -16, 12), 4, dt);
    f.bob = this.reduced ? 0 : Math.sin(f.t * 1.6) * 5 + Math.sin(f.t * 0.61 + 0.4) * 2.5;

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
