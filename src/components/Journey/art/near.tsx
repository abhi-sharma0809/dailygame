import type { ReactNode } from 'react';
import type { Actor } from '../Layer';
import { BEACON_X, CLIFF_X, LM_X, WORLD_END, WORLD_START, clamp, lerp, noise1, rng, smooth } from '../world';
import { Broadleaf, Cumulus, GrassTufts, Pine, Reeds, Rock, Waymark, type TreePal } from './shapes';

/* ============================================================
 * The near layer (parallax 1:1 with the explorer): terrain, the seven
 * destinations, props. Time of day is painted by place: dawn forest,
 * morning lake, golden kingdom, sunset clouds, dusk peaks, night
 * starfields, aurora summit.
 * ============================================================ */

/* ------------------------------------------------------------ terrain */

export function groundY(x: number): number | null {
  if (x > CLIFF_X) return null;
  let y = noise1(x / 260, 3) * 9 + noise1(x / 80, 7) * 2.5;
  const dl = (x - LM_X[1]) / 430;
  if (Math.abs(dl) < 1) y += 62 * (1 - dl * dl) ** 2;
  const hs = LM_X[2] - 760;
  const rise = smooth(clamp((x - hs) / 640, 0, 1));
  const fall = smooth(clamp((x - (LM_X[2] + 200)) / (CLIFF_X - LM_X[2] - 200), 0, 1));
  return y - 165 * rise + 40 * fall;
}

const SEA_KNOTS: [number, number][] = [[CLIFF_X - 420, -10], [LM_X[3], -320], [LM_X[4], -470], [LM_X[5], -600], [LM_X[6], -720], [BEACON_X, -790], [WORLD_END + 2000, -800]];
/** the cloud sea's surface beyond the cliff */
export function cloudSeaY(x: number): number {
  if (x <= SEA_KNOTS[0][0]) return SEA_KNOTS[0][1];
  for (let i = 0; i < SEA_KNOTS.length - 1; i++) {
    const [ax, ay] = SEA_KNOTS[i];
    const [bx, by] = SEA_KNOTS[i + 1];
    if (x <= bx) return lerp(ay, by, smooth((x - ax) / (bx - ax)));
  }
  return -800;
}

/** the high country: crystal peaks, the starfield mesa and the summit massif */
const PEAKS = [
  { cx: 5400, top: -560, w: 560, seed: 3 },
  { cx: LM_X[4], top: -640, w: 760, seed: 5 },
  { cx: 6430, top: -650, w: 500, seed: 9 },
];
const MESA = { x0: 6680, x1: 7820, top: -760 };
function massifY(x: number): number | null {
  if (x < 7700 || x > BEACON_X + 620) return null;
  if (x < 7820) return MESA.top;
  if (x < LM_X[6] - 80) return lerp(MESA.top, -930, smooth((x - 7820) / (LM_X[6] - 80 - 7820)));
  if (x < LM_X[6] + 80) return -930 + noise1(x / 40, 2) * 2;
  if (x < BEACON_X - 40) return lerp(-930, -1110, smooth((x - LM_X[6] - 80) / (BEACON_X - 40 - LM_X[6] - 80)));
  if (x < BEACON_X + 50) return -1110;
  return lerp(-1110, -560, smooth((x - BEACON_X - 50) / 570));
}
const WATER_Y = 18;
const LAKE = (() => {
  let a = LM_X[1], b = LM_X[1];
  while ((groundY(a - 1) ?? 0) > WATER_Y) a--;
  while ((groundY(b + 1) ?? 0) > WATER_Y) b++;
  return { a, b };
})();

/* ------------------------------------------------------------ palettes */

const PAL = {
  forest: { dark: '#1E3A31', mid: '#2C5142', light: '#5F8A62', rim: '#F0BE8E', trunk: '#3A2B22' } as TreePal,
  forestBack: { dark: '#3A5856', mid: '#46645F', light: '#6E8B7C', rim: '#E9C29A', trunk: '#3E4A48' } as TreePal,
  forestFront: { dark: '#14271F', mid: '#1C3529', light: '#365E46', rim: '#E7AE7E', trunk: '#241913' } as TreePal,
  lake: { dark: '#2F5A41', mid: '#3F7350', light: '#7FAE6C', rim: '#FFF1CF', trunk: '#4A3627' } as TreePal,
  kingdom: { dark: '#4C6234', mid: '#647D3F', light: '#A6B25E', rim: '#FFE09A', trunk: '#4A3627' } as TreePal,
  island: { dark: '#4C5A3B', mid: '#6B7B47', light: '#A9A15E', rim: '#FFD6A0', trunk: '#4A3627' } as TreePal,
};

/* ------------------------------------------------------------ items */

type Item = { a: number; b: number; node: ReactNode | ((x0: number, x1: number) => ReactNode) };

const ground = (x0: number, x1: number) => {
  const a = Math.max(x0, WORLD_START - 800);
  const b = Math.min(x1, CLIFF_X);
  if (b <= a) return null;
  const pts: string[] = [];
  for (let x = a; x <= b; x += 8) pts.push(`${x.toFixed(0)} ${groundY(x)!.toFixed(1)}`);
  pts.push(`${b.toFixed(0)} ${groundY(b)!.toFixed(1)}`);
  const top = `M${pts.join(' L')}`;
  let cliff = '';
  if (b >= CLIFF_X) {
    const g = groundY(CLIFF_X)!;
    cliff = ` L ${CLIFF_X + 8} ${g + 24} L ${CLIFF_X - 2} ${g + 58} L ${CLIFF_X + 14} ${g + 96} L ${CLIFF_X + 2} ${g + 150} L ${CLIFF_X + 18} ${g + 210} L ${CLIFF_X + 6} ${g + 300} L ${CLIFF_X + 20} 2600`;
  }
  return (
    <g>
      <path d={`${top}${cliff} L ${b === CLIFF_X ? CLIFF_X + 20 : b} 2600 L ${a} 2600 Z`} fill="url(#nr-ground)" />
      <path d={`${top}${cliff} L ${b === CLIFF_X ? CLIFF_X + 20 : b} 2600 L ${a} 2600 Z`} fill="url(#nr-depth)" />
      <path d={top} fill="none" stroke="url(#nr-rim)" strokeWidth="3" strokeOpacity="0.6" />
      {b >= CLIFF_X && (() => {
        const g = groundY(CLIFF_X)!;
        return (
          <g>
            <path d={`M${CLIFF_X - 150} ${g + 10} Q ${CLIFF_X - 60} ${g + 4} ${CLIFF_X} ${g} L ${CLIFF_X + 8} ${g + 24} L ${CLIFF_X - 2} ${g + 58} L ${CLIFF_X + 14} ${g + 96} L ${CLIFF_X + 2} ${g + 150} L ${CLIFF_X + 18} ${g + 210} L ${CLIFF_X + 6} ${g + 300} L ${CLIFF_X + 20} ${g + 520} L ${CLIFF_X - 260} ${g + 520} Z`} fill="#7A6A52" />
            <path d={`M${CLIFF_X - 150} ${g + 10} Q ${CLIFF_X - 60} ${g + 4} ${CLIFF_X} ${g} L ${CLIFF_X - 40} ${g + 520} L ${CLIFF_X - 260} ${g + 520} Z`} fill="#5A4C3C" opacity="0.6" />
            {[30, 80, 140, 210].map((dy, i) => <path key={i} d={`M${CLIFF_X - 140 + i * 6} ${g + dy} l 60 ${4 + i} l 50 -6 l 30 8`} stroke="#3E3226" strokeOpacity="0.45" strokeWidth="2" fill="none" />)}
            <path d={`M${CLIFF_X} ${g} L ${CLIFF_X + 8} ${g + 24} L ${CLIFF_X - 2} ${g + 58} L ${CLIFF_X + 14} ${g + 96}`} stroke="#FFE09A" strokeOpacity="0.5" strokeWidth="2" fill="none" />
            <path d={`M${CLIFF_X - 160} ${g + 12} Q ${CLIFF_X - 70} ${g - 2} ${CLIFF_X} ${g}`} stroke="#8EA25A" strokeWidth="6" fill="none" />
          </g>
        );
      })()}
      <GrassTufts x0={a} x1={b} yAt={(x) => { const y = groundY(x); return y == null || y > WATER_Y - 2 ? null : y; }} color="#24402F" seed={3} />
    </g>
  );
};

const cloudSea = (x0: number, x1: number) => {
  const a = Math.max(x0, CLIFF_X - 40);
  const b = x1;
  if (b <= a) return null;
  const pts: string[] = [];
  for (let x = a; x < b; x += 12) pts.push(`${x.toFixed(0)} ${(cloudSeaY(x) + 30).toFixed(1)}`);
  pts.push(`${b.toFixed(0)} ${(cloudSeaY(b) + 30).toFixed(1)}`);
  const rows: ReactNode[] = [];
  // the surface, then billows rolling toward the viewer, each row larger and nearer
  for (let k = 0; k < 4; k++) {
    const step = 64 + k * 40;
    const puffs: ReactNode[] = [];
    for (let x = Math.floor((a - 140) / step) * step; x < b + step; x += step) {
      const r = rng(x * 13 + 5 + k * 1009);
      const pr = (46 + r() * 44) * (1 + k * 0.45);
      const cx = x + r() * 30;
      const cy = cloudSeaY(cx) + pr * 0.4 + k * 74;
      puffs.push(
        <g key={x}>
          <circle cx={cx - 2} cy={cy + 5} r={pr} fill="url(#nr-cloud-shade)" />
          <circle cx={cx + 2} cy={cy - 1} r={pr * 0.965} fill="url(#nr-cloud)" />
          <circle cx={cx + pr * 0.24} cy={cy - pr * 0.34} r={pr * 0.5} fill="#FFFFFF" opacity={0.06} />
        </g>,
      );
    }
    rows.push(<g key={k}>{puffs}{k === 0 && <path d={`M${pts.join(' L')} L ${b} 2600 L ${a} 2600 Z`} fill="url(#nr-cloud-body)" />}</g>);
  }
  return <g>{rows}</g>;
};

function peak(p: (typeof PEAKS)[number]) {
  const r = rng(p.seed);
  const base = 260;
  const hw = p.w / 2;
  const ridge: [number, number][] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = p.cx - hw + t * p.w;
    const tri = 1 - Math.abs(t - 0.5) * 2;
    ridge.push([x, p.top + (1 - tri) * (base + 300) * (0.75 + r() * 0.15) + (i === n / 2 ? 0 : (r() - 0.5) * 34)]);
  }
  ridge[Math.round(n / 2)] = [p.cx, p.top];
  const d = `M${ridge.map(([x, y]) => `${x.toFixed(0)} ${y.toFixed(0)}`).join(' L')} L ${p.cx + hw} 2600 L ${p.cx - hw} 2600 Z`;
  const snowLine = p.top + 92;
  const snow = ridge.filter(([, y]) => y < snowLine + 40);
  return (
    <g>
      <path d={d} fill="url(#nr-rock)" />
      {/* shadow side */}
      <path d={`M${p.cx} ${p.top} L ${p.cx - 26} ${p.top + 140} L ${p.cx - 6} ${p.top + 300} L ${p.cx - 40} 2600 L ${p.cx - hw} 2600 L ${ridge[0][0]} ${ridge[0][1]} ${ridge.slice(1, Math.round(n / 2)).map(([x, y]) => `L ${x} ${y}`).join(' ')} Z`} fill="#2A2347" opacity="0.5" />
      {snow.length > 1 && (
        <path d={`M${p.cx - 64} ${snowLine} L ${p.cx - 40} ${snowLine - 30} L ${p.cx - 18} ${p.top + 22} L ${p.cx} ${p.top} L ${p.cx + 22} ${p.top + 26} L ${p.cx + 46} ${snowLine - 24} L ${p.cx + 70} ${snowLine + 6} L ${p.cx + 44} ${snowLine - 6} L ${p.cx + 26} ${snowLine + 16} L ${p.cx + 6} ${snowLine - 10} L ${p.cx - 16} ${snowLine + 14} L ${p.cx - 38} ${snowLine - 4} Z`} fill="#F4DCE0" />
      )}
      <path d={`M${p.cx - 64} ${snowLine} L ${p.cx - 40} ${snowLine - 30} L ${p.cx - 18} ${p.top + 22} L ${p.cx} ${p.top} L ${p.cx - 6} ${snowLine + 4} Z`} fill="#BC93B4" opacity="0.6" />
      <path d={`M${p.cx} ${p.top} L ${p.cx + 22} ${p.top + 26} L ${p.cx + 46} ${snowLine - 24} L ${p.cx + 70} ${snowLine + 6}`} fill="none" stroke="#FFC9A8" strokeWidth="2.5" strokeOpacity="0.7" />
    </g>
  );
}

const massif = (x0: number, x1: number) => {
  const a = Math.max(x0, 7700);
  const b = Math.min(x1, BEACON_X + 620);
  if (b <= a) return null;
  const pts: string[] = [];
  for (let x = a; x <= b + 9; x += 10) {
    const y = massifY(Math.min(x, b))!;
    const jag = x > MESA.x1 ? noise1(x / 34, 5) * 7 : noise1(x / 60, 8) * 2;
    pts.push(`${x.toFixed(0)} ${(y + jag).toFixed(1)}`);
  }
  const top = `M${pts.join(' L')}`;
  const deco: ReactNode[] = [];
  for (let x = Math.floor(a / 160) * 160; x < b; x += 160) {
    if (x < MESA.x1 + 40 || x > BEACON_X + 500) continue;
    const r = rng(x * 5 + 2);
    const y = massifY(x)!;
    // strata below the ridge
    deco.push(<path key={`st${x}`} d={`M${x - 70} ${y + 40 + r() * 30} q 70 ${-14 + r() * 10} 150 ${-4 + r() * 8}`} stroke="#04101A" strokeOpacity="0.45" strokeWidth="2" fill="none" />);
    // snow on the windward ledges
    if (r() > 0.35) deco.push(<path key={`sn${x}`} d={`M${x - 26} ${y + 4} q 26 -8 52 -2 q -20 10 -52 2 Z`} fill="#9CC8C2" opacity="0.55" />);
    // lanterns marking the climb
    if (Math.abs(x - LM_X[6]) > 120 && Math.abs(x - BEACON_X) > 90 && r() > 0.45) {
      const lx = x + 20;
      const ly = massifY(lx)!;
      deco.push(
        <g key={`ln${x}`} transform={`translate(${lx} ${ly})`}>
          <circle cy="-24" r="14" fill="url(#nr-gold-glow)" opacity="0.7" />
          <rect x="-1" y="-22" width="2" height="22" fill="#0A1622" />
          <rect x="-3.5" y="-29" width="7" height="8" rx="1.5" fill="#FFE2A0" />
        </g>,
      );
    }
  }
  return (
    <g>
      <path d={`${top} L ${b} 2600 L ${a} 2600 Z`} fill="url(#nr-massif)" />
      {deco}
      <path d={top} fill="none" stroke="url(#nr-massif-rim)" strokeWidth="3" strokeOpacity="0.85" />
    </g>
  );
};

function mesaBody() {
  const { x0, x1, top } = MESA;
  const edge: string[] = [];
  for (let x = x0 + 30; x <= x1; x += 14) edge.push(`${x} ${(top + Math.abs(noise1(x / 46, 31)) * 6).toFixed(1)}`);
  return (
    <g>
      <path d={`M${x0 - 70} 2600 L ${x0 - 46} ${top + 140} L ${x0 - 20} ${top + 70} L ${x0 - 4} ${top + 26} L ${x0 + 12} ${top + 8} L ${edge.join(' L ')} L ${x1} 2600 Z`} fill="url(#nr-massif)" />
      {/* the lit lip of the plateau */}
      <path d={`M${x0 - 4} ${top + 26} L ${x0 + 12} ${top + 8} L ${edge.join(' L ')}`} fill="none" stroke="url(#nr-massif-rim)" strokeWidth="3" />
      {/* strata and fissures in the cliff face */}
      {[22, 46, 80, 124].map((dy, i) => <path key={i} d={`M${x0 - 30 + i * 6} ${top + dy} C ${x0 + 300} ${top + dy + 12}, ${x0 + 700} ${top + dy - 10}, ${x1} ${top + dy + 4}`} stroke="#0A0F28" strokeOpacity={0.35 - i * 0.05} strokeWidth={2.5 - i * 0.4} fill="none" />)}
      {[x0 + 140, x0 + 420, x0 + 760, x0 + 980].map((fx, i) => <path key={`f${i}`} d={`M${fx} ${top + 6} l -6 30 l 8 26 l -4 40`} stroke="#0A0F28" strokeOpacity="0.4" strokeWidth="2" fill="none" />)}
      {/* standing rock spires along the rim */}
      {[[x0 + 70, 46, 14], [x0 + 300, 30, 10], [x0 + 860, 54, 15], [x1 - 60, 38, 12]].map(([sx, h, w], i) => (
        <g key={`s${i}`}>
          <path d={`M${sx - w} ${top + 2} L ${sx - w * 0.4} ${top - h} L ${sx + w * 0.3} ${top - h * 0.92} L ${sx + w} ${top + 2} Z`} fill="#222A5A" />
          <path d={`M${sx - w * 0.4} ${top - h} L ${sx + w * 0.3} ${top - h * 0.92} L ${sx + w} ${top + 2}`} fill="none" stroke="#9FB4FF" strokeOpacity="0.55" strokeWidth="1.4" />
        </g>
      ))}
      {/* glowing moss along the top */}
      <path d={`M${x0 + 12} ${top + 6} L ${edge.join(' L ')}`} fill="none" stroke="#6F86E8" strokeOpacity="0.25" strokeWidth="7" />
    </g>
  );
}

/* ------------------------------------------------------------ landmarks */

function Arch({ lit }: { lit: boolean }) {
  const x = LM_X[0];
  const y = groundY(x)! + 4;
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="10" cy="4" rx="78" ry="9" fill="#0C1A14" opacity="0.4" />
      {/* pillars of stacked stones */}
      {[-44, 44].map((px) => (
        <g key={px}>
          {[0, 1, 2, 3].map((i) => <rect key={i} x={px - 15 + (i % 2) * 2} y={-26 - i * 24} width={30 - (i % 2) * 2} height="25" rx="4" fill={i % 2 ? '#7C8A7C' : '#6D7B6F'} stroke="#2B3A33" strokeWidth="1.2" />)}
          <rect x={px + 6} y="-122" width="9" height="122" fill="#2B3A33" opacity="0.3" />
        </g>
      ))}
      {/* lintel arch */}
      <path d="M-62 -98 Q 0 -150 62 -98 L 54 -84 Q 0 -126 -54 -84 Z" fill="#7F8D80" stroke="#2B3A33" strokeWidth="1.4" />
      <path d="M-20 -126 L 20 -126 L 16 -102 L -16 -102 Z" fill="#8E9B8C" stroke="#2B3A33" strokeWidth="1.2" />
      {/* carved rune: two linked rings */}
      <g style={{ transition: 'opacity 1s' }}>
        {lit && <circle cx="0" cy="-114" r="22" fill="url(#nr-gold-glow)" />}
        <circle cx="-4" cy="-114" r="5" fill="none" stroke={lit ? '#FFE7A6' : '#4A574D'} strokeWidth="2" />
        <circle cx="4" cy="-114" r="5" fill="none" stroke={lit ? '#FFE7A6' : '#4A574D'} strokeWidth="2" />
      </g>
      {/* moss and ivy */}
      <path d="M-62 -98 Q -40 -128 -10 -136 Q 10 -132 22 -128" fill="none" stroke="#5E8A4C" strokeWidth="6" strokeLinecap="round" opacity="0.85" />
      <path d="M-50 -98 q -4 20 2 34 M-46 -96 q 6 14 2 26 M40 -100 q 6 14 2 30" stroke="#4E7A40" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M-30 -132 Q 0 -146 40 -116" fill="none" stroke="#F0BE8E" strokeWidth="2" strokeOpacity="0.5" />
      {/* lanterns at its feet */}
      {[-74, 74].map((lx) => (
        <g key={lx} transform={`translate(${lx} -2)`}>
          {lit && <circle cy="-16" r="16" fill="url(#nr-gold-glow)" />}
          <rect x="-1.2" y="-22" width="2.4" height="22" fill="#2B2018" />
          <rect x="-4.5" y="-30" width="9" height="10" rx="2" fill={lit ? '#FFE2A0' : '#4A4038'} stroke="#2B2018" strokeWidth="1" />
        </g>
      ))}
    </g>
  );
}

function Pavilion({ lit }: { lit: boolean }) {
  const x = LM_X[1];
  return (
    <g transform={`translate(${x} ${WATER_Y})`}>
      {/* reflection */}
      <g opacity="0.28" transform="scale(1 -0.55) translate(0 -8)">
        <path d="M-46 -12 L 46 -12 L 40 -96 L -40 -96 Z" fill="#DDEFF5" />
        <path d="M-52 -96 Q 0 -150 52 -96 Z" fill="#7FB3A6" />
      </g>
      {/* pier deck and posts */}
      <rect x="-170" y="-12" width="230" height="7" fill="#7A5A40" />
      <rect x="-170" y="-12" width="230" height="2.5" fill="#B48A5E" />
      {[-160, -120, -80, -40, 0, 40].map((px) => <rect key={px} x={px} y="-6" width="5" height="26" fill="#5A4030" />)}
      {/* platform */}
      <rect x="-56" y="-20" width="112" height="9" rx="2" fill="#C9C1AC" stroke="#4A4A44" strokeWidth="1" />
      {/* glass walls */}
      <path d="M-46 -20 L 46 -20 L 40 -96 L -40 -96 Z" fill="#CFE7EE" opacity="0.55" />
      {[-40, -20, 0, 20, 40].map((px) => <line key={px} x1={px * 1.08} y1="-20" x2={px} y2="-96" stroke="#3F6B6A" strokeWidth="2.2" />)}
      <path d="M-30 -86 L -14 -30 M6 -88 L 18 -40" stroke="#FFFFFF" strokeWidth="3" strokeOpacity="0.55" />
      {/* lamp inside */}
      {lit && <circle cx="0" cy="-58" r="44" fill="url(#nr-gold-glow)" />}
      <circle cx="0" cy="-58" r="6" fill={lit ? '#FFF1C4' : '#93A9A8'} />
      {/* copper dome */}
      <path d="M-54 -96 Q 0 -152 54 -96 Z" fill="#6FA595" />
      <path d="M0 -124 Q 30 -118 54 -96 L 0 -96 Z" fill="#4F8475" />
      <path d="M-54 -96 L 54 -96" stroke="#2F4F47" strokeWidth="3" />
      <path d="M-20 -128 Q 14 -138 40 -112" stroke="#FFF1CF" strokeWidth="2" strokeOpacity="0.7" fill="none" />
      <line x1="0" y1="-124" x2="0" y2="-140" stroke="#2F4F47" strokeWidth="2" />
      <circle cx="0" cy="-142" r="3.5" fill="#E2B15E" />
    </g>
  );
}

function Castle({ lit }: { lit: boolean }) {
  const x = LM_X[2];
  const y = groundY(x)! + 2;
  const stone = '#D2C3A0', shade = '#A08F70', roof = '#8E4B3B', roofShade = '#6A3329', ink = '#3A2E25';
  const win = lit ? '#FFE09A' : '#4A3A30';
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="10" cy="4" rx="150" ry="12" fill="#2C3A1E" opacity="0.35" />
      {/* curtain wall */}
      <rect x="-120" y="-48" width="240" height="50" fill={stone} />
      <rect x="0" y="-48" width="120" height="50" fill={shade} opacity="0.35" />
      {Array.from({ length: 16 }, (_, i) => <rect key={i} x={-120 + i * 15.4} y="-56" width="8" height="9" fill={stone} />)}
      <path d="M-14 2 L -14 -24 Q 0 -38 14 -24 L 14 2 Z" fill="#3A2B22" />
      {/* keep */}
      <rect x="-34" y="-128" width="68" height="84" fill={stone} />
      <rect x="0" y="-128" width="34" height="84" fill={shade} opacity="0.45" />
      <path d="M-40 -128 L 0 -176 L 40 -128 Z" fill={roof} />
      <path d="M0 -176 L 40 -128 L 0 -128 Z" fill={roofShade} />
      <path d="M0 -176 L 40 -128" stroke="#FFE09A" strokeWidth="2" strokeOpacity="0.6" />
      {lit && <circle cx="0" cy="-96" r="34" fill="url(#nr-gold-glow)" />}
      <rect x="-7" y="-108" width="14" height="22" rx="7" fill={win} />
      <rect x="-24" y="-76" width="8" height="12" rx="4" fill={win} />
      <rect x="16" y="-76" width="8" height="12" rx="4" fill={win} />
      {/* towers */}
      {[-104, 104].map((tx) => (
        <g key={tx} transform={`translate(${tx} 0)`}>
          <rect x="-18" y="-112" width="36" height="114" fill={stone} />
          <rect x={tx > 0 ? 0 : 6} y="-112" width={tx > 0 ? 18 : 12} height="114" fill={shade} opacity="0.45" />
          <path d="M-23 -112 L 0 -156 L 23 -112 Z" fill={roof} />
          <path d="M0 -156 L 23 -112 L 0 -112 Z" fill={roofShade} />
          <rect x="-4" y="-90" width="8" height="13" rx="4" fill={win} />
          <line x1="0" y1="-156" x2="0" y2="-176" stroke={ink} strokeWidth="1.6" />
        </g>
      ))}
      {/* ruined outer tower */}
      <path d="M134 2 L 134 -54 L 142 -62 L 148 -50 L 156 -58 L 156 2 Z" fill={shade} />
      {/* ivy */}
      <path d="M-120 -20 q 10 -16 6 -34 M-98 -40 q -6 20 4 40" stroke="#56703A" strokeWidth="3" fill="none" />
    </g>
  );
}

function Island({ cx, top, w, seed, children }: { cx: number; top: number; w: number; seed: number; children?: ReactNode }) {
  const r = rng(seed);
  const hw = w / 2;
  const depth = w * 0.42;
  const under: string[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = -hw + t * w;
    const y = 10 + Math.sin(Math.PI * t) * depth * (0.7 + r() * 0.35) * (i % 2 ? 1 : 0.86);
    under.push(`${x.toFixed(0)} ${y.toFixed(0)}`);
  }
  return (
    <g transform={`translate(${cx} ${top})`}>
      <path d={`M${-hw} 6 L ${under.join(' L ')} L ${hw} 6 Z`} fill="#7A5A50" />
      <path d={`M${-hw} 6 L ${under.slice(0, 5).join(' L ')} L 0 6 Z`} fill="#4F3B42" opacity="0.7" />
      <path d={`M${hw * 0.1} 12 L ${hw * 0.2} ${depth * 0.8} M${hw * 0.5} 12 L ${hw * 0.45} ${depth * 0.5}`} stroke="#4F3B42" strokeWidth="2" opacity="0.6" />
      {/* hanging roots */}
      {Array.from({ length: 6 }, (_, i) => { const x = -hw * 0.7 + i * (w * 0.14); const l = 20 + r() * 30; return <path key={i} d={`M${x} ${depth * 0.5} q 5 ${l / 2} -2 ${l}`} stroke="#5A4036" strokeWidth="1.6" fill="none" />; })}
      {/* grass cap */}
      <path d={`M${-hw - 6} 8 Q ${-hw} -6 ${-hw * 0.4} -6 L ${hw * 0.5} -7 Q ${hw + 4} -4 ${hw + 6} 8 Z`} fill="#7E9150" />
      <path d={`M${-hw * 0.2} -6 L ${hw * 0.5} -7 Q ${hw + 4} -4 ${hw + 6} 8`} fill="none" stroke="#FFD6A0" strokeWidth="2.4" strokeOpacity="0.8" />
      <path d={`M${-hw - 6} 8 Q ${-hw} 14 ${-hw * 0.5} 12 L ${hw} 12 Q ${hw + 6} 12 ${hw + 6} 8`} fill="#55683A" />
      {children}
    </g>
  );
}

function Gate({ lit }: { lit: boolean }) {
  return (
    <g>
      {[-30, 30].map((gx) => (
        <g key={gx}>
          <path d={`M${gx - 9} -4 L ${gx - 7} -70 L ${gx + 7} -72 L ${gx + 9} -4 Z`} fill="#A49789" />
          <path d={`M${gx} -71 L ${gx + 7} -72 L ${gx + 9} -4 L ${gx} -4 Z`} fill="#6E6260" opacity="0.6" />
        </g>
      ))}
      <path d="M-44 -70 L 44 -72 L 42 -60 L -42 -58 Z" fill="#B7AA98" />
      <path d="M-44 -70 L 44 -72" stroke="#FFD6A0" strokeWidth="2" strokeOpacity="0.8" />
      {/* hanging lantern */}
      <line x1="0" y1="-59" x2="0" y2="-40" stroke="#3A2A24" strokeWidth="1.2" />
      {lit && <circle cx="0" cy="-34" r="26" fill="url(#nr-gold-glow)" />}
      <rect x="-5" y="-40" width="10" height="12" rx="2" fill={lit ? '#FFE2A0' : '#5A4A40'} stroke="#3A2A24" strokeWidth="1" />
    </g>
  );
}

function Crystals({ lit }: { lit: boolean }) {
  const shards: [number, number, number, number][] = [[-26, 34, 9, -0.25], [-8, 58, 12, -0.08], [12, 46, 10, 0.12], [28, 28, 8, 0.3], [0, 22, 7, 0.02]];
  return (
    <g transform={`translate(${LM_X[4]} -638)`}>
      <circle cx="0" cy="-30" r={lit ? 90 : 50} fill="url(#nr-crystal-glow)" opacity={lit ? 1 : 0.55} style={{ transition: 'opacity 1.5s' }} />
      {shards.map(([x, h, w, a], i) => (
        <g key={i} transform={`translate(${x} 6) rotate(${a * 57})`}>
          <path d={`M${-w / 2} 0 L ${-w / 2} ${-h * 0.75} L 0 ${-h} L ${w / 2} ${-h * 0.75} L ${w / 2} 0 Z`} fill="url(#nr-crystal)" stroke="#E8FBFF" strokeWidth="0.8" />
          <path d={`M0 ${-h} L ${w / 2} ${-h * 0.75} L ${w / 2} 0 L 0 0 Z`} fill="#3E6E9A" opacity="0.5" />
        </g>
      ))}
    </g>
  );
}

function Henge({ lit }: { lit: boolean }) {
  const x = LM_X[5];
  const stones: [number, number, number][] = [[-84, 52, 16], [-46, 62, 18], [0, 66, 20], [46, 60, 18], [84, 48, 15]];
  return (
    <g transform={`translate(${x} ${MESA.top})`}>
      <ellipse cx="0" cy="2" rx="110" ry="7" fill="#05081A" opacity="0.6" />
      {lit && <ellipse cx="0" cy="-30" rx="130" ry="60" fill="url(#nr-star-glow)" />}
      {stones.map(([sx, h, w], i) => (
        <g key={i}>
          <path d={`M${sx - w / 2} 2 L ${sx - w / 2 + 2} ${-h + 4} Q ${sx} ${-h - 4} ${sx + w / 2 - 2} ${-h + 4} L ${sx + w / 2} 2 Z`} fill="#3A4374" />
          <path d={`M${sx} ${-h} Q ${sx + w / 2} ${-h} ${sx + w / 2 - 2} ${-h + 4} L ${sx + w / 2} 2 L ${sx} 2 Z`} fill="#232A55" />
          <path d={`M${sx - w / 2 + 2} ${-h + 4} Q ${sx} ${-h - 4} ${sx + w / 2 - 2} ${-h + 4}`} fill="none" stroke="#9FB4FF" strokeWidth="1.5" strokeOpacity="0.6" />
          <circle cx={sx} cy={-h * 0.5} r="2.6" fill={lit ? '#DCE6FF' : '#4B548A'} />
        </g>
      ))}
      <rect x="-58" y="-70" width="58" height="10" rx="2" fill="#434C80" />
      <rect x="10" y="-66" width="50" height="9" rx="2" fill="#434C80" />
    </g>
  );
}

function Camp({ lit }: { lit: boolean }) {
  return (
    <g transform={`translate(${LM_X[6]} -930)`}>
      <ellipse cx="0" cy="3" rx="70" ry="6" fill="#03080F" opacity="0.6" />
      {/* tent */}
      <path d="M-56 0 L -26 -44 L 4 0 Z" fill="#C8693F" />
      <path d="M-26 -44 L 4 0 L -14 0 Z" fill="#8F4430" />
      <path d="M-26 -44 L -34 0 L -20 0 Z" fill="#2A1A14" />
      {/* flag */}
      <line x1="26" y1="0" x2="26" y2="-62" stroke="#BFC8CC" strokeWidth="2" />
      {/* fire */}
      {lit && <circle cx="40" cy="-8" r="34" fill="url(#nr-gold-glow)" />}
      <path d="M32 0 L 48 0 M34 -2 L 46 2" stroke="#4A3426" strokeWidth="2.5" />
    </g>
  );
}

function BeaconTemple({ lit }: { lit: boolean }) {
  return (
    <g transform={`translate(${BEACON_X} -1110)`}>
      <rect x="-40" y="-6" width="80" height="10" fill="#9DB4B4" />
      {[-30, -10, 10, 30].map((cx) => <rect key={cx} x={cx - 4} y="-56" width="8" height="52" fill="#B9CFCC" />)}
      <rect x="0" y="-56" width="40" height="52" fill="#0E2230" opacity="0.35" />
      <path d="M-46 -56 L 46 -56 L 40 -64 L -40 -64 Z" fill="#9DB4B4" />
      <path d="M-34 -64 Q 0 -100 34 -64 Z" fill="#6FB7A5" />
      <path d="M0 -84 Q 22 -80 34 -64 L 0 -64 Z" fill="#3F7F72" />
      <path d="M-12 -2 L 12 -2 L 8 -22 L -8 -22 Z" fill="#E2B15E" />
      {!lit && <circle cx="0" cy="-26" r="4" fill="#4E6A6A" />}
    </g>
  );
}

/* ------------------------------------------------------------ props */

function forestTrees(): Item[] {
  const items: Item[] = [];
  const rows = [
    { dy: -6, h: [70, 110], step: 19, pal: PAL.forestBack, seed: 1 },
    { dy: 10, h: [96, 140], step: 30, pal: PAL.forest, seed: 2 },
  ];
  for (const row of rows) {
    const r = rng(row.seed * 977);
    for (let x = WORLD_START - 400; x < LM_X[1] - 340; x += row.step * (0.7 + r() * 0.6)) {
      if (row.dy > 0 && Math.abs(x - LM_X[0]) < 120) continue;
      if (row.dy > 0 && Math.abs(x - (LM_X[0] - 190)) < 40) continue;
      if (x > LM_X[0] + 300 && r() < Math.min(0.85, (x - LM_X[0] - 300) / 500)) continue; // thins toward the lake
      const g = groundY(x)!;
      const h = row.h[0] + r() * (row.h[1] - row.h[0]);
      const broad = r() > 0.78;
      const seed = Math.floor(x);
      items.push({ a: x - h * 0.4, b: x + h * 0.4, node: broad ? <Broadleaf key={`t${row.seed}-${seed}`} x={x} y={g + row.dy} h={h * 0.85} pal={row.pal} seed={seed} /> : <Pine key={`t${row.seed}-${seed}`} x={x} y={g + row.dy} h={h} pal={row.pal} k={r()} /> });
    }
  }
  return items;
}

function forestFloor(): Item[] {
  const items: Item[] = [];
  const r = rng(404);
  for (let x = WORLD_START; x < LM_X[0] + 520; x += 60 + r() * 90) {
    const g = groundY(x)! + 18;
    const kind = r();
    if (kind < 0.35) items.push({ a: x - 20, b: x + 20, node: <Rock key={`fr${x}`} x={x} y={g} w={26 + r() * 20} h={14 + r() * 10} fill="#566258" shade="#38433B" rim="#F0BE8E" /> });
    else if (kind < 0.6) {
      const c = r() > 0.5 ? '#E2A15E' : '#D9705A';
      items.push({ a: x - 12, b: x + 12, node: (
        <g key={`fm${x}`} transform={`translate(${x} ${g})`}>
          <rect x="-1.5" y="-9" width="3" height="9" fill="#EADCC0" />
          <path d="M-8 -8 Q 0 -18 8 -8 Z" fill={c} />
          <circle cx="-2" cy="-12" r="1.2" fill="#FFF6DD" />
          <rect x="7" y="-6" width="2" height="6" fill="#EADCC0" />
          <path d="M4 -5 Q 8 -11 12 -5 Z" fill={c} />
        </g>
      ) });
    } else {
      items.push({ a: x - 20, b: x + 20, node: (
        <g key={`ff${x}`} transform={`translate(${x} ${g})`} stroke="#2E5A3E" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M0 0 Q -10 -14 -22 -16 M0 0 Q -4 -18 -8 -26 M0 0 Q 6 -18 14 -24 M0 0 Q 12 -10 22 -12" />
        </g>
      ) });
    }
  }
  return items;
}

function lakeside(): Item[] {
  const items: Item[] = [];
  const r = rng(77);
  for (const [a, b] of [[LM_X[1] - 760, LAKE.a - 30], [LAKE.b + 40, LM_X[1] + 740]] as const) {
    for (let x = a; x < b; x += 70 + r() * 80) {
      if (Math.abs(x - (LM_X[1] - 360)) < 50) continue;
      const g = groundY(x)!;
      const h = 80 + r() * 50;
      items.push({ a: x - 50, b: x + 50, node: r() > 0.4 ? <Broadleaf key={`l${x}`} x={x} y={g + 6} h={h} pal={PAL.lake} seed={Math.floor(x)} /> : <Pine key={`l${x}`} x={x} y={g + 6} h={h * 1.1} pal={PAL.lake} k={r()} /> });
    }
  }
  // lily pads
  for (let i = 0; i < 6; i++) {
    const x = LAKE.a + 60 + r() * (LAKE.b - LAKE.a - 120);
    if (Math.abs(x - LM_X[1]) < 70) continue;
    items.push({ a: x - 10, b: x + 10, node: <ellipse key={`lp${i}`} cx={x} cy={WATER_Y + 4 + r() * 10} rx="9" ry="2.6" fill="#4E8A5A" /> });
  }
  return items;
}

function kingdomProps(): Item[] {
  const items: Item[] = [];
  const r = rng(303);
  // orchard trees on the slope
  for (let x = LM_X[1] + 760; x < LM_X[2] - 180; x += 80 + r() * 90) {
    if (x > LM_X[2] - 650 && x < LM_X[2] - 340) continue;
    const g = groundY(x)!;
    items.push({ a: x - 50, b: x + 50, node: <Broadleaf key={`k${x}`} x={x} y={g + 8} h={64 + r() * 40} pal={PAL.kingdom} seed={Math.floor(x)} /> });
  }
  // cottages
  const cottages = [LM_X[2] - 610, LM_X[2] - 520, LM_X[2] - 420];
  cottages.forEach((x, i) => {
    const g = groundY(x)! + 6;
    const roof = i % 2 ? '#8E4B3B' : '#A6693F';
    items.push({ a: x - 40, b: x + 40, node: (
      <g key={`c${i}`} transform={`translate(${x} ${g}) scale(${1 - i * 0.08})`}>
        <ellipse cx="6" cy="2" rx="36" ry="5" fill="#2C3A1E" opacity="0.3" />
        <rect x="-26" y="-34" width="52" height="36" fill="#E3D4B2" />
        <rect x="0" y="-34" width="26" height="36" fill="#B8A684" />
        <path d="M-32 -34 L 0 -62 L 32 -34 Z" fill={roof} />
        <path d="M0 -62 L 32 -34 L 0 -34 Z" fill="#000" opacity="0.18" />
        <path d="M0 -62 L 32 -34" stroke="#FFE09A" strokeWidth="1.6" strokeOpacity="0.6" />
        <rect x="-16" y="-24" width="10" height="10" fill="#4A3A30" />
        <rect x="6" y="-20" width="10" height="22" fill="#5A4030" />
        <rect x="12" y="-58" width="7" height="14" fill="#6A5040" />
      </g>
    ) });
  });
  // fences and hay
  for (let x = LM_X[2] - 360; x < LM_X[2] - 170; x += 22) {
    const g = groundY(x)! + 12;
    items.push({ a: x - 12, b: x + 12, node: <g key={`f${x}`}><rect x={x - 1.5} y={g - 18} width="3" height="18" fill="#6A4E36" /><line x1={x} y1={g - 14} x2={x + 22} y2={groundY(x + 22)! - 2} stroke="#6A4E36" strokeWidth="2" /><line x1={x} y1={g - 7} x2={x + 22} y2={groundY(x + 22)! + 5} stroke="#6A4E36" strokeWidth="2" /></g> });
  }
  for (const x of [LM_X[2] - 300, LM_X[2] - 230]) {
    const g = groundY(x)! + 18;
    items.push({ a: x - 16, b: x + 16, node: <g key={`h${x}`}><ellipse cx={x} cy={g - 10} rx="14" ry="12" fill="#D9B565" /><path d={`M${x - 10} ${g - 14} q 10 -4 20 0`} stroke="#B08E45" strokeWidth="1.5" fill="none" /><ellipse cx={x + 4} cy={g - 16} rx="6" ry="4" fill="#F2D88E" /></g> });
  }
  // sheep
  for (const x of [LM_X[2] + 230, LM_X[2] + 262, LM_X[2] + 330]) {
    const g = groundY(x)! + 14;
    items.push({ a: x - 10, b: x + 10, node: <g key={`s${x}`} transform={`translate(${x} ${g})`}><ellipse rx="9" ry="6" cy="-7" fill="#F4EFE4" /><circle cx="8" cy="-9" r="3.4" fill="#3A2E25" /><rect x="-5" y="-2" width="2" height="4" fill="#3A2E25" /><rect x="3" y="-2" width="2" height="4" fill="#3A2E25" /></g> });
  }
  // rocks at the cliff edge
  items.push({ a: CLIFF_X - 100, b: CLIFF_X, node: <Rock key="cr1" x={CLIFF_X - 60} y={groundY(CLIFF_X - 60)! + 8} w={50} h={30} fill="#9A8E72" shade="#6E6450" rim="#FFE09A" /> });
  return items;
}

function islandsItems(lit: boolean): Item[] {
  const A = { cx: 4180, top: -400, w: 150 };
  const IV = { cx: LM_X[3], top: -440, w: 300 };
  const C = { cx: 5080, top: -480, w: 170 };
  const bridge = (x1: number, y1: number, x2: number, y2: number, key: string) => (
    <g key={key}>
      <path d={`M${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.max(y1, y2) + 40} ${x2} ${y2}`} stroke="#5A4030" strokeWidth="2.4" fill="none" />
      <path d={`M${x1} ${y1 - 14} Q ${(x1 + x2) / 2} ${Math.max(y1, y2) + 24} ${x2} ${y2 - 14}`} stroke="#8C6B4F" strokeWidth="1.4" fill="none" />
      <path d={`M${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.max(y1, y2) + 40} ${x2} ${y2}`} stroke="#B48A5E" strokeWidth="5" strokeDasharray="3 5" fill="none" />
    </g>
  );
  return [
    { a: A.cx - 120, b: C.cx + 120, node: <g key="bridges">{bridge(A.cx + A.w / 2, A.top + 4, IV.cx - IV.w / 2, IV.top + 4, 'b1')}{bridge(IV.cx + IV.w / 2, IV.top + 4, C.cx - C.w / 2, C.top + 4, 'b2')}</g> },
    { a: A.cx - 100, b: A.cx + 100, node: <Island key="iA" cx={A.cx} top={A.top} w={A.w} seed={4}><Pine x={-20} y={-4} h={70} pal={PAL.island} /><Broadleaf x={30} y={-4} h={46} pal={PAL.island} seed={4} /></Island> },
    { a: IV.cx - 170, b: IV.cx + 170, node: <Island key="iIV" cx={IV.cx} top={IV.top} w={IV.w} seed={9}><Gate lit={lit} /><Broadleaf x={-110} y={-4} h={58} pal={PAL.island} seed={11} /><Rock x={104} y={-2} w={26} h={16} fill="#A49789" shade="#6E6260" rim="#FFD6A0" /></Island> },
    { a: C.cx - 110, b: C.cx + 110, node: (
      <Island key="iC" cx={C.cx} top={C.top} w={C.w} seed={17}>
        <path d="M-30 -2 L -30 -40 Q -12 -60 6 -40 L 6 -2 L -2 -2 L -2 -36 Q -12 -46 -22 -36 L -22 -2 Z" fill="#A49789" />
        <path d="M-30 -40 Q -12 -60 6 -40" stroke="#FFD6A0" strokeWidth="1.6" fill="none" strokeOpacity="0.8" />
        <Pine x={40} y={-4} h={54} pal={PAL.island} />
      </Island>
    ) },
  ];
}

function highProps(): Item[] {
  const items: Item[] = [];
  const r = rng(909);
  // small crystal clusters on the slopes
  for (const [x, y, s] of [[5300, -470, 0.6], [5620, -500, 0.5], [6180, -520, 0.55], [6520, -560, 0.5]] as const) {
    items.push({ a: x - 30, b: x + 30, node: (
      <g key={`cr${x}`} transform={`translate(${x} ${y}) scale(${s})`}>
        <circle cy="-20" r="40" fill="url(#nr-crystal-glow)" opacity="0.6" />
        <path d="M-12 0 L -10 -36 L -4 -46 L 2 -36 L 2 0 Z" fill="url(#nr-crystal)" />
        <path d="M2 0 L 4 -24 L 10 -30 L 14 -22 L 12 0 Z" fill="url(#nr-crystal)" />
      </g>
    ) });
  }
  // star-flowers on the mesa
  for (let x = MESA.x0 + 40; x < MESA.x1 - 20; x += 26 + r() * 30) {
    if (Math.abs(x - LM_X[5]) < 110) continue;
    const c = r() > 0.6 ? '#FFE7A8' : '#BFD3FF';
    items.push({ a: x - 8, b: x + 8, node: (
      <g key={`sf${x}`} transform={`translate(${x.toFixed(0)} ${MESA.top})`}>
        <path d="M0 0 q -2 -8 0 -14" stroke="#2B3A6A" strokeWidth="1.4" fill="none" />
        <circle cy="-15" r="6" fill="url(#nr-star-glow)" />
        <circle cy="-15" r="1.8" fill={c} />
      </g>
    ) });
  }
  // cairns up the summit path
  for (const x of [8000, 8260, 9000, 9300]) {
    const y = massifY(x)! + 4;
    items.push({ a: x - 12, b: x + 12, node: (
      <g key={`cn${x}`} transform={`translate(${x} ${y})`}>
        <ellipse cy="-4" rx="10" ry="5" fill="#2E4A55" />
        <ellipse cy="-11" rx="7" ry="4" fill="#3B5C66" />
        <ellipse cy="-17" rx="4.5" ry="3" fill="#4C7076" />
      </g>
    ) });
  }
  return items;
}


/* ------------------------------------------------------------ the ground band (nearer than the treeline) */

const PATH_END = LM_X[2] + 10;
export function pathY(x: number): number | null {
  if (x > PATH_END) return null;
  const g = groundY(x)!;
  const base = g * 0.82 + 74 + noise1(x / 340, 12) * 24;
  const t = smooth(clamp((x - (LM_X[2] - 520)) / 520, 0, 1));
  return lerp(base, groundY(LM_X[2])! + 4, t);
}

const pathBand = (x0: number, x1: number) => {
  const a = Math.max(x0, WORLD_START - 800);
  const b = Math.min(x1, PATH_END);
  if (b <= a) return null;
  const w = (x: number) => 11 * (1 - smooth(clamp((x - (LM_X[2] - 520)) / 520, 0, 1)) * 0.6);
  const top: string[] = [], bot: string[] = [];
  for (let x = a; x <= b; x += 10) { const y = pathY(x)!; top.push(`${x} ${(y - w(x)).toFixed(1)}`); bot.push(`${x} ${(y + w(x)).toFixed(1)}`); }
  const stones: ReactNode[] = [];
  for (let x = Math.floor(a / 34) * 34; x < b; x += 34) {
    const r = rng(x * 3 + 11);
    const y = pathY(x);
    if (y == null) continue;
    const side = r() > 0.5 ? 1 : -1;
    stones.push(<ellipse key={x} cx={x + r() * 20} cy={y + side * (w(x) + 2)} rx={3 + r() * 3} ry={1.8 + r() * 1.4} fill="#7E6E58" opacity="0.8" />);
  }
  return (
    <g>
      <path d={`M${top.join(' L')} L ${bot.reverse().join(' L ')} Z`} fill="url(#nr-path)" />
      <path d={`M${top.join(' L')}`} fill="none" stroke="#FFF1CF" strokeOpacity="0.28" strokeWidth="1.6" />
      {stones}
    </g>
  );
};

/** meadow texture between the treeline and the viewer: light patches, flowers, tufts */
const meadow = (x0: number, x1: number) => {
  const a = Math.max(x0, WORLD_START - 800);
  const b = Math.min(x1, CLIFF_X - 60);
  if (b <= a) return null;
  const out: ReactNode[] = [];
  const cell = 90;
  for (let cx = Math.floor(a / cell) * cell; cx < b; cx += cell) {
    const r = rng(cx * 7 + 3);
    const g = groundY(cx + cell / 2)!;
    const lakeHere = cx + cell > LAKE.a - 40 && cx < LAKE.b + 40;
    for (let k = 0; k < 4; k++) {
      const x = cx + r() * cell;
      const dy = 30 + r() * 480;
      if (lakeHere && dy < 90) continue;
      const near = Math.min(1.4, dy / 330);
      const kind = r();
      if (kind < 0.3) out.push(<ellipse key={`${cx}p${k}`} cx={x} cy={g + dy} rx={40 + near * 70} ry={5 + near * 6} fill="#DDE8B0" opacity={0.08 + near * 0.05} />);
      else if (kind < 0.62) {
        const col = ['#F2D16B', '#F7F1E3', '#E99A8C', '#B9A6E0'][Math.floor(r() * 4)];
        for (let j = 0; j < 4; j++) out.push(<circle key={`${cx}f${k}${j}`} cx={x + (r() - 0.5) * 30} cy={g + dy + (r() - 0.5) * 8} r={1.4 + near * 1.6} fill={col} opacity="0.9" />);
      } else {
        const h = 6 + near * 12;
        out.push(<path key={`${cx}t${k}`} d={`M${x - 4} ${g + dy} q 2 ${-h * 0.6} 1 ${-h} M${x} ${g + dy} q 1 ${-h * 0.8} 3 ${-h * 1.2} M${x + 4} ${g + dy} q 2 ${-h * 0.5} 6 ${-h * 0.8}`} stroke="#1D3828" strokeOpacity="0.55" strokeWidth={1.2 + near} fill="none" strokeLinecap="round" />);
      }
    }
  }
  return <g>{out}</g>;
};

function Bush({ x, y, s, pal, seed }: { x: number; y: number; s: number; pal: TreePal; seed: number }) {
  const r = rng(seed);
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})`}>
      <ellipse cx="4" cy="2" rx="30" ry="5" fill="#0A140F" opacity="0.3" />
      {[-16, 0, 16].map((dx, i) => <circle key={i} cx={dx} cy={-10 - (i === 1 ? 8 : 0)} r={14 + r() * 4} fill={pal.dark} />)}
      {[-10, 8].map((dx, i) => <circle key={`m${i}`} cx={dx + 2} cy={-16 - (i ? 4 : 0)} r={10 + r() * 3} fill={pal.mid} />)}
      <circle cx="8" cy="-22" r="6" fill={pal.light} opacity="0.7" />
    </g>
  );
}

function groundBand(): Item[] {
  const items: Item[] = [];
  const r = rng(6060);
  // forest: a front row of big, dark trees framing the way, bushes and stones
  for (let x = WORLD_START - 300; x < LM_X[1] - 420; x += 120 + r() * 160) {
    if (Math.abs(x - LM_X[0]) < 250 || Math.abs(x - (LM_X[0] - 190)) < 90) { r(); continue; }
    const g = groundY(x)!;
    const dy = 100 + r() * 60;
    const h = 150 + r() * 60;
    items.push({ a: x - 70, b: x + 70, node: r() > 0.3 ? <Pine key={`ft${x}`} x={x} y={g + dy} h={h} pal={PAL.forestFront} k={r()} /> : <Broadleaf key={`ft${x}`} x={x} y={g + dy} h={h * 0.8} pal={PAL.forestFront} seed={Math.floor(x)} /> });
  }
  for (let x = WORLD_START; x < LM_X[2] - 200; x += 70 + r() * 110) {
    const g = groundY(x)!;
    const dy = 40 + r() * 380;
    if (x > LAKE.a - 60 && x < LAKE.b + 60 && dy < 120) continue;
    const pal = x < LM_X[1] - 300 ? PAL.forestFront : x < LM_X[2] - 700 ? PAL.lake : PAL.kingdom;
    if (r() < 0.6) items.push({ a: x - 40, b: x + 40, node: <Bush key={`bu${x}`} x={x} y={g + dy} s={0.7 + dy / 260} pal={pal} seed={Math.floor(x)} /> });
    else items.push({ a: x - 30, b: x + 30, node: <Rock key={`ro${x}`} x={x} y={g + dy} w={24 + dy * 0.14} h={12 + dy * 0.07} fill={x < LM_X[1] ? '#566258' : '#8E8A72'} shade={x < LM_X[1] ? '#38433B' : '#64614E'} rim="#FFE6B8" /> });
  }
  // lakeside: reed beds along the near shore, a jetty post or two
  for (let x = LAKE.a - 80; x < LAKE.b + 80; x += 46 + r() * 50) {
    const y = Math.max(groundY(x)!, WATER_Y) + 70 + r() * 50;
    items.push({ a: x - 20, b: x + 20, node: <Reeds key={`rd${x}`} x={x} y={y} n={7} color="#22452F" seed={Math.floor(x)} /> });
  }
  // kingdom: soft strip fields on the slope, edged with hedgerows, and a scarecrow
  for (const [fx, fw, col, off, depth] of [[LM_X[1] + 640, 230, '#B9B35E', 34, 34], [LM_X[1] + 900, 200, '#C9B866', 70, 30], [LM_X[2] - 700, 240, '#D2BE6A', 44, 36], [LM_X[2] - 420, 180, '#A9AE60', 110, 30]] as const) {
    const pts = (o: number) => { const out: [number, number][] = []; for (let x = fx; x <= fx + fw; x += 10) out.push([x, groundY(x)! + o]); return out; };
    const t0 = pts(off), b0 = pts(off + depth).reverse();
    const d = `M${t0.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L ')} Q ${fx + fw + 12} ${groundY(fx + fw)! + off + depth / 2} ${b0[0][0]} ${b0[0][1].toFixed(1)} L ${b0.map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L ')} Q ${fx - 12} ${groundY(fx)! + off + depth / 2} ${t0[0][0]} ${t0[0][1].toFixed(1)} Z`;
    const rows: ReactNode[] = [];
    for (let k = 1; k < 4; k++) rows.push(<path key={k} d={`M${pts(off + (depth * k) / 4).map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L ')}`} stroke="#6E6A2E" strokeOpacity="0.28" strokeWidth="1.6" strokeDasharray="2 5" strokeLinecap="round" fill="none" />);
    items.push({ a: fx - 20, b: fx + fw + 20, node: (
      <g key={`fld${fx}`}>
        <path d={d} fill={col} opacity="0.78" />
        {rows}
        <path d={`M${pts(off + depth + 3).map(([x, y]) => `${x} ${y.toFixed(1)}`).join(' L ')}`} stroke="#4C6234" strokeOpacity="0.75" strokeWidth="6" strokeDasharray="5 3" strokeLinecap="round" fill="none" />
      </g>
    ) });
  }
  // the plateau's foot sinks into the cloud sea
  for (let i = 0; i < 6; i++) {
    const x = CLIFF_X - 260 + i * 120 + r() * 40;
    const w = 220 + r() * 140;
    const y = groundY(CLIFF_X)! + 250 + (i % 2) * 70 + r() * 40;
    items.push({ a: x - w / 2, b: x + w / 2, node: <Cumulus key={`cc${i}`} x={x} y={y} w={w} h={w * 0.42} light="#FFF0E4" shade="#F0C2B6" seed={i + 40} rim="#FFF8EE" /> });
  }
  const sx = LM_X[1] + 1010;
  const sg = groundY(sx)! + 120;
  items.push({ a: sx - 20, b: sx + 20, node: (
    <g key="scarecrow" transform={`translate(${sx} ${sg})`}>
      <rect x="-1.5" y="-56" width="3" height="58" fill="#5A4030" />
      <rect x="-18" y="-44" width="36" height="3" fill="#5A4030" />
      <path d="M-10 -46 L 10 -46 L 8 -22 L -8 -22 Z" fill="#6E7FA0" />
      <circle cy="-52" r="7" fill="#E2C48A" />
      <path d="M-11 -55 L 11 -55 L 6 -62 L -6 -62 Z" fill="#7A5A30" />
    </g>
  ) });
  return items;
}

/* ------------------------------------------------------------ assembly */

let STATIC: { back: Item[]; mid: Item[]; front: Item[]; band: Item[] } | null = null;
function staticItems() {
  if (STATIC) return STATIC;
  STATIC = {
    back: [
      ...PEAKS.map((p, i) => ({ a: p.cx - p.w / 2 - 10, b: p.cx + p.w / 2 + 10, node: <g key={`pk${i}`}>{peak(p)}</g> })),
      { a: MESA.x0 - 80, b: MESA.x1 + 10, node: <g key="mesa">{mesaBody()}</g> },
    ],
    mid: [...forestTrees(), ...lakeside(), ...kingdomProps()],
    front: [...forestFloor(), ...highProps()],
    band: groundBand(),
  };
  return STATIC;
}

const inRange = (it: Item, x0: number, x1: number) => it.b > x0 && it.a < x1;
const draw = (items: Item[], x0: number, x1: number) => items.filter((it) => inRange(it, x0, x1)).map((it) => (typeof it.node === 'function' ? it.node(x0, x1) : it.node));

const water = (x0: number, x1: number) => {
  const a = Math.max(x0, LAKE.a);
  const b = Math.min(x1, LAKE.b);
  if (b <= a) return null;
  const pts: string[] = [];
  for (let x = LAKE.a; x <= LAKE.b; x += 8) pts.push(`${x} ${groundY(x)!.toFixed(1)}`);
  return (
    <g>
      <path d={`M${LAKE.a} ${WATER_Y} L ${LAKE.b} ${WATER_Y} L ${pts.reverse().join(' L ')} Z`} fill="url(#nr-water)" />
      <rect x={LAKE.a + 10} y={WATER_Y} width={LAKE.b - LAKE.a - 20} height="3" fill="#E9F6F8" opacity="0.6" />
      {/* reflections of the far bank's trees */}
      <g opacity="0.22" fill="#2F5A41">
        {[LAKE.a + 10, LAKE.a + 40, LAKE.b - 50, LAKE.b - 20].map((x) => <path key={x} d={`M${x - 14} ${WATER_Y + 2} L ${x} ${WATER_Y + 46} L ${x + 14} ${WATER_Y + 2} Z`} />)}
      </g>
    </g>
  );
};

/** Renders a tile of the near layer. `lit[i]` = destination i reached. */
export function makeNearRenderer(lit: boolean[]) {
  const S = staticItems();
  const ln = (i: number) => lit[i] ?? false;
  const landmarks: Item[] = [
    { a: LM_X[0] - 260, b: LM_X[0] + 110, node: <g key="lm0"><Waymark x={LM_X[0] - 190} y={groundY(LM_X[0] - 190)! + 10} numeral="I" name="The Forgotten Forest" lit={ln(0)} cloth="#E8DCC4" ink="#2A3A33" /><Arch lit={ln(0)} /></g> },
    { a: LM_X[1] - 420, b: LM_X[1] + 70, node: <g key="lm1"><Waymark x={LM_X[1] - 360} y={groundY(LM_X[1] - 360)! + 8} numeral="II" name="The Glass Lake" lit={ln(1)} cloth="#F4EEDF" ink="#2A4A55" /><Pavilion lit={ln(1)} /></g> },
    { a: LM_X[2] - 300, b: LM_X[2] + 170, node: <g key="lm2"><Castle lit={ln(2)} /><Waymark x={LM_X[2] - 270} y={groundY(LM_X[2] - 270)! + 10} numeral="III" name="The Old Kingdom" lit={ln(2)} cloth="#F2E5C4" ink="#4A2E25" /></g> },
    ...islandsItems(ln(3)),
    { a: LM_X[3] - 20, b: LM_X[3] + 160, node: <Waymark key="wm3" x={LM_X[3] + 74} y={-438} numeral="IV" name="The Cloud Passage" lit={ln(3)} cloth="#FBEADB" ink="#5A3A4A" h={70} /> },
    { a: LM_X[4] - 70, b: LM_X[4] + 70, node: <Crystals key="lm4" lit={ln(4)} /> },
    { a: LM_X[4] - 280, b: LM_X[4] - 120, node: <Waymark key="wm4" x={LM_X[4] - 250} y={-400} numeral="V" name="The Crystal Peaks" lit={ln(4)} cloth="#E9D8EA" ink="#3A2A55" /> },
    { a: LM_X[5] - 130, b: LM_X[5] + 130, node: <Henge key="lm5" lit={ln(5)} /> },
    { a: LM_X[5] - 260, b: LM_X[5] - 110, node: <Waymark key="wm5" x={LM_X[5] - 230} y={MESA.top + 2} numeral="VI" name="The Starfields" lit={ln(5)} cloth="#3A4374" ink="#DCE6FF" h={70} /> },
    { a: LM_X[6] - 80, b: LM_X[6] + 70, node: <Camp key="lm6" lit={ln(6)} /> },
    { a: LM_X[6] - 290, b: LM_X[6] - 160, node: <Waymark key="wm6" x={LM_X[6] - 260} y={massifY(LM_X[6] - 260)! + 4} numeral="VII" name="The Summit" lit={ln(6)} cloth="#24465A" ink="#CFF5EA" h={70} /> },
    { a: BEACON_X - 60, b: BEACON_X + 60, node: <BeaconTemple key="lm7" lit={ln(7)} /> },
  ];
  return (x0: number, x1: number) => (
    <>
      <NearDefs />
      {draw(S.back, x0, x1)}
      <g key="massif">{massif(x0, x1)}</g>
      <g key="sea">{cloudSea(x0, x1)}</g>
      <g key="ground">{ground(x0, x1)}</g>
      {draw(S.mid, x0, x1)}
      <g key="water">{water(x0, x1)}</g>
      {draw(landmarks, x0, x1)}
      {draw(S.front, x0, x1)}
      <g key="meadow">{meadow(x0, x1)}</g>
      <g key="path">{pathBand(x0, x1)}</g>
      {draw(S.band, x0, x1)}
    </>
  );
}

function NearDefs() {
  const span = CLIFF_X - WORLD_START;
  const o = (x: number) => clamp((x - WORLD_START) / span, 0, 1);
  const seaSpan = WORLD_END - (CLIFF_X - 460);
  const so = (x: number) => clamp((x - (CLIFF_X - 460)) / seaSpan, 0, 1);
  return (
    <defs>
      <linearGradient id="nr-ground" gradientUnits="userSpaceOnUse" x1={WORLD_START} y1="0" x2={CLIFF_X} y2="0">
        <stop offset={o(LM_X[0] - 300)} stopColor="#2F4D3B" />
        <stop offset={o(LM_X[0] + 500)} stopColor="#3B5F43" />
        <stop offset={o(LM_X[1] - 300)} stopColor="#5C8A55" />
        <stop offset={o(LM_X[1] + 500)} stopColor="#7A9B55" />
        <stop offset={o(LM_X[2] - 300)} stopColor="#95A15A" />
        <stop offset="1" stopColor="#A3A35E" />
      </linearGradient>
      <linearGradient id="nr-depth" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="420">
        <stop offset="0" stopColor="#0A140F" stopOpacity="0" />
        <stop offset="1" stopColor="#0A140F" stopOpacity="0.75" />
      </linearGradient>
      <linearGradient id="nr-rim" gradientUnits="userSpaceOnUse" x1={WORLD_START} y1="0" x2={CLIFF_X} y2="0">
        <stop offset={o(LM_X[0])} stopColor="#F0BE8E" />
        <stop offset={o(LM_X[1])} stopColor="#FFF4D6" />
        <stop offset={o(LM_X[2])} stopColor="#FFE09A" />
      </linearGradient>
      <linearGradient id="nr-path" gradientUnits="userSpaceOnUse" x1={WORLD_START} y1="0" x2={CLIFF_X} y2="0">
        <stop offset={o(LM_X[0])} stopColor="#8E7A5C" />
        <stop offset={o(LM_X[1])} stopColor="#C2A877" />
        <stop offset={o(LM_X[2])} stopColor="#D9BD82" />
      </linearGradient>
      <linearGradient id="nr-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#A8D3E2" />
        <stop offset="0.35" stopColor="#6FA9C4" />
        <stop offset="1" stopColor="#2F5F78" />
      </linearGradient>
      <linearGradient id="nr-cloud" gradientUnits="userSpaceOnUse" x1={CLIFF_X - 460} y1="0" x2={WORLD_END} y2="0">
        <stop offset={so(LM_X[3])} stopColor="#FFEBDC" />
        <stop offset={so(LM_X[4])} stopColor="#EECBD6" />
        <stop offset={so(LM_X[5])} stopColor="#38417A" />
        <stop offset={so(LM_X[6])} stopColor="#1C4250" />
      </linearGradient>
      <linearGradient id="nr-cloud-shade" gradientUnits="userSpaceOnUse" x1={CLIFF_X - 460} y1="0" x2={WORLD_END} y2="0">
        <stop offset={so(LM_X[3])} stopColor="#F0C2B6" />
        <stop offset={so(LM_X[4])} stopColor="#C493B4" />
        <stop offset={so(LM_X[5])} stopColor="#2A3263" />
        <stop offset={so(LM_X[6])} stopColor="#14333E" />
      </linearGradient>
      <linearGradient id="nr-cloud-body" gradientUnits="userSpaceOnUse" x1={CLIFF_X - 460} y1="0" x2={WORLD_END} y2="0">
        <stop offset={so(LM_X[3])} stopColor="#E4AFAA" />
        <stop offset={so(LM_X[4])} stopColor="#A47AA0" />
        <stop offset={so(LM_X[5])} stopColor="#1A2049" />
        <stop offset={so(LM_X[6])} stopColor="#0C222C" />
      </linearGradient>
      <linearGradient id="nr-rock" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8F78A8" />
        <stop offset="0.5" stopColor="#5E4E7E" />
        <stop offset="1" stopColor="#2E2650" />
      </linearGradient>
      <linearGradient id="nr-massif" gradientUnits="userSpaceOnUse" x1="6500" y1="0" x2={BEACON_X + 600} y2="0">
        <stop offset="0" stopColor="#3C3266" />
        <stop offset="0.22" stopColor="#1B2350" />
        <stop offset="0.5" stopColor="#13243A" />
        <stop offset="1" stopColor="#0E2230" />
      </linearGradient>
      <linearGradient id="nr-massif-rim" gradientUnits="userSpaceOnUse" x1="6500" y1="0" x2={BEACON_X + 600} y2="0">
        <stop offset="0" stopColor="#E9A3B4" />
        <stop offset="0.22" stopColor="#8FA3FF" />
        <stop offset="1" stopColor="#7FE6C8" />
      </linearGradient>
      <linearGradient id="nr-crystal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F2FDFF" />
        <stop offset="0.5" stopColor="#9EE6F2" />
        <stop offset="1" stopColor="#4C7FB0" />
      </linearGradient>
      <radialGradient id="nr-crystal-glow">
        <stop offset="0" stopColor="#CFF6FF" stopOpacity="0.85" />
        <stop offset="1" stopColor="#9EE6F2" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="nr-gold-glow">
        <stop offset="0" stopColor="#FFEFC2" stopOpacity="0.95" />
        <stop offset="0.4" stopColor="#FFCB6E" stopOpacity="0.35" />
        <stop offset="1" stopColor="#FFCB6E" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="nr-star-glow">
        <stop offset="0" stopColor="#DCE6FF" stopOpacity="0.8" />
        <stop offset="1" stopColor="#8FA3FF" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/* ------------------------------------------------------------ actors */

/** Cloud puffs drifting over the sea, behind the islands and peaks. */
export function nearUnderActors(): Actor[] {
  const A: Actor[] = [];
  const r = rng(808);
  const tone = (x: number): [string, string, string] => {
    const rr = (x - LM_X[0]) / (LM_X[1] - LM_X[0]);
    if (rr < 3.6) return ['#FFF0E4', '#F0C2B6', '#FFF8EE'];
    if (rr < 4.6) return ['#F1CDD8', '#C493B4', '#FFE6EE'];
    if (rr < 5.6) return ['#3A4380', '#252C5E', '#8FA3FF'];
    return ['#1F4654', '#13303B', '#7FE6C8'];
  };
  for (let i = 0; i < 16; i++) {
    const x = CLIFF_X + 200 + i * 400 + r() * 200;
    const y = cloudSeaY(x) - 60 - r() * 70;
    const w = 200 + r() * 180;
    const [light, shade, rim] = tone(x);
    A.push({ key: `cl${i}`, x: x - w / 2, y: y - w * 0.3, w, h: w * 0.42, className: 'anim-drift-slow', style: { animationDelay: `${-r() * 30}s` }, children: (
      <svg viewBox={`${-w / 2} ${-w * 0.42} ${w} ${w * 0.42}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
        <Cumulus x={0} y={0} w={w} h={w * 0.4} light={light} shade={shade} seed={i + 3} rim={rim} />
      </svg>
    ) });
  }
  return A;
}

/** Animated pieces of the near layer (compositor-driven CSS animations). */
export function nearActors(lit: boolean[]): Actor[] {
  const A: Actor[] = [];
  const r = rng(5150);
  // fireflies are particles; here: swaying foreground ferns, reeds, banners, water shimmer, mills, falls, flames
  for (const x of [LAKE.a - 10, LAKE.a + 14, LAKE.b - 18, LAKE.b + 8, LAKE.a + 40]) {
    A.push({ key: `reed${x}`, x: x - 20, y: WATER_Y - 50, w: 40, h: 52, className: 'anim-sway', style: { transformOrigin: '50% 100%', animationDelay: `${-r() * 3}s` }, children: <svg viewBox="-20 -50 40 52" width="100%" height="100%" style={{ overflow: 'visible' }}><Reeds x={0} y={2} n={6} color="#2F5A41" seed={Math.floor(x)} /></svg> });
  }
  for (let i = 0; i < 7; i++) {
    const x = LAKE.a + 40 + ((LAKE.b - LAKE.a - 80) * i) / 6;
    A.push({ key: `sh${i}`, x: x - 30, y: WATER_Y + 6 + (i % 3) * 9, w: 60, h: 3, className: 'anim-glint', style: { background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent)', borderRadius: 3, animationDelay: `${-i * 0.7}s` }, children: null });
  }
  // rowboat
  A.push({ key: 'boat', x: LM_X[1] + 130, y: WATER_Y - 16, w: 56, h: 22, className: 'anim-bob-slow', children: (
    <svg viewBox="0 0 56 22" width="100%" height="100%"><path d="M2 12 L54 12 Q 48 22 28 22 Q 8 22 2 12 Z" fill="#8C5A3C" /><path d="M2 12 L54 12" stroke="#E2B15E" strokeWidth="1.6" /><line x1="20" y1="12" x2="36" y2="2" stroke="#5A3A2A" strokeWidth="1.6" /></svg>
  ) });
  // castle banners
  const cy = groundY(LM_X[2])! + 2;
  for (const tx of [-104, 104]) {
    A.push({ key: `ban${tx}`, x: LM_X[2] + tx, y: cy - 178, w: 24, h: 12, className: 'anim-banner', style: { transformOrigin: '0% 50%' }, children: <svg viewBox="0 0 24 12" width="100%" height="100%"><path d="M0 0 L24 3 L18 6 L24 9 L0 12 Z" fill="#E2B15E" /></svg> });
  }
  // windmill on the hill
  const wx = LM_X[2] - 700;
  const wg = groundY(wx)! + 6;
  A.push({ key: 'mill', x: wx - 14, y: wg - 66, w: 28, h: 68, children: (
    <svg viewBox="-14 -66 28 68" width="100%" height="100%" style={{ overflow: 'visible' }}><path d="M-11 2 L -7 -56 L 7 -56 L 11 2 Z" fill="#E3D4B2" /><path d="M0 -56 L 7 -56 L 11 2 L 0 2 Z" fill="#B8A684" /><path d="M-10 -56 L 0 -68 L 10 -56 Z" fill="#8E4B3B" /></svg>
  ) });
  A.push({ key: 'millsail', x: wx - 40, y: wg - 100, w: 80, h: 80, className: 'anim-spin-slow', children: (
    <svg viewBox="-40 -40 80 80" width="100%" height="100%">{[0, 90, 180, 270].map((a) => <g key={a} transform={`rotate(${a})`}><rect x="-1.8" y="-38" width="3.6" height="38" fill="#5B4636" /><rect x="2" y="-36" width="9" height="26" fill="#F4EBD8" stroke="#5B4636" strokeWidth="0.8" /></g>)}<circle r="3.5" fill="#3A2E25" /></svg>
  ) });
  // falls off the cliff and the islands
  const falls: [number, number, number][] = [[CLIFF_X - 4, groundY(CLIFF_X)! + 2, 320], [4600, -380, 150], [5090, -420, 120]];
  falls.forEach(([x, y, h], i) => A.push({ key: `fall${i}`, x: x - 5, y, w: 10, h, className: 'falls', style: { animationDelay: `${-i * 0.4}s` }, children: null }));
  // pulsing crystals
  A.push({ key: 'cglow', x: LM_X[4] - 70, y: -740, w: 140, h: 140, className: 'anim-breathe', style: { background: 'radial-gradient(closest-side, rgba(207,246,255,.55), rgba(158,230,242,0))', opacity: lit[4] ? 1 : 0.5 }, children: null });
  // twinkling star-flowers
  for (let i = 0; i < 12; i++) {
    const x = MESA.x0 + 60 + r() * (MESA.x1 - MESA.x0 - 120);
    A.push({ key: `tw${i}`, x: x - 9, y: MESA.top - 26, w: 18, h: 18, className: 'anim-twinkle', style: { background: 'radial-gradient(closest-side, rgba(255,240,200,.95), rgba(255,240,200,0))', animationDelay: `${-r() * 3}s`, borderRadius: '50%' }, children: null });
  }
  // constellation drawn above the henge once it is reached
  if (lit[5]) {
    A.push({ key: 'const', x: LM_X[5] - 150, y: MESA.top - 250, w: 300, h: 160, className: 'anim-fade-in', children: (
      <svg viewBox="0 0 300 160" width="100%" height="100%">
        <polyline points="20,120 70,70 130,92 180,40 240,64 285,20" fill="none" stroke="#DCE6FF" strokeOpacity="0.7" strokeWidth="1.4" strokeDasharray="3 4" className="draw-in" />
        {[[20, 120], [70, 70], [130, 92], [180, 40], [240, 64], [285, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#FFF6DD" />)}
      </svg>
    ) });
  }
  // campfire and the summit flag
  if (lit[6]) A.push({ key: 'fire', x: LM_X[6] + 30, y: -960, w: 20, h: 30, className: 'anim-flame', style: { transformOrigin: '50% 100%' }, children: <svg viewBox="0 0 20 30" width="100%" height="100%"><path d="M10 0 Q 18 14 16 22 Q 14 30 10 30 Q 6 30 4 22 Q 2 14 10 0 Z" fill="#FFB347" /><path d="M10 10 Q 14 18 13 24 Q 12 30 10 30 Q 8 30 7 24 Q 6 18 10 10 Z" fill="#FFF1C4" /></svg> });
  A.push({ key: 'sflag', x: LM_X[6] + 26, y: -992, w: 30, h: 16, className: 'anim-banner', style: { transformOrigin: '0% 50%' }, children: <svg viewBox="0 0 30 16" width="100%" height="100%"><path d="M0 0 L30 4 L24 8 L30 12 L0 16 Z" fill="#E2B15E" /></svg> });
  // the beacon
  if (lit[7]) {
    A.push({ key: 'rays', x: BEACON_X - 180, y: -1110 - 30 - 180, w: 360, h: 360, className: 'anim-rays', children: (
      <svg viewBox="-180 -180 360 360" width="100%" height="100%"><defs><linearGradient id="bk-ray" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#FFE7A6" stopOpacity="0.55" /><stop offset="1" stopColor="#FFE7A6" stopOpacity="0" /></linearGradient></defs>{Array.from({ length: 12 }, (_, i) => <path key={i} d="M0 0 L-10 -178 L10 -178 Z" fill="url(#bk-ray)" transform={`rotate(${i * 30})`} />)}</svg>
    ) });
    A.push({ key: 'bfire', x: BEACON_X - 14, y: -1110 - 52, w: 28, h: 34, className: 'anim-flame', style: { transformOrigin: '50% 100%' }, children: <svg viewBox="0 0 20 30" width="100%" height="100%"><path d="M10 0 Q 18 14 16 22 Q 14 30 10 30 Q 6 30 4 22 Q 2 14 10 0 Z" fill="#FFB347" /><path d="M10 10 Q 14 18 13 24 Q 12 30 10 30 Q 8 30 7 24 Q 6 18 10 10 Z" fill="#FFF1C4" /></svg> });
  }
  // glows that breathe once a destination is lit
  const glows: [number, number, number][] = [[LM_X[0], groundY(LM_X[0])! - 110, 70], [LM_X[1], WATER_Y - 60, 90], [LM_X[2], groundY(LM_X[2])! - 96, 80], [LM_X[3], -474, 60], [LM_X[6] + 40, -940, 60], [BEACON_X, -1140, 150]];
  glows.forEach(([x, y, rad], i) => {
    const idx = i < 4 ? i : i === 4 ? 6 : 7;
    if (!lit[idx]) return;
    A.push({ key: `g${i}`, x: x - rad, y: y - rad, w: rad * 2, h: rad * 2, className: 'anim-breathe', style: { background: 'radial-gradient(closest-side, rgba(255,226,160,.5), rgba(255,203,110,0))', animationDelay: `${-i}s` }, children: null });
  });
  return A;
}

export { MESA, massifY, WATER_Y, LAKE };
