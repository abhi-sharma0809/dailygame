import { CATEGORIES, QUESTIONS } from '../../data/atlas';
import type { CategoryId, Difficulty, QuestionDef } from '../types';

/* ------------------------------------------------------------ PRNG */

export function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------ dates */

/** Daily journeys reset at local midnight. */
export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Journey #1. */
export const EPOCH = '2026-11-15';

export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  const [ey, em, ed] = EPOCH.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ey, em - 1, ed)) / 86400000);
}

export function keyFromDayNumber(n: number): string {
  const [ey, em, ed] = EPOCH.split('-').map(Number);
  const t = new Date(Date.UTC(ey, em - 1, ed) + n * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export const addDays = (key: string, n: number) => keyFromDayNumber(dayNumber(key) + n);

/* ------------------------------------------------------------ daily */

const DIFF_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const catIds = () => CATEGORIES.map((c) => c.id);

/** Which 7 of the 10 categories appear on day n: a sliding window, so none repeats within a day. */
export function dailyCategories(n: number): CategoryId[] {
  const cats = catIds();
  const k = Math.min(7, cats.length);
  return Array.from({ length: k }, (_, i) => cats[(((n * k + i) % cats.length) + cats.length) % cats.length]);
}

const seqCache = new Map<string, QuestionDef[]>();

/** A category's question order for one cycle; later cycles reshuffle only within small chunks, so repeats stay far apart. */
function categorySequence(cat: CategoryId, cycle: number, salt: string): QuestionDef[] {
  const key = `${salt}|${cat}|${cycle}`;
  const hit = seqCache.get(key);
  if (hit) return hit;
  let out: QuestionDef[];
  if (cycle === 0) {
    const rand = mulberry32(hashString(`${salt}:${cat}`));
    const buckets = DIFFS.map((d) => shuffle(QUESTIONS.filter((q) => q.category === cat && q.difficulty === d).sort((a, b) => a.id.localeCompare(b.id)), rand));
    const order = shuffle([0, 1, 2], rand);
    out = [];
    while (buckets.some((b) => b.length)) for (const i of order) if (buckets[i].length) out.push(buckets[i].shift()!);
  } else {
    const prev = categorySequence(cat, cycle - 1, salt);
    const rand = mulberry32(hashString(`${salt}:${cat}:${cycle}`));
    out = [];
    const chunk = Math.max(2, Math.floor(prev.length / 4));
    for (let i = 0; i < prev.length; i += chunk) out.push(...shuffle(prev.slice(i, i + chunk), rand));
  }
  seqCache.set(key, out);
  return out;
}

const usesMemo = new Map<string, number>();
/** How many times category `cat` was used on days before n. */
function usesBefore(cat: CategoryId, n: number): number {
  const key = `${cat}|${n}`;
  const hit = usesMemo.get(key);
  if (hit != null) return hit;
  let count = 0;
  for (let d = 0; d < n; d++) if (dailyCategories(d).includes(cat)) count++;
  usesMemo.set(key, count);
  return count;
}

function pick(cat: CategoryId, k: number, salt: string): QuestionDef {
  const len = QUESTIONS.filter((q) => q.category === cat).length;
  return categorySequence(cat, Math.floor(k / len), salt)[k % len];
}

/**
 * Seed for the daily draw. Frozen on purpose: it predates the SIMMLY name, and
 * changing it would reshuffle every past and present daily quest (and orphan
 * any quest in progress).
 */
export const DAILY_SEED = 'kinship-daily-v1';

/** The same seven questions for everyone on a date, easiest first. */
export function dailyQuestionIds(key: string, salt = DAILY_SEED): string[] {
  const n = Math.max(0, dayNumber(key));
  return dailyCategories(n)
    .map((cat, i) => ({ q: pick(cat, usesBefore(cat, n), salt), i }))
    .sort((a, b) => DIFF_RANK[a.q.difficulty] - DIFF_RANK[b.q.difficulty] || a.i - b.i)
    .map(({ q }) => q.id);
}
