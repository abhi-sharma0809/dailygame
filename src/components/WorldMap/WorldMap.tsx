import { animate, useMotionValue } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Explorer, type ExplorerMood } from './Explorer';
import { BEACON, H, LANDMARKS, TRAIL_D, W, scoreToLength } from './geometry';
import { Fog, PaperOverlay, Scenery, SceneryDefs } from './Scenery';

export interface WorldMapProps {
  /** journey points (0–700) — positions the explorer */
  score: number;
  /** 'full' shows the whole atlas; 'follow' frames the explorer and travels with it */
  view?: 'full' | 'follow';
  /** width of the camera window in follow view (map units) */
  zoom?: number;
  mood?: ExplorerMood;
  burstKey?: number;
  reducedMotion?: boolean;
  interactive?: boolean;
  showLabels?: boolean;
  /** draw the explorer */
  explorer?: boolean;
  className?: string;
  /** seconds for the explorer to travel to a new score */
  travelSeconds?: number;
  onLandmark?: (i: number) => void;
  selected?: number | null;
  ariaLabel?: string;
  id?: string;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function WorldMap({
  score, view = 'full', zoom = 760, mood = 'idle', burstKey = 0, reducedMotion = false, interactive = false, showLabels = true,
  explorer = true, className = '', travelSeconds = 1.8, onLandmark, selected = null, ariaLabel, id,
}: WorldMapProps) {
  const trailRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const shipRef = useRef<SVGGElement>(null);
  const traveledRef = useRef<SVGPathElement>(null);
  const [geom, setGeom] = useState<{ total: number; marks: number[] } | null>(null);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [hover, setHover] = useState<number | null>(null);
  const len = useMotionValue(0);
  const lastX = useRef<number | null>(null);

  // measure the trail once: total length and the length at each landmark
  useLayoutEffect(() => {
    const p = trailRef.current;
    if (!p) return;
    const total = p.getTotalLength();
    const marks = LANDMARKS.map((lm) => {
      let best = 0;
      let bestD = Infinity;
      for (let l = 0; l <= total; l += 3) {
        const pt = p.getPointAtLength(l);
        const d = (pt.x - lm.x) ** 2 + (pt.y - lm.y) ** 2;
        if (d < bestD) { bestD = d; best = l; }
      }
      return best;
    });
    setGeom({ total, marks });
    len.set(scoreToLength(score, marks, total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // place the ship, the traveled trail and the camera for a trail length
  useEffect(() => {
    if (!geom) return;
    const apply = (l: number) => {
      const p = trailRef.current;
      if (!p) return;
      const pt = p.getPointAtLength(l);
      shipRef.current?.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${(pt.y - 52).toFixed(1)})`);
      traveledRef.current?.setAttribute('stroke-dasharray', `${l.toFixed(1)} ${geom.total}`);
      if (lastX.current != null && Math.abs(pt.x - lastX.current) > 0.6) setFacing(pt.x >= lastX.current ? 1 : -1);
      lastX.current = pt.x;
      if (view === 'follow' && svgRef.current) {
        const vw = zoom;
        const vh = vw * (H / W) * 0.62;
        const x = clamp(pt.x - vw / 2, 0, W - vw);
        const y = clamp(pt.y - vh * 0.58, 0, H - vh);
        svgRef.current.setAttribute('viewBox', `${x.toFixed(1)} ${y.toFixed(1)} ${vw} ${vh.toFixed(1)}`);
      }
    };
    apply(len.get());
    return len.on('change', apply);
  }, [geom, len, view, zoom]);

  // travel to the new score
  useEffect(() => {
    if (!geom) return;
    const target = scoreToLength(score, geom.marks, geom.total);
    if (reducedMotion) { len.set(target); return; }
    const c = animate(len, target, { duration: Math.abs(target - len.get()) < 2 ? 0 : travelSeconds, ease: [0.45, 0, 0.2, 1] });
    return () => c.stop();
  }, [score, geom, len, reducedMotion, travelSeconds]);

  const reached = Math.min(6, Math.floor(score / 100 + 1e-9));
  const fullBox = `0 0 ${W} ${H}`;

  return (
    <svg
      ref={svgRef}
      id={id}
      viewBox={view === 'follow' ? `0 0 ${zoom} ${(zoom * (H / W) * 0.62).toFixed(1)}` : fullBox}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={ariaLabel ?? `Atlas of Connections — the explorer has reached ${LANDMARKS[reached].name}`}
    >
      <SceneryDefs />
      <Scenery />
      <Fog reached={reached} />

      {/* the trail: dark underlay, parchment dashes, gold for the distance traveled */}
      <path ref={trailRef} d={TRAIL_D} fill="none" stroke="#1A2620" strokeOpacity="0.55" strokeWidth="9" strokeLinecap="round" />
      <path d={TRAIL_D} fill="none" stroke="#F0E6D1" strokeOpacity="0.75" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
      <path ref={traveledRef} d={TRAIL_D} fill="none" stroke="#ECCB8B" strokeWidth="4" strokeLinecap="round" strokeDasharray="0 99999" style={{ filter: 'drop-shadow(0 0 4px rgba(236,203,139,.8))' }} />

      {/* landmarks */}
      {LANDMARKS.map((lm, i) => {
        const passed = i <= reached;
        const next = i === reached + 1;
        const active = hover === i || selected === i;
        return (
          <g
            key={i}
            transform={`translate(${lm.x} ${lm.y})`}
            className={interactive ? 'cursor-pointer' : undefined}
            onMouseEnter={interactive ? () => setHover(i) : undefined}
            onMouseLeave={interactive ? () => setHover(null) : undefined}
            onClick={interactive && onLandmark ? () => onLandmark(i) : undefined}
            onKeyDown={interactive && onLandmark ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLandmark(i); } } : undefined}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? 'button' : undefined}
            aria-label={interactive ? `${lm.name}${passed ? ' — reached' : ''}` : undefined}
          >
            {next && !reducedMotion && <circle r="26" fill="none" stroke="#ECCB8B" strokeWidth="2" className="anim-pulse" />}
            <circle r={active ? 21 : 18} fill={passed ? '#D9AD63' : '#26323A'} stroke={passed ? '#FFF1CC' : '#F0E6D1'} strokeOpacity={passed ? 1 : 0.55} strokeWidth="2" style={{ transition: 'r .2s' }} />
            <circle r="13" fill="none" stroke={passed ? '#26323A' : '#F0E6D1'} strokeOpacity="0.4" strokeWidth="1" />
            <text y="5" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="14" fontWeight="700" fill={passed ? '#26323A' : '#F0E6D1'}>{lm.numeral}</text>
            {showLabels && (
              <g transform={`translate(0 ${lm.labelDy})`} opacity={active || passed || next ? 1 : 0.8}>
                <rect x={-lm.name.length * 4.6 - 12} y="-13" width={lm.name.length * 9.2 + 24} height="24" rx="12" fill="#F0E6D1" fillOpacity={passed ? 0.96 : 0.82} stroke="#26323A" strokeOpacity="0.4" />
                <text y="4" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="14" fontStyle="italic" fontWeight="600" fill="#26323A">{lm.name}</text>
              </g>
            )}
          </g>
        );
      })}

      {/* the beacon goal marker */}
      <circle cx={BEACON.x} cy={BEACON.y} r="6" fill="#FFF6DD" />

      {explorer && (
        <g ref={shipRef}>
          <Explorer mood={mood} facing={facing} reducedMotion={reducedMotion} burstKey={burstKey} />
        </g>
      )}

      <PaperOverlay />
    </svg>
  );
}
