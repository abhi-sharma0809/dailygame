import { createContext, memo, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { JourneyEngine } from './engine';
import { ROUTE_Y } from './world';

/* ============================================================
 * Parallax layers.
 *
 * A layer is a full-width strip of the world that moves at `f` × the
 * camera's horizontal speed and `fy` × its vertical speed. Its static art
 * is cut into tiles (one <svg> each) and only the tiles near the camera
 * are mounted; animated pieces ("actors") are small positioned elements
 * whose CSS animations run on the compositor. The layer's own transform is
 * written from the engine's frame — React re-renders only when the set of
 * visible tiles changes.
 * ============================================================ */

export interface View {
  /** CSS px per world unit */
  s: number;
  /** viewport in world units */
  viewW: number;
  viewH: number;
  /** where the explorer sits on screen (world units from the top-left) */
  ax: number;
  ay: number;
  portrait: boolean;
}

export const ViewContext = createContext<View>({ s: 1, viewW: 1440, viewH: 900, ax: 520, ay: 360, portrait: false });
export const EngineContext = createContext<JourneyEngine | null>(null);
export const useView = () => useContext(ViewContext);

/** camera y at the start; layers are authored so they line up there */
export const Y0 = ROUTE_Y[0];

/**
 * Author helper: a point that should appear `sy` units below the explorer's
 * screen anchor when the camera is at world x `wx`, in this layer's coordinates.
 */
export const layerPoint = (f: number, fy: number, wx: number, sy: number, routeAt: (x: number) => number) =>
  [wx * f, sy + Y0 + (routeAt(wx) - Y0) * fy] as const;

const NONE: Actor[] = [];

export interface Actor {
  key: string;
  /** layer coords of the actor's box */
  x: number;
  y: number;
  w: number;
  h: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

interface LayerProps {
  f: number;
  fy: number;
  /** vertical extent of the tiles in layer coords */
  top: number;
  height: number;
  tile?: number;
  /** layer-x extent of the art (tiles outside are never mounted) */
  minX: number;
  maxX: number;
  renderTile: (x0: number, x1: number) => ReactNode;
  actors?: Actor[];
  /** actors drawn behind the tile art */
  underActors?: Actor[];
  /** bump to re-render tile art (e.g. palette or lit landmarks changed) */
  version?: string | number;
  className?: string;
  style?: CSSProperties;
  zIndex?: number;
}

export const Layer = memo(function Layer({ f, fy, top, height, tile = 1400, minX, maxX, renderTile, actors = NONE, underActors = NONE, version, className, style, zIndex }: LayerProps) {
  const engine = useContext(EngineContext)!;
  const view = useView();
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<[number, number]>([0, -1]);
  const rangeRef = useRef(range);

  useEffect(() => {
    const margin = 500;
    return engine.subscribe((fr) => {
      const tx = (view.ax - fr.camX * f) * view.s;
      const ty = (view.ay - Y0 - (fr.camY - Y0) * fy) * view.s;
      if (ref.current) ref.current.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
      const lx0 = fr.camX * f - view.ax - margin;
      const lx1 = fr.camX * f - view.ax + view.viewW + margin;
      const a = Math.floor(Math.max(minX, lx0) / tile);
      const b = Math.floor(Math.min(maxX, lx1) / tile);
      const [ra, rb] = rangeRef.current;
      if (a !== ra || b !== rb) { rangeRef.current = [a, b]; setRange([a, b]); }
    });
  }, [engine, view, f, fy, tile, minX, maxX]);

  const tiles: number[] = [];
  for (let i = range[0]; i <= range[1]; i++) tiles.push(i);
  const lx0 = range[0] * tile - 600;
  const lx1 = (range[1] + 1) * tile + 600;
  const s = view.s;
  const actor = (a: Actor) => (
    <div key={a.key} className={`absolute ${a.className ?? ''}`} style={{ left: a.x * s, top: a.y * s, width: a.w * s, height: a.h * s, ...a.style }}>
      {a.children}
    </div>
  );
  const visible = (a: Actor) => a.x + a.w > lx0 && a.x < lx1;

  return (
    <div ref={ref} className={`pointer-events-none absolute left-0 top-0 ${className ?? ''}`} style={{ willChange: 'transform', zIndex, ...style }} aria-hidden>
      {underActors.filter(visible).map(actor)}
      {tiles.map((i) => (
        <Tile key={i} x0={i * tile} w={tile} top={top} height={height} s={s} version={version} render={renderTile} />
      ))}
      {actors.filter(visible).map(actor)}
    </div>
  );
});

const Tile = memo(function Tile({ x0, w, top, height, s, render }: { x0: number; w: number; top: number; height: number; s: number; version?: string | number; render: (x0: number, x1: number) => ReactNode }) {
  // Edges snap to device pixels so neighbouring tiles meet exactly: no gap
  // (anti-aliased seam) and no overlap (translucent art drawn twice).
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const snap = (v: number) => Math.round(v * dpr) / dpr;
  const left = snap(x0 * s);
  const right = snap((x0 + w) * s);
  const tp = snap(top * s);
  const bt = snap((top + height) * s);
  return (
    <svg className="absolute" style={{ left, top: tp, width: right - left, height: bt - tp }} viewBox={`${x0} ${top} ${w} ${height}`} preserveAspectRatio="none">
      {render(x0, x0 + w)}
    </svg>
  );
}, (a, b) => a.x0 === b.x0 && a.w === b.w && a.top === b.top && a.height === b.height && a.s === b.s && a.version === b.version && a.render === b.render);

/** A tiny SVG for an actor, drawn in its own local units. */
export function ActorSvg({ w, h, vb, children, style }: { w: number; h: number; vb?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <svg width="100%" height="100%" viewBox={vb ?? `0 0 ${w} ${h}`} style={{ overflow: 'visible', display: 'block', ...style }}>
      {children}
    </svg>
  );
}
