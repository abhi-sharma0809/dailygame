import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { play } from '../audio/sfx';
import { ConnectionReveal } from '../components/ConnectionReveal';
import { JourneyWorld, type ExplorerMood, type TravelStyle } from '../components/Journey/JourneyWorld';
import { DEFAULT_STYLE, styleForTier } from '../components/Journey/motion';
import { DestinationCard, JourneyHud, type DestinationNote } from '../components/JourneyHud';
import { PixelIcon } from '../components/PixelIcon';
import { QuestionDock } from '../components/QuestionScreen';
import { ReportDialog } from '../components/ReportDialog';
import { QUESTION_BY_ID } from '../data/atlas';
import { buildQuestion } from '../game/engine/questions';
import { createSession, currentRound, isExpired, sessionReducer, totalScore, type SessionAction, type SessionConfig, type SessionState } from '../game/engine/session';
import { DESTINATIONS, destinationIndex } from '../game/scoring';
import type { Entity, ResultTier } from '../game/types';
import { useDeadline, useSecondsLeft } from '../hooks/useCountdown';
import { navigate } from '../hooks/useHashRoute';
import { usePlayer } from '../state/PlayerContext';

export interface PlaySpec {
  slot: string;
  makeConfig: () => SessionConfig;
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

const moodFor = (tier: ResultTier): ExplorerMood => (tier === 'perfect' ? 'celebrate' : tier === 'nearly' || tier === 'family' ? 'cheer' : tier === 'none' ? 'miss' : 'travel');

/**
 * One quest (today's, or a past one from the Archives): seven questions, and
 * after each answer the airship flies on by exactly the points it earned.
 */
export function Play({ spec }: { spec: PlaySpec }) {
  const { data, saveProgress, finishSession, reducedMotion } = usePlayer();

  const [state, setState] = useState<SessionState>(() => {
    const saved = data.inProgress[spec.slot];
    const fresh = spec.makeConfig();
    if (saved && saved.phase !== 'complete' && saved.config.questionIds.join() === fresh.questionIds.join()) return saved;
    return createSession(fresh, Date.now());
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [report, setReport] = useState({ open: false, submitted: '' });

  const total = totalScore(state);
  const round = currentRound(state);
  const answering = state.phase === 'answering' && !round.status;
  // Resumed in the middle of a reveal (left and came back): show it finished, ship already in place.
  const [resumedReveal] = useState(() => (state.phase === 'revealing' ? state.index : -1));
  // otherwise the world shows the score *before* this round's reveal until the ship launches
  const [mapScore, setMapScore] = useState(total);
  const [mood, setMood] = useState<ExplorerMood>('idle');
  const [travel, setTravel] = useState<TravelStyle>(DEFAULT_STYLE);
  const [reactKey, setReactKey] = useState(0);
  const reactKeyRef = useRef(0);
  const [launchedRound, setLaunchedRound] = useState(-1);
  const [settledKey, setSettledKey] = useState(0);
  useEffect(() => { if (answering) { setMapScore(total); setMood('idle'); } }, [answering, total]);

  const dispatch = useCallback((a: SessionAction) => {
    const prev = stateRef.current;
    const next = sessionReducer(prev, a);
    if ((window as unknown as { __SIMMLY_DEBUG?: boolean }).__SIMMLY_DEBUG) console.log(`[simmly] ${a.type} idx=${prev.index} ${prev.phase}→${next.phase}${next === prev ? ' (ignored)' : ''}`);
    if (next === prev) return;
    stateRef.current = next;
    setState(next);
    if (next.phase === 'complete') { finishSession(spec.slot, next); navigate(`/results/${next.id}`, true); }
    else saveProgress(spec.slot, next);
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
  const count = cfg.questionIds.length;
  // the world is drawn for seven 100-point legs
  const journeyScore = count === 7 ? mapScore : (mapScore / count) * 7;
  const dest = DESTINATIONS[destinationIndex(journeyScore)];
  const stageLabel = `Question ${state.index + 1} of ${count}`;

  const onLock = (e: Entity, input: string) => dispatch({ type: 'LOCK', entityId: e.id, input, now: Date.now() });
  const onPass = () => dispatch({ type: 'SKIP', now: Date.now() });

  /** The reveal hands over to the ship: launch it in the style of this answer's tier. */
  const onTravel = () => {
    const s = stateRef.current;
    const r = currentRound(s);
    const tier: ResultTier = r.status === 'answered' && r.result ? r.result.tier : 'none';
    setTravel(styleForTier(tier));
    setMapScore(totalScore(s));
    setMood(moodFor(tier));
    setLaunchedRound(s.index);
    reactKeyRef.current += 1;
    setReactKey(reactKeyRef.current);
  };
  const onLaunch = useCallback((style: TravelStyle, moving: boolean) => { if (moving) play('launch', style.power); }, []);
  const onSettle = useCallback(() => setSettledKey(reactKeyRef.current), []);
  const settled = launchedRound === state.index && settledKey === reactKey && reactKey > 0;

  const onNext = useCallback(() => {
    play('click');
    dispatch({ type: 'NEXT', now: Date.now() });
  }, [dispatch]);

  /* ------------------------------------------------ destination notes */
  const journeyScoreRef = useRef(journeyScore);
  journeyScoreRef.current = journeyScore;
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

  const kb = useKeyboardInset();

  return (
    <div className="fixed inset-0 overflow-hidden bg-night">
      <JourneyWorld score={journeyScore} reducedMotion={reducedMotion} mood={mood} reactKey={reactKey} travel={travel} onLaunch={onLaunch} onSettle={onSettle} onLandmark={onLandmark} onRegion={onRegion} />
      <h2 className="sr-only" aria-live="polite">{`The airship is at ${dest.name}`}</h2>

      <JourneyHud
        state={state}
        shownScore={mapScore}
        scoreFrom={Math.max(0, mapScore - (round.result?.points ?? 0))}
        instant={reducedMotion || answering}
        journeyScore={journeyScore}
        onHome={() => navigate('/')}
        right={<button onClick={() => navigate('/')} className="btn-ghost btn-sm btn-icon pointer-events-auto mr-0.5 mt-0.5" aria-label="Leave (progress is saved)" title="Leave — your progress is saved"><PixelIcon name="close" size={12} /></button>}
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
                isLast={state.index >= count - 1}
                resumed={resumedReveal === state.index}
                settled={settled}
                onTravel={onTravel}
                onNext={onNext}
                onReport={(s) => setReport({ open: true, submitted: s })}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <ReportDialog q={q} open={report.open} submitted={report.submitted} onClose={() => setReport({ open: false, submitted: '' })} />
    </div>
  );
}
