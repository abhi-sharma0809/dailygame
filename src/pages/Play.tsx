import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { play } from '../audio/sfx';
import { ConnectionReveal } from '../components/ConnectionReveal';
import { JourneyWorld, type ExplorerMood } from '../components/Journey/JourneyWorld';
import { DestinationCard, JourneyHud, type DestinationNote } from '../components/JourneyHud';
import { QuestionDock } from '../components/QuestionScreen';
import { ReportDialog } from '../components/ReportDialog';
import { QUESTION_BY_ID } from '../data/atlas';
import { buildQuestion } from '../game/engine/questions';
import { createSession, currentRound, isExpired, sessionReducer, totalScore, type SessionAction, type SessionConfig, type SessionState } from '../game/engine/session';
import { DESTINATIONS, destinationIndex } from '../game/scoring';
import { nextOpenQuestion } from '../game/selection';
import type { CategoryId, Entity } from '../game/types';
import { useDeadline, useSecondsLeft } from '../hooks/useCountdown';
import { navigate } from '../hooks/useHashRoute';
import { usePlayer } from '../state/PlayerContext';

export interface PlaySpec {
  slot: string;
  makeConfig: () => SessionConfig;
  open?: { category: CategoryId | 'all' };
}

/** Lift the dock above an on-screen keyboard (visualViewport-aware browsers). */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener('resize', on);
    vv.addEventListener('scroll', on);
    return () => { vv.removeEventListener('resize', on); vv.removeEventListener('scroll', on); };
  }, []);
  return inset;
}

export function Play({ spec }: { spec: PlaySpec }) {
  const { data, saveProgress, finishSession, reducedMotion } = usePlayer();

  const [state, setState] = useState<SessionState>(() => {
    const saved = data.inProgress[spec.slot];
    const fresh = spec.makeConfig();
    if (saved && saved.phase !== 'complete' && (fresh.fixedLength ? saved.config.questionIds.join() === fresh.questionIds.join() : saved.config.token === fresh.token)) return saved;
    return createSession(fresh, Date.now());
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [report, setReport] = useState({ open: false, submitted: '' });

  const total = totalScore(state);
  const round = currentRound(state);
  const answering = state.phase === 'answering' && !round.status;
  // the world shows the score *before* this round's reveal until the explorer travels
  const settledTotal = answering || state.phase !== 'revealing' ? total : total - (round.result?.points ?? 0);
  const [mapScore, setMapScore] = useState(settledTotal);
  const [mood, setMood] = useState<ExplorerMood>('idle');
  const [reactKey, setReactKey] = useState(0);
  useEffect(() => { if (answering) { setMapScore(total); setMood('idle'); } }, [answering, total]);

  const dispatch = useCallback((a: SessionAction) => {
    const prev = stateRef.current;
    const next = sessionReducer(prev, a);
    if ((window as unknown as { __KINSHIP_DEBUG?: boolean }).__KINSHIP_DEBUG) console.log(`[kinship] ${a.type} idx=${prev.index} ${prev.phase}→${next.phase}${next === prev ? ' (ignored)' : ''}`);
    if (next === prev) return;
    stateRef.current = next;
    setState(next);
    if (next.phase === 'complete') {
      if (next.rounds.some((r) => r.status)) { finishSession(spec.slot, next); navigate(`/results/${next.id}`, true); }
      else { saveProgress(spec.slot, null); navigate('/', true); }
    } else saveProgress(spec.slot, next);
  }, [finishSession, saveProgress, spec.slot]);

  // persist immediately so a refresh can never re-roll the session
  useEffect(() => { if (!data.inProgress[spec.slot]) saveProgress(spec.slot, stateRef.current); /* eslint-disable-next-line */ }, []);
  // reloaded after the deadline → time out at once
  useEffect(() => { if (isExpired(state, Date.now())) dispatch({ type: 'TIMEOUT', now: Date.now() }); }, [state, dispatch]);

  const q = useMemo(() => buildQuestion(QUESTION_BY_ID.get(round.questionId)!), [round.questionId]);

  /* ------------------------------------------------ timing: the deadline in state is the only clock */
  const deadline = answering ? round.deadline : null;
  useDeadline(deadline, () => dispatch({ type: 'TIMEOUT', now: Date.now() }));
  const secs = useSecondsLeft(deadline);
  useEffect(() => { if (secs != null && secs > 0 && secs <= 5) play('tick'); }, [secs]);

  const cfg = state.config;
  const fixed = cfg.fixedLength;
  const journeyScore = fixed ? (cfg.questionIds.length === 7 ? mapScore : (mapScore / cfg.questionIds.length) * 7) : mapScore % 700;
  const dest = DESTINATIONS[destinationIndex(journeyScore)];
  const stageLabel = fixed ? `Leg ${state.index + 1} of ${cfg.questionIds.length}` : `Endless · leg ${state.index + 1}`;

  const onLock = (e: Entity, input: string) => dispatch({ type: 'LOCK', entityId: e.id, input, now: Date.now() });
  const onPass = () => dispatch({ type: 'SKIP', now: Date.now() });
  const onTravel = () => {
    const r = currentRound(stateRef.current).result;
    const pts = r?.points ?? 0;
    setMapScore(totalScore(stateRef.current));
    setMood(r?.tier === 'perfect' ? 'celebrate' : pts >= 65 ? 'cheer' : pts > 0 ? 'travel' : 'miss');
    setReactKey((k) => k + 1);
  };
  const onNext = useCallback(() => {
    const s = stateRef.current;
    let nextQuestionId: string | undefined;
    if (!s.config.fixedLength) {
      nextQuestionId = nextOpenQuestion({ rand: Math.random, recent: [...data.recentQuestions, ...s.config.questionIds], category: spec.open?.category, lastCategory: QUESTION_BY_ID.get(currentRound(s).questionId)?.category });
    }
    play('click');
    dispatch({ type: 'NEXT', now: Date.now(), nextQuestionId });
  }, [data.recentQuestions, dispatch, spec.open]);
  const retry = () => { play('click'); dispatch({ type: 'NEXT', now: Date.now(), nextQuestionId: currentRound(stateRef.current).questionId }); };

  /* ------------------------------------------------ destination notes */
  const [note, setNote] = useState<DestinationNote | null>(() => ({ key: 0, kind: 'start', index: destinationIndex(journeyScore) }));
  const noteTimer = useRef(0);
  const showNote = useCallback((n: Omit<DestinationNote, 'key'>, ms = 3600) => {
    window.clearTimeout(noteTimer.current);
    setNote({ ...n, key: Date.now() });
    noteTimer.current = window.setTimeout(() => setNote(null), ms);
  }, []);
  useEffect(() => { noteTimer.current = window.setTimeout(() => setNote(null), 3400); return () => window.clearTimeout(noteTimer.current); }, []);
  const onLandmark = useCallback((i: number) => { play('acquire'); showNote({ kind: 'reached', index: i }, 4200); }, [showNote]);
  const onRegion = useCallback((i: number) => {
    // entering a destination's lands before reaching it: build anticipation
    if (i > destinationIndex(journeyScoreRef.current)) showNote({ kind: 'ahead', index: i }, 3000);
  }, [showNote]);
  const journeyScoreRef = useRef(journeyScore);
  journeyScoreRef.current = journeyScore;

  const kb = useKeyboardInset();

  return (
    <div className="fixed inset-0 overflow-hidden bg-night">
      <JourneyWorld score={journeyScore} reducedMotion={reducedMotion} mood={mood} reactKey={reactKey} onLandmark={onLandmark} onRegion={onRegion} />
      <h2 className="sr-only" aria-live="polite">{`The explorer is at ${dest.name}`}</h2>

      <JourneyHud
        state={state}
        shownScore={mapScore}
        scoreFrom={Math.max(0, mapScore - (round.result?.points ?? 0))}
        instant={reducedMotion || answering}
        journeyScore={journeyScore}
        onHome={() => navigate('/')}
        right={!fixed ? (
          <button onClick={() => dispatch({ type: 'END', now: Date.now() })} className="hud-plaque pointer-events-auto px-3 py-2.5 text-[13px] font-semibold text-cream/85 hover:text-gold">End journey</button>
        ) : (
          <button onClick={() => navigate('/')} className="hud-plaque pointer-events-auto grid h-[46px] w-10 place-items-center text-xl leading-none text-cream/60 hover:text-cream sm:h-[52px]" aria-label="Leave (progress is saved)" title="Leave — your progress is saved">×</button>
        )}
      />
      <DestinationCard note={note} />

      {/* ------------------------------------------------ the dock */}
      <div className="absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 sm:px-6" style={{ paddingBottom: `max(${kb + 12}px, calc(env(safe-area-inset-bottom) + 12px))`, transition: 'padding-bottom .2s ease' }}>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#05090D]/55 to-transparent" />
        <AnimatePresence mode="wait" initial={false}>
          {state.phase === 'answering' ? (
            <motion.div key={`q-${state.index}`} className="relative flex w-full justify-center" initial={reducedMotion ? false : { opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: 18 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}>
              <QuestionDock q={q} stageLabel={stageLabel} deadline={deadline} seconds={cfg.seconds} disabled={!answering} onLock={onLock} onPass={onPass} onReport={(s) => setReport({ open: true, submitted: s })} />
            </motion.div>
          ) : state.phase === 'revealing' ? (
            <motion.div key={`r-${state.index}`} className="relative flex w-full justify-center" initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: 22 }} transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}>
              <ConnectionReveal
                q={q}
                round={round}
                reducedMotion={reducedMotion}
                quick={cfg.mode === 'practice'}
                isLast={fixed && state.index >= cfg.questionIds.length - 1}
                onTravel={onTravel}
                onNext={onNext}
                onReport={(s) => setReport({ open: true, submitted: s })}
                extraAction={cfg.mode === 'practice' ? <button onClick={(e) => { e.stopPropagation(); retry(); }} className="text-[11px] font-medium text-cream/70 hover:text-gold">Try this one again ↺</button> : undefined}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <ReportDialog q={q} open={report.open} submitted={report.submitted} onClose={() => setReport({ open: false, submitted: '' })} />
    </div>
  );
}
