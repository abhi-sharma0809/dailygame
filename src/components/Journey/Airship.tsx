import { motion, useAnimationControls } from 'framer-motion';
import { memo, useContext, useEffect, useRef } from 'react';
import { EngineContext, useView } from './Layer';

/* ============================================================
 * The explorer: a patched airship with a wooden gondola, a pilot in a long
 * scarf, a bow lantern and a stern propeller. Origin = the route point
 * (the gondola's deck). Faces right; the journey runs left → right.
 *
 * Position, pitch, bob and engine glow come from the engine every frame
 * (direct DOM writes). The glow, jet flame and aura take the colour and
 * power of the answer that launched the ship. Reactions (`mood`) are
 * one-shot framer-motion sequences on an inner group, replayed only when
 * `reactKey` changes.
 * ============================================================ */

export type ExplorerMood = 'idle' | 'travel' | 'cheer' | 'celebrate' | 'miss';

interface Props { mood: ExplorerMood; reactKey: number; night: boolean; rim: string; reducedMotion: boolean }

const VB = { x: -110, y: -105, w: 210, h: 150 };

export const Airship = memo(function Airship({ mood, reactKey, night, rim, reducedMotion }: Props) {
  const engine = useContext(EngineContext)!;
  const view = useView();
  const outer = useRef<HTMLDivElement>(null);
  const prop = useRef<SVGEllipseElement>(null);
  const jet = useRef<SVGGElement>(null);
  const jetFill = useRef<SVGPathElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const aura = useRef<HTMLDivElement>(null);
  const body = useAnimationControls();
  const arm = useAnimationControls();
  const k = view.portrait ? 1.25 : 1; // a touch larger on phones, where the world is zoomed out

  useEffect(() => {
    let color = '';
    return engine.subscribe((f) => {
      const el = outer.current;
      if (!el) return;
      const x = (view.ax + f.ex - f.camX) * view.s;
      const y = (view.ay + f.ey - f.camY + f.bob) * view.s;
      const p = f.style.power;
      // wind-up squash: the ship gathers itself before it launches
      const sq = f.charge * (0.03 + 0.05 * p);
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${f.tilt.toFixed(2)}deg) scale(${(1 + sq).toFixed(4)}, ${(1 - sq * 1.2).toFixed(4)})`;
      if (prop.current) prop.current.style.opacity = String(Math.min(0.85, Math.abs(f.vx) / 500 + f.boost * 0.5));
      if (f.style.color !== color) {
        color = f.style.color;
        el.style.setProperty('--glow', color);
        jetFill.current?.setAttribute('fill', color);
      }
      const b = reducedMotion ? 0 : f.boost;
      if (jet.current) {
        jet.current.setAttribute('transform', `translate(-46 12) scale(${(0.25 + b * (0.6 + 1.3 * p)).toFixed(3)} ${(0.7 + b * 0.5).toFixed(3)})`);
        jet.current.style.opacity = String(Math.min(1, b * 1.6));
      }
      if (glow.current) glow.current.style.opacity = String(Math.min(1, b * 1.3));
      if (aura.current) aura.current.style.opacity = String(Math.min(0.9, b * p * 0.9 + f.flash * 0.6));
    });
  }, [engine, view, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !reactKey) return;
    // the pilot reacts to the verdict first; the engine (see engine.ts) then winds up and launches
    if (mood === 'celebrate') {
      void body.start({ y: [0, -14, 0, -6, 0], rotate: [0, -5, 3, -1, 0], transition: { duration: 1.1, ease: 'easeOut', delay: 0.5 } });
      void arm.start({ rotate: [0, -70, -30, -75, -30, -70, -30, -70, 0], transition: { duration: 2.2, ease: 'easeInOut' } });
    } else if (mood === 'cheer') {
      void body.start({ y: [0, -8, 0], rotate: [0, -3, 0], transition: { duration: 0.8, ease: 'easeOut', delay: 0.4 } });
      void arm.start({ rotate: [0, -65, -30, -65, 0], transition: { duration: 1.3, ease: 'easeInOut' } });
    } else if (mood === 'travel') {
      void arm.start({ rotate: [0, -40, 0], transition: { duration: 0.8, ease: 'easeInOut' } });
    } else if (mood === 'miss') {
      void body.start({ y: [0, 8, 3, 0], rotate: [0, 4, -2, 0], transition: { duration: 1.2, ease: 'easeOut' } });
    }
  }, [reactKey, mood, reducedMotion, body, arm]);

  const s = view.s * k;
  return (
    <div ref={outer} className="pointer-events-none absolute left-0 top-0" style={{ willChange: 'transform', zIndex: 30, ['--glow' as string]: '#F6CD7E' }} aria-hidden>
      {/* aura: the whole ship lights up on strong answers */}
      <div ref={aura} className="absolute rounded-full" style={{ width: 320 * s, height: 220 * s, left: -160 * s, top: -150 * s, opacity: 0, background: 'radial-gradient(closest-side, color-mix(in srgb, var(--glow) 55%, transparent), transparent)', willChange: 'opacity' }} />
      {/* engine glow at the stern */}
      <div ref={glow} className="absolute rounded-full" style={{ width: 120 * s, height: 120 * s, left: -106 * s, top: -48 * s, opacity: 0, background: 'radial-gradient(closest-side, #FFF8E6 0%, var(--glow) 32%, transparent 100%)', willChange: 'opacity' }} />
      <svg
        width={VB.w * s}
        height={VB.h * s}
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        style={{ position: 'absolute', left: VB.x * s, top: VB.y * s, overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="as-env" cx="0.62" cy="0.28" r="0.8">
            <stop offset="0" stopColor="#FFF8EA" />
            <stop offset="0.45" stopColor="#F0E2C6" />
            <stop offset="1" stopColor="#B9A27E" />
          </radialGradient>
          <linearGradient id="as-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.45" stopColor="#2A2230" stopOpacity="0" />
            <stop offset="1" stopColor="#2A2230" stopOpacity="0.38" />
          </linearGradient>
          <radialGradient id="as-lamp">
            <stop offset="0" stopColor="#FFE9B0" stopOpacity="0.95" />
            <stop offset="0.35" stopColor="#FFC970" stopOpacity="0.35" />
            <stop offset="1" stopColor="#FFC970" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="as-hull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9A6E48" />
            <stop offset="1" stopColor="#5B3E2A" />
          </linearGradient>
          <clipPath id="as-clip"><ellipse cx="0" cy="-50" rx="64" ry="36" /></clipPath>
        </defs>

        <motion.g animate={body} style={{ originX: '0px', originY: '-20px' }}>
          {/* lantern glow (night) */}
          <circle cx="46" cy="14" r="46" fill="url(#as-lamp)" style={{ opacity: night ? 1 : 0.25, transition: 'opacity 2s' }} />

          {/* stern fins */}
          <path d="M-58 -58 L-86 -84 Q-90 -70 -80 -52 Z" fill="#B7583A" />
          <path d="M-58 -42 L-86 -18 Q-90 -30 -80 -48 Z" fill="#8F4430" />
          <path d="M-60 -50 L-92 -50" stroke="#6E3424" strokeWidth="3" strokeLinecap="round" />

          {/* envelope */}
          <ellipse cx="0" cy="-50" rx="64" ry="36" fill="url(#as-env)" />
          <g clipPath="url(#as-clip)">
            {/* gores: alternating terracotta and saffron panels */}
            <path d="M0 -86 A 46 36 0 0 1 0 -14 A 30 36 0 0 0 0 -86 Z" fill="#C8693F" />
            <path d="M0 -86 A 46 36 0 0 0 0 -14 A 30 36 0 0 1 0 -86 Z" fill="#C8693F" />
            <ellipse cx="0" cy="-50" rx="12" ry="36" fill="#E2B15E" />
            {[12, 30, 46, 58].map((rx) => (
              <g key={rx} fill="none" stroke="#5B3A2A" strokeOpacity="0.28" strokeWidth="0.9">
                <path d={`M0 -86 A ${rx} 36 0 0 1 0 -14`} />
                <path d={`M0 -86 A ${rx} 36 0 0 0 0 -14`} />
              </g>
            ))}
            {/* patch with stitches */}
            <g transform="rotate(-14 -30 -60)">
              <rect x="-40" y="-68" width="17" height="13" fill="#7FA9BE" />
              <rect x="-40" y="-68" width="17" height="13" fill="none" stroke="#F8F3E8" strokeWidth="1" strokeDasharray="2 2" />
            </g>
            <ellipse cx="0" cy="-50" rx="64" ry="36" fill="url(#as-shade)" />
            <ellipse cx="22" cy="-70" rx="24" ry="9" fill="#FFFFFF" opacity="0.45" />
          </g>
          {/* rim light from the sky ahead */}
          <path d="M30 -82 A 64 36 0 0 1 60 -36" fill="none" stroke={rim} strokeWidth="3" strokeLinecap="round" style={{ opacity: 0.85, transition: 'stroke 2s' }} />
          <ellipse cx="0" cy="-50" rx="64" ry="36" fill="none" stroke="#3A2A24" strokeOpacity="0.55" strokeWidth="1.4" />
          {/* belly band */}
          <path d="M-54 -32 Q 0 -6 54 -32" fill="none" stroke="#6B4A32" strokeWidth="2.5" />
          {[-40, -14, 14, 40].map((x) => <circle key={x} cx={x} cy={x === -40 || x === 40 ? -26 : -18} r="1.8" fill="#C9A255" />)}

          {/* rigging */}
          <g stroke="#3A2A24" strokeWidth="1" strokeOpacity="0.8">
            <line x1="-40" y1="-26" x2="-30" y2="0" />
            <line x1="-14" y1="-18" x2="-10" y2="0" />
            <line x1="14" y1="-18" x2="12" y2="0" />
            <line x1="40" y1="-26" x2="32" y2="0" />
          </g>

          {/* stern pennant */}
          <line x1="-34" y1="2" x2="-34" y2="-14" stroke="#4A3426" strokeWidth="1.6" />
          <path d="M-34 -14 L-54 -10 L-48 -7 L-54 -4 L-34 -6 Z" fill="#E2B15E" className="anim-flag" style={{ transformOrigin: '-34px -10px' }} />

          {/* pilot */}
          <g transform="translate(10 0)">
            {/* scarf trailing in the wind */}
            <path d="M-3 -12 C -12 -13, -20 -9, -30 -12 C -26 -8, -18 -6, -4 -8 Z" fill="#B7432F" className="anim-scarf" style={{ transformOrigin: '-3px -10px' }} />
            <path d="M-6 2 L-5 -10 Q 0 -13 5 -10 L6 2 Z" fill="#3D5A6C" />
            <circle cx="0" cy="-16" r="5.4" fill="#EBC199" />
            <path d="M-5.6 -17 Q 0 -25 5.6 -17 Z" fill="#6B4A32" />
            <rect x="-1" y="-19" width="6" height="2.6" rx="1.2" fill="#C9A255" />
            <circle cx="3.2" cy="-15" r="0.9" fill="#2A2116" />
            {/* waving arm */}
            <motion.g animate={arm} style={{ originX: '4px', originY: '-8px' }}>
              <path d="M4 -8 L11 -2" stroke="#3D5A6C" strokeWidth="3" strokeLinecap="round" />
              <circle cx="11.5" cy="-1.5" r="1.8" fill="#EBC199" />
            </motion.g>
          </g>

          {/* gondola */}
          <path d="M-40 0 L42 0 Q 40 18 28 24 L-28 24 Q -38 18 -40 0 Z" fill="url(#as-hull)" />
          <path d="M-40 0 L42 0" stroke="#C9A255" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M-37 8 L39 8 M-33 15 L35 15" stroke="#3E2A1C" strokeOpacity="0.5" strokeWidth="1" />
          <path d="M42 0 Q 40 18 28 24" fill="none" stroke="#E7C58A" strokeOpacity="0.5" strokeWidth="1.5" />
          {[-22, -4, 14].map((x) => <circle key={x} cx={x} cy="11" r="2.2" fill="#2B2B33" stroke="#C9A255" strokeWidth="0.9" />)}

          {/* bow lantern */}
          <path d="M42 0 L48 4" stroke="#3A2A24" strokeWidth="1.4" />
          <rect x="44.5" y="5" width="7" height="10" rx="1.5" fill="#FFE2A0" stroke="#4A3426" strokeWidth="1" />
          <path d="M44 5 L52 5 L48 2 Z" fill="#4A3426" />

          {/* jet flame: length and brightness follow the engine's boost */}
          <g ref={jet} transform="translate(-46 12) scale(0.25 0.7)" style={{ opacity: 0 }}>
            <path ref={jetFill} d="M0 0 C -10 -8, -34 -6, -58 0 C -34 6, -10 8, 0 0 Z" fill="#F6CD7E" opacity="0.85" />
            <path d="M0 0 C -6 -4, -18 -3, -30 0 C -18 3, -6 4, 0 0 Z" fill="#FFF8E6" />
          </g>

          {/* propeller */}
          <g transform="translate(-44 12)">
            <rect x="0" y="-1.5" width="6" height="3" fill="#4A3426" />
            <ellipse ref={prop} cx="-1" cy="0" rx="2.6" ry="13" fill="#E8DCC4" style={{ opacity: 0 }} />
            <g className={reducedMotion ? undefined : 'anim-prop'} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              <ellipse cx="-1" cy="-6.5" rx="1.8" ry="6.5" fill="#5B3E2A" />
              <ellipse cx="-1" cy="6.5" rx="1.8" ry="6.5" fill="#5B3E2A" />
            </g>
            <circle cx="-1" cy="0" r="2" fill="#C9A255" />
          </g>
        </motion.g>
      </svg>
    </div>
  );
});
