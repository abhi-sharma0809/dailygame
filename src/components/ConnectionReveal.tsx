import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { play } from '../audio/sfx';
import { boardByTier } from '../game/engine/questions';
import type { RoundRecord } from '../game/engine/session';
import { TIER_COLORS, tierIntensity } from '../game/scoring';
import { hashString, mulberry32 } from '../game/selection';
import { TIER_LABEL, TIER_POINTS, type RuntimeQuestion } from '../game/types';
import { CountUp } from './ui';

/* ============================================================
 * THE CONNECTION REVEAL — compact, inside the journey.
 *   draw   — a thread of light leaves the reference and threads the stars
 *   lock   — it reaches your answer, which blooms; the tier is stamped
 *   board  — the similarity board slides in beside the world
 *   travel — the explorer flies on; points join the total
 * Presentation only: the round is already scored in game state.
 * ============================================================ */

export type RevealStage = 'draw' | 'lock' | 'board' | 'travel' | 'done';
const ORDER: RevealStage[] = ['draw', 'lock', 'board', 'travel', 'done'];
const atLeast = (s: RevealStage, t: RevealStage) => ORDER.indexOf(s) >= ORDER.indexOf(t);

interface Props {
  q: RuntimeQuestion;
  round: RoundRecord;
  reducedMotion: boolean;
  quick?: boolean;
  isLast: boolean;
  nextLabel?: string;
  onTravel: () => void;
  onNext: () => void;
  onReport: (submitted: string) => void;
  extraAction?: React.ReactNode;
}

const VW = 420;
const VH = 74;
const REF = { x: 26, y: 37 };
const ANS = { x: 394, y: 37 };

export function ConnectionReveal({ q, round, reducedMotion, quick, isLast, nextLabel, onTravel, onNext, onReport, extraAction }: Props) {
  const r = round.result;
  const answered = round.status === 'answered' && !!r;
  const tier = answered ? r!.tier : 'none';
  const color = TIER_COLORS[tier];
  const intensity = tierIntensity(tier);
  const perfect = tier === 'perfect';
  const [stage, setStage] = useState<RevealStage>(reducedMotion ? 'done' : 'draw');
  const [skippable, setSkippable] = useState(reducedMotion);
  const [sheet, setSheet] = useState(false);
  const travelled = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const travel = () => {
    if (travelled.current) return;
    travelled.current = true;
    onTravel();
  };

  /* choreography timings (ms) */
  useEffect(() => {
    if (reducedMotion) { travel(); setStage('done'); return; }
    const k = quick ? 0.55 : 1;
    const steps: [RevealStage, number, () => void][] = [
      ['lock', 1000 * k, () => (answered ? play('reveal', 5 - Math.min(5, intensity)) : play('miss'))],
      ['board', 550 * k, () => {}],
      ['travel', 350 * k, () => { travel(); if (answered && r!.points > 0) play('travel'); }],
      ['done', 1100 * k, () => {}],
    ];
    if (answered) play('connect');
    const timers: number[] = [window.setTimeout(() => setSkippable(true), 600 * k)];
    let acc = 0;
    for (const [s, d, fx] of steps) { acc += d; timers.push(window.setTimeout(() => { setStage(s); fx(); }, acc)); }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.questionId]);

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

  /* constellation: board entries as stars between the two nodes */
  const stars = useMemo(() => {
    const rand = mulberry32(hashString(q.def.id));
    return q.ranked
      .filter((x) => x.entity.id !== r?.entityId)
      .slice(0, 12)
      .map((x, i) => ({ id: x.entity.id, x: 80 + rand() * 260, y: 10 + rand() * (VH - 20), size: x.points >= 90 ? 2.6 : x.points >= 65 ? 2 : 1.5, i }));
  }, [q, r?.entityId]);

  const route = useMemo(() => {
    const up = stars.filter((s) => s.y < VH / 2 && s.x < 210).sort((a, b) => Math.abs(a.x - 150) - Math.abs(b.x - 150))[0];
    const down = stars.filter((s) => s.y > VH / 2 && s.x >= 210).sort((a, b) => Math.abs(a.x - 280) - Math.abs(b.x - 280))[0];
    const via = [up, down].filter(Boolean) as typeof stars;
    const pts = [REF, ...via, ANS];
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], c = pts[i];
      const dx = (c.x - p.x) * 0.5;
      d += ` C ${p.x + dx} ${p.y}, ${c.x - dx} ${c.y}, ${c.x} ${c.y}`;
    }
    return { d, via };
  }, [stars]);

  const best = q.ranked[0];
  const label = answered ? TIER_LABEL[tier] : round.status === 'timeout' ? 'The compass ran out' : 'Passed';
  const lockd = atLeast(stage, 'lock');
  const nextText = stage !== 'done' ? 'Skip ahead' : nextLabel ?? (isLast ? 'See where you landed' : 'Continue the journey');

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
                +{lockd ? <CountUp to={r?.points ?? 0} duration={quick ? 0.4 : 0.8} instant={reducedMotion} /> : 0}
              </div>
            </div>
          </div>
          <AnimatePresence>
            {lockd && (
              <motion.p initial={reducedMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.3 }} className="line-clamp-2 overflow-hidden pt-1 text-[13px] leading-snug text-ink-soft">
                {answered ? r!.why : <>{best?.entry.why}.</>}
                {tier === 'unranked' && (
                  <button onClick={(e) => { e.stopPropagation(); onReport(round.input ?? r!.entityName); }} className="ml-1.5 font-semibold text-gold-deep hover:underline">Make the case for it →</button>
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ------------------------------------------------ console: thread + continue */}
        <div className="ink-console flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center sm:gap-3 sm:p-3">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="h-[54px] w-full min-w-0 sm:h-[60px] sm:flex-1" role="img" aria-label={answered ? `${q.def.ref} connects to ${r!.entityName}: ${label}` : `${q.def.ref}: no connection made`}>
            <defs>
              <radialGradient id="cr-bloom"><stop offset="0" stopColor={color} stopOpacity="0.85" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient>
              <filter id="cr-glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {stars.map((s) => {
              const isVia = route.via.some((v) => v.id === s.id);
              return (
                <motion.circle key={s.id} cx={s.x} cy={s.y} r={s.size} fill={isVia && lockd ? color : '#F0E6D1'} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: reducedMotion ? 0 : 0.04 * s.i, duration: 0.3 }} />
              );
            })}
            {answered && (
              <>
                <motion.path d={route.d} fill="none" stroke={color} strokeWidth={perfect ? 3.4 : 2.4} strokeLinecap="round" opacity="0.3" filter="url(#cr-glow)" initial={reducedMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: quick ? 0.55 : 0.95, ease: [0.6, 0, 0.3, 1] }} />
                <motion.path d={route.d} fill="none" stroke={color} strokeWidth={perfect ? 2 : 1.5} strokeLinecap="round" strokeDasharray={tier === 'unranked' ? '4 5' : undefined} initial={reducedMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: quick ? 0.55 : 0.95, ease: [0.6, 0, 0.3, 1] }} />
              </>
            )}
            <circle cx={REF.x} cy={REF.y} r="13" fill="#F0E6D1" stroke="#D9AD63" strokeWidth="2.4" />
            <text x={REF.x} y={REF.y + 4.5} textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="700" fontSize="13" fill="#26323A">{initial(q.def.ref)}</text>
            <text x={REF.x + 20} y={REF.y - 22} fontFamily="Fraunces, serif" fontStyle="italic" fontSize="10.5" fill="#F0E6D1" opacity="0.75">{shorten(q.def.ref)}</text>
            {answered ? (
              <g>
                {lockd && !reducedMotion && Array.from({ length: perfect ? 3 : intensity <= 2 ? 2 : 1 }, (_, i) => (
                  <motion.circle key={i} cx={ANS.x} cy={ANS.y} r="13" fill="none" stroke={color} strokeWidth={perfect ? 2.4 : 1.6} initial={{ scale: 1, opacity: 0.9 }} animate={{ scale: perfect ? 2.6 : 1.9, opacity: 0 }} transition={{ duration: 1.1, delay: i * 0.18 }} style={{ transformOrigin: `${ANS.x}px ${ANS.y}px` }} />
                ))}
                <motion.circle cx={ANS.x} cy={ANS.y} r="30" fill="url(#cr-bloom)" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: lockd ? 1 : 0 }} />
                <motion.circle cx={ANS.x} cy={ANS.y} r="13" fill={lockd ? color : '#26323A'} stroke="#F0E6D1" strokeWidth="2" initial={reducedMotion ? false : { scale: 0.6 }} animate={{ scale: lockd ? 1 : 0.8 }} transition={{ type: 'spring', stiffness: 380, damping: 14 }} style={{ transformOrigin: `${ANS.x}px ${ANS.y}px` }} />
                <text x={ANS.x} y={ANS.y + 4.5} textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="700" fontSize="13" fill={lockd ? '#26323A' : '#F0E6D1'}>{initial(r!.entityName)}</text>
                <text x={ANS.x - 20} y={ANS.y + 30} textAnchor="end" fontFamily="Fraunces, serif" fontStyle="italic" fontSize="10.5" fill="#F0E6D1" opacity="0.75">{shorten(r!.entityName)}</text>
              </g>
            ) : (
              <g opacity="0.65">
                <circle cx={ANS.x} cy={ANS.y} r="13" fill="none" stroke="#F0E6D1" strokeDasharray="3 4" strokeWidth="1.6" />
                <text x={ANS.x} y={ANS.y + 4.5} textAnchor="middle" fontFamily="Fraunces, serif" fontSize="13" fill="#F0E6D1">?</text>
              </g>
            )}
          </svg>
          <div className="flex items-center gap-2 sm:shrink-0">
            <button type="button" onClick={(e) => { e.stopPropagation(); setSheet(true); }} className="btn-ghost h-11 shrink-0 px-3.5 text-sm xl:hidden" aria-expanded={sheet} aria-controls="board-panel" disabled={!atLeast(stage, 'board')}>
              The board
            </button>
            <button ref={nextRef} onClick={(e) => { e.stopPropagation(); if (stage === 'done') onNext(); else if (skippable) finish(); }} disabled={!skippable} className="btn-gold h-11 flex-1 whitespace-nowrap px-5 text-[15px] sm:flex-none">
              {nextText} →
            </button>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1">
          <button onClick={(e) => { e.stopPropagation(); onReport(round.input ?? ''); }} className="text-[11px] font-medium text-cream/55 hover:text-gold">Report this board</button>
          {extraAction}
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
              <button onClick={onCloseSheet} className="mx-auto mb-2 block h-1.5 w-12 rounded-full bg-ink/25" aria-label="Close the board" />
              {body}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
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
