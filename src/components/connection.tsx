import { TIER_COLORS } from '../game/scoring';
import type { ResultTier } from '../game/types';

/* ============================================================
 * How a connection *looks*, by tier. Presentation only — the score is
 * already decided; this is how the thread between the reference and the
 * answer shows it:
 *
 *   strong  → nodes close together, a direct, thick, glowing line,
 *             drawn fast, with a dense stream of bright particles
 *   weak    → nodes far apart, a long winding hairline, drawn slowly,
 *             dashed and faint, a particle or two at most
 *   none    → a grey thread that wanders out, frays and never arrives
 * ============================================================ */

export interface ConnectionLook {
  /** distance between the two nodes (thread viewBox units, 420 wide) */
  gap: number;
  /** how many times the thread bends, and how far */
  bends: number;
  wind: number;
  /** core and glow stroke widths, glow blur */
  width: number;
  glowWidth: number;
  blur: number;
  /** steady glow opacity once settled, and the extra flash on arrival */
  glow: number;
  flash: number;
  /** seconds to draw the thread */
  draw: number;
  /** draw easing: confident (fast start) or careful (slow in, slow out) */
  confident: boolean;
  /** particles running along the thread after it lands */
  particles: number;
  particleSize: number;
  /** seconds for one particle to cross */
  particlePeriod: number;
  /** dashes for a broken, delicate line */
  dash?: string;
  /** rings that pulse from the answer node */
  rings: number;
  /** answer-node bloom radius */
  bloom: number;
  /** fraction of the way the thread gets (only < 1 for no connection) */
  reach: number;
}

const L = (l: ConnectionLook) => l;

export const CONNECTION_LOOKS: Record<ResultTier, ConnectionLook> = {
  perfect: L({ gap: 236, bends: 0, wind: 0, width: 3.6, glowWidth: 12, blur: 3.4, glow: 0.55, flash: 0.45, draw: 0.5, confident: true, particles: 7, particleSize: 2.3, particlePeriod: 0.75, rings: 3, bloom: 40, reach: 1 }),
  nearly: L({ gap: 262, bends: 1, wind: 5, width: 3.0, glowWidth: 9, blur: 2.8, glow: 0.45, flash: 0.32, draw: 0.62, confident: true, particles: 5, particleSize: 2.0, particlePeriod: 0.9, rings: 2, bloom: 34, reach: 1 }),
  family: L({ gap: 288, bends: 1, wind: 9, width: 2.5, glowWidth: 7, blur: 2.2, glow: 0.36, flash: 0.22, draw: 0.8, confident: true, particles: 4, particleSize: 1.8, particlePeriod: 1.1, rings: 2, bloom: 28, reach: 1 }),
  close: L({ gap: 316, bends: 2, wind: 12, width: 1.9, glowWidth: 5, blur: 1.6, glow: 0.26, flash: 0.12, draw: 1.05, confident: false, particles: 2, particleSize: 1.6, particlePeriod: 1.5, rings: 1, bloom: 22, reach: 1 }),
  distant: L({ gap: 342, bends: 3, wind: 15, width: 1.4, glowWidth: 3.5, blur: 1.1, glow: 0.18, flash: 0, draw: 1.3, confident: false, particles: 1, particleSize: 1.4, particlePeriod: 2, dash: '7 3', rings: 1, bloom: 16, reach: 1 }),
  loose: L({ gap: 366, bends: 4, wind: 18, width: 1.05, glowWidth: 2.5, blur: 0.8, glow: 0.12, flash: 0, draw: 1.55, confident: false, particles: 0, particleSize: 1.2, particlePeriod: 2.4, dash: '2.5 4', rings: 0, bloom: 12, reach: 1 }),
  unranked: L({ gap: 366, bends: 4, wind: 18, width: 1.05, glowWidth: 2.5, blur: 0.8, glow: 0.12, flash: 0, draw: 1.55, confident: false, particles: 0, particleSize: 1.2, particlePeriod: 2.4, dash: '4 5', rings: 0, bloom: 12, reach: 1 }),
  none: L({ gap: 300, bends: 3, wind: 13, width: 1.2, glowWidth: 0, blur: 0, glow: 0, flash: 0, draw: 0.85, confident: false, particles: 0, particleSize: 0, particlePeriod: 1, dash: '3 4', rings: 0, bloom: 0, reach: 0.46 }),
};

/** Seeded RNG so a question's thread winds the same way every time. */
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth thread from x0 to x1 at height cy, bending `bends` times by about `wind`. */
export function threadPath(x0: number, x1: number, cy: number, look: Pick<ConnectionLook, 'bends' | 'wind'>, rand: () => number): string {
  if (look.bends === 0) return `M ${x0} ${cy} Q ${(x0 + x1) / 2} ${cy - 5} ${x1} ${cy}`;
  const pts: [number, number][] = [[x0, cy]];
  const sign = rand() < 0.5 ? -1 : 1;
  for (let i = 1; i <= look.bends; i++) {
    const x = x0 + ((x1 - x0) * i) / (look.bends + 1) + (rand() - 0.5) * 10;
    const y = cy + sign * (i % 2 ? -1 : 1) * look.wind * (0.75 + rand() * 0.5);
    pts.push([x, y]);
  }
  pts.push([x1, cy]);
  // Catmull-Rom → cubic Bézier
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * The same visual language in miniature, for lists: two nodes and the
 * thread between them — short, straight and bright for strong answers,
 * long, winding and faint for weak ones, frayed for none.
 */
export function StrengthGlyph({ tier, className = '' }: { tier: ResultTier; className?: string }) {
  const look = CONNECTION_LOOKS[tier];
  const color = TIER_COLORS[tier];
  const k = 52 / 420; // scale the reveal's geometry into a 52-wide glyph
  const cx = 28;
  const half = (look.gap * k) / 2;
  const x0 = cx - half, x1 = cx + half;
  const none = tier === 'none';
  // a miss wanders out and stops short of the answer
  const d = threadPath(x0, none ? x0 + (x1 - x0) * 0.55 : x1, 9, { bends: Math.min(look.bends, 3), wind: look.wind * 0.28 }, seeded(tier));
  const strong = look.glow >= 0.36;
  return (
    <svg viewBox="0 0 56 18" className={className} aria-hidden>
      {strong && <path d={d} fill="none" stroke={color} strokeWidth={look.width * 1.6} strokeLinecap="round" opacity={0.35} style={{ filter: `drop-shadow(0 0 ${look.blur * 0.9}px ${color})` }} />}
      <path d={d} fill="none" stroke={none ? '#7C8790' : color} strokeWidth={Math.max(0.7, look.width * 0.55)} strokeLinecap="round" strokeDasharray={none ? '1.6 2' : look.dash ? '2 1.6' : undefined} opacity={none ? 0.7 : 1} />
      {none ? (
        <>
          <circle cx={x0} cy="9" r="1.9" fill="#9AA3A8" />
          <circle cx={x1} cy="9" r="1.9" fill="none" stroke="#7C8790" strokeWidth="0.9" strokeDasharray="1.2 1.2" />
        </>
      ) : (
        <>
          <circle cx={x0} cy="9" r="1.9" fill="#F0E6D1" />
          <circle cx={x1} cy="9" r={1.6 + look.width * 0.35} fill={color} />
        </>
      )}
    </svg>
  );
}
