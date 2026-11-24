import type { ResultTier } from '../../game/types';

/* ============================================================
 * How the airship moves after an answer.
 *
 * Distance is never decided here: it always comes from the score
 * (`scoreToX(total)`). A TravelStyle only decides *how* the ship covers that
 * distance — how long it winds up, how hard it accelerates, how long it
 * glides, and how much light and spray it throws off — so a Perfect Match
 * feels like a burst and a Loose Connection like a gentle drift.
 * ============================================================ */

export interface TravelStyle {
  /** tier this style was made for (for debugging and tests) */
  key: ResultTier | 'replay' | 'default';
  /** 0 (no connection) … 1 (perfect): overall intensity of every effect */
  power: number;
  /** trail, glow and spark colour */
  color: string;
  /** wind-up before launch, ms (the ship rears back and the engine glows) */
  charge: number;
  /** flight time for one full 100-point leg, ms (scaled by distance) */
  duration: number;
  /** velocity curve v(u) ∝ u^accel · (1−u)^decel — low accel = sudden burst, high decel = long glide */
  accel: number;
  decel: number;
  /** seconds a point of trail stays visible */
  trail: number;
  /** sparks per second at full speed */
  sparks: number;
  /** particles in the launch burst */
  burst: number;
  /** camera shake at launch, world units */
  shake: number;
  /** soft bloom of light around the ship at launch, 0–1 */
  flash: number;
}

const S = (s: TravelStyle) => s;

/** One style per answer tier, strongest first. */
export const TRAVEL_STYLES: Record<ResultTier, TravelStyle> = {
  perfect: S({ key: 'perfect', power: 1, color: '#FFD978', charge: 560, duration: 2400, accel: 1, decel: 4.4, trail: 1.6, sparks: 95, burst: 64, shake: 7, flash: 0.5 }),
  nearly: S({ key: 'nearly', power: 0.84, color: '#F6CD7E', charge: 460, duration: 2450, accel: 1.15, decel: 3.6, trail: 1.2, sparks: 55, burst: 34, shake: 3.5, flash: 0.28 }),
  family: S({ key: 'family', power: 0.68, color: '#A9D49A', charge: 380, duration: 2400, accel: 1.45, decel: 2.9, trail: 0.95, sparks: 28, burst: 16, shake: 1.5, flash: 0.12 }),
  close: S({ key: 'close', power: 0.5, color: '#9FCBE0', charge: 300, duration: 2250, accel: 1.8, decel: 2.5, trail: 0.7, sparks: 10, burst: 0, shake: 0, flash: 0 }),
  distant: S({ key: 'distant', power: 0.36, color: '#BEB2DA', charge: 250, duration: 2200, accel: 2, decel: 2.2, trail: 0.5, sparks: 4, burst: 0, shake: 0, flash: 0 }),
  loose: S({ key: 'loose', power: 0.24, color: '#D8CAAE', charge: 220, duration: 2200, accel: 2.2, decel: 2.2, trail: 0.4, sparks: 0, burst: 0, shake: 0, flash: 0 }),
  unranked: S({ key: 'unranked', power: 0.24, color: '#D8CAAE', charge: 220, duration: 2200, accel: 2.2, decel: 2.2, trail: 0.4, sparks: 0, burst: 0, shake: 0, flash: 0 }),
  none: S({ key: 'none', power: 0, color: '#9AA3A8', charge: 0, duration: 0, accel: 2, decel: 2, trail: 0, sparks: 0, burst: 0, shake: 0, flash: 0 }),
};

/** Used when the world moves without an answer behind it (previews, resumes). */
export const DEFAULT_STYLE: TravelStyle = { ...TRAVEL_STYLES.close, key: 'default', charge: 0 };

/** The end-of-quest flight from the forest to wherever the player landed. */
export function replayStyle(total: number): TravelStyle {
  const p = Math.max(0.3, Math.min(1, total / 700));
  return { ...TRAVEL_STYLES.nearly, key: 'replay', power: p, charge: 420, duration: 1900, accel: 1.4, decel: 2.6, shake: p > 0.85 ? 3 : 0, flash: p > 0.85 ? 0.25 : 0 };
}

export const styleForTier = (t: ResultTier): TravelStyle => TRAVEL_STYLES[t];

/** Flight time for a given distance (world units; LEG = one 100-point leg). */
export function flightDuration(style: TravelStyle, distance: number, leg: number): number {
  const k = Math.max(0.62, Math.min(1.75, Math.sqrt(distance / leg)));
  return style.duration * k;
}

/* ------------------------------------------------------------ velocity profiles */

const N = 160;
const tables = new Map<string, { cum: Float64Array; vel: Float64Array }>();

/** Normalised cumulative distance P(u) and speed v(u)/vmax for a curve; P is strictly monotonic. */
function table(accel: number, decel: number) {
  const key = `${accel}|${decel}`;
  let t = tables.get(key);
  if (t) return t;
  const vel = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) { const u = i / N; vel[i] = Math.pow(u, accel) * Math.pow(1 - u, decel); }
  const cum = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) cum[i] = cum[i - 1] + (vel[i - 1] + vel[i]) / 2;
  const total = cum[N];
  let vmax = 0;
  for (let i = 0; i <= N; i++) { cum[i] /= total; vmax = Math.max(vmax, vel[i]); }
  for (let i = 0; i <= N; i++) vel[i] /= vmax;
  t = { cum, vel };
  tables.set(key, t);
  return t;
}

const sample = (arr: Float64Array, u: number) => {
  const x = Math.max(0, Math.min(1, u)) * N;
  const i = Math.min(N - 1, Math.floor(x));
  return arr[i] + (arr[i + 1] - arr[i]) * (x - i);
};

/** Fraction of the flight covered at time fraction u (0→0, 1→1, never decreasing). */
export const progressAt = (style: TravelStyle, u: number) => (u >= 1 ? 1 : u <= 0 ? 0 : sample(table(style.accel, style.decel).cum, u));
/** Speed at time fraction u, relative to the flight's top speed (0–1). */
export const speedAt = (style: TravelStyle, u: number) => sample(table(style.accel, style.decel).vel, u);
