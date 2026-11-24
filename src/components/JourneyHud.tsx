import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import type { SessionState } from '../game/engine/session';
import { TIER_COLORS } from '../game/scoring';
import { DEST } from './Journey/world';
import { CountUp, Wordmark } from './ui';

/* ============================================================
 * The journey HUD: small ink plaques at the edges of the world.
 *   left   — wordmark + quest label
 *   centre — the seven questions and the next destination
 *   right  — the running score and leave
 * ============================================================ */

interface HudProps {
  state: SessionState;
  shownScore: number;
  scoreFrom: number;
  instant: boolean;
  /** journey points 0–700 used by the world */
  journeyScore: number;
  onHome: () => void;
  right?: ReactNode;
}

export function JourneyHud({ state, shownScore, scoreFrom, instant, journeyScore, onHome, right }: HudProps) {
  const cfg = state.config;
  const count = cfg.questionIds.length;
  const reached = Math.min(6, Math.floor(journeyScore / 100 + 1e-9));
  const nextI = journeyScore >= 700 ? 7 : reached + 1;
  const into = journeyScore >= 600 ? (journeyScore - 600) / 100 : (journeyScore % 100) / 100;
  const nextName = nextI >= 7 ? 'The Beacon' : DEST[nextI].name;
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 px-3 pt-[max(0.6rem,env(safe-area-inset-top))] sm:px-5 sm:pt-4">
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto ml-0.5 mt-0.5 flex items-center gap-3">
          <Wordmark size="sm" onClick={onHome} />
          <div className="hud-plaque hidden min-w-0 px-3 py-1.5 lg:block">
            <div className="eyebrow truncate text-[9.5px] text-cream/55">{cfg.label}</div>
            <div className="font-pixel text-[14px] text-cream/90">Question {state.index + 1} / {count}</div>
          </div>
        </div>

        {/* centre: legs + next destination (desktop) */}
        <div className="hud-plaque pointer-events-auto absolute left-1/2 top-[max(0.6rem,env(safe-area-inset-top))] hidden -translate-x-1/2 flex-col items-center px-4 py-2 sm:top-4 md:flex">
          <Legs state={state} count={count} />
          <NextUp name={nextName} numeral={nextI >= 7 ? '✦' : DEST[nextI].numeral} into={into} done={journeyScore >= 700} />
        </div>

        <div className="flex items-start gap-1.5">
          <div className="hud-plaque pointer-events-auto mr-2 mt-0.5 px-3 py-1.5 text-right sm:px-4">
            <div className="eyebrow text-[9px] text-cream/50">Score</div>
            <div className="readout text-[21px] font-semibold leading-tight text-gold sm:text-[23px]">
              <CountUp key={shownScore} from={scoreFrom} to={shownScore} duration={1.2} instant={instant} />
              <span className="text-[12px] font-medium text-cream/50">/{count * 100}</span>
            </div>
          </div>
          {right}
        </div>
      </div>

      {/* phones: legs + next destination under the top row */}
      <div className="mt-2 flex justify-center md:hidden">
        <div className="hud-plaque pointer-events-auto flex flex-col items-center px-3 py-1.5">
          <Legs state={state} count={count} />
          <NextUp name={nextName} numeral={nextI >= 7 ? '✦' : DEST[nextI].numeral} into={into} done={journeyScore >= 700} />
        </div>
      </div>
    </header>
  );
}

function Legs({ state, count }: { state: SessionState; count: number }) {
  const shown = Math.min(count, 12);
  const offset = count - shown;
  return (
    <div className="flex items-center gap-1.5" aria-label={`Question ${state.index + 1} of ${count}`}>
      {Array.from({ length: shown }, (_, k) => {
        const i = k + offset;
        const r = state.rounds[i];
        const done = !!r?.status;
        const cur = i === state.index && !done;
        return (
          <span
            key={i}
            className="h-2.5 w-2.5 rotate-45 rounded-[2px] border transition-colors duration-500"
            style={{
              borderColor: cur ? '#F8F3E8' : 'rgba(240,230,209,.35)',
              background: done ? TIER_COLORS[r!.result?.tier ?? 'none'] : cur ? 'rgba(248,243,232,.9)' : 'transparent',
              boxShadow: cur ? '0 0 0 3px rgba(248,243,232,.12)' : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

function NextUp({ name, numeral, into, done }: { name: string; numeral: string; into: number; done: boolean }) {
  return (
    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-cream/70">
      {done ? (
        <span className="font-display italic text-gold-light">The beacon is lit</span>
      ) : (
        <>
          <span className="eyebrow text-[9px] text-cream/45">Next</span>
          <span className="font-display text-[13px] italic text-cream">{numeral} · {name.replace(/^The /, '')}</span>
          <span className="relative h-1.5 w-14 overflow-hidden bg-parchment/15">
            <span className="absolute inset-y-0 left-0 bg-gold transition-[width] duration-[1600ms] ease-out" style={{ width: `${Math.round(into * 100)}%` }} />
          </span>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ destination card */

export interface DestinationNote { key: number; kind: 'start' | 'ahead' | 'reached'; index: number }

/** "Now approaching / Reached" — a cartouche that settles under the HUD, then fades. */
export function DestinationCard({ note }: { note: DestinationNote | null }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[124px] z-30 flex justify-center px-4 md:top-[96px]">
      <AnimatePresence mode="wait">
        {note && (
          <motion.div
            key={note.key}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            className={`cartouche text-center ${note.kind === 'reached' ? 'cartouche--gold' : ''}`}
          >
            <div className="eyebrow text-[9.5px]" style={{ color: note.kind === 'reached' ? '#7A5A22' : 'rgba(248,243,232,.6)' }}>
              {note.kind === 'reached' ? (note.index === 7 ? 'The journey’s end' : `Destination ${DEST[note.index].numeral} reached`) : note.kind === 'ahead' ? 'Now approaching' : 'Your journey begins'}
            </div>
            <div className="font-display text-[19px] font-semibold leading-tight sm:text-[22px]" style={{ color: note.kind === 'reached' ? '#2A2116' : '#F8F3E8' }}>
              {note.index === 7 ? 'The Beacon is lit' : DEST[note.index].name}
            </div>
            <div className="mt-0.5 font-display text-[12.5px] italic" style={{ color: note.kind === 'reached' ? '#5A4A30' : 'rgba(248,243,232,.7)' }}>
              {note.index === 7 ? 'Everything has something in common.' : DEST[note.index].blurb}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
