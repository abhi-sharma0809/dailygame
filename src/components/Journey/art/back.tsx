import type { ReactNode } from 'react';
import { Y0, type Actor, type View } from '../Layer';
import { LEG, X0, WORLD_END, WORLD_START, clamp, lerp, noise1, rng, routeY, smooth } from '../world';
import { Cumulus } from './shapes';

/* ============================================================
 * Distant layers. They span the whole journey at once, so they are lit by
 * the *current* time of day (palette by region, CSS-transitioned) rather
 * than painted by place. Authoring uses world-equivalent x (the camera x
 * at which a feature sits at the explorer's anchor) and a screen offset
 * `sy` below the anchor; `toLayer` converts to layer coordinates.
 * ============================================================ */

export interface BackPal { far1: string; far2: string; snow: string; hill1: string; hill2: string; tree: string; cloud: string; cloudShade: string; rim: string; haze: string }

export const BACK: BackPal[] = [
  { far1: '#7A8592', far2: '#5D6C79', snow: '#F0D8C4', hill1: '#3E5A55', hill2: '#2B4639', tree: '#1F392F', cloud: '#F1D5C0', cloudShade: '#B99C9E', rim: '#F2C894', haze: '#C9A88A' },
  { far1: '#A3C3D2', far2: '#86AABC', snow: '#FAF8F2', hill1: '#6E9A7C', hill2: '#517F62', tree: '#3A6A4E', cloud: '#F7F6F1', cloudShade: '#BFD0D8', rim: '#FFF4D6', haze: '#D9E6E0' },
  { far1: '#AFC0BE', far2: '#91A7A6', snow: '#FBF1DC', hill1: '#9AA66A', hill2: '#788C55', tree: '#56693E', cloud: '#FCF1DA', cloudShade: '#D8C1A0', rim: '#FFEAB0', haze: '#EFD9A6' },
  { far1: '#BC9FAE', far2: '#9C849E', snow: '#FCE0C6', hill1: '#8A7690', hill2: '#6E5F7E', tree: '#57496A', cloud: '#FDE1C8', cloudShade: '#DCA19A', rim: '#FFD7A0', haze: '#F0BE96' },
  { far1: '#604878', far2: '#4A3866', snow: '#EDB0B0', hill1: '#57437A', hill2: '#433366', tree: '#32264F', cloud: '#E9A9B0', cloudShade: '#9A5F86', rim: '#FFAE7E', haze: '#B86D84' },
  { far1: '#1A2246', far2: '#121936', snow: '#6676A8', hill1: '#1A2147', hill2: '#121835', tree: '#0B0F22', cloud: '#2E3769', cloudShade: '#1A2048', rim: '#8FA3FF', haze: '#2A2F5C' },
  { far1: '#0F2131', far2: '#0A1824', snow: '#5C9E98', hill1: '#0E2131', hill2: '#091723', tree: '#061019', cloud: '#1D3D4C', cloudShade: '#0F2733', rim: '#7FE6C8', haze: '#163A48' },
];

const T = 'fill 2.6s ease, stroke 2.6s ease, opacity 2.6s ease';

const toLayer = (f: number, fy: number, wx: number, sy: number) => [wx * f, sy + Y0 + (routeY(wx) - Y0) * fy] as const;

/** blend per-region numbers by world x */
function byRegion(wx: number, vals: number[]) {
  const r = clamp((wx - X0) / LEG, 0, vals.length - 1);
  const i = Math.floor(r);
  const t = smooth(r - i);
  return lerp(vals[i], vals[Math.min(vals.length - 1, i + 1)], t);
}

/* ------------------------------------------------------------ horizon (very far) */

export const HORIZON = { f: 0.035, fy: 0.03 };

export function makeHorizonRenderer(pal: BackPal) {
  const { f, fy } = HORIZON;
  return (x0: number, x1: number) => {
    const pts: string[] = [];
    for (let lx = x0; lx <= x1 + 8; lx += 8) {
      const wx = lx / f;
      const sy = 150 + noise1(lx / 90, 21) * 28 + noise1(lx / 30, 4) * 6;
      pts.push(`${lx.toFixed(0)} ${toLayer(f, fy, wx, sy)[1].toFixed(1)}`);
    }
    return <path d={`M${pts.join(' L')} L ${x1 + 8} 2400 L ${x0} 2400 Z`} style={{ fill: pal.far1, opacity: 0.55, transition: T }} />;
  };
}

/** The Summit on the far horizon: the goal, visible from the first step. */
export function horizonActors(view: View, pal: BackPal, region: number): Actor[] {
  const { f, fy } = HORIZON;
  const lx = view.viewW * 0.5 + X0 * f;
  const [, baseY] = toLayer(f, fy, X0, 170);
  const h = 330;
  return [{
    key: 'spire', x: lx - 90, y: baseY - h, w: 180, h: h + 10,
    style: { opacity: region >= 6 ? 0 : 0.9, transition: 'opacity 3s' },
    children: (
      <svg viewBox={`-90 ${-h} 180 ${h + 10}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
        <path d={`M-90 10 L -40 -90 L -22 -150 L -8 -${h - 40} L 0 -${h - 14} L 8 -${h - 40} L 24 -160 L 46 -80 L 90 10 Z`} style={{ fill: pal.far2, transition: T }} />
        <path d={`M0 -${h - 14} L 8 -${h - 40} L 24 -160 L 46 -80 L 90 10 L 10 10 Z`} fill="#000" opacity="0.18" />
        <path d={`M-8 -${h - 40} L 0 -${h - 14} L 8 -${h - 40} L 3 -${h - 52} Z`} style={{ fill: pal.snow, transition: T }} />
        <circle cx="0" cy={-h - 6} r="34" className="anim-breathe" fill="url(#hz-beacon)" />
        <circle cx="0" cy={-h - 6} r="3.4" fill="#FFF6DD" />
        <defs>
          <radialGradient id="hz-beacon"><stop offset="0" stopColor="#FFF1C4" stopOpacity="0.95" /><stop offset="0.3" stopColor="#FFD58A" stopOpacity="0.45" /><stop offset="1" stopColor="#FFD58A" stopOpacity="0" /></radialGradient>
        </defs>
      </svg>
    ),
  }];
}

/* ------------------------------------------------------------ far mountains */

export const FAR = { f: 0.12, fy: 0.1 };

export function makeFarRenderer(pal: BackPal) {
  const { f, fy } = FAR;
  // ridged multi-octave noise: sharp summits, rounded valleys, no repetition
  const ridged = (x: number, seed: number) => { const n = 1 - Math.abs(noise1(x, seed)); return n * n; };
  const ridge = (x0: number, x1: number, seed: number, base: number[], amp: number, period: number) => {
    const pts: string[] = [];
    const snow: ReactNode[] = [];
    const a = Math.floor(x0 / 5) * 5;
    let prevH = 0, prevPrevH = 0, prevX = 0, prevY = 0;
    for (let lx = a; lx <= x1 + 5; lx += 5) {
      const wx = lx / f;
      const h = ridged(lx / period, seed) * 0.62 + ridged(lx / (period * 0.43), seed + 5) * 0.28 + (noise1(lx / 9, seed + 9) * 0.5 + 0.5) * 0.1;
      const sy = byRegion(wx, base) - h * amp;
      const y = toLayer(f, fy, wx, sy)[1];
      pts.push(`${lx} ${y.toFixed(1)}`);
      // snow on local summits that stand tall
      if (prevH > prevPrevH && prevH >= h && prevH > 0.72) snow.push(<path key={lx} d={`M${prevX - 11} ${prevY + 16} L ${prevX - 3} ${prevY + 2} L ${prevX} ${prevY} L ${prevX + 4} ${prevY + 3} L ${prevX + 12} ${prevY + 16} L ${prevX + 5} ${prevY + 11} L ${prevX + 1} ${prevY + 17} L ${prevX - 4} ${prevY + 11} Z`} style={{ fill: pal.snow, transition: T }} />);
      prevPrevH = prevH; prevH = h; prevX = lx; prevY = y;
    }
    return { d: `M${pts.join(' L')} L ${x1 + 5} 2400 L ${a} 2400 Z`, snow };
  };
  return (x0: number, x1: number) => {
    const back = ridge(x0, x1, 11, [70, 80, 90, 120, 160, 220, 250], 170, 95);
    const front = ridge(x0, x1, 17, [120, 128, 136, 170, 210, 270, 300], 95, 52);
    return (
      <g>
        <path d={back.d} style={{ fill: pal.far1, transition: T }} />
        {back.snow}
        <path d={front.d} style={{ fill: pal.far2, transition: T }} />
        {front.snow}
      </g>
    );
  };
}

/* ------------------------------------------------------------ mid hills / clouds / peaks */

export const MID = { f: 0.4, fy: 0.35 };

// per region: [base sy, hill amp, peak amp]; clouds region drops the land away
const MID_BASE = [105, 120, 95, 560, 10, 150, 130];
const MID_HILL = [26, 22, 32, 0, 0, 10, 0];
const MID_PEAK = [0, 0, 0, 0, 170, 40, 130];

function midSy(wx: number, seed: number, off = 0) {
  const base = byRegion(wx, MID_BASE) + off;
  const hill = byRegion(wx, MID_HILL) * noise1(wx / 700, seed);
  const pa = byRegion(wx, MID_PEAK);
  const ph = wx / 900 + noise1(wx / 2000, seed + 1) * 0.4;
  const tri = 1 - Math.abs((ph - Math.floor(ph)) * 2 - 1);
  const peak = -tri * pa + pa * 0.35;
  return base + hill + peak + noise1(wx / 60, seed + 7) * 3;
}

export function makeMidRenderer(pal: BackPal) {
  const { f, fy } = MID;
  return (x0: number, x1: number) => {
    const rowPath = (seed: number, off: number) => {
      const pts: string[] = [];
      const a = Math.floor(x0 / 6) * 6;
      for (let lx = a; lx <= x1 + 6; lx += 6) {
        const wx = lx / f;
        pts.push(`${lx} ${toLayer(f, fy, wx, midSy(wx, seed, off))[1].toFixed(1)}`);
      }
      return `M${pts.join(' L')} L ${x1 + 6} 2600 L ${a} 2600 Z`;
    };
    // treeline along the front row through the forest; hedgerows and towers in the kingdom
    const trees: ReactNode[] = [];
    const step = 9;
    for (let lx = Math.floor(x0 / step) * step; lx < x1; lx += step) {
      const wx = lx / f;
      const rr = (wx - X0) / LEG;
      const r = rng(Math.floor(lx) * 31 + 7);
      const y = toLayer(f, fy, wx, midSy(wx, 5, 40))[1];
      if (rr < 1.25 || (rr > 1.25 && rr < 2.4 && r() > 0.82)) {
        const h = 16 + r() * 18;
        trees.push(<path key={lx} d={`M${lx - h * 0.22} ${y + 3} L ${lx} ${y - h} L ${lx + h * 0.22} ${y + 3} Z`} style={{ fill: pal.tree, transition: T }} />);
      } else if (rr >= 1.9 && rr < 2.45 && Math.floor(lx) % 171 < step) {
        trees.push(
          <g key={lx} style={{ fill: pal.tree, transition: T }}>
            <rect x={lx - 5} y={y - 34} width="10" height="36" />
            <path d={`M${lx - 7} ${y - 34} L ${lx} ${y - 48} L ${lx + 7} ${y - 34} Z`} />
          </g>,
        );
      }
    }
    // cloud banks once the land falls away
    const banks: ReactNode[] = [];
    const bstep = 120;
    for (let lx = Math.floor((x0 - 200) / bstep) * bstep; lx < x1 + 200; lx += bstep) {
      const wx = lx / f;
      const rr = (wx - X0) / LEG;
      if (rr < 2.45) continue;
      const r = rng(Math.floor(lx) * 17 + 3);
      const w = 200 + r() * 180;
      const sy = rr < 3.6 ? 150 + r() * 120 : 210 + r() * 90;
      const [bx, by] = toLayer(f, fy, wx, sy);
      banks.push(<Cumulus key={lx} x={bx + r() * 40} y={by} w={w} h={w * 0.42} light={pal.cloud} shade={pal.cloudShade} seed={Math.floor(lx)} rim={pal.rim} />);
    }
    return (
      <g>
        <path d={rowPath(3, 0)} style={{ fill: pal.hill1, transition: T }} />
        <path d={rowPath(5, 40)} style={{ fill: pal.hill2, transition: T }} />
        {trees}
        <g style={{ transition: T }}>{banks}</g>
      </g>
    );
  };
}

/** Birds wheeling over the kingdom and drifting cloud wisps. */
export function midActors(pal: BackPal): Actor[] {
  const { f, fy } = MID;
  const A: Actor[] = [];
  for (const [wx, sy] of [[X0 + LEG * 1.6, -120], [X0 + LEG * 2.3, -160], [X0 - 300, -140]] as const) {
    const [x, y] = toLayer(f, fy, wx, sy);
    A.push({ key: `birds${wx}`, x, y, w: 90, h: 30, className: 'anim-birds', children: (
      <svg viewBox="0 0 90 30" width="100%" height="100%" fill="none" stroke={pal.tree} strokeWidth="1.6" strokeLinecap="round" style={{ transition: T }}>
        {[[10, 14, 1], [30, 8, 0.8], [44, 18, 0.9], [62, 10, 0.7], [76, 20, 0.75]].map(([bx, by, s], i) => <path key={i} className="anim-wing" style={{ animationDelay: `${-i * 0.17}s`, transformOrigin: `${bx}px ${by}px` }} d={`M${bx - 8 * s} ${by} q ${4 * s} ${-5 * s} ${8 * s} 0 q ${4 * s} ${-5 * s} ${8 * s} 0`} />)}
      </svg>
    ) });
  }
  return A;
}

/* ------------------------------------------------------------ foreground */

export const FRONT = { f: 1.45, fy: 1.2 };

export function makeFrontRenderer(view: View) {
  const { f, fy } = FRONT;
  const bottom = view.viewH - view.ay + 30;
  return (x0: number, x1: number) => {
    const out: ReactNode[] = [];
    const step = 340;
    for (let lx = Math.floor((x0 - 300) / step) * step; lx < x1 + 300; lx += step) {
      const r = rng(Math.floor(lx) * 7 + 1);
      if (r() < 0.35) continue;
      const wx = lx / f;
      const rr = (wx - X0) / LEG;
      const x = lx + r() * 120;
      const [, by] = toLayer(f, fy, wx, bottom);
      const k = 0.8 + r() * 0.6;
      if (rr < 1.3) {
        out.push(
          <g key={lx} transform={`translate(${x} ${by}) scale(${k})`} fill="#0A1611">
            <path d="M0 0 C -30 -40, -70 -60, -110 -62 C -70 -48, -40 -30, -20 0 Z" />
            <path d="M0 0 C -6 -60, -2 -110, 10 -150 C 10 -100, 12 -50, 18 0 Z" />
            <path d="M10 0 C 40 -50, 80 -70, 120 -70 C 80 -50, 50 -26, 30 0 Z" />
            <path d="M-50 0 q 6 -40 2 -80 M-40 0 q 10 -30 16 -60 M40 0 q -4 -46 6 -90" stroke="#0A1611" strokeWidth="3" fill="none" />
          </g>,
        );
      } else if (rr < 2.0) {
        out.push(
          <g key={lx} transform={`translate(${x} ${by}) scale(${k})`} stroke="#0F2419" strokeWidth="4" fill="none" strokeLinecap="round">
            {[-30, -16, -4, 8, 22, 34].map((dx, i) => <path key={i} d={`M${dx} 0 q ${4 + i} -60 ${dx > 0 ? 14 : -10} ${-120 - (i % 3) * 30}`} />)}
            <ellipse cx="-14" cy="-118" rx="4" ry="14" fill="#0F2419" stroke="none" />
            <ellipse cx="20" cy="-130" rx="4" ry="14" fill="#0F2419" stroke="none" />
          </g>,
        );
      } else if (rr < 2.25) {
        out.push(
          <g key={lx} transform={`translate(${x} ${by}) scale(${k})`} fill="#1B200F">
            {[-60, -20, 20, 60].map((dx) => <rect key={dx} x={dx - 5} y="-90" width="10" height="92" rx="2" />)}
            <rect x="-70" y="-74" width="140" height="7" />
            <rect x="-70" y="-44" width="140" height="7" />
            {[-40, 0, 44].map((dx) => <circle key={dx} cx={dx} cy="-100" r="5" fill="#3A2A12" />)}
          </g>,
        );
      } else if (rr < 2.4) {
        continue;
      } else if (rr < 4.5) {
        const pink = rr > 3.6;
        out.push(<g key={lx} opacity="0.85"><Cumulus x={x} y={by + 30} w={320 * k} h={150 * k} light={pink ? '#E4A9BE' : '#FFEDE2'} shade={pink ? '#A86F95' : '#E8B3A8'} seed={Math.floor(lx)} /></g>);
      } else {
        const night = rr > 4.8;
        const c = night ? (rr > 5.6 ? '#03090F' : '#05081A') : '#1A1230';
        const pts: string[] = [];
        for (let i = 0; i <= 12; i++) { const t = i / 12; const hh = Math.sin(Math.PI * t) * (70 + r() * 40) + (r() - 0.5) * 18; pts.push(`${(-130 + t * 260).toFixed(0)} ${(-Math.max(0, hh)).toFixed(0)}`); }
        out.push(
          <g key={lx} transform={`translate(${x} ${by}) scale(${k * 0.85})`}>
            <path d={`M-130 4 L ${pts.join(' L ')} L 130 4 Z`} fill={c} />
            {night && [[-40, -60], [10, -78], [52, -54]].map(([fx, fy2], j) => (
              <g key={j}><circle cx={fx} cy={fy2} r="9" fill="#BFD3FF" opacity="0.12" /><circle cx={fx} cy={fy2} r="2.2" fill={j === 1 ? '#FFE7A6' : '#BFD3FF'} opacity="0.85" /></g>
            ))}
          </g>,
        );
      }
    }
    return <g>{out}</g>;
  };
}

/* ------------------------------------------------------------ extents */

export const layerExtent = (f: number, view: View) => ({ minX: WORLD_START * f - view.viewW, maxX: WORLD_END * f + view.viewW });
