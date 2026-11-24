import { describe, expect, it } from 'vitest';
import { ATLAS, QUESTION_BY_ID, QUESTIONS } from '../src/data/atlas';
import { normalize, resolve, editDistance } from '../src/game/answerResolution/resolver';
import { parseBoardFile, serializeBoardFile } from '../src/game/atlas/format';
import { validateAtlas } from '../src/game/atlas/validate';
import { boardByTier, buildQuestion, checkPick, evaluate, resolveAnswer } from '../src/game/engine/questions';
import { destinationIndex, journeyProgress, pointsFor } from '../src/game/scoring';
import { TIER_POINTS } from '../src/game/types';

const Q = (id: string) => buildQuestion(QUESTION_BY_ID.get(id)!);
const lock = (id: string, text: string) => {
  const q = Q(id);
  const r = resolveAnswer(q, text);
  if (r.kind !== 'accept') throw new Error(`${text} → ${r.kind}${'message' in r ? `: ${r.message}` : ''}`);
  return evaluate(q, r.entity.id);
};

describe('scoring tiers', () => {
  it('has the fixed tier values', () => {
    expect(TIER_POINTS).toEqual({ perfect: 100, nearly: 90, family: 80, close: 65, distant: 45, loose: 30 });
    expect(pointsFor('unranked')).toBe(30);
    expect(pointsFor('none')).toBe(0);
  });
  it.each([
    ['animal_panda', 'Red panda', 'perfect', 100],
    ['animal_panda', 'spectacled bear', 'nearly', 90],
    ['animal_panda', 'polar bear', 'family', 80],
    ['animal_panda', 'koala', 'close', 65],
    ['animal_panda', 'raccoon', 'distant', 45],
    ['animal_panda', 'zebra', 'loose', 30],
    ['animal_panda', 'giraffe', 'unranked', 30],
  ])('%s: %s → %s', (qid, text, tier, pts) => {
    const r = lock(qid, text);
    expect(r.tier).toBe(tier);
    expect(r.points).toBe(pts);
  });
  it('ranks within the board', () => {
    expect(lock('tv_friends', 'How I Met Your Mother').rank).toBe(1);
    expect(lock('tv_friends', 'Seinfeld').rank).toBe(2);
    expect(lock('tv_friends', 'Lost').rank).toBeNull();
  });
});

describe('answer resolution', () => {
  it('normalizes case, punctuation and accents', () => {
    expect(normalize('  Spider-Man! ')).toBe('spider man');
    expect(normalize('Pokémon')).toBe('pokemon');
  });
  it.each([
    ['tv_friends', 'HIMYM', 'How I Met Your Mother'],
    ['tv_friends', 'seinfeld', 'Seinfeld'],
    ['char_batman', 'spiderman', 'Spider-Man'],
    ['char_batman', 'Spider Man', 'Spider-Man'],
    ['movie_harry_potter', 'LOTR', 'The Lord of the Rings: The Fellowship of the Ring'],
    ['tv_sopranos', 'GOT', 'Game of Thrones'],
    ['animal_tiger', 'lions', 'Lion'],
    ['game_minecraft', 'terarria', 'Terraria'],
    ['food_pizza', 'calzones', 'Calzone'],
  ])('%s: "%s" → %s', (qid, text, name) => {
    const r = resolveAnswer(Q(qid), text);
    expect(r.kind === 'accept' || r.kind === 'confirm').toBe(true);
    if (r.kind === 'accept' || r.kind === 'confirm') expect(r.entity.name).toBe(name);
  });
  it('asks before accepting bigger typos', () => {
    expect(resolveAnswer(Q('tv_friends'), 'How I Met Yur Mothr').kind).toBe('confirm');
  });
  it('never turns a real answer from another category into a lookalike', () => {
    expect(resolveAnswer(Q('obj_camera'), 'Iran').kind).toBe('reject');
    expect(resolveAnswer(Q('animal_crocodile'), 'Ramen').kind).toBe('reject');
    expect(resolveAnswer(Q('tv_friends'), 'Soda').kind).toBe('reject');
    expect(resolveAnswer(Q('person_rock'), 'Sydney').kind).toBe('confirm');
  });
  it('never fuzzily corrects numbers', () => {
    expect(resolve('Terminator 3', ATLAS.universes.movie).kind).not.toBe('match');
  });
  it('rejects the reference, excluded kinds and other categories with reasons', () => {
    const panda = resolveAnswer(Q('animal_panda'), 'panda');
    expect(panda.kind).toBe('reject');
    if (panda.kind === 'reject') expect(panda.message).toMatch(/itself/);
    const fox = resolveAnswer(Q('animal_fox'), 'arctic fox');
    expect(fox.kind).toBe('reject');
    const wrong = resolveAnswer(Q('tv_friends'), 'Titanic');
    expect(wrong.kind).toBe('reject');
    if (wrong.kind === 'reject') expect(wrong.message).toMatch(/movie/);
    expect(resolveAnswer(Q('tv_friends'), 'qzqzqz').kind).toBe('reject');
  });
  it('enforces accept tags but keeps ranked answers', () => {
    expect(resolveAnswer(Q('food_coffee'), 'pizza').kind).toBe('reject');
    expect(resolveAnswer(Q('food_coffee'), 'lemonade').kind).toBe('accept');
    expect(resolveAnswer(Q('food_coffee'), 'espresso').kind).toBe('reject');
  });
  it('accepts every valid universe member somewhere (never rejects a legit unranked answer)', () => {
    for (const def of QUESTIONS) {
      const q = buildQuestion(def);
      for (const e of q.universe.entities.slice(0, 40)) {
        const r = checkPick(q, e);
        if (r.kind === 'reject') expect(r.message).toMatch(/itself|kind of|isn't a/);
      }
    }
  });
  it('disambiguates shared aliases', () => {
    const r = resolve('kansas', ATLAS.universes.city);
    expect(['unknown', 'confirm', 'ambiguous', 'hint']).toContain(r.kind);
  });
  it('edit distance counts transpositions once', () => expect(editDistance('panda', 'pnada')).toBe(1));
});

describe('atlas', () => {
  it('validates cleanly', () => {
    const errors = validateAtlas(ATLAS).filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });
  it('has 100+ questions across ten categories', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(QUESTIONS.map((q) => q.category)).size).toBe(10);
  });
  it('board format round-trips through the editor serializer', () => {
    for (const b of Object.values(ATLAS.boards)) {
      const again = parseBoardFile(serializeBoardFile(b)).board;
      expect(again.questions.map((q) => [q.id, q.board.length, q.board.map((e) => e.tier).join()])).toEqual(b.questions.map((q) => [q.id, q.board.length, [...q.board].sort((x, y) => TIER_POINTS[y.tier] - TIER_POINTS[x.tier]).map((e) => e.tier).join()]));
    }
  });
  it('groups boards by tier best-first', () => {
    const groups = boardByTier(Q('tv_friends'));
    expect(groups[0].tier).toBe('perfect');
  });
});

describe('journey map', () => {
  it('maps score to progress and destination', () => {
    expect(journeyProgress(0)).toBe(0);
    expect(journeyProgress(700)).toBe(1);
    expect(destinationIndex(0)).toBe(0);
    expect(destinationIndex(99)).toBe(0);
    expect(destinationIndex(100)).toBe(1);
    expect(destinationIndex(599)).toBe(5);
    expect(destinationIndex(600)).toBe(6);
    expect(destinationIndex(700)).toBe(6);
  });
});
