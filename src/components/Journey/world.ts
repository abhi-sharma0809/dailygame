/* ============================================================
 * The Journey — a side-on world the explorer crosses during play.
 *
 * World units: x grows to the right along the journey, y grows downward;
 * y = 0 is the meadow floor of the Forgotten Forest. The airship rides a
 * route that climbs from the forest (dawn) to the Summit (aurora night).
 * One "leg" (100 points) is LEG units long, so a daily day's journey is a
 * literal day: dawn → morning → afternoon → sunset → dusk → night → aurora.
 * ============================================================ */

export const LEG = 1300;
export const X0 = 760;
/** x of each destination's dock (reached at i × 100 points) */
export const LM_X = Array.from({ length: 7 }, (_, i) => X0 + i * LEG);
/** the beacon at the very top of the Summit (700 points) */
export const BEACON_X = LM_X[6] + Math.round(LEG * 0.82);
/** airship altitude (route y) at each destination */
export const ROUTE_Y = [-200, -185, -380, -575, -745, -880, -1030];
export const BEACON_Y = -1250;
export const WORLD_START = -1400;
export const WORLD_END = BEACON_X + 2200;
/** the cloud sea's surface, from the Old Kingdom's cliff onward */
export const CLOUD_SEA_Y = -250;
export const CLIFF_X = LM_X[2] + 470;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Journey points → distance along the world. */
export function scoreToX(score: number): number {
  const s = clamp(score, 0, 700);
  if (s >= 600) return LM_X[6] + (BEACON_X - LM_X[6]) * ((s - 600) / 100);
  return X0 + (s / 100) * LEG;
}

const KNOTS: [number, number][] = [
  [WORLD_START, ROUTE_Y[0] + 10],
  ...LM_X.map((x, i) => [x, ROUTE_Y[i]] as [number, number]),
  [BEACON_X, BEACON_Y],
  [WORLD_END, BEACON_Y],
];

/** The route's altitude at x: eased between docks with a gentle mid-leg lift. */
export function routeY(x: number): number {
  if (x <= KNOTS[0][0]) return KNOTS[0][1];
  for (let i = 0; i < KNOTS.length - 1; i++) {
    const [ax, ay] = KNOTS[i];
    const [bx, by] = KNOTS[i + 1];
    if (x <= bx) {
      const t = (x - ax) / (bx - ax);
      const arc = i >= 1 && i <= 6 ? 46 : 0;
      return lerp(ay, by, smoother(t)) - Math.sin(Math.PI * t) * arc;
    }
  }
  return KNOTS[KNOTS.length - 1][1];
}

/** Continuous region index: 0 at the forest dock … 6 at the summit. */
export const regionAt = (x: number) => clamp((x - X0) / LEG, 0, 6.6);
/** Discrete region the camera is in (boundaries half-way between docks). */
export const regionIndex = (x: number) => clamp(Math.round((x - X0) / LEG), 0, 6);

/* ------------------------------------------------------------ time of day */

export interface SkyStop { top: string; mid: string; low: string; horizon: string; sun: string; haze: string }

/** Sky for each destination: dawn, morning, afternoon, sunset, dusk, night, aurora. */
export const SKIES: SkyStop[] = [
  { top: '#22364E', mid: '#5B7487', low: '#C9A88A', horizon: '#F2C894', sun: '#FFE2A8', haze: '#E9C29A' },
  { top: '#3C78A3', mid: '#79AFCB', low: '#C7DEE3', horizon: '#F4E7C6', sun: '#FFF4D6', haze: '#D9E6E0' },
  { top: '#3F78A0', mid: '#8DB6C4', low: '#E5D7AE', horizon: '#F6D58E', sun: '#FFEAB0', haze: '#EFD9A6' },
  { top: '#4A6593', mid: '#B48AA0', low: '#EDB18A', horizon: '#F8CE93', sun: '#FFD18A', haze: '#F0BE96' },
  { top: '#272C58', mid: '#6D4A7E', low: '#C5677A', horizon: '#F09A6C', sun: '#FF9F6B', haze: '#B86D84' },
  { top: '#060A1C', mid: '#0F1838', low: '#1E2752', horizon: '#38386D', sun: '#C8D4FF', haze: '#2A2F5C' },
  { top: '#03060F', mid: '#08142A', low: '#0E2A3C', horizon: '#1F4A55', sun: '#BFF5E2', haze: '#163A48' },
];

export interface Destination { numeral: string; name: string; blurb: string }
export const DEST: Destination[] = [
  { numeral: 'I', name: 'The Forgotten Forest', blurb: 'Every journey begins among the old trees.' },
  { numeral: 'II', name: 'The Glass Lake', blurb: 'Still water reflects what you already know.' },
  { numeral: 'III', name: 'The Old Kingdom', blurb: 'Ruins full of half-remembered links.' },
  { numeral: 'IV', name: 'The Cloud Passage', blurb: 'Bridges between islands of thought.' },
  { numeral: 'V', name: 'The Crystal Peaks', blurb: 'Connections that catch the light.' },
  { numeral: 'VI', name: 'The Starfields', blurb: 'Patterns emerge from the scattered points.' },
  { numeral: 'VII', name: 'The Summit', blurb: 'Everything has something in common.' },
];

/* ------------------------------------------------------------ helpers */

/** Seeded RNG so procedural scenery is identical on every render. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1-D value noise in [-1, 1]. */
export function noise1(x: number, seed = 1) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => { const s = Math.sin((n + seed * 101.3) * 127.1) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
  return lerp(h(i), h(i + 1), smooth(f));
}

/** Mix two #rrggbb colors. */
export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (sh: number) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, t));
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}
