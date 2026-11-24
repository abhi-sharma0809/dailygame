import type { ReactNode } from 'react';
import { rng } from '../world';

/* Reusable illustrated pieces. Light comes from the sun ahead (upper right):
 * right-hand faces carry the rim light, left-hand faces fall into shade. */

export interface TreePal { dark: string; mid: string; light: string; rim: string; trunk: string }

export function Pine({ x, y, h, pal, k = 0 }: { x: number; y: number; h: number; pal: TreePal; k?: number }) {
  const w = h * 0.46;
  const tiers = 4;
  const out: ReactNode[] = [];
  for (let i = 0; i < tiers; i++) {
    const t0 = -h + (i * h * 0.78) / tiers;
    const t1 = t0 + h * 0.36 + i * 4;
    const tw = (w * (0.42 + (i / (tiers - 1)) * 0.58)) / 2;
    const droop = 4 + i * 1.5;
    out.push(
      <g key={i}>
        <path d={`M0 ${t0} C ${tw * 0.25} ${t0 + (t1 - t0) * 0.4}, ${tw * 0.7} ${t1 - droop}, ${tw} ${t1} Q ${tw * 0.4} ${t1 - 3} 0 ${t1 - 1} Q ${-tw * 0.4} ${t1 - 3} ${-tw} ${t1} C ${-tw * 0.7} ${t1 - droop}, ${-tw * 0.25} ${t0 + (t1 - t0) * 0.4}, 0 ${t0} Z`} fill={pal.mid} />
        <path d={`M0 ${t0} C ${-tw * 0.25} ${t0 + (t1 - t0) * 0.4}, ${-tw * 0.7} ${t1 - droop}, ${-tw} ${t1} Q ${-tw * 0.4} ${t1 - 3} 0 ${t1 - 1} Z`} fill={pal.dark} />
        <path d={`M0 ${t0} C ${tw * 0.25} ${t0 + (t1 - t0) * 0.4}, ${tw * 0.7} ${t1 - droop}, ${tw} ${t1}`} fill="none" stroke={pal.rim} strokeWidth={1.1} strokeOpacity={0.32} />
      </g>,
    );
  }
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <rect x={-h * 0.025} y={-h * 0.14} width={h * 0.05} height={h * 0.15} fill={pal.trunk} />
      {out}
      {k > 0.7 && <path d={`M${w * 0.06} ${-h * 0.72} l ${w * 0.1} ${h * 0.08}`} stroke={pal.light} strokeWidth="1.4" strokeOpacity="0.5" />}
    </g>
  );
}

export function Broadleaf({ x, y, h, pal, seed = 1 }: { x: number; y: number; h: number; pal: TreePal; seed?: number }) {
  const r = rng(seed);
  const cr = h * 0.34;
  const cy = -h + cr;
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + r();
    return { x: Math.cos(a) * cr * 0.55, y: cy + Math.sin(a) * cr * 0.4, r: cr * (0.55 + r() * 0.25) };
  });
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <path d={`M${-h * 0.035} 0 L ${-h * 0.02} ${cy + cr * 0.5} L ${h * 0.02} ${cy + cr * 0.5} L ${h * 0.04} 0 Z`} fill={pal.trunk} />
      <path d={`M0 ${cy + cr * 0.6} l ${-cr * 0.35} ${-cr * 0.4} M0 ${cy + cr * 0.7} l ${cr * 0.4} ${-cr * 0.45}`} stroke={pal.trunk} strokeWidth={h * 0.02} />
      {blobs.map((b, i) => <circle key={`d${i}`} cx={b.x - 2} cy={b.y + 3} r={b.r} fill={pal.dark} />)}
      <circle cx={0} cy={cy} r={cr * 0.82} fill={pal.mid} />
      {blobs.slice(0, 3).map((b, i) => <circle key={`m${i}`} cx={b.x * 0.8 + 2} cy={b.y - 2} r={b.r * 0.8} fill={pal.mid} />)}
      <circle cx={cr * 0.32} cy={cy - cr * 0.36} r={cr * 0.42} fill={pal.light} opacity={0.75} />
      <path d={`M${cr * 0.3} ${cy - cr * 0.85} A ${cr * 0.9} ${cr * 0.9} 0 0 1 ${cr * 0.98} ${cy + cr * 0.1}`} fill="none" stroke={pal.rim} strokeWidth={2} strokeOpacity={0.6} strokeLinecap="round" />
    </g>
  );
}

export function Rock({ x, y, w, h, fill, shade, rim }: { x: number; y: number; w: number; h: number; fill: string; shade: string; rim?: string }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <path d={`M${-w / 2} 2 L ${-w * 0.38} ${-h * 0.7} L ${-w * 0.08} ${-h} L ${w * 0.3} ${-h * 0.82} L ${w / 2} 2 Z`} fill={fill} />
      <path d={`M${-w / 2} 2 L ${-w * 0.38} ${-h * 0.7} L ${-w * 0.08} ${-h} L ${-w * 0.02} 2 Z`} fill={shade} />
      {rim && <path d={`M${-w * 0.08} ${-h} L ${w * 0.3} ${-h * 0.82} L ${w / 2} 2`} fill="none" stroke={rim} strokeWidth="1.5" strokeOpacity="0.6" />}
    </g>
  );
}

/** A cumulus made of overlapping puffs; shade below, light above. */
export function Cumulus({ x, y, w, h, light, shade, seed = 1, rim }: { x: number; y: number; w: number; h: number; light: string; shade: string; seed?: number; rim?: string }) {
  const r = rng(seed);
  const n = Math.max(4, Math.round(w / 38));
  const puffs = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const bell = Math.sin(Math.PI * t);
    const pr = (h * 0.42 + r() * h * 0.22) * (0.55 + bell * 0.55);
    return { x: -w / 2 + t * w + (r() - 0.5) * 12, y: -pr * 0.85 - bell * h * 0.18, r: pr };
  });
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      {puffs.map((p, i) => <circle key={`s${i}`} cx={p.x - p.r * 0.04} cy={p.y + p.r * 0.12} r={p.r} style={{ fill: shade, transition: 'fill 2.6s' }} />)}
      <rect x={-w / 2 - 6} y={-h * 0.22} width={w + 12} height={h * 0.3} rx={h * 0.15} style={{ fill: shade, transition: 'fill 2.6s' }} />
      {puffs.map((p, i) => <circle key={`l${i}`} cx={p.x + p.r * 0.08} cy={p.y - p.r * 0.06} r={p.r * 0.9} style={{ fill: light, transition: 'fill 2.6s' }} />)}
      {rim && puffs.filter((_, i) => i % 2 === 0).map((p, i) => <circle key={`r${i}`} cx={p.x + p.r * 0.3} cy={p.y - p.r * 0.38} r={p.r * 0.46} style={{ fill: rim, opacity: 0.22, transition: 'fill 2.6s' }} />)}
    </g>
  );
}

export function Reeds({ x, y, n = 5, color, seed = 1 }: { x: number; y: number; n?: number; color: string; seed?: number }) {
  const r = rng(seed);
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} stroke={color} strokeLinecap="round" fill="none">
      {Array.from({ length: n }, (_, i) => {
        const dx = (i - n / 2) * 4 + r() * 3;
        const hh = 22 + r() * 22;
        const bend = (r() - 0.3) * 10;
        return (
          <g key={i}>
            <path d={`M${dx} 0 Q ${dx + bend * 0.3} ${-hh * 0.6} ${dx + bend} ${-hh}`} strokeWidth="1.6" />
            {r() > 0.55 && <ellipse cx={dx + bend * 0.85} cy={-hh * 0.86} rx="1.8" ry="5" fill={color} stroke="none" transform={`rotate(${bend * 1.5} ${dx + bend * 0.85} ${-hh * 0.86})`} />}
          </g>
        );
      })}
    </g>
  );
}

/** Hanging cloth banner on a pole, naming a destination. */
export function Waymark({ x, y, numeral, name, lit, cloth, ink, pole = '#4A3A2C', glow = '#FCE7B8', h = 118 }: { x: number; y: number; numeral: string; name: string; lit: boolean; cloth: string; ink: string; pole?: string; glow?: string; h?: number }) {
  const w = Math.max(92, name.replace(/^The /, '').length * 7.4 + 30);
  const t = -h;
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="4" cy="2" rx="10" ry="3" fill="#000" opacity="0.2" />
      <rect x="-2.5" y={t} width="5" height={h + 2} fill={pole} />
      <rect x="-2.5" y={t} width="2" height={h + 2} fill="#000" opacity="0.18" />
      <path d={`M0 ${t + 6} L ${w} ${t + 6}`} stroke={pole} strokeWidth="4" strokeLinecap="round" />
      <circle cx={w} cy={t + 6} r="3.5" fill={pole} />
      {/* cloth with a swallowtail */}
      <path d={`M6 ${t + 8} L ${w - 6} ${t + 8} L ${w - 6} ${t + 52} L ${w / 2 + 3} ${t + 62} L 6 ${t + 52} Z`} fill={lit ? '#E9C27A' : cloth} style={{ transition: 'fill 1.2s' }} />
      <path d={`M6 ${t + 8} L ${w - 6} ${t + 8} L ${w - 6} ${t + 14} L 6 ${t + 14} Z`} fill="#000" opacity="0.12" />
      <text x={w / 2 + 3} y={t + 33} textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontWeight="700" fontSize="17" fill={lit ? '#2A2116' : ink}>{numeral}</text>
      <text x={w / 2 + 3} y={t + 48} textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontStyle="italic" fontWeight="600" fontSize="10.5" fill={lit ? '#2A2116' : ink} opacity="0.9">{name.replace(/^The /, '')}</text>
      {lit && <circle cx="0" cy={t - 4} r="9" fill={glow} opacity="0.9" />}
      <circle cx="0" cy={t - 4} r="4" fill={lit ? '#FFF6DD' : pole} />
    </g>
  );
}

export function GrassTufts({ x0, x1, yAt, color, seed = 1, step = 26 }: { x0: number; x1: number; yAt: (x: number) => number | null; color: string; seed?: number; step?: number }) {
  const out: ReactNode[] = [];
  const start = Math.floor(x0 / step) * step;
  for (let x = start; x < x1; x += step) {
    const r = rng(Math.floor(x) * 7 + seed);
    const y = yAt(x + r() * 10);
    if (y == null) continue;
    const xx = x + r() * step;
    const h = 5 + r() * 7;
    out.push(<path key={x} d={`M${xx - 4} ${y + 2} q 2 ${-h * 0.6} 1 ${-h} M${xx} ${y + 2} q 1 ${-h * 0.8} 3 ${-h * 1.2} M${xx + 3} ${y + 2} q 2 ${-h * 0.5} 5 ${-h * 0.8}`} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />);
  }
  return <g>{out}</g>;
}
