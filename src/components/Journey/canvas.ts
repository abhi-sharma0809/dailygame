import type { Frame } from './engine';
import type { View } from './Layer';
import { BEACON_X, LM_X, WORLD_END, WORLD_START, X0, clamp, regionAt, rng, routeY } from './world';

/* ============================================================
 * Canvas painters driven by the engine frame (no React).
 *   SkyPainter      stars, shooting stars, aurora (behind the mountains)
 *   RoutePainter    the route ahead (parchment dashes) and travelled (gold),
 *                   exhaust puffs, and the answer-driven flight effects: a
 *                   glowing trail, engine sparks, launch burst, landing ring
 *   WeatherPainter  region particles in front: fireflies, leaves, pollen,
 *                   wind, snow, rising star motes
 * ============================================================ */

function fit(c: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

const band = (r: number, a: number, b: number, fade = 0.4) => clamp(Math.min((r - a) / fade + 1, (b - r) / fade + 1), 0, 1);

/* ------------------------------------------------------------ sky */

export class SkyPainter {
  private stars: { x: number; y: number; r: number; p: number; s: number }[];
  private shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  private lastVisible = -1;
  constructor(private c: HTMLCanvasElement) {
    const r = rng(2026);
    this.stars = Array.from({ length: 260 }, () => ({ x: r(), y: Math.pow(r(), 1.4), r: 0.4 + r() * 1.3, p: r() * 6.28, s: 0.6 + r() * 2 }));
  }
  draw(f: Frame, view: View, reduced: boolean) {
    const rr = regionAt(f.camX);
    const vis = clamp((rr - 3.7) / 1.1, 0, 1);
    if (vis === 0 && this.lastVisible === 0) return;
    this.lastVisible = vis;
    const { ctx, w, h } = fit(this.c);
    ctx.clearRect(0, 0, w, h);
    if (vis === 0) return;
    const horizon = (view.ay + 170) * view.s;
    const off = (f.camX * 0.004 * view.s) % w;
    for (const st of this.stars) {
      const x = ((st.x * w * 1.2 - off) % w + w) % w;
      const y = st.y * horizon * 1.05;
      const tw = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(f.t * st.s + st.p);
      ctx.globalAlpha = vis * tw * (1 - y / (horizon * 1.15));
      ctx.fillStyle = st.r > 1.4 ? '#FFF1CF' : '#E6ECFF';
      ctx.beginPath();
      ctx.arc(x, y, st.r * Math.max(0.8, view.s), 0, 6.283);
      ctx.fill();
    }
    // aurora over the summit
    const au = clamp((rr - 5.2) / 0.8, 0, 1);
    if (au > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const base = horizon * (0.22 + k * 0.1);
        const g = ctx.createLinearGradient(0, base - 120 * view.s, 0, base + 60 * view.s);
        const col = k === 1 ? '120,200,255' : '110,240,190';
        g.addColorStop(0, `rgba(${col},0)`);
        g.addColorStop(0.6, `rgba(${col},${0.22 * au})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        const ph = reduced ? 0 : f.t * (0.18 + k * 0.05);
        ctx.moveTo(0, base + 60 * view.s);
        for (let x = 0; x <= w + 20; x += 20) {
          const y = base + Math.sin(x / (180 + k * 60) + ph + k) * 34 * view.s + Math.sin(x / 70 + ph * 2) * 8 * view.s;
          ctx.lineTo(x, y - 110 * view.s);
        }
        for (let x = w + 20; x >= 0; x -= 20) {
          const y = base + Math.sin(x / (180 + k * 60) + ph + k) * 34 * view.s;
          ctx.lineTo(x, y + 40 * view.s);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // a shooting star now and then
    if (!reduced && vis > 0.6) {
      if (!this.shoot && Math.random() < f.dt * 0.12) this.shoot = { x: w * (0.3 + Math.random() * 0.7), y: horizon * Math.random() * 0.4, vx: -(420 + Math.random() * 200), vy: 160, life: 1 };
      if (this.shoot) {
        const s = this.shoot;
        s.x += s.vx * f.dt; s.y += s.vy * f.dt; s.life -= f.dt * 1.2;
        const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.18, s.y - s.vy * 0.18);
        g.addColorStop(0, `rgba(255,246,221,${0.9 * s.life})`);
        g.addColorStop(1, 'rgba(255,246,221,0)');
        ctx.globalAlpha = 1;
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.18, s.y - s.vy * 0.18); ctx.stroke();
        if (s.life <= 0) this.shoot = null;
      }
    }
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------ route */

interface Puff { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; dark: boolean }
/** world-space trail sample at the ship's stern */
interface TrailPt { x: number; y: number; age: number; w: number }
/** world-space spark / burst particle */
interface Spark { x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; white: boolean; g: number }
interface Ring { x: number; y: number; life: number; max: number; r: number; w: number; color: string }

export class RoutePainter {
  private puffs: Puff[] = [];
  private emit = 0;
  private trail: TrailPt[] = [];
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private sparkAcc = 0;
  /** reached destinations, for the route markers */
  reached = 0;
  sputter = 0;
  constructor(private c: HTMLCanvasElement) {}

  /** stern of the airship in world units (the propeller), allowing for the phone scale */
  private stern(f: Frame, view: View) {
    const k = view.portrait ? 1.25 : 1;
    return { x: f.ex - 46 * k, y: f.ey + f.bob + 12 * k };
  }

  /** The ship leaves: a ring of light and a spray of sparks thrown backwards. */
  launch(f: Frame, view: View) {
    const st = f.style;
    if (st.power <= 0) { this.sputter = 1.2; return; }
    const p = this.stern(f, view);
    if (st.burst > 0) {
      this.rings.push({ x: p.x, y: p.y, life: 0, max: 0.7, r: 30 + 120 * st.power, w: 2 + 4 * st.power, color: st.color });
      for (let i = 0; i < st.burst; i++) {
        const a = Math.PI + (Math.random() - 0.5) * 2.4; // mostly backwards
        const v = 120 + Math.random() * 420 * st.power;
        this.sparks.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, r: 1.4 + Math.random() * 2.6, life: 0, max: 0.6 + Math.random() * 0.8, white: Math.random() > 0.55, g: 160 });
      }
    }
  }

  /** The ship arrives: strong answers leave a shimmer where it lands. */
  land(f: Frame, view: View) {
    const st = f.style;
    if (st.power < 0.6) return;
    const k = view.portrait ? 1.25 : 1;
    this.rings.push({ x: f.ex, y: f.ey - 40 * k, life: 0, max: 0.9, r: 70 + 70 * st.power, w: 1.5 + 2 * st.power, color: st.color });
    const n = Math.round(10 + 22 * st.power);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const v = 60 + Math.random() * 90;
      this.sparks.push({ x: f.ex + Math.cos(a) * 50, y: f.ey - 40 * k + Math.sin(a) * 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, r: 1 + Math.random() * 1.8, life: 0, max: 0.7 + Math.random() * 0.6, white: true, g: 40 });
    }
  }

  draw(f: Frame, view: View, reduced: boolean) {
    const { ctx, w, h } = fit(this.c);
    ctx.clearRect(0, 0, w, h);
    const s = view.s;
    const sx = (x: number) => (view.ax + x - f.camX) * s;
    const sy = (y: number) => (view.ay + y - f.camY) * s;
    const xa = Math.max(WORLD_START, f.camX - view.ax - 40);
    const xb = Math.min(WORLD_END, f.camX - view.ax + view.viewW + 40);
    const step = 14;
    // ahead: parchment dashes
    ctx.lineCap = 'round';
    ctx.setLineDash([3 * s * 1.2, 11 * s * 1.2]);
    ctx.lineWidth = Math.max(1.5, 3 * s);
    ctx.strokeStyle = 'rgba(248,240,222,0.55)';
    ctx.beginPath();
    for (let x = Math.max(xa, f.ex); x <= xb; x += step) { const X = sx(x), Y = sy(routeY(x)); if (x === Math.max(xa, f.ex)) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
    ctx.stroke();
    // behind: the gold of the distance travelled
    ctx.setLineDash([]);
    // (the journey starts at the forest: the gold fades in just before it)
    const g0 = Math.max(xa, X0 - 520);
    if (f.ex > g0) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,214,140,0.9)';
      ctx.shadowBlur = 10 * s;
      const grad = ctx.createLinearGradient(sx(X0 - 520), 0, sx(X0 - 140), 0);
      grad.addColorStop(0, 'rgba(242,207,138,0)');
      grad.addColorStop(1, 'rgba(242,207,138,1)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(2, 3.6 * s);
      ctx.beginPath();
      for (let x = g0; x <= f.ex; x += step) { const X = sx(x), Y = sy(routeY(x)); if (x === g0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
      ctx.lineTo(sx(f.ex), sy(f.ey));
      ctx.stroke();
      ctx.restore();
    }
    // destination markers on the route
    const marks = [...LM_X, BEACON_X];
    marks.forEach((mx, i) => {
      if (mx < xa - 20 || mx > xb + 20) return;
      const X = sx(mx), Y = sy(routeY(mx));
      const r = Math.max(4, 7 * s);
      const done = i < this.reached || mx <= f.ex + 0.5;
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(Math.PI / 4);
      if (done) { ctx.shadowColor = 'rgba(255,214,140,0.9)'; ctx.shadowBlur = 12 * s; }
      ctx.fillStyle = done ? '#F6D68F' : 'rgba(16,25,35,0.65)';
      ctx.strokeStyle = done ? '#FFF6DD' : 'rgba(248,240,222,0.8)';
      ctx.lineWidth = Math.max(1, 1.6 * s);
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    });

    if (!reduced) this.drawFlight(ctx, f, view, sx, sy);

    // exhaust puffs from the propeller while flying (dark sputter on a miss)
    if (!reduced) {
      const k = view.portrait ? 1.25 : 1;
      const px = sx(f.ex) - 50 * s * k;
      const py = sy(f.ey + f.bob) + 12 * s * k;
      const rate = Math.abs(f.vx) > 60 ? 10 + 10 * f.style.power : this.sputter > 0 ? 9 : 1.2;
      this.emit += rate * f.dt;
      if (this.sputter > 0) this.sputter -= f.dt;
      while (this.emit > 1) {
        this.emit -= 1;
        const dark = this.sputter > 0;
        this.puffs.push({ x: px, y: py, vx: -20 - Math.random() * 30, vy: -8 - Math.random() * 14, r: (3 + Math.random() * 3) * s * k, life: 0, max: 1.2 + Math.random() * 0.8, dark });
      }
      const dCam = (f.camX - (this.lastCam ?? f.camX)) * s;
      this.lastCam = f.camX;
      for (const p of this.puffs) {
        p.life += f.dt;
        p.x += p.vx * f.dt * s - dCam;
        p.y += p.vy * f.dt * s;
        p.r += 7 * f.dt * s;
        const a = (1 - p.life / p.max) * 0.5;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = p.dark ? '#4A4650' : '#F8F1E2';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      this.puffs = this.puffs.filter((p) => p.life < p.max);
      ctx.globalAlpha = 1;
    }
  }
  private lastCam: number | null = null;

  private drawFlight(ctx: CanvasRenderingContext2D, f: Frame, view: View, sx: (x: number) => number, sy: (y: number) => number) {
    const s = view.s;
    const st = f.style;
    const dt = f.dt;
    const p = this.stern(f, view);

    // trail: sampled at the stern while the engine is lit, fades with age
    for (const t of this.trail) t.age += dt;
    const life = Math.max(0.15, st.trail);
    this.trail = this.trail.filter((t) => t.age < life);
    if (f.boost > 0.04 && st.trail > 0 && (f.phase === 'flight' || f.phase === 'settle')) this.trail.push({ x: p.x, y: p.y, age: 0, w: f.boost });
    if (this.trail.length > 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? st.color : '#FFF8E6';
        for (let i = 1; i < this.trail.length; i++) {
          const a = this.trail[i - 1], b = this.trail[i];
          const fade = 1 - b.age / life;
          if (fade <= 0) continue;
          const w = (pass === 0 ? 3 + 14 * st.power : 1 + 3 * st.power) * b.w * fade * s;
          ctx.globalAlpha = (pass === 0 ? 0.28 : 0.55) * fade;
          ctx.lineWidth = Math.max(0.6, w);
          ctx.beginPath(); ctx.moveTo(sx(a.x), sy(a.y)); ctx.lineTo(sx(b.x), sy(b.y)); ctx.stroke();
        }
      }
      ctx.restore();
    }

    // sparks streaming from the engine at speed
    if (f.phase === 'flight' && st.sparks > 0) {
      this.sparkAcc += st.sparks * f.boost * dt;
      while (this.sparkAcc > 1) {
        this.sparkAcc -= 1;
        this.sparks.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y + (Math.random() - 0.5) * 8, vx: -40 - Math.random() * 160, vy: (Math.random() - 0.5) * 90, r: 0.9 + Math.random() * 1.8 * st.power, life: 0, max: 0.35 + Math.random() * 0.6, white: Math.random() > 0.6, g: 60 });
      }
    } else this.sparkAcc = 0;

    if (this.sparks.length || this.rings.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const k of this.sparks) {
        k.life += dt;
        k.vy += k.g * dt;
        k.vx *= 1 - 1.6 * dt;
        k.x += k.vx * dt; k.y += k.vy * dt;
        const a = 1 - k.life / k.max;
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = k.white ? '#FFF8E6' : st.color;
        ctx.beginPath(); ctx.arc(sx(k.x), sy(k.y), Math.max(0.5, k.r * (0.5 + a * 0.6) * s), 0, 6.283); ctx.fill();
      }
      this.sparks = this.sparks.filter((k) => k.life < k.max);
      for (const r of this.rings) {
        r.life += dt;
        const q = r.life / r.max;
        if (q >= 1) continue;
        const e = 1 - Math.pow(1 - q, 3);
        ctx.globalAlpha = (1 - q) * 0.8;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = Math.max(0.8, r.w * (1 - q) * s);
        ctx.beginPath(); ctx.ellipse(sx(r.x), sy(r.y), r.r * e * s, r.r * e * 0.62 * s, 0, 0, 6.283); ctx.stroke();
      }
      this.rings = this.rings.filter((r) => r.life < r.max);
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------ weather */

type Kind = 'firefly' | 'leaf' | 'pollen' | 'wind' | 'snow' | 'spark';
interface P { kind: Kind; x: number; y: number; vx: number; vy: number; r: number; life: number; max: number; rot: number; vr: number; depth: number; hue: number; bvx: number; bvy: number }
const approachV = (v: number, base: number, dt: number) => base + (v - base) * Math.exp(-2.2 * dt);

export class WeatherPainter {
  private ps: P[] = [];
  private acc: Record<Kind, number> = { firefly: 0, leaf: 0, pollen: 0, wind: 0, snow: 0, spark: 0 };
  private lastCam: number | null = null;
  private bursts: P[] = [];
  constructor(private c: HTMLCanvasElement, private budget: number) {}

  /** a fountain of gold sparks at a screen point (landmark celebrations) */
  burst(x: number, y: number, n = 36) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 220;
      this.bursts.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, r: 1.5 + Math.random() * 2.5, life: 0, max: 1.2 + Math.random() * 0.8, rot: 0, vr: 0, depth: 1, hue: Math.random(), bvx: 0, bvy: 0 });
    }
  }

  draw(f: Frame, view: View, reduced: boolean) {
    const { ctx, w, h } = fit(this.c);
    ctx.clearRect(0, 0, w, h);
    if (reduced) { this.ps = []; this.bursts = []; return; }
    const rr = regionAt(f.camX);
    const rates: Record<Kind, number> = {
      firefly: band(rr, -1, 0.9, 0.6) * 9,
      leaf: band(rr, -1, 2.3, 0.6) * (rr > 1.6 ? 3 : 2.2),
      pollen: band(rr, 0.8, 2.5, 0.5) * 7,
      // speed lines grow with the strength of the answer that launched the ship
      wind: band(rr, 2.6, 4.3, 0.4) * 5 + (Math.abs(f.vx) > 200 ? 3 + 22 * f.style.power * f.boost : 0),
      snow: band(rr, 3.5, 5.0, 0.5) * 26,
      spark: band(rr, 4.9, 7, 0.5) * 8,
    };
    const scale = view.s;
    const dCam = this.lastCam == null ? 0 : (f.camX - this.lastCam) * scale;
    this.lastCam = f.camX;
    const dt = f.dt;
    for (const k of Object.keys(rates) as Kind[]) {
      this.acc[k] += rates[k] * dt;
      while (this.acc[k] > 1) {
        this.acc[k] -= 1;
        if (this.ps.length < this.budget) this.ps.push(this.spawn(k, w, h));
      }
    }
    // the ship's wake: nearby motes, leaves and snow are pushed aside as it passes
    const shipX = (view.ax + f.ex - f.camX) * scale;
    const shipY = (view.ay + f.ey - 40 - f.camY) * scale;
    const wakeR = 170 * scale;
    const wake = Math.min(1600, Math.abs(f.vx)) * (0.6 + f.style.power);
    for (const p of this.ps) {
      p.life += dt;
      if (wake > 40 && p.kind !== 'wind') {
        const dx = p.x - shipX, dy = p.y - shipY;
        const d = Math.hypot(dx, dy);
        if (d < wakeR && d > 1) {
          const k = (1 - d / wakeR) * wake * dt * 1.4;
          p.vx += (dx / d) * k - k * 0.6;
          p.vy += (dy / d) * k;
        }
      }
      // wake impulses fade so particles return to their own drift
      if (p.kind !== 'wind' && p.kind !== 'firefly') { p.vx = approachV(p.vx, p.bvx, dt); p.vy = approachV(p.vy, p.bvy, dt); }
      p.x += p.vx * dt * scale - dCam * p.depth;
      p.y += p.vy * dt * scale;
      p.rot += p.vr * dt;
      if (p.kind === 'firefly') { p.vx += (Math.random() - 0.5) * 30 * dt; p.vy += (Math.random() - 0.5) * 30 * dt; }
      if (p.kind === 'leaf' || p.kind === 'snow') p.x += Math.sin(f.t * 1.4 + p.hue * 6) * 18 * dt * scale;
      // wrap horizontally so travel doesn't empty the sky
      if (p.x < -40) p.x += w + 80;
      if (p.x > w + 40) p.x -= w + 80;
    }
    this.ps = this.ps.filter((p) => p.life < p.max && p.y < h + 40 && p.y > -60);
    for (const p of this.ps) this.paint(ctx, p, f.t);
    // celebration sparks
    for (const b of this.bursts) {
      b.life += dt; b.vy += 260 * dt; b.vx *= 0.985;
      b.x += b.vx * dt - dCam; b.y += b.vy * dt;
      const a = 1 - b.life / b.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = b.hue > 0.5 ? '#FFE7A6' : '#FFF8EA';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.6 + a * 0.6), 0, 6.283); ctx.fill();
    }
    this.bursts = this.bursts.filter((b) => b.life < b.max);
    ctx.globalAlpha = 1;
  }

  private spawn(kind: Kind, w: number, h: number): P {
    const p = this.spawnRaw(kind, w, h);
    p.bvx = p.vx; p.bvy = p.vy;
    return p;
  }

  private spawnRaw(kind: Kind, w: number, h: number): P {
    const r = Math.random;
    const base = { kind, life: 0, rot: r() * 6, vr: (r() - 0.5) * 3, depth: 0.6 + r() * 0.9, hue: r() } as P;
    switch (kind) {
      case 'firefly': return { ...base, x: r() * w, y: h * (0.45 + r() * 0.4), vx: (r() - 0.5) * 12, vy: -4 - r() * 8, r: 1 + r() * 1.1, max: 4 + r() * 4 };
      case 'leaf': return { ...base, x: r() * w * 1.2, y: -20, vx: -18 - r() * 22, vy: 30 + r() * 30, r: 3 + r() * 3, max: 14 };
      case 'pollen': return { ...base, x: r() * w, y: h * (0.2 + r() * 0.6), vx: -10 - r() * 14, vy: -3 + r() * 6, r: 1 + r() * 1.4, max: 5 + r() * 4 };
      case 'wind': return { ...base, x: w + 20, y: h * (0.1 + r() * 0.7), vx: -380 - r() * 260, vy: 0, r: 40 + r() * 80, max: 3 };
      case 'snow': return { ...base, x: r() * w * 1.3, y: -10, vx: -26 - r() * 20, vy: 36 + r() * 40, r: 1 + r() * 2.2, max: 20 };
      case 'spark': return { ...base, x: r() * w, y: h * (0.5 + r() * 0.5), vx: (r() - 0.5) * 10, vy: -14 - r() * 16, r: 0.8 + r() * 1.6, max: 5 + r() * 4 };
    }
  }

  private paint(ctx: CanvasRenderingContext2D, p: P, t: number) {
    const fade = Math.min(1, p.life * 1.5, (p.max - p.life) * 1.5);
    switch (p.kind) {
      case 'firefly': {
        const a = fade * (0.5 + 0.5 * Math.sin(t * 3 + p.hue * 9));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        g.addColorStop(0, `rgba(255,232,150,${0.9 * a})`);
        g.addColorStop(1, 'rgba(255,232,150,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.283); ctx.fill();
        return;
      }
      case 'leaf': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(Math.sin(p.rot * 1.3)) * 0.7 + 0.3);
        ctx.globalAlpha = fade * 0.9;
        ctx.fillStyle = p.hue > 0.6 ? '#D99A4E' : p.hue > 0.3 ? '#7FA35E' : '#C9B45A';
        ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.6, p.r * 0.7, 0, 0, 6.283); ctx.fill();
        ctx.restore();
        return;
      }
      case 'pollen':
        ctx.globalAlpha = fade * 0.75;
        ctx.fillStyle = '#FFF4D0';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        return;
      case 'wind': {
        ctx.globalAlpha = fade * 0.28;
        ctx.strokeStyle = '#FFF6EA';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + p.r * 0.5, p.y - 4, p.x + p.r, p.y); ctx.stroke();
        return;
      }
      case 'snow':
        ctx.globalAlpha = fade * 0.9;
        ctx.fillStyle = '#FFF8FB';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        return;
      case 'spark': {
        const a = fade * (0.6 + 0.4 * Math.sin(t * 4 + p.hue * 9));
        ctx.globalAlpha = a;
        ctx.fillStyle = p.hue > 0.5 ? '#FFE7A6' : '#BFD3FF';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        return;
      }
    }
  }
}
