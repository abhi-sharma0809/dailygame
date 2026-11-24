import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { StrengthGlyph } from '../components/connection';
import { JourneyWorld } from '../components/Journey/JourneyWorld';
import { PixelIcon } from '../components/PixelIcon';
import { DEST } from '../components/Journey/world';
import { renderShareCard } from '../components/shareCard';
import { CountUp, PageShell, Wordmark } from '../components/ui';
import { WorldMap } from '../components/WorldMap/WorldMap';
import { QUESTION_BY_ID } from '../data/atlas';
import { boardByTier, buildQuestion } from '../game/engine/questions';
import type { RoundSummary, SessionSummary } from '../game/persistence/store';
import { computeStats, shareText } from '../game/progression';
import { DESTINATIONS, TIER_COLORS, destinationIndex } from '../game/scoring';
import { dayNumber } from '../game/selection';
import { TIER_LABEL, TIER_POINTS } from '../game/types';
import { hms, useUntilMidnight } from '../hooks/useCountdown';
import { navigate } from '../hooks/useRoute';
import { usePlayer } from '../state/PlayerContext';

/* ============================================================
 * The last page of the journey.
 *
 * The world stays exactly where the seventh answer left the airship. The
 * camera settles, pans to make room, and the journey recap rises over the
 * landscape: an achievement plate (score, destination, how far along the
 * route), then the voyage log — one compact entry per question, each with
 * the answer, its score and a small thread showing how strong the
 * connection was. Any entry opens to show its board.
 * ============================================================ */

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const SHORT: Record<RoundSummary['tier'], string> = { perfect: 'Perfect', nearly: 'Nearly', family: 'Family', close: 'Close', distant: 'Distant', loose: 'Loose', unranked: 'Unranked', none: '—' };
/** the camera holds on the ship for a beat before the recap rises, ms */
const SETTLE_BEAT = 650;

function useWide() {
  const q = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

export function Results({ id }: { id: string }) {
  const { data, today, reducedMotion } = usePlayer();
  const s = data.sessions.find((x) => x.id === id);
  const wide = useWide();
  const [framed, setFramed] = useState(reducedMotion);
  const [wave, setWave] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    const t1 = window.setTimeout(() => setFramed(true), SETTLE_BEAT);
    const t2 = window.setTimeout(() => setWave(1), SETTLE_BEAT + 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reducedMotion]);

  if (!s) {
    return <PageShell title="Journey"><div className="py-24 text-center"><p className="text-cream/70">That journey isn’t recorded on this device.</p><button onClick={() => navigate('/')} className="btn-gold mt-6">Back home</button></div></PageShell>;
  }

  const journeyScore = s.rounds.length === 7 ? s.total : (s.total / Math.max(1, s.rounds.length)) * 7;
  // desktop: the ship moves left, the recap sits on the right; phones: the ship rises, the recap fills below
  const shift = framed ? (wide ? { x: -0.12, y: 0.02 } : { x: 0.04, y: -0.17 }) : { x: 0, y: 0 };

  return (
    <div className="relative min-h-dvh">
      <div className="fixed inset-0 bg-night">
        <JourneyWorld score={journeyScore} reducedMotion={reducedMotion} mood={journeyScore >= 600 ? 'celebrate' : 'cheer'} reactKey={wave} shift={shift} />
        {/* just enough shade for the recap to read; the world stays the world */}
        <div className="pointer-events-none absolute inset-0 transition-opacity duration-1000 lg:hidden" style={{ opacity: framed ? 1 : 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(5,9,13,.55) 62%, rgba(5,9,13,.8) 100%)' }} />
        <div className="pointer-events-none absolute inset-0 hidden transition-opacity duration-1000 lg:block" style={{ opacity: framed ? 1 : 0, background: 'linear-gradient(to right, transparent 45%, rgba(5,9,13,.5) 75%, rgba(5,9,13,.7) 100%)' }} />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-3 pt-[max(0.6rem,env(safe-area-inset-top))] sm:px-5 sm:pt-4">
        <div className="pointer-events-auto ml-0.5 mt-0.5"><Wordmark size="sm" onClick={() => navigate('/')} /></div>
        <button onClick={() => navigate('/')} className="btn-ghost btn-sm btn-icon pointer-events-auto mr-0.5 mt-0.5" aria-label="Home"><PixelIcon name="close" size={12} /></button>
      </header>

      {/* the illustrated atlas, kept off-screen for the share card */}
      <div aria-hidden className="pointer-events-none fixed left-[-20000px] top-0 h-[1000px] w-[1600px] overflow-hidden">
        <WorldMap id="results-map" score={journeyScore} reducedMotion className="block h-full w-full" ariaLabel="" />
      </div>

      <AnimatePresence>
        {framed && (
          <motion.main
            key="recap"
            className="relative z-10 mx-auto w-full max-w-[540px] px-3 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[33dvh] sm:px-4 lg:ml-auto lg:mr-[4vw] lg:max-w-[500px] lg:pt-[72px]"
            initial={reducedMotion ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <Recap s={s} journeyScore={journeyScore} streak={s.mode === 'daily' ? computeStats(data, today).streak.current : 0} reducedMotion={reducedMotion} />
            <VoyageLog rounds={s.rounds} reducedMotion={reducedMotion} daily={s.mode === 'daily'} />
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------ achievement plate */

function Recap({ s, journeyScore, streak, reducedMotion }: { s: SessionSummary; journeyScore: number; streak: number; reducedMotion: boolean }) {
  const [shared, setShared] = useState<'' | 'Shared' | 'Copied!'>('');
  const di = destinationIndex(journeyScore);
  const dest = DESTINATIONS[di];
  const perfect = s.rounds.filter((r) => r.tier === 'perfect').length;
  const answered = s.rounds.filter((r) => r.status === 'answered').length;
  const dateLabel = s.dateKey ? new Date(`${s.dateKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const title = s.dateKey ? `${s.mode === 'daily' ? 'Daily Quest' : 'Archives · Quest'} No. ${dayNumber(s.dateKey) + 1}` : s.label;
  /** Date, score and seven emoji — nothing else. Native share sheet where there is one, otherwise the clipboard. */
  const share = async () => {
    const text = shareText(s);
    const done = (how: 'Shared' | 'Copied!') => { setShared(how); setTimeout(() => setShared(''), 2500); };
    if (navigator.share) {
      try { await navigator.share({ text }); done('Shared'); return; } catch (e) { if ((e as DOMException)?.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); done('Copied!'); } catch { /* clipboard blocked */ }
  };
  const card = async () => {
    const blob = await renderShareCard(s, document.getElementById('results-map') as SVGSVGElement | null);
    if (!blob) return;
    const file = new File([blob], 'simmly-journey.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if ((e as DOMException)?.name === 'AbortError') return; } }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'simmly-journey.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <section aria-label="Journey summary">
      <div className="journal-slip px-5 pb-4 pt-4 sm:px-6">
        <div className="flex items-baseline justify-between gap-3">
          <span className="eyebrow truncate text-[10px] text-gold-deep">{title}</span>
          <span className="shrink-0 font-display text-[13px] italic text-ink-soft">{dateLabel}</span>
        </div>
        <h1 className="mt-1 font-display text-[clamp(1.6rem,6vw,2.1rem)] font-semibold leading-none text-ink">Journey complete<span className="text-gold-deep">.</span></h1>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-ink" aria-label={`${s.total} of ${s.maxTotal} points`}>
            <CountUp to={s.total} duration={1.6} delay={0.25} instant={reducedMotion} className="font-display text-[clamp(3.4rem,15vw,4.6rem)] font-semibold leading-[0.85] tracking-tight" />
            <span className="font-display text-xl text-ink-soft">/ {s.maxTotal}</span>
          </div>
          <div className="min-w-0 pb-1 text-right">
            <div className="eyebrow text-[9px] text-ink-soft">Reached</div>
            <div className="font-display text-[17px] font-semibold leading-tight text-ink">{dest.name}</div>
            <div className="truncate font-display text-[12.5px] italic text-ink-soft">{dest.blurb}</div>
          </div>
        </div>

        <RouteTrack score={journeyScore} reducedMotion={reducedMotion} />

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink">
          <span className="flex items-center gap-1.5"><span className="text-gold-deep">✦</span><span><b className="readout">{perfect}</b> perfect connection{perfect === 1 ? '' : 's'}</span></span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rotate-45 bg-ink/70" /><span><b className="readout">{answered}</b> of 7 answered</span></span>
          {streak > 0 && <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rotate-45 bg-gold-deep" /><span><b className="readout">{streak}</b>-day streak</span></span>}
        </div>
      </div>
      <div className="ink-console flex flex-wrap items-center gap-x-3 gap-y-4 px-3 pb-4 pt-3.5 sm:gap-x-4 sm:px-3.5">
        <button onClick={share} className="btn-gold btn-sm" aria-live="polite">{shared || 'Share score'}</button>
        <button onClick={card} className="btn-ghost btn-sm">Save card</button>
        <button onClick={() => navigate('/archive')} className="btn-ghost btn-sm">Archives</button>
      </div>
    </section>
  );
}

/** The route in miniature: seven destinations and the beacon, gold up to where the ship stopped. */
function RouteTrack({ score, reducedMotion }: { score: number; reducedMotion: boolean }) {
  const frac = Math.min(1, score / 700);
  const marks = [...DEST.map((d, i) => ({ label: d.numeral, at: i / 7, reached: score >= i * 100 })), { label: '✦', at: 1, reached: score >= 700 }];
  return (
    <div className="relative mt-4 h-7" aria-hidden>
      <div className="absolute inset-x-1 top-[9px] h-[2px] rounded-full bg-ink/15" />
      <motion.div className="absolute left-1 top-[9px] h-[2px] rounded-full bg-gold-deep" initial={reducedMotion ? false : { width: 0 }} animate={{ width: `calc((100% - 0.5rem) * ${frac})` }} transition={{ duration: 1.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }} />
      {marks.map((m) => (
        <div key={m.label} className="absolute top-[4px] -translate-x-1/2" style={{ left: `calc(0.25rem + (100% - 0.5rem) * ${m.at})` }}>
          <span className="block h-3 w-3 rotate-45 rounded-[2px] border" style={{ background: m.reached ? '#C9A255' : '#F0E6D1', borderColor: m.reached ? '#8A6A2C' : 'rgba(38,50,58,.3)' }} />
          <span className="readout absolute left-1/2 top-[15px] -translate-x-1/2 text-[8.5px] text-ink-soft">{m.label}</span>
        </div>
      ))}
      {/* the ship, sailing along to where it stopped */}
      <motion.div className="absolute -top-[7px] -translate-x-1/2" initial={reducedMotion ? false : { left: 'calc(0.25rem + (100% - 0.5rem) * 0)' }} animate={{ left: `calc(0.25rem + (100% - 0.5rem) * ${frac})` }} transition={{ duration: 1.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}>
        <svg viewBox="0 0 24 18" className="h-[17px] w-[22px] drop-shadow"><ellipse cx="12" cy="6.5" rx="9" ry="5.5" fill="#D9824F" /><ellipse cx="12" cy="6.5" rx="3" ry="5.5" fill="#E9B65C" /><path d="M7 13 H17 Q16 17 14 17 H10 Q8 17 7 13 Z" fill="#6B4A32" /><path d="M8 11 L8.5 13 M16 11 L15.5 13" stroke="#3A2A24" strokeWidth="0.9" /></svg>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------ voyage log */

function VoyageLog({ rounds, reducedMotion, daily }: { rounds: RoundSummary[]; reducedMotion: boolean; daily: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const untilMidnight = useUntilMidnight();
  return (
    <section className="mt-5" aria-label="Voyage log">
      <div className="mb-2 flex items-center gap-3 px-1">
        <h2 className="eyebrow text-[10px] text-cream/70">Voyage log</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-cream/25 to-transparent" />
        {daily && <span className="text-[11px] text-cream/55">Next quest <span className="readout text-cream/80">{hms(untilMidnight)}</span></span>}
      </div>
      <ol className="space-y-2.5 px-0.5">
        {rounds.map((r, i) => <LogEntry key={i} r={r} i={i} open={open === i} onToggle={() => setOpen(open === i ? null : i)} reducedMotion={reducedMotion} />)}
      </ol>
    </section>
  );
}

function LogEntry({ r, i, open, onToggle, reducedMotion }: { r: RoundSummary; i: number; open: boolean; onToggle: () => void; reducedMotion: boolean }) {
  const def = QUESTION_BY_ID.get(r.questionId);
  const color = TIER_COLORS[r.tier];
  const perfect = r.tier === 'perfect';
  const answer = r.status === 'answered' ? r.entityName : r.status === 'timeout' ? 'Out of time' : 'Passed';
  const delay = 0.55 + i * 0.09;
  return (
    <motion.li
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={`tile ${perfect ? 'tile-gold' : 'tile-log'}`}
    >
      <button onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left sm:px-3.5">
        {/* the entry's numeral on a route-marker diamond, in the tier's colour */}
        <span className="relative grid h-8 w-8 shrink-0 place-items-center">
          <span className="absolute inset-[5px] rotate-45" style={{ background: r.tier === 'none' ? 'transparent' : color, border: r.tier === 'none' ? '1.5px dashed rgba(240,230,209,.35)' : undefined, boxShadow: perfect ? `0 0 12px ${color}` : undefined }} />
          <span className={`relative font-display text-[11px] font-bold ${r.tier === 'none' ? 'text-cream/50' : 'text-ink'}`}>{NUMERALS[i]}</span>
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] text-cream/55">Most like <span className="text-cream/75">{def?.ref ?? '—'}</span></span>
          <span className={`block truncate font-display text-[17px] font-semibold leading-tight ${r.status === 'answered' ? 'text-cream' : 'italic text-cream/45'}`}>{answer}</span>
        </span>
        <motion.span className="flex shrink-0 items-center gap-2" initial={reducedMotion ? false : { opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: delay + 0.22, duration: 0.35 }}>
          <StrengthGlyph tier={r.tier} className="hidden h-[18px] w-[56px] min-[380px]:block" />
          <span className="w-[3.9rem] text-right">
            <span className="readout block text-[21px] font-medium leading-none" style={{ color: r.tier === 'none' ? '#8C969C' : color, textShadow: perfect ? `0 0 14px ${color}99` : undefined }}>{r.points}</span>
            <span className="block whitespace-nowrap text-[8.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: r.tier === 'none' ? '#8C969C' : color }}>{SHORT[r.tier]}</span>
          </span>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && def && <EntryBoard questionId={r.questionId} mine={r.entityName} tier={r.tier} status={r.status} />}
      </AnimatePresence>
    </motion.li>
  );
}

/** An opened log entry: why it scored what it did, and the whole board. */
function EntryBoard({ questionId, mine, tier, status }: { questionId: string; mine?: string; tier: RoundSummary['tier']; status: RoundSummary['status'] }) {
  const q = useMemo(() => buildQuestion(QUESTION_BY_ID.get(questionId)!), [questionId]);
  const ranked = mine ? q.ranked.find((x) => x.entity.name === mine) : undefined;
  const why = ranked ? ranked.entry.why : tier === 'unranked' ? 'A fair answer that isn’t on this board yet.' : status === 'timeout' ? 'The compass ran out before an answer.' : status === 'skipped' ? 'Passed.' : '';
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} className="overflow-hidden">
      <div className="journal-slip journal-slip--full mx-2.5 mb-2.5 px-4 py-3 text-ink">
        <p className="font-display text-[14px] italic text-ink-soft">{q.def.prompt}</p>
        {why && <p className="mt-1 text-[13.5px] leading-snug"><span className="font-semibold">{mine ?? 'No answer'}</span>{mine && ' — '}{mine ? why : ` ${why}`}</p>}
        <div className="rule-ink my-2" />
        <div className="space-y-1.5">
          {boardByTier(q).map((g) => (
            <div key={g.tier} className="flex flex-wrap items-center gap-1">
              <span className="readout mr-0.5 inline-flex w-9 shrink-0 items-center gap-1 text-[10.5px] font-semibold text-ink-soft" title={TIER_LABEL[g.tier]}><span className="h-2 w-2 rounded-full" style={{ background: TIER_COLORS[g.tier] }} />{TIER_POINTS[g.tier]}</span>
              {g.entries.map((e) => <span key={e.entity.id} title={e.entry.why} className={`rounded-full px-2 py-0.5 text-[12.5px] ${e.entity.name === mine ? 'bg-ink font-semibold text-parchment ring-2 ring-gold' : 'bg-ink/[0.07]'}`}>{e.entity.name}</span>)}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
