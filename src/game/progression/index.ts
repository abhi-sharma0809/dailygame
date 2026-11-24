import { CATEGORIES, QUESTION_BY_ID } from '../../data/atlas';
import { totalScore, type SessionState } from '../engine/session';
import type { PlayerData, RoundSummary, SessionSummary } from '../persistence/store';
import { DESTINATIONS, MAX_JOURNEY_SCORE, destinationIndex } from '../scoring';
import { EXPEDITIONS, addDays, dayNumber } from '../selection';
import type { CategoryId, ResultTier } from '../types';

/* ------------------------------------------------------------ summarize */

export function summarize(s: SessionState): SessionSummary {
  const rounds: RoundSummary[] = s.rounds
    .filter((r) => r.status)
    .map((r) => {
      const q = QUESTION_BY_ID.get(r.questionId)!;
      return {
        questionId: r.questionId,
        category: q.category,
        difficulty: q.difficulty,
        status: r.status!,
        points: r.result?.points ?? 0,
        tier: r.result?.tier ?? 'none',
        entityName: r.result?.entityName,
        input: r.input,
      };
    });
  return {
    id: s.id,
    mode: s.config.mode,
    label: s.config.label,
    dateKey: s.config.dateKey,
    expeditionId: s.config.expeditionId,
    expeditionSession: s.config.expeditionSession,
    startedAt: s.startedAt,
    endedAt: s.endedAt ?? s.startedAt,
    rounds,
    total: totalScore(s),
    maxTotal: rounds.length * 100,
    challenge: s.config.challenge,
  };
}

/** Destination reached by a finished journey. */
export function destinationFor(total: number, rounds = 7) {
  return DESTINATIONS[destinationIndex(rounds >= 7 ? total : (total / Math.max(1, rounds)) * 7)];
}

/* ------------------------------------------------------------ streaks */

export function streaks(data: PlayerData, today: string): { current: number; best: number } {
  const days = Object.keys(data.dailies).map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    run = prev != null && d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const set = new Set(Object.keys(data.dailies));
  let cursor = set.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, best };
}

/* ------------------------------------------------------------ stats */

const isJourney = (s: SessionSummary) => s.mode !== 'endless' && s.mode !== 'practice';

export interface Stats {
  journeys: number;
  dailies: number;
  totalPoints: number;
  answered: number;
  averageJourney: number;
  averageRound: number;
  personalBest: number;
  previousScore: number | null;
  perfectMatches: number;
  tierCounts: Record<ResultTier, number>;
  categories: { id: CategoryId; label: string; avg: number; count: number }[];
  bestQuestion: { questionId: string; points: number; entityName?: string } | null;
  history: { sessionId: string; label: string; when: number; questionId: string; input?: string; entityName?: string; points: number; tier: ResultTier }[];
  streak: { current: number; best: number };
}

export function computeStats(data: PlayerData, today: string): Stats {
  const journeys = data.sessions.filter(isJourney);
  const rounds = data.sessions.flatMap((s) => s.rounds);
  const answered = rounds.filter((r) => r.status === 'answered');
  const tierCounts = { perfect: 0, nearly: 0, family: 0, close: 0, distant: 0, loose: 0, unranked: 0, none: 0 } as Record<ResultTier, number>;
  for (const r of rounds) tierCounts[r.tier]++;
  const categories = CATEGORIES.map((c) => {
    const rs = rounds.filter((r) => r.category === c.id);
    return { id: c.id as CategoryId, label: c.label, count: rs.length, avg: rs.length ? rs.reduce((a, r) => a + r.points, 0) / rs.length : 0 };
  });
  const best = [...answered].sort((a, b) => b.points - a.points)[0];
  const lastJourney = journeys[journeys.length - 1];
  return {
    journeys: journeys.length,
    dailies: Object.keys(data.dailies).length,
    totalPoints: rounds.reduce((a, r) => a + r.points, 0),
    answered: answered.length,
    averageJourney: journeys.length ? journeys.reduce((a, s) => a + (s.total / Math.max(1, s.rounds.length)) * 7, 0) / journeys.length : 0,
    averageRound: rounds.length ? rounds.reduce((a, r) => a + r.points, 0) / rounds.length : 0,
    personalBest: Math.max(0, ...journeys.map((s) => s.total)),
    previousScore: lastJourney ? lastJourney.total : null,
    perfectMatches: tierCounts.perfect,
    tierCounts,
    categories,
    bestQuestion: best ? { questionId: best.questionId, points: best.points, entityName: best.entityName } : null,
    history: data.sessions
      .flatMap((s) => s.rounds.map((r) => ({ sessionId: s.id, label: s.label, when: s.endedAt, questionId: r.questionId, input: r.input, entityName: r.entityName, points: r.points, tier: r.tier })))
      .reverse(),
    streak: streaks(data, today),
  };
}

/* ------------------------------------------------------------ achievements */

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  glyph: string;
  check: (ctx: { data: PlayerData; session: SessionSummary; today: string }) => boolean;
}

const allRounds = (d: PlayerData) => d.sessions.flatMap((s) => s.rounds);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-connection', title: 'First Connection', description: 'Finish your first journey.', glyph: '✧', check: ({ session }) => isJourney(session) && session.rounds.length >= 7 },
  { id: 'perfect-pair', title: 'Perfect Pair', description: 'Earn a 100-point Perfect Match.', glyph: '✦', check: ({ session }) => session.rounds.some((r) => r.tier === 'perfect') },
  { id: 'the-connector', title: 'The Connector', description: 'Earn five Perfect Matches in total.', glyph: '❖', check: ({ data }) => allRounds(data).filter((r) => r.tier === 'perfect').length >= 5 },
  { id: 'world-explorer', title: 'World Explorer', description: 'Visit all seven destinations — answer every round of a journey.', glyph: '⌖', check: ({ session }) => isJourney(session) && session.rounds.length >= 7 && session.rounds.every((r) => r.status === 'answered') },
  { id: 'summit', title: 'Summit Seeker', description: 'Reach The Summit — score 600 or more in a journey.', glyph: '▲', check: ({ session }) => isJourney(session) && session.rounds.length >= 7 && session.total >= 600 },
  { id: 'seven-day-journey', title: 'Seven Day Journey', description: 'Keep a seven-day daily streak.', glyph: '☀', check: ({ data, today }) => streaks(data, today).current >= 7 },
  {
    id: 'master-of-connections', title: 'Master of Connections', description: 'Average 75+ points per round across 21 or more rounds.', glyph: '♛',
    check: ({ data }) => { const rs = allRounds(data); return rs.length >= 21 && rs.reduce((a, r) => a + r.points, 0) / rs.length >= 75; },
  },
  { id: 'off-the-map', title: 'Off the Map', description: 'Submit five valid answers that weren’t on the board yet.', glyph: '?', check: ({ data }) => allRounds(data).filter((r) => r.tier === 'unranked').length >= 5 },
  { id: 'cartographer', title: 'Cartographer', description: 'Answer a question in all ten categories.', glyph: '◎', check: ({ data }) => CATEGORIES.every((c) => allRounds(data).some((r) => r.category === c.id && r.status === 'answered')) },
  { id: 'expedition-leader', title: 'Expedition Leader', description: 'Complete every themed expedition.', glyph: '⚑', check: ({ data }) => EXPEDITIONS.every((e) => data.sessions.some((s) => s.expeditionId === e.id)) },
  { id: 'long-road', title: 'The Long Road', description: 'Answer 25 questions in one endless journey.', glyph: '∞', check: ({ session }) => session.mode === 'endless' && session.rounds.filter((r) => r.status === 'answered').length >= 25 },
];

/** Record a finished session (pure). */
export function recordSession(data: PlayerData, state: SessionState, today: string, now = Date.now()) {
  const summary = summarize(state);
  if (data.sessions.some((s) => s.id === summary.id)) return { data, unlocked: [] as AchievementDef[], summary };
  const unrankedNew = state.rounds
    .filter((r) => r.result?.tier === 'unranked')
    .map((r) => ({ questionId: r.questionId, questionVersion: QUESTION_BY_ID.get(r.questionId)?.version ?? 1, entityId: r.result!.entityId, name: r.result!.entityName, timestamp: now }));
  const next: PlayerData = {
    ...data,
    sessions: [...data.sessions, summary].slice(-500),
    dailies: { ...data.dailies },
    achievements: { ...data.achievements },
    unranked: [...data.unranked, ...unrankedNew].slice(-500),
    recentQuestions: [...data.recentQuestions.filter((id) => !summary.rounds.some((r) => r.questionId === id)), ...summary.rounds.map((r) => r.questionId)].slice(-80),
    inProgress: { ...data.inProgress },
  };
  if (summary.mode === 'daily' && summary.dateKey && !next.dailies[summary.dateKey]) {
    next.dailies[summary.dateKey] = { sessionId: summary.id, total: summary.total, completedAt: now };
  }
  const unlocked = ACHIEVEMENTS.filter((a) => !next.achievements[a.id] && a.check({ data: next, session: summary, today }));
  for (const a of unlocked) next.achievements[a.id] = now;
  return { data: next, unlocked, summary };
}

/* ------------------------------------------------------------ sharing */

const SQUARE: Record<ResultTier, string> = { perfect: '🟨', nearly: '🟧', family: '🟩', close: '🟦', distant: '🟪', loose: '⬜', unranked: '⬜', none: '⬛' };

/** Share text: score and tiers only — never the questions or answers. */
export function shareText(s: SessionSummary, url?: string): string {
  const perfect = s.rounds.filter((r) => r.tier === 'perfect').length;
  const title = s.mode === 'daily' && s.dateKey ? `KINSHIP — DAILY JOURNEY #${dayNumber(s.dateKey) + 1}` : `KINSHIP — ${s.label.toUpperCase()}`;
  const lines = [
    title,
    '',
    `${s.total} / ${s.maxTotal}`,
    s.rounds.map((r) => SQUARE[r.tier]).join(''),
    `Reached ${destinationFor(s.total, s.rounds.length).name}`,
    perfect ? `${perfect} PERFECT CONNECTION${perfect === 1 ? '' : 'S'}` : '',
    '',
    'Can you find the same connections?',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '');
  if (url) lines.push(url);
  return lines.join('\n');
}

/* ------------------------------------------------------------ friend challenges */

export interface ChallengePayload { q: string[]; s?: number; n?: string }

const b64 = {
  enc: (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))),
};

export const encodeChallenge = (p: ChallengePayload) => b64.enc(JSON.stringify(p));

export function decodeChallenge(token: string): ChallengePayload | null {
  try {
    const p = JSON.parse(b64.dec(token)) as ChallengePayload;
    if (!Array.isArray(p.q) || p.q.length < 1 || p.q.length > 10 || !p.q.every((id) => QUESTION_BY_ID.has(id))) return null;
    return { q: p.q, s: typeof p.s === 'number' ? Math.max(0, Math.min(MAX_JOURNEY_SCORE, Math.round(p.s))) : undefined, n: typeof p.n === 'string' ? p.n.slice(0, 24) : undefined };
  } catch {
    return null;
  }
}
