import { QUESTION_BY_ID } from '../../data/atlas';
import type { AnswerResult } from '../types';
import { buildQuestion, evaluate, rejectionReason } from './questions';

/* ============================================================
 * Session state machine (pure, deterministic, serializable)
 *
 *   answering ──LOCK──▶ revealing ──NEXT──▶ answering … ──▶ complete
 *       │  └─SKIP/TIMEOUT─┘                    ▲
 *       └──────────────── END (endless/practice)┘
 *
 * Time is injected (`now`) so every transition is testable. Deadlines are
 * absolute timestamps stored in state, so re-renders or reloads can never
 * restart a timer.
 * ============================================================ */

export type SessionMode = 'daily' | 'archive' | 'endless' | 'practice' | 'expedition' | 'challenge';

export interface SessionConfig {
  mode: SessionMode;
  /** question ids, in order; endless/practice sessions append as they go */
  questionIds: string[];
  /** seconds per question; null = untimed */
  seconds: number | null;
  /** fixed-length sessions complete after the last question */
  fixedLength: boolean;
  /** date key for daily/archive sessions */
  dateKey?: string;
  expeditionId?: string;
  expeditionSession?: number;
  bankVersion?: string;
  challenge?: { fromName?: string; fromScore?: number };
  label: string;
  /** identifies an open-ended run so a reload resumes the same one */
  token?: string;
}

export type RoundStatus = 'answered' | 'skipped' | 'timeout';

export interface RoundRecord {
  questionId: string;
  startedAt: number;
  deadline: number | null;
  status?: RoundStatus;
  input?: string;
  result?: AnswerResult;
  lockedAt?: number;
}

export type Phase = 'answering' | 'revealing' | 'complete';

export interface SessionState {
  id: string;
  config: SessionConfig;
  index: number;
  rounds: RoundRecord[];
  phase: Phase;
  startedAt: number;
  endedAt?: number;
}

export type SessionAction =
  | { type: 'LOCK'; entityId: string; input: string; now: number }
  | { type: 'SKIP'; now: number }
  | { type: 'TIMEOUT'; now: number }
  | { type: 'NEXT'; now: number; nextQuestionId?: string }
  | { type: 'END'; now: number };

export function createSession(config: SessionConfig, now: number, id = `s_${now.toString(36)}`): SessionState {
  if (!config.questionIds.length) throw new Error('A session needs at least one question');
  for (const qid of config.questionIds) if (!QUESTION_BY_ID.has(qid)) throw new Error(`Unknown question ${qid}`);
  return {
    id,
    config,
    index: 0,
    rounds: [openRound(config, config.questionIds[0], now)],
    phase: 'answering',
    startedAt: now,
  };
}

function openRound(config: SessionConfig, questionId: string, now: number): RoundRecord {
  return { questionId, startedAt: now, deadline: config.seconds ? now + config.seconds * 1000 : null };
}

export const currentRound = (s: SessionState): RoundRecord => s.rounds[s.index];

/** Has the current round's timer run out at `now`? */
export const isExpired = (s: SessionState, now: number) => {
  const r = currentRound(s);
  return s.phase === 'answering' && !r.status && r.deadline != null && now >= r.deadline;
};

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  const round = currentRound(state);
  switch (action.type) {
    case 'LOCK': {
      // one answer per question; no answers after the buzzer
      if (state.phase !== 'answering' || round.status) return state;
      if (round.deadline != null && action.now > round.deadline + 250) return lockEmpty(state, 'timeout', action.now);
      const q = buildQuestion(QUESTION_BY_ID.get(round.questionId)!);
      const e = q.universe.entities.find((x) => x.id === action.entityId);
      if (!e || rejectionReason(q, e)) return state; // never lock an invalid answer
      const result = evaluate(q, action.entityId);
      return replaceRound(state, { ...round, status: 'answered', input: action.input, result, lockedAt: action.now }, 'revealing');
    }
    case 'SKIP':
      if (state.phase !== 'answering' || round.status) return state;
      return lockEmpty(state, 'skipped', action.now);
    case 'TIMEOUT':
      if (state.phase !== 'answering' || round.status) return state;
      if (round.deadline == null || action.now < round.deadline) return state;
      return lockEmpty(state, 'timeout', action.now);
    case 'NEXT': {
      if (state.phase !== 'revealing') return state;
      const { config } = state;
      const isLast = config.fixedLength && state.index >= config.questionIds.length - 1;
      if (isLast) return { ...state, phase: 'complete', endedAt: action.now };
      let questionIds = config.questionIds;
      let nextId = questionIds[state.index + 1];
      if (!config.fixedLength) {
        nextId = action.nextQuestionId ?? questionIds[state.index + 1];
        if (!nextId || !QUESTION_BY_ID.has(nextId)) return { ...state, phase: 'complete', endedAt: action.now };
        questionIds = [...questionIds.slice(0, state.index + 1), nextId];
      }
      return {
        ...state,
        config: { ...config, questionIds },
        index: state.index + 1,
        rounds: [...state.rounds, openRound(config, nextId, action.now)],
        phase: 'answering',
      };
    }
    case 'END': {
      if (state.phase === 'complete') return state;
      // drop an unanswered open round in open-ended modes
      const rounds = round.status ? state.rounds : state.rounds.slice(0, -1);
      return { ...state, rounds, index: Math.max(0, rounds.length - 1), phase: 'complete', endedAt: action.now };
    }
  }
}

function lockEmpty(state: SessionState, status: RoundStatus, now: number): SessionState {
  return replaceRound(state, { ...currentRound(state), status, lockedAt: now }, 'revealing');
}

function replaceRound(state: SessionState, round: RoundRecord, phase: Phase): SessionState {
  const rounds = state.rounds.slice();
  rounds[state.index] = round;
  return { ...state, rounds, phase };
}

/* ---------------------------------------------------------- summaries */

export const roundScore = (r: RoundRecord) => r.result?.points ?? 0;
export const totalScore = (s: SessionState) => s.rounds.reduce((sum, r) => sum + roundScore(r), 0);
export const completedRounds = (s: SessionState) => s.rounds.filter((r) => r.status);
