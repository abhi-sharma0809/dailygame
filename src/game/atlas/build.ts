import { compact, normalize } from '../answerResolution/resolver';
import type { CategoryId, Entity, QuestionDef, Universe, UniverseId } from '../types';
import { parseBoardFile, parseUniverse, slug, type BoardFile, type ParseIssue } from './format';

export interface Atlas {
  universes: Record<UniverseId, Universe>;
  questions: QuestionDef[];
  byId: Map<string, QuestionDef>;
  categories: { id: CategoryId; label: string }[];
  boards: Record<string, BoardFile>;
  /** board entries that were not in their universe file and were added from the board */
  boardOnly: { questionId: string; name: string }[];
  issues: ParseIssue[];
}

const CATEGORY_ORDER: CategoryId[] = ['animals', 'tv', 'movies', 'geography', 'food', 'games', 'sports', 'people', 'characters', 'objects'];

/**
 * Build the playable atlas from raw text files. Board entries are merged into
 * their universe: a ranked answer is by definition a valid answer.
 */
export function buildAtlas(universeTexts: Record<string, string>, boardTexts: Record<string, string>): Atlas {
  const issues: ParseIssue[] = [];
  const universes = {} as Record<UniverseId, Universe>;
  for (const [file, text] of Object.entries(universeTexts)) {
    const { universe, issues: iss } = parseUniverse(text, file);
    issues.push(...iss);
    universes[universe.id] = universe;
  }

  const boards: Record<string, BoardFile> = {};
  const questions: QuestionDef[] = [];
  for (const [file, text] of Object.entries(boardTexts)) {
    const { board, issues: iss } = parseBoardFile(text, file);
    issues.push(...iss);
    boards[board.category] = board;
    questions.push(...board.questions);
  }

  // key index per universe for merging
  const keyIndex = new Map<UniverseId, Map<string, Entity>>();
  const indexEntity = (u: UniverseId, e: Entity, text: string) => {
    const k = compact(normalize(text));
    if (!k) return;
    const m = keyIndex.get(u)!;
    if (!m.has(k)) m.set(k, e);
  };
  for (const u of Object.values(universes)) {
    keyIndex.set(u.id, new Map());
    for (const e of u.entities) {
      indexEntity(u.id, e, e.name);
      for (const a of e.aliases) indexEntity(u.id, e, a);
    }
  }

  const boardOnly: Atlas['boardOnly'] = [];
  for (const q of questions) {
    const u = universes[q.universe];
    if (!u) continue;
    for (const entry of q.board) {
      const m = keyIndex.get(u.id)!;
      let e = m.get(compact(normalize(entry.name))) ?? entry.aliases.map((a) => m.get(compact(normalize(a)))).find(Boolean);
      if (!e) {
        e = { id: `${u.id}:${slug(entry.name)}`, name: entry.name, aliases: [], tags: ['board'], universe: u.id };
        u.entities.push(e);
        boardOnly.push({ questionId: q.id, name: entry.name });
        indexEntity(u.id, e, e.name);
      }
      for (const a of entry.aliases) {
        if (!e.aliases.some((x) => compact(normalize(x)) === compact(normalize(a))) && compact(normalize(a)) !== compact(normalize(e.name))) {
          e.aliases.push(a);
          indexEntity(u.id, e, a);
        }
      }
      // board entries refer to the canonical entity from here on
      entry.name = e.name;
    }
  }

  const categories = CATEGORY_ORDER.filter((c) => boards[c]).map((c) => ({ id: c, label: boards[c].label }));
  return { universes, questions, byId: new Map(questions.map((q) => [q.id, q])), categories, boards, boardOnly, issues };
}
