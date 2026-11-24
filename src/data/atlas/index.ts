import { buildAtlas } from '../../game/atlas/build';

/* Raw text content, bundled at build time and parsed on load. The dev editor
 * writes these same files, and Vite hot-reloads them. */
const universeTexts = import.meta.glob('./universes/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const boardTexts = import.meta.glob('./boards/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const ATLAS = buildAtlas(universeTexts, boardTexts);
export const QUESTIONS = ATLAS.questions;
export const QUESTION_BY_ID = ATLAS.byId;
export const CATEGORIES = ATLAS.categories;
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<string, { id: string; label: string }>;

/** Stable fingerprint of the question bank (ids + versions). */
export const BANK_VERSION = (() => {
  let h = 2166136261;
  for (const q of [...QUESTIONS].sort((a, b) => a.id.localeCompare(b.id))) for (const ch of `${q.id}@${q.version};`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
})();
