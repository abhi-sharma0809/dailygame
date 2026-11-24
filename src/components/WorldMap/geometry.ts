/* Geometry of the Atlas: landmark anchors and the winding trail between them.
 * Canvas is 1600 × 1000. Landmark i is reached at i × 100 points; the trail
 * continues past the Summit camp to the beacon at 700. */

export const W = 1600;
export const H = 1000;

export interface Landmark { x: number; y: number; name: string; short: string; numeral: string; labelDy: number }

export const LANDMARKS: Landmark[] = [
  { x: 214, y: 842, name: 'The Forgotten Forest', short: 'Forest', numeral: 'I', labelDy: 46 },
  { x: 566, y: 806, name: 'The Glass Lake', short: 'Lake', numeral: 'II', labelDy: 46 },
  { x: 944, y: 708, name: 'The Old Kingdom', short: 'Kingdom', numeral: 'III', labelDy: 48 },
  { x: 640, y: 470, name: 'The Cloud Passage', short: 'Clouds', numeral: 'IV', labelDy: -40 },
  { x: 1004, y: 372, name: 'The Crystal Peaks', short: 'Peaks', numeral: 'V', labelDy: 48 },
  { x: 1268, y: 470, name: 'The Starfields', short: 'Starfields', numeral: 'VI', labelDy: 48 },
  { x: 1402, y: 296, name: 'The Summit', short: 'Summit', numeral: 'VII', labelDy: -40 },
];

/** Final beacon at the very top of the Summit (700 points). */
export const BEACON = { x: 1446, y: 156 };

/** Trail waypoints: landmarks plus a few shaping points so the path winds. */
export const WAYPOINTS: { x: number; y: number; landmark?: number }[] = [
  { x: 96, y: 930 },
  { ...LANDMARKS[0], landmark: 0 },
  { x: 380, y: 880 },
  { ...LANDMARKS[1], landmark: 1 },
  { x: 760, y: 790 },
  { ...LANDMARKS[2], landmark: 2 },
  { x: 860, y: 590 },
  { x: 780, y: 520 },
  { ...LANDMARKS[3], landmark: 3 },
  { x: 800, y: 420 },
  { ...LANDMARKS[4], landmark: 4 },
  { x: 1150, y: 430 },
  { ...LANDMARKS[5], landmark: 5 },
  { x: 1350, y: 400 },
  { ...LANDMARKS[6], landmark: 6 },
  { x: 1430, y: 220 },
  BEACON,
];

/** Smooth Catmull-Rom → cubic Bézier path through points. */
export function smoothPath(pts: { x: number; y: number }[], tension = 0.5): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export const TRAIL_D = smoothPath(WAYPOINTS);

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

/**
 * Convert a journey score to a distance along the trail. `landmarkLengths`
 * are the trail lengths at each landmark, `total` the full trail length.
 */
export function scoreToLength(score: number, landmarkLengths: number[], total: number): number {
  const s = Math.max(0, score);
  if (s <= 0) return landmarkLengths[0]; // every journey starts in the forest
  const i = Math.floor(s / 100);
  const f = (s % 100) / 100;
  if (i >= 6) return landmarkLengths[6] + (total - landmarkLengths[6]) * Math.min(1, (s - 600) / 100);
  const from = landmarkLengths[i];
  const to = landmarkLengths[i + 1];
  return from + (to - from) * f;
}
