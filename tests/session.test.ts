import { describe, expect, it } from 'vitest';
import { QUESTION_BY_ID } from '../src/data/atlas';
import { buildQuestion } from '../src/game/engine/questions';
import { createSession, isExpired, sessionReducer, totalScore, type SessionConfig } from '../src/game/engine/session';
import { emptyPlayer, LEGACY_STORAGE_KEYS, loadPlayer, memoryStore, savePlayer, STORAGE_KEY } from '../src/game/persistence/store';
import { computeStats, recordSession, shareText, shareTitle, streaks } from '../src/game/progression';
import { addDays, dailyCategories, dailyQuestionIds, dateKey, dayNumber } from '../src/game/selection';

const id = (qid: string, name: string) => buildQuestion(QUESTION_BY_ID.get(qid)!).universe.entities.find((e) => e.name === name)!.id;
const cfg = (o: Partial<SessionConfig> = {}): SessionConfig => ({ mode: 'daily', questionIds: ['animal_panda', 'tv_friends', 'food_pizza'], seconds: 20, label: 'T', ...o });

describe('session', () => {
  it('locks once, ignores duplicates, refuses invalid', () => {
    let s = createSession(cfg(), 0);
    expect(sessionReducer(s, { type: 'LOCK', entityId: id('animal_panda', 'Giant panda'), input: 'panda', now: 1 })).toBe(s);
    s = sessionReducer(s, { type: 'LOCK', entityId: id('animal_panda', 'Red panda'), input: 'red panda', now: 1 });
    expect(s.rounds[0].result?.points).toBe(100);
    expect(sessionReducer(s, { type: 'LOCK', entityId: id('animal_panda', 'Bear'), input: 'bear', now: 2 })).toBe(s);
  });
  it('times out at 20 s and treats late locks as timeouts', () => {
    let s = createSession(cfg(), 0);
    expect(isExpired(s, 19_999)).toBe(false);
    expect(isExpired(s, 20_000)).toBe(true);
    s = sessionReducer(s, { type: 'LOCK', entityId: id('animal_panda', 'Red panda'), input: 'x', now: 30_000 });
    expect(s.rounds[0].status).toBe('timeout');
  });
  it('passes score 0 and the journey totals correctly', () => {
    let s = createSession(cfg(), 0);
    s = sessionReducer(s, { type: 'SKIP', now: 1 });
    s = sessionReducer(s, { type: 'NEXT', now: 2 });
    s = sessionReducer(s, { type: 'LOCK', entityId: id('tv_friends', 'Lost'), input: 'Lost', now: 3 });
    s = sessionReducer(s, { type: 'NEXT', now: 4 });
    s = sessionReducer(s, { type: 'LOCK', entityId: id('food_pizza', 'Calzone'), input: 'calzone', now: 5 });
    s = sessionReducer(s, { type: 'NEXT', now: 6 });
    expect(s.phase).toBe('complete');
    expect(totalScore(s)).toBe(0 + 30 + 100);
  });
});

describe('daily selection', () => {
  it('is deterministic and varies by day', () => {
    expect(dailyQuestionIds('2026-11-19')).toEqual(dailyQuestionIds('2026-11-19'));
    expect(dailyQuestionIds('2026-11-19')).not.toEqual(dailyQuestionIds('2026-11-20'));
  });
  it('uses 7 distinct categories, easiest first, no repeats within 8 days', () => {
    const rank = { easy: 0, medium: 1, hard: 2 } as const;
    const last = new Map<string, number>();
    for (let d = 0; d < 120; d++) {
      const ids = dailyQuestionIds(addDays('2026-11-15', d));
      const qs = ids.map((x) => QUESTION_BY_ID.get(x)!);
      expect(new Set(qs.map((q) => q.category)).size).toBe(7);
      for (let i = 1; i < 7; i++) expect(rank[qs[i].difficulty]).toBeGreaterThanOrEqual(rank[qs[i - 1].difficulty]);
      for (const x of ids) { if (last.has(x)) expect(d - last.get(x)!).toBeGreaterThanOrEqual(8); last.set(x, d); }
    }
  });
  it('rotates categories evenly', () => {
    const counts = new Map<string, number>();
    for (let d = 0; d < 100; d++) for (const c of dailyCategories(d)) counts.set(c, (counts.get(c) ?? 0) + 1);
    expect(new Set(counts.values()).size).toBe(1);
  });
  it('date helpers', () => {
    expect(dayNumber('2026-11-15')).toBe(0);
    expect(dateKey(new Date(2026, 10, 19, 23, 59))).toBe('2026-11-19');
  });
});

function playDaily(key: string, answer: 'best' | 'skip' = 'best') {
  const ids = dailyQuestionIds(key);
  let s = createSession({ mode: 'daily', questionIds: ids, seconds: 20, dateKey: key, label: 'Daily' }, 0, `d_${key}`);
  ids.forEach((qid, i) => {
    const q = buildQuestion(QUESTION_BY_ID.get(qid)!);
    s = answer === 'best' ? sessionReducer(s, { type: 'LOCK', entityId: q.ranked[0].entity.id, input: 'x', now: i * 10 + 1 }) : sessionReducer(s, { type: 'SKIP', now: i * 10 + 1 });
    s = sessionReducer(s, { type: 'NEXT', now: i * 10 + 2 });
  });
  return s;
}

describe('progression & persistence', () => {
  it('records once, persists, and earns achievements through play', () => {
    const store = memoryStore();
    const { data, unlocked } = recordSession(emptyPlayer(), playDaily('2026-11-19'), '2026-11-19');
    expect(data.dailies['2026-11-19'].total).toBe(700);
    expect(unlocked.map((a) => a.id)).toEqual(expect.arrayContaining(['first-connection', 'perfect-pair', 'the-connector', 'world-explorer', 'summit']));
    expect(recordSession(data, playDaily('2026-11-19'), '2026-11-19').data.sessions).toHaveLength(1);
    savePlayer(store, data);
    expect(loadPlayer(store).dailies['2026-11-19'].total).toBe(700);
    const skipped = recordSession(emptyPlayer(), playDaily('2026-11-19', 'skip'), '2026-11-19').unlocked.map((a) => a.id);
    expect(skipped).toEqual(['first-connection']);
  });
  it('streaks and stats', () => {
    let data = emptyPlayer();
    for (let d = 0; d < 7; d++) data = recordSession(data, playDaily(addDays('2026-11-13', d)), addDays('2026-11-13', d)).data;
    expect(streaks(data, '2026-11-19')).toEqual({ current: 7, best: 7 });
    expect(streaks(data, '2026-11-21').current).toBe(0);
    expect(data.achievements['seven-day-journey']).toBeDefined();
    const st = computeStats(data, '2026-11-19');
    expect(st.journeys).toBe(7);
    expect(st.perfectMatches).toBe(49);
    expect(st.history).toHaveLength(49);
  });
  it('survives corrupt storage', () => expect(loadPlayer(memoryStore({ [STORAGE_KEY]: '{oops' })).sessions).toEqual([]));
  it('share text is only the date, the score and one symbol per question', () => {
    const { summary } = recordSession(emptyPlayer(), playDaily('2026-11-19'), '2026-11-19');
    expect(shareText(summary)).toBe('SIMMLY | NOVEMBER 19\n\n🏆 700 / 700\n🌟🌟🌟🌟🌟🌟🌟');
    const tiers = ['perfect', 'nearly', 'family', 'close', 'distant', 'unranked', 'none'] as const;
    const mixed = { ...summary, total: 100 + 90 + 80 + 65 + 45 + 30, rounds: summary.rounds.map((r, i) => ({ ...r, tier: tiers[i] })) };
    const t = shareText(mixed);
    expect(t).toBe('SIMMLY | NOVEMBER 19\n\n⛵ 410 / 700\n🌟🟨🟩🟦🟪⬜⬛');
    expect(t).not.toMatch(/https?:|www\.|#/);
    for (const r of summary.rounds) { expect(t).not.toContain(r.entityName!); expect(t).not.toContain(QUESTION_BY_ID.get(r.questionId)!.prompt); }
  });
  it('share titles name the quest', () => {
    const { summary } = recordSession(emptyPlayer(), playDaily('2026-11-19'), '2026-11-19');
    expect(shareTitle(summary)).toBe('SIMMLY — DAILY QUEST #5');
    expect(shareTitle({ ...summary, mode: 'archive' })).toBe('SIMMLY — QUEST #5 · ARCHIVES');
  });
  it('moves progress saved under the old name to the new key', () => {
    const { data } = recordSession(emptyPlayer(), playDaily('2026-11-19'), '2026-11-19');
    const store = memoryStore({ [LEGACY_STORAGE_KEYS[0]]: JSON.stringify(data) });
    expect(loadPlayer(store).dailies['2026-11-19'].total).toBe(700);
    expect(store.get(STORAGE_KEY)).not.toBeNull();
    expect(store.get(LEGACY_STORAGE_KEYS[0])).toBeNull();
    // the new key wins over any leftover legacy copy
    store.set(LEGACY_STORAGE_KEYS[0], JSON.stringify(emptyPlayer()));
    expect(loadPlayer(store).dailies['2026-11-19'].total).toBe(700);
  });
  it('drops runs from removed modes but keeps resumable quests', () => {
    const daily = createSession(cfg({ dateKey: '2026-11-19' }), 0);
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ ...emptyPlayer(), inProgress: { 'daily:2026-11-19': daily, 'archive:2026-11-16': daily, endless: daily, practice: daily, 'expedition:wild:0': daily } }) });
    expect(Object.keys(loadPlayer(store).inProgress).sort()).toEqual(['archive:2026-11-16', 'daily:2026-11-19']);
  });
});
