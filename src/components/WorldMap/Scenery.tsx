import { memo, useMemo } from 'react';
import { BEACON, H, W, rng } from './geometry';

/* ============================================================
 * The Atlas of Connections — static painted scenery.
 * Light comes from the upper left (a low golden sun); shadows fall
 * to the lower right. Everything is procedural but seeded, so the
 * world is identical on every render.
 * ============================================================ */

const C = {
  ink: '#26323A',
  night: '#101923',
  forest: '#19382E',
  forestMid: '#244A3B',
  moss: '#78936B',
  mossLight: '#9DB28F',
  parchment: '#F0E6D1',
  gold: '#D9AD63',
  goldLight: '#ECCB8B',
  sky: '#89B7CE',
  skyLight: '#B5D3E2',
  plum: '#4A3F66',
  stone: '#7C8790',
  stoneLight: '#A9B1B4',
};

export const SceneryDefs = memo(function SceneryDefs() {
  return (
    <defs>
      <linearGradient id="km-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0A1220" />
        <stop offset="0.32" stopColor="#152536" />
        <stop offset="0.55" stopColor="#2B3E45" />
        <stop offset="0.7" stopColor="#4B5A4C" />
        <stop offset="1" stopColor="#24382F" />
      </linearGradient>
      <radialGradient id="km-sun" cx="0.18" cy="0.58" r="0.55">
        <stop offset="0" stopColor="#F3D79B" stopOpacity="0.55" />
        <stop offset="0.35" stopColor="#D9AD63" stopOpacity="0.18" />
        <stop offset="1" stopColor="#D9AD63" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="km-starglow" cx="0.82" cy="0.32" r="0.35">
        <stop offset="0" stopColor="#7E6BB0" stopOpacity="0.35" />
        <stop offset="1" stopColor="#7E6BB0" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="km-hill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5E7A55" />
        <stop offset="1" stopColor="#1F4033" />
      </linearGradient>
      <linearGradient id="km-hill2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7E9A6E" />
        <stop offset="1" stopColor="#2A5244" />
      </linearGradient>
      <linearGradient id="km-lake" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#B5D3E2" />
        <stop offset="0.5" stopColor="#89B7CE" />
        <stop offset="1" stopColor="#3F6F86" />
      </linearGradient>
      <linearGradient id="km-mtn" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#C9D3D6" />
        <stop offset="0.45" stopColor="#8A98A3" />
        <stop offset="1" stopColor="#3B4954" />
      </linearGradient>
      <linearGradient id="km-mtn-shadow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#56636D" />
        <stop offset="1" stopColor="#25313A" />
      </linearGradient>
      <linearGradient id="km-crystal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#E6F4FA" />
        <stop offset="0.5" stopColor="#89B7CE" />
        <stop offset="1" stopColor="#4C7F9A" />
      </linearGradient>
      <linearGradient id="km-island" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6B5847" />
        <stop offset="1" stopColor="#2E2A2A" />
      </linearGradient>
      <linearGradient id="km-mesa" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3D3757" />
        <stop offset="1" stopColor="#1B1A2B" />
      </linearGradient>
      <linearGradient id="km-spire" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#B7C1C6" />
        <stop offset="0.5" stopColor="#7A8790" />
        <stop offset="1" stopColor="#2E3A43" />
      </linearGradient>
      <radialGradient id="km-beacon" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#FFF1CC" />
        <stop offset="0.3" stopColor="#ECCB8B" stopOpacity="0.9" />
        <stop offset="1" stopColor="#D9AD63" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="km-glow-blue" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#CBE7F5" stopOpacity="0.9" />
        <stop offset="1" stopColor="#89B7CE" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="km-glow-gold" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#FCE7B8" stopOpacity="0.95" />
        <stop offset="1" stopColor="#D9AD63" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="km-mist" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#D8DED8" stopOpacity="0.85" />
        <stop offset="0.6" stopColor="#B8C4BE" stopOpacity="0.45" />
        <stop offset="1" stopColor="#B8C4BE" stopOpacity="0" />
      </radialGradient>
      {/* painterly edges: a gentle wobble, like gouache on paper */}
      <filter id="km-paint" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="km-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
      <filter id="km-blur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" /></filter>
      <filter id="km-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
        <feColorMatrix values="0 0 0 0 0.94  0 0 0 0 0.88  0 0 0 0 0.75  0 0 0 0.09 0" />
      </filter>
      <pattern id="km-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <line x1="0" y1="0" x2="0" y2="6" stroke={C.ink} strokeWidth="1" strokeOpacity="0.22" />
      </pattern>
    </defs>
  );
});

/* ------------------------------------------------------------ helpers */

function Pine({ x, y, s, tone = 0 }: { x: number; y: number; s: number; tone?: number }) {
  const dark = tone ? '#16302A' : C.forest;
  const mid = tone ? '#21453A' : C.forestMid;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="6" cy="2" rx="14" ry="3.5" fill="#0D1B17" opacity="0.35" />
      <rect x="-1.6" y="-6" width="3.2" height="8" fill="#3A2E25" />
      <path d="M0 -46 L13 -14 L7 -15 L16 -2 L-16 -2 L-7 -15 L-13 -14 Z" fill={dark} />
      <path d="M0 -46 L-13 -14 L-7 -15 L-16 -2 L0 -2 Z" fill={mid} />
      <path d="M0 -46 L-5 -34 L0 -33 Z" fill={C.mossLight} opacity="0.55" />
    </g>
  );
}

function RoundTree({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="6" cy="2" rx="16" ry="4" fill="#0D1B17" opacity="0.3" />
      <rect x="-2" y="-10" width="4" height="12" fill="#3A2E25" />
      <circle cx="0" cy="-22" r="15" fill={C.forestMid} />
      <circle cx="-5" cy="-27" r="9" fill={C.moss} opacity="0.9" />
      <circle cx="-8" cy="-30" r="4" fill={C.mossLight} opacity="0.7" />
    </g>
  );
}

/* ------------------------------------------------------------ layers */

function Sky() {
  const stars = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: 140 }, () => ({ x: r() * W, y: r() * 470 * (0.4 + r() * 0.6), s: r() * 1.4 + 0.3, d: r() * 4 }));
  }, []);
  return (
    <g>
      <rect width={W} height={H} fill="url(#km-sky)" />
      <rect width={W} height={H} fill="url(#km-starglow)" />
      <rect width={W} height={H} fill="url(#km-sun)" />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill={i % 7 === 0 ? C.goldLight : C.parchment} className={i % 3 === 0 ? 'anim-twinkle' : undefined} style={{ animationDelay: `${s.d}s` }} opacity={i % 3 === 0 ? undefined : 0.55} />
      ))}
      {/* a low moon behind the peaks */}
      <circle cx="1180" cy="150" r="46" fill="#F3E7C9" opacity="0.9" />
      <circle cx="1196" cy="140" r="40" fill="#152536" opacity="0.55" />
    </g>
  );
}

function DistantRange() {
  return (
    <g opacity="0.75">
      <path d="M0 620 L90 540 L170 590 L260 500 L360 570 L450 520 L560 585 L640 545 L720 600 L820 560 L900 610 L1600 610 L1600 700 L0 700 Z" fill="#3A4D55" opacity="0.6" />
      <path d="M0 650 L120 590 L230 630 L340 575 L470 640 L600 600 L700 650 L840 615 L980 660 L1600 650 L1600 720 L0 720 Z" fill="#2F444A" opacity="0.7" />
    </g>
  );
}

function CloudSea() {
  const puffs = useMemo(() => {
    const r = rng(29);
    return Array.from({ length: 34 }, () => ({ x: r() * W, y: 520 + r() * 110, rx: 60 + r() * 110, ry: 14 + r() * 18, o: 0.18 + r() * 0.22 }));
  }, []);
  return (
    <g filter="url(#km-blur2)">
      {puffs.map((p, i) => (
        <ellipse key={i} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} fill="#DCE3DF" opacity={p.o} className={i % 4 === 0 ? 'anim-drift' : undefined} style={{ animationDelay: `${-i * 1.3}s` }} />
      ))}
    </g>
  );
}

function Lowlands() {
  return (
    <g filter="url(#km-paint)">
      {/* rolling hills, back to front */}
      <path d="M0 700 C160 660 300 690 430 670 C560 650 640 690 760 670 C860 650 960 640 1080 668 C1180 690 1280 700 1600 690 L1600 1000 L0 1000 Z" fill="url(#km-hill)" />
      <path d="M0 760 C140 720 260 760 380 744 C520 726 600 760 720 748 C860 734 980 700 1120 740 C1260 780 1400 760 1600 770 L1600 1000 L0 1000 Z" fill="url(#km-hill2)" />
      <path d="M0 860 C180 820 320 880 520 870 C700 860 860 900 1060 880 C1260 860 1420 900 1600 880 L1600 1000 L0 1000 Z" fill="#1F4033" />
      {/* sunlit meadow patches */}
      <path d="M300 760 C360 744 430 750 470 766 C420 780 350 782 300 760 Z" fill={C.mossLight} opacity="0.45" />
      <path d="M780 742 C830 728 890 732 930 744 C880 758 820 760 780 742 Z" fill={C.mossLight} opacity="0.4" />
      <path d="M1080 770 C1150 752 1230 760 1270 774 C1200 790 1130 790 1080 770 Z" fill={C.mossLight} opacity="0.35" />
    </g>
  );
}

function River() {
  return (
    <g filter="url(#km-paint)">
      {/* falls from the floating islands down into the Glass Lake */}
      <path d="M612 540 C606 600 600 640 604 690 C608 730 590 760 600 790" fill="none" stroke={C.skyLight} strokeWidth="7" opacity="0.75" />
      <path d="M612 540 C606 600 600 640 604 690 C608 730 590 760 600 790" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="6 10" opacity="0.6" className="anim-shimmer" />
      {/* out of the lake toward the kingdom */}
      <path d="M700 832 C760 846 820 820 880 840 C940 860 1010 846 1060 860 C1120 876 1200 868 1260 900 C1320 930 1400 920 1600 940" fill="none" stroke={C.sky} strokeWidth="9" opacity="0.55" />
      <path d="M700 832 C760 846 820 820 880 840 C940 860 1010 846 1060 860 C1120 876 1200 868 1260 900 C1320 930 1400 920 1600 940" fill="none" stroke={C.skyLight} strokeWidth="2" strokeDasharray="10 14" opacity="0.6" className="anim-shimmer" />
    </g>
  );
}

function GlassLake() {
  return (
    <g>
      <g filter="url(#km-paint)">
        <path d="M430 800 C440 760 520 744 600 752 C680 758 724 786 714 820 C704 856 620 872 540 866 C470 862 422 840 430 800 Z" fill="#2B4E5E" />
        <path d="M440 798 C452 766 524 754 598 760 C668 766 706 790 698 818 C688 846 616 860 544 856 C478 852 434 830 440 798 Z" fill="url(#km-lake)" />
      </g>
      {/* reflections of the sky and peaks */}
      <path d="M480 790 C520 780 560 782 600 790" stroke="#FFFFFF" strokeWidth="2" opacity="0.5" fill="none" strokeDasharray="14 18" className="anim-shimmer" />
      <path d="M500 822 C560 812 620 816 660 826" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.4" fill="none" strokeDasharray="10 22" className="anim-shimmer" style={{ animationDuration: '4.2s' }} />
      <path d="M560 776 L580 790 L600 776" stroke={C.parchment} strokeWidth="1.2" opacity="0.35" fill="none" />
      {/* reeds */}
      {[[452, 836], [462, 842], [700, 806], [690, 812], [706, 812]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} q 2 -14 -2 -22 M${x + 3} ${y} q 3 -12 6 -18`} stroke={C.forest} strokeWidth="1.6" fill="none" />
      ))}
      {/* a small arched wooden bridge across the east end */}
      <g transform="translate(560 786)">
        <path d="M-34 12 Q 0 -14 34 12" fill="none" stroke="#5B4636" strokeWidth="6" strokeLinecap="round" />
        <path d="M-34 12 Q 0 -14 34 12" fill="none" stroke="#8C6B4F" strokeWidth="2.5" strokeLinecap="round" />
        {[-26, -13, 0, 13, 26].map((x) => <line key={x} x1={x} y1={x === 0 ? -1 : Math.abs(x) > 20 ? 7 : 2} x2={x} y2={x === 0 ? -10 : Math.abs(x) > 20 ? -2 : -7} stroke="#5B4636" strokeWidth="2" />)}
        <path d="M-30 4 Q 0 -22 30 4" fill="none" stroke="#8C6B4F" strokeWidth="1.5" />
        <path d="M-34 14 Q 0 36 34 14" fill="none" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="2" />
      </g>
    </g>
  );
}

function Forest() {
  const trees = useMemo(() => {
    const r = rng(5);
    const t: { x: number; y: number; s: number; tone: number; round: boolean }[] = [];
    for (let i = 0; i < 95; i++) {
      const x = r() * 440 - 20;
      const y = 700 + r() * 300;
      if (x > 150 && x < 300 && y > 800 && y < 880) continue; // clearing for the landmark
      if (x > 360 && y < 760) continue;
      t.push({ x, y, s: 0.7 + (y - 700) / 300 + r() * 0.25, tone: r() > 0.5 ? 1 : 0, round: r() > 0.86 });
    }
    // a few trees scattered on the far hills and around the kingdom
    for (let i = 0; i < 26; i++) t.push({ x: 720 + r() * 820, y: 690 + r() * 70, s: 0.45 + r() * 0.2, tone: 1, round: r() > 0.6 });
    for (let i = 0; i < 18; i++) t.push({ x: 1050 + r() * 540, y: 820 + r() * 160, s: 0.8 + r() * 0.4, tone: r() > 0.5 ? 1 : 0, round: r() > 0.5 });
    return t.sort((a, b) => a.y - b.y);
  }, []);
  const fireflies = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 22 }, () => ({ x: 20 + r() * 380, y: 760 + r() * 220, d: r() * 4 }));
  }, []);
  return (
    <g>
      {/* forest floor shadow */}
      <path d="M0 720 C120 700 260 730 420 760 L430 1000 L0 1000 Z" fill="#132A23" opacity="0.6" filter="url(#km-paint)" />
      {trees.map((t, i) => (t.round ? <RoundTree key={i} x={t.x} y={t.y} s={t.s} /> : <Pine key={i} x={t.x} y={t.y} s={t.s} tone={t.tone} />))}
      {/* ancient stone archway marks the forest's heart */}
      <g transform="translate(214 860)">
        <path d="M-26 0 L-26 -38 Q 0 -66 26 -38 L26 0 L16 0 L16 -34 Q 0 -52 -16 -34 L-16 0 Z" fill="#6E7B76" stroke={C.ink} strokeWidth="1.5" />
        <path d="M-26 -38 Q 0 -66 26 -38" fill="none" stroke={C.moss} strokeWidth="4" opacity="0.8" />
        <circle cx="0" cy="-44" r="4" fill={C.goldLight} className="anim-pulse" />
      </g>
      {fireflies.map((f, i) => (
        <circle key={i} cx={f.x} cy={f.y} r="2.2" fill="#F6E3A6" className="anim-twinkle" style={{ animationDelay: `${f.d}s`, animationDuration: `${2 + (i % 4)}s` }} />
      ))}
    </g>
  );
}

function OldKingdom() {
  return (
    <g>
      <g filter="url(#km-paint)">
        <path d="M840 740 C870 680 920 650 960 650 C1010 650 1050 690 1070 740 Z" fill="#5E7A55" />
        <path d="M960 650 C1010 650 1050 690 1070 740 L960 740 Z" fill="#3F5A43" opacity="0.7" />
      </g>
      <g transform="translate(948 676)">
        {/* curtain wall */}
        <path d="M-58 8 L-58 -18 L58 -18 L58 8 Z" fill="#B9AD95" stroke={C.ink} strokeWidth="1.5" />
        <path d="M0 -18 L58 -18 L58 8 L0 8 Z" fill="#8E836F" />
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={-58 + i * 10} y="-23" width="5" height="5" fill={i > 5 ? '#8E836F' : '#B9AD95'} stroke={C.ink} strokeWidth="0.8" />)}
        {/* keep */}
        <rect x="-18" y="-60" width="36" height="44" fill="#C9BEA6" stroke={C.ink} strokeWidth="1.5" />
        <rect x="0" y="-60" width="18" height="44" fill="#9C907A" />
        <path d="M-22 -60 L0 -88 L22 -60 Z" fill="#6E3B3B" stroke={C.ink} strokeWidth="1.5" />
        <path d="M0 -88 L22 -60 L0 -60 Z" fill="#4E2A2C" />
        <rect x="-5" y="-48" width="10" height="14" rx="5" fill={C.goldLight} className="anim-pulse" />
        {/* towers */}
        {[-52, 52].map((x) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <rect x="-9" y="-46" width="18" height="50" fill="#BDB199" stroke={C.ink} strokeWidth="1.5" />
            <rect x={x > 0 ? 0 : -9} y="-46" width="9" height="50" fill={x > 0 ? '#8E836F' : '#CFC5AE'} opacity="0.8" />
            <path d="M-12 -46 L0 -68 L12 -46 Z" fill="#6E3B3B" stroke={C.ink} strokeWidth="1.5" />
            <line x1="0" y1="-68" x2="0" y2="-82" stroke={C.ink} strokeWidth="1.2" />
            <path d="M0 -82 L14 -78 L0 -73 Z" fill={C.gold} className="anim-flutter" />
            <rect x="-2.5" y="-32" width="5" height="8" fill={C.goldLight} opacity="0.85" />
          </g>
        ))}
        {/* ruined outer tower */}
        <path d="M74 8 L74 -26 L80 -30 L84 -22 L90 -28 L90 8 Z" fill="#9C907A" stroke={C.ink} strokeWidth="1.2" />
        <path d="M-8 8 L-8 -6 Q 0 -14 8 -6 L8 8 Z" fill="#3A2E25" />
      </g>
    </g>
  );
}

function FloatingIslands() {
  const island = (x: number, y: number, w: number, seed: number) => {
    const r = rng(seed);
    const roots = Array.from({ length: 5 }, (_, i) => ({ x: -w / 2 + (i + 0.5) * (w / 5) + (r() - 0.5) * 10, l: 20 + r() * 30 }));
    return (
      <g transform={`translate(${x} ${y})`}>
        <g filter="url(#km-paint)">
          <path d={`M${-w / 2} 0 C${-w / 3} ${w * 0.55} ${w / 3} ${w * 0.6} ${w / 2} 0 Z`} fill="url(#km-island)" />
          <path d={`M${-w / 2} 0 C${-w / 3} ${w * 0.55} ${-w * 0.05} ${w * 0.6} 0 ${w * 0.45} L0 0 Z`} fill="#8A715B" opacity="0.5" />
          <ellipse cx="0" cy="0" rx={w / 2 + 4} ry="10" fill={C.moss} />
          <ellipse cx={-w * 0.12} cy="-3" rx={w / 3} ry="6" fill={C.mossLight} opacity="0.7" />
        </g>
        {roots.map((rt, i) => <path key={i} d={`M${rt.x} ${w * 0.3} q 4 ${rt.l / 2} -2 ${rt.l}`} stroke="#4A3B30" strokeWidth="1.5" fill="none" opacity="0.7" />)}
        <Pine x={-w * 0.2} y={-2} s={0.55} />
        <Pine x={w * 0.05} y={-4} s={0.7} tone={1} />
        <RoundTree x={w * 0.28} y={-1} s={0.5} />
      </g>
    );
  };
  return (
    <g>
      {/* soft shadows on the cloud sea */}
      <ellipse cx="560" cy="610" rx="90" ry="12" fill="#0E1820" opacity="0.25" filter="url(#km-soft)" />
      <ellipse cx="720" cy="560" rx="70" ry="10" fill="#0E1820" opacity="0.25" filter="url(#km-soft)" />
      <g className="anim-bob" style={{ animation: 'bob 7s ease-in-out infinite' }}>{island(560, 520, 150, 3)}</g>
      <g style={{ animation: 'bob 9s ease-in-out infinite', animationDelay: '-2s' }}>{island(726, 450, 112, 8)}</g>
      <g style={{ animation: 'bob 8s ease-in-out infinite', animationDelay: '-4s' }}>{island(420, 430, 90, 13)}</g>
      {/* rope bridges */}
      <path d="M632 516 Q 676 520 676 452" fill="none" stroke="#8C6B4F" strokeWidth="2" />
      <path d="M632 516 Q 676 528 676 452" fill="none" stroke="#5B4636" strokeWidth="1" strokeDasharray="2 4" />
      <path d="M462 428 Q 500 470 490 514" fill="none" stroke="#8C6B4F" strokeWidth="2" />
      {/* waterfall off the big island */}
      <path d="M610 522 L614 560" stroke={C.skyLight} strokeWidth="5" opacity="0.8" />
    </g>
  );
}

function CrystalPeaks() {
  const crystals = [
    [890, 452, 0.9], [1052, 420, 1.2], [1112, 470, 0.8], [960, 470, 0.7], [1168, 440, 0.65], [1036, 340, 0.75],
  ];
  return (
    <g>
      <g filter="url(#km-paint)">
        <path d="M820 520 L930 300 L1000 380 L1060 250 L1140 360 L1200 320 L1270 520 Z" fill="url(#km-mtn)" />
        <path d="M930 300 L960 520 L820 520 Z" fill="url(#km-mtn-shadow)" opacity="0.45" />
        <path d="M1060 250 L1090 520 L1000 380 Z" fill="url(#km-mtn-shadow)" opacity="0.55" />
        <path d="M1200 320 L1220 520 L1140 360 Z" fill="url(#km-mtn-shadow)" opacity="0.5" />
        {/* snow caps */}
        <path d="M930 300 L948 336 L938 332 L926 344 L914 334 Z" fill="#F4F2EA" />
        <path d="M1060 250 L1082 292 L1070 286 L1060 300 L1046 288 L1038 294 Z" fill="#F4F2EA" />
        <path d="M1200 320 L1214 348 L1204 344 L1194 352 L1186 344 Z" fill="#F4F2EA" />
      </g>
      {crystals.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <circle cx="0" cy="-16" r="34" fill="url(#km-glow-blue)" className="anim-pulse" style={{ animationDelay: `${i * 0.6}s` }} />
          <path d="M-10 0 L-6 -30 L0 -40 L6 -30 L10 0 Z" fill="url(#km-crystal)" stroke="#E6F4FA" strokeWidth="0.8" />
          <path d="M0 -40 L6 -30 L10 0 L0 0 Z" fill="#4C7F9A" opacity="0.6" />
          <path d="M-18 0 L-14 -18 L-9 -24 L-6 -16 L-6 0 Z" fill="url(#km-crystal)" stroke="#E6F4FA" strokeWidth="0.6" />
          <path d="M8 0 L11 -14 L16 -20 L20 -10 L18 0 Z" fill="url(#km-crystal)" stroke="#E6F4FA" strokeWidth="0.6" />
        </g>
      ))}
    </g>
  );
}

function Starfields() {
  const flowers = useMemo(() => {
    const r = rng(41);
    return Array.from({ length: 30 }, () => ({ x: 1180 + r() * 200, y: 482 + r() * 34, d: r() * 3 }));
  }, []);
  const constellation = [[1210, 380], [1246, 352], [1290, 366], [1318, 336], [1352, 360]];
  return (
    <g>
      <g filter="url(#km-paint)">
        <path d="M1160 520 C1170 486 1200 474 1270 472 C1340 470 1380 486 1392 520 L1380 560 C1300 590 1220 586 1170 560 Z" fill="url(#km-mesa)" />
        <ellipse cx="1276" cy="482" rx="112" ry="16" fill="#4F4673" />
      </g>
      {flowers.map((f, i) => (
        <g key={i}>
          <circle cx={f.x} cy={f.y} r="5" fill="url(#km-glow-gold)" className="anim-twinkle" style={{ animationDelay: `${f.d}s` }} />
          <circle cx={f.x} cy={f.y} r="1.4" fill="#FFF1CC" />
        </g>
      ))}
      {/* a constellation drawn between the stars — the theme of the game */}
      <polyline points={constellation.map((p) => p.join(',')).join(' ')} fill="none" stroke={C.goldLight} strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 4" />
      {constellation.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#FFF1CC" className="anim-twinkle" style={{ animationDelay: `${i * 0.5}s` }} />)}
    </g>
  );
}

function Summit() {
  return (
    <g>
      <g filter="url(#km-paint)">
        <path d="M1330 600 L1400 300 L1446 156 L1490 300 L1560 600 Z" fill="url(#km-spire)" />
        <path d="M1446 156 L1490 300 L1560 600 L1450 600 Z" fill="#26313A" opacity="0.55" />
        <path d="M1446 156 L1462 210 L1450 204 L1438 216 L1428 204 Z" fill="#F4F2EA" />
        <path d="M1300 640 C1360 600 1520 600 1600 620 L1600 700 L1300 700 Z" fill="#2F444A" />
      </g>
      {/* switchback steps carved in the rock */}
      <path d="M1396 300 L1420 280 L1404 262 L1428 240 L1416 222" fill="none" stroke={C.parchment} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 3" />
      {/* the beacon temple */}
      <g transform={`translate(${BEACON.x} ${BEACON.y})`}>
        <g className="anim-rays" opacity="0.5">
          {Array.from({ length: 12 }, (_, i) => <path key={i} d="M0 0 L-7 -120 L7 -120 Z" fill="#ECCB8B" opacity="0.18" transform={`rotate(${i * 30})`} />)}
        </g>
        <circle r="60" fill="url(#km-beacon)" className="anim-pulse" />
        <rect x="-12" y="-6" width="24" height="10" fill="#C9BEA6" stroke={C.ink} strokeWidth="1.2" />
        <path d="M-15 -6 L0 -22 L15 -6 Z" fill="#D9AD63" stroke={C.ink} strokeWidth="1.2" />
        <circle cy="-12" r="4" fill="#FFF6DD" />
      </g>
    </g>
  );
}


function Village() {
  const cottages: [number, number, number][] = [[1180, 842, 1], [1222, 856, 0.85], [1262, 838, 0.95], [1318, 864, 0.8]];
  return (
    <g>
      {cottages.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <ellipse cx="6" cy="2" rx="22" ry="4" fill="#0D1B17" opacity="0.35" />
          <rect x="-14" y="-18" width="28" height="20" fill="#D8CBB0" stroke={C.ink} strokeWidth="1.2" />
          <rect x="0" y="-18" width="14" height="20" fill="#AE9F84" />
          <path d="M-18 -18 L0 -34 L18 -18 Z" fill={i % 2 ? '#6E3B3B' : '#8C6B4F'} stroke={C.ink} strokeWidth="1.2" />
          <rect x="-8" y="-12" width="6" height="6" fill="#FCE7B8" className="anim-pulse" style={{ animationDelay: `${i * 0.8}s` }} />
          <rect x="6" y="-30" width="4" height="8" fill="#5B4636" />
        </g>
      ))}
      {/* windmill */}
      <g transform="translate(1390 846)">
        <ellipse cx="8" cy="2" rx="22" ry="4" fill="#0D1B17" opacity="0.35" />
        <path d="M-12 0 L-7 -46 L7 -46 L12 0 Z" fill="#CFC2A6" stroke={C.ink} strokeWidth="1.2" />
        <path d="M0 -46 L7 -46 L12 0 L0 0 Z" fill="#A89A7E" />
        <path d="M-10 -46 L0 -58 L10 -46 Z" fill="#6E3B3B" stroke={C.ink} strokeWidth="1.2" />
        <g transform="translate(0 -46)">
          <g style={{ animation: 'spin 9s linear infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
            {[0, 90, 180, 270].map((a) => (
              <g key={a} transform={`rotate(${a})`}>
                <rect x="-2" y="-34" width="4" height="34" fill="#5B4636" />
                <rect x="2" y="-32" width="8" height="24" fill="#F0E6D1" stroke={C.ink} strokeWidth="0.8" opacity="0.92" />
              </g>
            ))}
            <circle r="3.5" fill={C.ink} />
          </g>
        </g>
      </g>
      {/* grazing sheep */}
      {[[1110, 900], [1124, 906], [1460, 890], [1476, 884]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <ellipse rx="6" ry="4" fill="#F4EFE4" />
          <circle cx="5.5" cy="-1" r="2.2" fill={C.ink} />
        </g>
      ))}
    </g>
  );
}

function Birds() {
  return (
    <g fill="none" stroke="#F0E6D1" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round">
      <g style={{ animation: 'drift 22s ease-in-out infinite alternate' }}>
        {[[180, 300, 1], [204, 288, 0.8], [222, 308, 0.9], [246, 296, 0.7], [198, 322, 0.75]].map(([x, y, s], i) => (
          <path key={i} d={`M${x - 8 * s} ${y} q ${4 * s} ${-5 * s} ${8 * s} 0 q ${4 * s} ${-5 * s} ${8 * s} 0`} />
        ))}
      </g>
    </g>
  );
}

/** Painted world, back to front. */
export const Scenery = memo(function Scenery() {
  return (
    <g>
      <Sky />
      <Birds />
      <DistantRange />
      <CrystalPeaks />
      <Summit />
      <Starfields />
      <CloudSea />
      <FloatingIslands />
      <Lowlands />
      <River />
      <GlassLake />
      <OldKingdom />
      <Village />
      <Forest />
    </g>
  );
});

/** Mist that hangs over regions the explorer hasn't reached; it lifts as they advance. */
export function Fog({ reached }: { reached: number }) {
  const banks: [number, number, number, number][] = [
    [566, 800, 230, 70], [944, 700, 220, 90], [640, 470, 260, 110], [1004, 372, 260, 150], [1268, 470, 200, 90], [1420, 260, 170, 170],
  ];
  return (
    <g pointerEvents="none">
      {banks.map(([x, y, rx, ry], i) => (
        <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="url(#km-mist)" style={{ opacity: i + 1 > reached ? 0.38 : 0, transition: 'opacity 1.6s ease' }} />
      ))}
    </g>
  );
}

export function PaperOverlay() {
  return (
    <g pointerEvents="none">
      <rect width={W} height={H} filter="url(#km-grain)" />
      <rect x="6" y="6" width={W - 12} height={H - 12} fill="none" stroke={C.parchment} strokeOpacity="0.16" strokeWidth="2" rx="14" />
    </g>
  );
}
