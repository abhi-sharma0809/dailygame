import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Airship, type ExplorerMood } from './Airship';
import { BACK, FAR, FRONT, HORIZON, MID, horizonActors, layerExtent, makeFarRenderer, makeFrontRenderer, makeHorizonRenderer, makeMidRenderer, midActors } from './art/back';
import { makeNearRenderer, nearActors, nearUnderActors } from './art/near';
import { RoutePainter, SkyPainter, WeatherPainter } from './canvas';
import { JourneyEngine } from './engine';
import { EngineContext, Layer, ViewContext, type View } from './Layer';
import { DEFAULT_STYLE, type TravelStyle } from './motion';
import { BEACON_X, BEACON_Y, LM_X, ROUTE_Y, SKIES, WORLD_END, WORLD_START, clamp, regionAt, regionIndex, scoreToX } from './world';

/* ============================================================
 * JourneyWorld — the living, side-on Atlas the explorer crosses while
 * playing. Gameplay passes a journey score; the world does the rest:
 * the airship flies to the matching point on the route, destinations
 * light up as they are reached, and time of day moves from dawn at the
 * Forgotten Forest to an aurora night at the Summit.
 *
 * The score alone decides *where* the ship goes (scoreToX). `travel`
 * decides *how* it gets there: bumping `reactKey` launches the ship in that
 * style, even if the score didn't change (a miss sputters in place).
 * ============================================================ */

export type { ExplorerMood, TravelStyle };

interface Props {
  /** journey points 0–700 */
  score: number;
  reducedMotion: boolean;
  mood: ExplorerMood;
  /** bump to launch the explorer (in the `travel` style) and replay its reaction */
  reactKey: number;
  /** how the next launch looks: from the answer's tier */
  travel?: TravelStyle;
  onLaunch?: (style: TravelStyle, moving: boolean) => void;
  /** the explorer has landed and come to rest */
  onSettle?: () => void;
  /** a destination (0–6) or the beacon (7) was reached by travelling */
  onLandmark?: (i: number) => void;
  onRegion?: (i: number) => void;
  onArrive?: () => void;
  /** move the ship on screen by this fraction of the view (negative = left / up); the camera pans there */
  shift?: { x: number; y: number };
  className?: string;
}

const litFor = (score: number) => Array.from({ length: 8 }, (_, i) => (i === 7 ? score >= 700 : score >= i * 100));

function computeView(w: number, h: number): View {
  const portrait = h > w * 1.1;
  // phones are zoomed in a little and frame the explorer lower, above the dock
  const s = Math.min(h / 900, w / (portrait ? 640 : 1100));
  const viewW = w / s;
  const viewH = h / s;
  return { s, viewW, viewH, ax: viewW * (portrait ? 0.3 : 0.36), ay: viewH * (portrait ? 0.4 : 0.4), portrait };
}

export const JourneyWorld = memo(function JourneyWorld({ score, reducedMotion, mood, reactKey, travel, onLandmark, onRegion, onArrive, onLaunch, onSettle, shift, className }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [engine] = useState(() => new JourneyEngine(scoreToX(score), reducedMotion));
  const [view, setView] = useState<View>(() => computeView(typeof window !== 'undefined' ? window.innerWidth : 1440, typeof window !== 'undefined' ? window.innerHeight : 900));
  const [lit, setLit] = useState(() => litFor(score));
  const [region, setRegion] = useState(() => regionIndex(scoreToX(score)));
  const cbs = useRef({ onLandmark, onRegion, onArrive, onLaunch, onSettle });
  cbs.current = { onLandmark, onRegion, onArrive, onLaunch, onSettle };
  const travelRef = useRef(travel);
  travelRef.current = travel;
  const flashRef = useRef<HTMLDivElement>(null);

  const skyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sunRef = useRef<HTMLDivElement>(null);
  const moonRef = useRef<HTMLDivElement>(null);
  const skyCanvas = useRef<HTMLCanvasElement>(null);
  const routeCanvas = useRef<HTMLCanvasElement>(null);
  const weatherCanvas = useRef<HTMLCanvasElement>(null);
  const weather = useRef<WeatherPainter | null>(null);
  const routeP = useRef<RoutePainter | null>(null);

  // where the ship actually rests (written on mount and every time it settles; read by e2e checks)
  useLayoutEffect(() => { if (root.current) root.current.dataset.shipX = engine.frame.ex.toFixed(1); }, [engine]);

  // size
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setView((v) => { const n = computeView(r.width, r.height); return Math.abs(n.s - v.s) < 1e-4 && Math.abs(n.viewW - v.viewW) < 0.5 && Math.abs(n.viewH - v.viewH) < 0.5 ? v : n; });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // engine lifecycle: one loop per mounted world
  useEffect(() => {
    engine.reduced = reducedMotion;
    engine.maxLead = Math.min(320, view.viewW * 0.16);
    engine.onLandmark = (i) => {
      setLit((l) => { if (l[i]) return l; const n = l.slice(); n[i] = true; return n; });
      if (routeP.current) routeP.current.reached = Math.max(routeP.current.reached, i + 1);
      // a fountain of sparks where the destination sits on screen
      const f = engine.frame;
      const lx = i === 7 ? BEACON_X : LM_X[i];
      const ly = i === 7 ? BEACON_Y : ROUTE_Y[i];
      weather.current?.burst((view.ax + lx - f.camX) * view.s, (view.ay + ly - f.camY + 40) * view.s, i === 7 ? 70 : 40);
      cbs.current.onLandmark?.(i);
    };
    engine.onRegion = (i) => { setRegion(i); cbs.current.onRegion?.(i); };
    engine.onLaunch = (style, moving) => { if (moving || style.power === 0) routeP.current?.launch(engine.frame, view); cbs.current.onLaunch?.(style, moving); };
    engine.onArrive = () => { routeP.current?.land(engine.frame, view); cbs.current.onArrive?.(); };
    engine.onSettle = () => {
      if (root.current) root.current.dataset.shipX = engine.frame.ex.toFixed(1);
      cbs.current.onSettle?.();
    };
    engine.start();
    return () => engine.stop();
  }, [engine, reducedMotion, view]);

  // painters + sky, all on the engine's frame
  useEffect(() => {
    const sky = skyCanvas.current ? new SkyPainter(skyCanvas.current) : null;
    const route = routeCanvas.current ? new RoutePainter(routeCanvas.current) : null;
    if (route) route.reached = lit.filter(Boolean).length;
    const w = weatherCanvas.current ? new WeatherPainter(weatherCanvas.current, view.portrait ? 50 : 90) : null;
    routeP.current = route;
    weather.current = w;
    let lastR = -1;
    const horizon = (view.ay + 170) * view.s;
    return engine.subscribe((f) => {
      const rr = regionAt(f.camX);
      if (Math.abs(rr - lastR) > 0.0005) {
        lastR = rr;
        const base = Math.floor(rr);
        // only the two skies being blended stay composited
        skyRefs.current.forEach((el, i) => {
          if (!el) return;
          const op = i < base ? 0 : i === base ? 1 : i === base + 1 ? rr - base : 0;
          el.style.opacity = String(op);
          el.style.display = op > 0 ? '' : 'none';
        });
        // the sun climbs through the morning and sets at the peaks; the moon takes over
        const e = Math.sin((Math.PI * (rr + 0.55)) / 5.1);
        const sun = sunRef.current;
        if (sun) {
          const x = (0.84 - rr * 0.035) * view.viewW * view.s;
          const y = horizon - e * horizon * 0.72;
          sun.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          sun.style.opacity = String(clamp((4.75 - rr) / 0.35, 0, 1));
        }
        const moon = moonRef.current;
        if (moon) {
          const m = clamp((rr - 4.3) / 1.4, 0, 1);
          moon.style.transform = `translate3d(${(view.viewW * view.s * (0.66 - m * 0.08)).toFixed(1)}px, ${(horizon - m * horizon * 0.62).toFixed(1)}px, 0)`;
          moon.style.opacity = String(m);
        }
      }
      sky?.draw(f, view, engine.reduced);
      route?.draw(f, view, engine.reduced);
      w?.draw(f, view, engine.reduced);
      // a soft bloom of light from the ship on a strong launch
      const fl = flashRef.current;
      if (fl) {
        const on = f.flash > 0.005 && !engine.reduced;
        if (on) {
          fl.style.setProperty('--fx', `${((view.ax + f.ex - f.camX) * view.s).toFixed(0)}px`);
          fl.style.setProperty('--fy', `${((view.ay + f.ey - 40 - f.camY) * view.s).toFixed(0)}px`);
          fl.style.setProperty('--glow', f.style.color);
        }
        fl.style.opacity = on ? f.flash.toFixed(3) : '0';
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, view]);

  // framing
  const sx = shift?.x ?? 0, sy = shift?.y ?? 0;
  useEffect(() => { engine.focus = { x: -sx * view.viewW, y: -sy * view.viewH }; }, [engine, sx, sy, view]);

  // score → destination; reactKey → launch in the answer's style.
  // The destination is always scoreToX(score): the engine only decides how to get there.
  const commanded = useRef({ x: scoreToX(score), key: reactKey });
  useEffect(() => {
    const x = scoreToX(score);
    const launched = reactKey !== commanded.current.key;
    if (!launched && Math.abs(x - commanded.current.x) < 0.5) return;
    commanded.current = { x, key: reactKey };
    if (root.current) root.current.dataset.targetX = x.toFixed(1);
    engine.travelTo(x, launched ? travelRef.current ?? DEFAULT_STYLE : DEFAULT_STYLE);
  }, [score, reactKey, engine]);

  /* ------------------------------------------------ layers */
  const pal = BACK[region];
  const horizonRender = useMemo(() => makeHorizonRenderer(pal), [pal]);
  const farRender = useMemo(() => makeFarRenderer(pal), [pal]);
  const midRender = useMemo(() => makeMidRenderer(pal), [pal]);
  const litKey = lit.map((x) => (x ? 1 : 0)).join('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nearRender = useMemo(() => makeNearRenderer(lit), [litKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nActors = useMemo(() => nearActors(lit), [litKey]);
  const nUnder = useMemo(() => nearUnderActors(), []);
  const frontRender = useMemo(() => makeFrontRenderer(view), [view]);
  const hActors = useMemo(() => horizonActors(view, pal, region), [view, pal, region]);
  const mActors = useMemo(() => midActors(pal), [pal]);
  const hExt = layerExtent(HORIZON.f, view);
  const fExt = layerExtent(FAR.f, view);
  const mExt = layerExtent(MID.f, view);
  const frExt = layerExtent(FRONT.f, view);

  const horizonPx = (view.ay + 170) * view.s;
  const skyBg = useCallback((i: number) => {
    const k = SKIES[i];
    const hz = horizonPx;
    return `linear-gradient(to bottom, ${k.top} 0px, ${k.mid} ${(hz * 0.45).toFixed(0)}px, ${k.low} ${(hz * 0.82).toFixed(0)}px, ${k.horizon} ${hz.toFixed(0)}px, ${k.haze} ${(hz + 160 * view.s).toFixed(0)}px)`;
  }, [horizonPx, view.s]);
  const sunR = 46 * view.s;
  const sky = SKIES[region];

  return (
    <EngineContext.Provider value={engine}>
      <ViewContext.Provider value={view}>
        <div ref={root} className={`absolute inset-0 overflow-hidden ${className ?? ''}`} style={{ background: SKIES[0].top, contain: 'strict' }} data-target-x={scoreToX(score).toFixed(1)} aria-hidden>
          {/* sky: seven times of day, crossfaded by position */}
          {SKIES.map((_, i) => (
            <div key={i} ref={(el) => { skyRefs.current[i] = el; }} className="absolute inset-0" style={{ background: skyBg(i), opacity: i === 0 ? 1 : 0, willChange: 'opacity' }} />
          ))}
          <div ref={sunRef} className="absolute left-0 top-0" style={{ willChange: 'transform, opacity' }}>
            <div className="absolute rounded-full" style={{ width: sunR * 9, height: sunR * 9, left: -sunR * 4.5, top: -sunR * 4.5, background: `radial-gradient(closest-side, ${sky.sun}66, ${sky.sun}00)`, transition: 'background 2.5s' }} />
            <div className="absolute rounded-full" style={{ width: sunR * 2, height: sunR * 2, left: -sunR, top: -sunR, background: sky.sun, boxShadow: `0 0 ${sunR}px ${sunR * 0.4}px ${sky.sun}88`, transition: 'background 2.5s, box-shadow 2.5s' }} />
          </div>
          <div ref={moonRef} className="absolute left-0 top-0" style={{ opacity: 0, willChange: 'transform, opacity' }}>
            <div className="absolute rounded-full" style={{ width: sunR * 7, height: sunR * 7, left: -sunR * 3.5, top: -sunR * 3.5, background: 'radial-gradient(closest-side, rgba(220,230,255,.25), rgba(220,230,255,0))' }} />
            <div className="absolute rounded-full" style={{ width: sunR * 1.5, height: sunR * 1.5, left: -sunR * 0.75, top: -sunR * 0.75, background: 'radial-gradient(circle at 38% 36%, #FFFBEF, #E6E2D2 60%, #C9C3B0)' }} />
          </div>
          <canvas ref={skyCanvas} className="absolute inset-0 h-full w-full" />

          <Layer f={HORIZON.f} fy={HORIZON.fy} top={-800} height={3400} tile={1600} minX={hExt.minX} maxX={hExt.maxX} renderTile={horizonRender} actors={hActors} version={region} />
          <Layer f={FAR.f} fy={FAR.fy} top={-900} height={3400} tile={1600} minX={fExt.minX} maxX={fExt.maxX} renderTile={farRender} version={region} />
          <Layer f={MID.f} fy={MID.fy} top={-1100} height={3800} tile={1400} minX={mExt.minX} maxX={mExt.maxX} renderTile={midRender} actors={mActors} version={region} />
          {/* atmospheric haze between the distance and the near ground */}
          <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent ${(horizonPx * 0.7).toFixed(0)}px, ${sky.haze}40 ${(horizonPx + 60 * view.s).toFixed(0)}px, transparent ${(horizonPx + 420 * view.s).toFixed(0)}px)`, transition: 'background 2.5s' }} />
          <Layer f={1} fy={1} top={-1500} height={4200} tile={1300} minX={WORLD_START - 800} maxX={WORLD_END + 800} renderTile={nearRender} actors={nActors} underActors={nUnder} version={litKey} />
          <canvas ref={routeCanvas} className="absolute inset-0 h-full w-full" />
          <Airship mood={mood} reactKey={reactKey} night={region >= 4} rim={sky.horizon} reducedMotion={reducedMotion} />
          <Layer f={FRONT.f} fy={FRONT.fy} top={-2400} height={5200} tile={1600} minX={frExt.minX} maxX={frExt.maxX} renderTile={frontRender} />
          <canvas ref={weatherCanvas} className="absolute inset-0 h-full w-full" />
          {/* vignette */}
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(5,9,14,.5) 100%)' }} />
          {/* launch bloom (driven per frame) */}
          <div ref={flashRef} className="pointer-events-none absolute inset-0" style={{ opacity: 0, background: 'radial-gradient(42vmax 32vmax at var(--fx, 50%) var(--fy, 50%), color-mix(in srgb, var(--glow, #FFD978) 60%, transparent), transparent 70%)' }} />
        </div>
      </ViewContext.Provider>
    </EngineContext.Provider>
  );
});

