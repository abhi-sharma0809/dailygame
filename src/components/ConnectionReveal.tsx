import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { play } from '../audio/sfx';
import { boardByTier } from '../game/engine/questions';
import type { RoundRecord } from '../game/engine/session';
import { TIER_COLORS, tierIntensity } from '../game/scoring';
import { TIER_LABEL, TIER_POINTS, type RuntimeQuestion } from '../game/types';
import { CONNECTION_LOOKS, seeded, threadPath, type ConnectionLook } from './connection';
import { CountUp } from './ui';
import { PixelIcon } from './PixelIcon';

/* ============================================================
 * THE CONNECTION REVEAL — compact, inside the journey.
 *   nodes  — the reference and your answer appear (closer together the
 *            stronger the connection)
 *   draw   — a thread of light leaves the reference at the pace of the
 *            connection: direct, thick and quick for a strong one; long,
 *            winding and slow for a weak one; a miss frays out half-way
 *   lock   — it reaches your answer, which blooms; the score and tier land
 *   board  — the similarity board slides in beside the world
 *   travel — the airship reacts, winds up and flies on by the points earned
 *   done   — once it has landed and settled, the journey can continue
 * Presentation only: the round is already scored in game state.
 * ============================================================ */

export type RevealStage = 'draw' | 'lock' | 'board' | 'travel' | 'done';
const ORDER: RevealStage[] = ['draw', 'lock', 'board', 'travel', 'done'];
const atLeast = (s: RevealStage, t: RevealStage) => ORDER.indexOf(s) >= ORDER.indexOf(t);

interface Props {
  q: RuntimeQuestion;
  round: RoundRecord;
  reducedMotion: boolean;
  isLast: boolean;
  /** reopened after leaving mid-reveal: show it finished; the ship is already there */
  resumed?: boolean;
  /** the airship launched for this round has landed and come to rest */
  settled: boolean;
  onTravel: () => void;
  onNext: () => void;
  onReport: (submitted: string) => void;
}

const VW = 420;
const VH = 74;
const CY = 37;
/** nodes appear before the thread starts drawing, s */
const NODE_DELAY = 0.3;

/** if the world never reports back (tab hidden, etc.), don't hold the player hostage */
const SETTLE_FALLBACK_MS = 6500;

export function ConnectionReveal({ q, round, reducedMotion, isLast, resumed, settled, onTravel, onNext, onReport }: Props) {
  const r = round.result;
  const answered = round.status === 'answered' && !!r;
  const tier = answered ? r!.tier : 'none';
  const color = TIER_COLORS[tier];
  const intensity = tierIntensity(tier);
  const [stage, setStage] = useState<RevealStage>(reducedMotion || resumed ? 'done' : 'draw');
  const [skippable, setSkippable] = useState(reducedMotion || !!resumed);
  const [sheet, setSheet] = useState(false);
  const travelled = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const travel = () => {
    if (travelled.current) return;
    travelled.current = true;
    onTravel();
  };

  /* choreography timings (ms): reveal the verdict, let it land, then hand over to the ship */
  useEffect(() => {
    if (resumed) { travelled.current = true; return; }
    if (reducedMotion) { travel(); setStage('done'); return; }
    const steps: [RevealStage, number, () => void][] = [
      ['lock', (NODE_DELAY + look.draw) * 1000 + 120, () => (answered ? play('reveal', 5 - Math.min(5, intensity)) : play('miss'))],
      ['board', 500, () => {}],
      ['travel', 300, () => travel()],
    ];
    if (answered) play('connect');
    const timers: number[] = [window.setTimeout(() => setSkippable(true), 600)];
    let acc = 0;
    for (const [s, d, fx] of steps) { acc += d; timers.push(window.setTimeout(() => { setStage((cur) => (atLeast(cur, s) ? cur : s)); fx(); }, acc)); }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.questionId]);

  // the sequence ends when the ship has settled at its new position
  useEffect(() => {
    if (stage !== 'travel') return;
    if (settled) { const t = window.setTimeout(() => setStage('done'), 180); return () => clearTimeout(t); }
    const t = window.setTimeout(() => setStage('done'), SETTLE_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [stage, settled]);

  const finish = () => { travel(); setStage('done'); };
  useEffect(() => { if (stage === 'done' && !sheet) nextRef.current?.focus({ preventScroll: true }); }, [stage, sheet]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (stage !== 'done') { if (skippable) finish(); } else onNext();
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, skippable, onNext]);

  /* the thread: geometry from the tier, winding from the question (stable across replays) */
  const look = CONNECTION_LOOKS[tier];
  const refX = VW / 2 - look.gap / 2;
  const ansX = VW / 2 + look.gap / 2;
  const d = useMemo(() => threadPath(refX, ansX, CY, look, seeded(`${q.def.id}:${tier}`)), [refX, ansX, look, q.def.id, tier]);
  /* other board entries scattered as faint stars behind the thread */
  const stars = useMemo(() => {
    const rand = seeded(q.def.id);
    return q.ranked.filter((x) => x.entity.id !== r?.entityId).slice(0, 10).map((x) => ({ id: x.entity.id, x: 60 + rand() * 300, y: 8 + rand() * (VH - 16), size: x.points >= 90 ? 1.8 : 1.3 }));
  }, [q, r?.entityId]);

  const best = q.ranked[0];
  const label = answered ? TIER_LABEL[tier] : round.status === 'timeout' ? 'The compass ran out' : 'Passed';
  const lockd = atLeast(stage, 'lock');
  const gid = useId().replace(/:/g, '');
  const nextText = stage !== 'done' ? 'Skip ahead' : isLast ? 'See where you landed' : 'Next question';

  return (
    <>
      <div className="relative w-full max-w-[600px]" onClick={() => skippable && stage !== 'done' && finish()}>
        {/* ------------------------------------------------ verdict slip */}
        <div className="journal-slip px-4 pb-3 pt-3 sm:px-5">
          <p className="truncate font-display text-[13px] italic text-ink-soft">{q.def.prompt}</p>
          <div className="mt-1.5 flex min-h-[3.25rem] items-center justify-between gap-3">
            <AnimatePresence mode="wait">
              {lockd ? (
                <motion.div key="v" className="min-w-0" initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  <motion.div
                    initial={reducedMotion ? false : { scale: 1.35, opacity: 0, rotate: -3 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 18 }}
                    className="ribbon origin-left"
                    style={answered ? { background: `linear-gradient(180deg, ${lighten(color)}, ${color})` } : { background: 'linear-gradient(180deg,#9aa3a8,#7c8790)' }}
                  >
                    {label}
                  </motion.div>
                  <div className="mt-1 truncate font-display text-lg font-semibold leading-tight text-ink">
                    {answered ? r!.entityName : <span className="text-ink-soft">Best: <span className="text-ink">{best?.entity.name}</span></span>}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="w" className="flex items-center gap-2 text-sm text-ink-soft" exit={{ opacity: 0 }}>
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold-deep" />
                  {answered ? <>Tracing <span className="font-display italic text-ink">{r!.entityName}</span>…</> : 'Reading the board…'}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="shrink-0 text-right">
              <div className="readout text-[2.4rem] font-medium leading-none" style={{ color: answered ? darken(color) : '#7C8790' }}>
                +{lockd ? <CountUp to={r?.points ?? 0} duration={0.8} instant={reducedMotion} /> : 0}
              </div>
            </div>
          </div>
          <AnimatePresence>
            {lockd && (
              <motion.p initial={reducedMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }} className="line-clamp-2 overflow-hidden pt-1 text-[13px] leading-snug text-ink-soft">
                {answered ? r!.why : <>{best?.entry.why}.</>}
                {tier === 'unranked' && (
                  <button onClick={(e) => { e.stopPropagation(); onReport(round.input ?? r!.entityName); }} className="btn-text on-paper ml-1 py-0 text-[13px]">Make the case for it</button>
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ------------------------------------------------ console: thread + continue */}
        <div className="ink-console flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center sm:gap-3 sm:p-3">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="h-[54px] w-full min-w-0 overflow-visible sm:h-[60px] sm:flex-1" role="img" aria-label={answered ? `${q.def.ref} connects to ${r!.entityName}: ${label}` : `${q.def.ref}: no connection made`} data-connection={tier}>
            {stars.map((st) => <circle key={st.id} cx={st.x} cy={st.y} r={st.size} fill="#F0E6D1" opacity="0.32" />)}
            <Thread key={`${q.def.id}:${tier}`} d={d} look={look} color={color} reduced={reducedMotion || !!resumed} none={!answered} />
            {/* reference node */}
            <motion.g initial={reducedMotion ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} style={{ transformOrigin: `${refX}px ${CY}px` }}>
              {lockd && !reducedMotion && answered && look.rings >= 2 && (
                <motion.circle cx={refX} cy={CY} r="12" fill="none" stroke={color} strokeWidth="1.4" initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 0.9 }} style={{ transformOrigin: `${refX}px ${CY}px` }} />
              )}
              <circle cx={refX} cy={CY} r="12" fill="#F0E6D1" stroke="#D9AD63" strokeWidth="2.2" />
              <text x={refX} y={CY + 4.5} textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="700" fontSize="12.5" fill="#26323A">{initial(q.def.ref)}</text>
              <text x={refX - 10} y={CY - 19} fontFamily="Fraunces, serif" fontStyle="italic" fontSize="10.5" fill="#F0E6D1" opacity="0.78">{shorten(q.def.ref)}</text>
            </motion.g>
            {/* answer node: blooms in proportion to the connection */}
            {answered ? (
              <motion.g initial={reducedMotion ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.12 }} style={{ transformOrigin: `${ansX}px ${CY}px` }}>
                {lockd && !reducedMotion && Array.from({ length: look.rings }, (_, i) => (
                  <motion.circle key={i} cx={ansX} cy={CY} r="12" fill="none" stroke={color} strokeWidth={1.2 + look.width * 0.35} initial={{ scale: 1, opacity: 0.9 }} animate={{ scale: 1.6 + look.rings * 0.35, opacity: 0 }} transition={{ duration: 1.1, delay: i * 0.16 }} style={{ transformOrigin: `${ansX}px ${CY}px` }} />
                ))}
                <motion.circle cx={ansX} cy={CY} r={look.bloom} fill={`url(#${gid}-bloom)`} initial={false} animate={{ opacity: lockd ? 1 : 0 }} transition={{ duration: 0.4 }} />
                <motion.circle cx={ansX} cy={CY} r="12" fill={lockd ? color : '#26323A'} stroke="#F0E6D1" strokeWidth={lockd ? 1.4 + look.width * 0.3 : 1.6} initial={false} animate={{ scale: lockd ? [1.25, 1] : 0.85 }} transition={{ type: 'spring', stiffness: 380, damping: 14 }} style={{ transformOrigin: `${ansX}px ${CY}px` }} />
                <text x={ansX} y={CY + 4.5} textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="700" fontSize="12.5" fill={lockd ? '#26323A' : '#F0E6D1'}>{initial(r!.entityName)}</text>
                <text x={ansX + 10} y={CY + 29} textAnchor="end" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="10.5" fill="#F0E6D1" opacity="0.78">{shorten(r!.entityName)}</text>
              </motion.g>
            ) : (
              <motion.g initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 0.55 }} transition={{ duration: 0.3, delay: 0.12 }}>
                <circle cx={ansX} cy={CY} r="12" fill="none" stroke="#F0E6D1" strokeDasharray="3 4" strokeWidth="1.5" />
                <text x={ansX} y={CY + 4.5} textAnchor="middle" fontFamily="Fraunces, serif" fontSize="13" fill="#F0E6D1">?</text>
              </motion.g>
            )}
            <defs>
              <radialGradient id={`${gid}-bloom`}><stop offset="0" stopColor={color} stopOpacity="0.8" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient>
            </defs>
          </svg>
          <div className="flex items-center gap-3 px-0.5 pb-1 sm:shrink-0 sm:pb-0">
            <button type="button" onClick={(e) => { e.stopPropagation(); setSheet(true); }} className="btn-ghost btn-sm shrink-0 xl:hidden" aria-expanded={sheet} aria-controls="board-panel" disabled={!atLeast(stage, 'board')}>
              The board
            </button>
            <button ref={nextRef} onClick={(e) => { e.stopPropagation(); if (stage === 'done') onNext(); else if (skippable) finish(); }} disabled={!skippable} className="btn-gold flex-1 sm:flex-none">
              {nextText} <PixelIcon name={stage !== 'done' ? 'skip' : 'arrow'} size={14} />
            </button>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1">
          <button onClick={(e) => { e.stopPropagation(); onReport(round.input ?? ''); }} className="btn-text py-0.5 text-[12px] text-cream/55">Report this board</button>
        </div>
      </div>

      {/* ------------------------------------------------ the board: drawer on desktop, sheet on phones */}
      <BoardPanel q={q} entityId={r?.entityId} unranked={tier === 'unranked' ? r!.entityName : null} show={atLeast(stage, 'board')} sheetOpen={sheet} onCloseSheet={() => setSheet(false)} reducedMotion={reducedMotion} />
    </>
  );
}

function BoardPanel({ q, entityId, unranked, show, sheetOpen, onCloseSheet, reducedMotion }: { q: RuntimeQuestion; entityId?: string; unranked: string | null; show: boolean; sheetOpen: boolean; onCloseSheet: () => void; reducedMotion: boolean }) {
  const groups = boardByTier(q);
  const body = (
    <>
      <h2 className="font-display text-xl font-semibold leading-tight text-ink">The board</h2>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-soft">Judged on {q.def.dims.slice(0, 3).join(', ')}</p>
      <div className="rule-ink my-1.5" />
      <ol className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">
        {groups.map((g, gi) => (
          <motion.li key={g.tier} initial={reducedMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reducedMotion ? 0 : 0.15 + gi * 0.06 }}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: TIER_COLORS[g.tier] }} />
              <span className="eyebrow text-[9.5px] text-ink-soft">{TIER_LABEL[g.tier]} · {TIER_POINTS[g.tier]}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {g.entries.map((e) => {
                const mine = e.entity.id === entityId;
                return (
                  <span key={e.entity.id} title={e.entry.why} className={`rounded-full px-2 py-0.5 text-[13px] ${mine ? 'bg-ink font-semibold text-parchment ring-2 ring-gold' : 'bg-ink/[0.07] text-ink'}`}>
                    {e.entity.name}{mine && ' ← you'}
                  </span>
                );
              })}
            </div>
          </motion.li>
        ))}
        {unranked && (
          <li className="rounded-xl border border-dashed border-ink/30 px-3 py-2 text-sm text-ink">
            <span className="eyebrow text-[9.5px] text-ink-soft">Unranked connection · 30</span>
            <div className="mt-0.5 font-semibold">{unranked} ← you</div>
          </li>
        )}
      </ol>
      <p className="mt-2 line-clamp-3 border-t border-ink/10 pt-2 text-[11px] leading-relaxed text-ink-soft">{q.def.rationale}</p>
    </>
  );
  return createPortal(
    <>
      {/* desktop: a drawer over the ground already travelled, leaving the way ahead clear */}
      <AnimatePresence>
        {show && (
          <motion.aside
            id="board-panel"
            key="drawer"
            className="journal-slip journal-slip--full fixed left-6 top-[104px] z-40 hidden max-h-[min(560px,calc(100dvh-8.5rem))] w-[300px] flex-col p-4 xl:flex 2xl:left-10 2xl:w-[340px]"
            initial={reducedMotion ? false : { opacity: 0, x: -30, rotate: -0.6 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          >
            {body}
          </motion.aside>
        )}
      </AnimatePresence>
      {/* phones and tablets: a pull-up sheet, closed by default so the world stays in view */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div key="sheet" className="fixed inset-0 z-[55] flex items-end bg-[#05090D]/45 xl:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCloseSheet}>
            <motion.div
              role="dialog"
              aria-label="The board"
              className="journal-slip journal-slip--full flex max-h-[72dvh] w-full flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={onCloseSheet} className="btn-paper btn-xs mb-3 ml-auto mr-0.5 mt-0.5" aria-label="Close the board">Close <PixelIcon name="close" size={9} /></button>
              {body}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}

/**
 * The thread itself, driven frame by frame (no React renders): a bright head
 * draws it at the connection's pace, the glow flares on arrival and settles,
 * then particles run along it for a while and fade. A miss wanders out
 * part of the way, frays and dims.
 */
function Thread({ d, look, color, reduced, none }: { d: string; look: ConnectionLook; color: string; reduced: boolean; none: boolean }) {
  const id = useId().replace(/:/g, '');
  const measure = useRef<SVGPathElement>(null);
  const reveal = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const head = useRef<SVGGElement>(null);
  const group = useRef<SVGGElement>(null);
  const parts = useRef<(SVGCircleElement | null)[]>([]);
  const [fray, setFray] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const m = measure.current, rv = reveal.current;
    if (!m || !rv) return;
    const len = m.getTotalLength();
    const reach = len * look.reach;
    rv.style.strokeDasharray = `${len + 1} ${len + 1}`;
    const draw = (e: number) => { rv.style.strokeDashoffset = String(len + 1 - reach * e); };
    const end = () => { const pt = m.getPointAtLength(reach); return { x: pt.x, y: pt.y }; };
    if (reduced) {
      draw(1);
      if (glow.current) glow.current.style.opacity = String(look.glow);
      if (head.current) head.current.style.opacity = '0';
      if (none) { setFray(end()); if (group.current) group.current.style.opacity = '0.4'; }
      return;
    }
    draw(0);
    const LINGER = 2.6; // seconds particles keep running after arrival
    const t0 = performance.now();
    let raf = 0;
    let frayed = false;
    const ease = (p: number) => (look.confident ? 1 - Math.pow(1 - p, 3) : p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
    const loop = (now: number) => {
      const t = (now - t0) / 1000 - NODE_DELAY;
      const p = Math.max(0, Math.min(1, t / look.draw));
      const e = ease(p);
      draw(e);
      const st = t - look.draw; // seconds since arrival
      // head of the thread
      if (head.current) {
        const hp = m.getPointAtLength(reach * e);
        head.current.setAttribute('transform', `translate(${hp.x.toFixed(1)} ${hp.y.toFixed(1)})`);
        head.current.style.opacity = t < 0 ? '0' : st < 0 ? '1' : String(Math.max(0, 1 - st / 0.25));
      }
      // glow: builds while drawing, flares on arrival, settles
      if (glow.current) glow.current.style.opacity = String(st < 0 ? look.glow * 0.7 * p : look.glow + look.flash * Math.exp(-st / 0.45));
      if (none && st >= 0 && !frayed) {
        frayed = true;
        setFray(end());
        if (group.current) { group.current.style.transition = 'opacity .9s ease'; group.current.style.opacity = '0.4'; }
      }
      // particles streaming from reference to answer
      const life = st < 0 ? 0 : Math.max(0, Math.min(1, 1 - (st - LINGER) / 0.8));
      parts.current.forEach((c, i) => {
        if (!c) return;
        if (life <= 0) { c.style.opacity = '0'; return; }
        const ph = ((st / look.particlePeriod) + i / Math.max(1, look.particles)) % 1;
        const pt = m.getPointAtLength(len * ph);
        c.setAttribute('cx', pt.x.toFixed(1));
        c.setAttribute('cy', pt.y.toFixed(1));
        c.style.opacity = String(Math.sin(Math.PI * ph) * life);
      });
      if (st < LINGER + 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [d, look, reduced, none]);

  const stroke = none ? '#9AA3A8' : color;
  return (
    <g>
      <defs>
        <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x="-20" y="-40" width="460" height="160">
          <path ref={reveal} d={d} fill="none" stroke="#fff" strokeWidth={Math.max(16, look.glowWidth + 8)} strokeLinecap="round" />
        </mask>
        {look.blur > 0 && <filter id={`${id}-b`} x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation={look.blur} /></filter>}
      </defs>
      <path ref={measure} d={d} fill="none" stroke="none" />
      <g ref={group} mask={`url(#${id}-m)`}>
        {look.glowWidth > 0 && <path ref={glow} d={d} fill="none" stroke={stroke} strokeWidth={look.glowWidth} strokeLinecap="round" filter={look.blur > 0 ? `url(#${id}-b)` : undefined} style={{ opacity: 0 }} />}
        <path d={d} fill="none" stroke={stroke} strokeWidth={look.width} strokeLinecap="round" strokeDasharray={look.dash} />
        {look.width >= 2.4 && <path d={d} fill="none" stroke="#FFF8E6" strokeWidth={look.width * 0.32} strokeLinecap="round" opacity="0.75" />}
      </g>
      {Array.from({ length: look.particles }, (_, i) => (
        <circle key={i} ref={(el) => { parts.current[i] = el; }} r={look.particleSize} fill="#FFF8E6" stroke={color} strokeWidth="0.8" style={{ opacity: 0 }} />
      ))}
      <g ref={head} style={{ opacity: 0 }}>
        <circle r={none ? 3 : 3 + look.width} fill={stroke} opacity="0.35" />
        <circle r={none ? 1.4 : 1.2 + look.width * 0.45} fill={none ? '#C9CED1' : '#FFF8E6'} />
      </g>
      {/* a miss frays: a few grey specks drop where the thread gave out */}
      {fray && !reduced && [0, 1, 2, 3].map((i) => (
        <motion.circle key={i} cx={fray.x} cy={fray.y} r={1.3 - i * 0.15} fill="#9AA3A8" initial={{ opacity: 0.9, x: 0, y: 0 }} animate={{ opacity: 0, x: (i - 1.5) * 6, y: 10 + i * 4 }} transition={{ duration: 0.9 + i * 0.15, ease: 'easeOut' }} />
      ))}
      {fray && <path d={`M ${fray.x - 3} ${fray.y - 3} L ${fray.x + 3} ${fray.y + 3} M ${fray.x + 3} ${fray.y - 3} L ${fray.x - 3} ${fray.y + 3}`} stroke="#9AA3A8" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />}
    </g>
  );
}

function initial(s: string) {
  return s.replace(/^The /, '').slice(0, 1);
}

function shorten(s: string) {
  const t = s.replace(/:.*$/, '');
  return t.length > 26 ? `${t.slice(0, 24)}…` : t;
}

function lighten(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 40), g = Math.min(255, ((n >> 8) & 255) + 40), b = Math.min(255, (n & 255) + 40);
  return `rgb(${r},${g},${b})`;
}

function darken(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.62), g = Math.round(((n >> 8) & 255) * 0.62), b = Math.round((n & 255) * 0.62);
  return `rgb(${r},${g},${b})`;
}
