import type { BoardEntry, CategoryId, Difficulty, Entity, QuestionDef, TierId, Universe, UniverseId } from '../types';
import { TIER_POINTS, tierForPoints } from '../types';

/* ============================================================
 * Plain-text content formats (parsed at runtime, written by the
 * dev editor). Kept human-readable so editors can review diffs.
 *
 * UNIVERSE  (src/data/atlas/universes/<id>.txt)
 *   @universe animal | noun=animal | plural=animals
 *   Red panda ; lesser panda ; firefox  #mammal
 *
 * BOARD     (src/data/atlas/boards/<category>.txt)
 *   @category animals | label=Animals & Nature
 *   ## animal_panda | easy | universe=animal | ref=Giant panda | v=1
 *   prompt: Name an animal most like a panda.
 *   hint: Think appearance, family tree and lifestyle.
 *   dims: physical resemblance, family tree, diet
 *   why: Editorial rationale for the board as a whole.
 *   notes: Source / review notes.
 *   100 Red panda ; lesser panda * :: why this answer sits in this tier
 *   (`*` marks an "obvious" first-thought answer)
 * ============================================================ */

export const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function headerFields(line: string): { head: string[]; kv: Record<string, string> } {
  const parts = line.split('|').map((p) => p.trim());
  const head: string[] = [];
  const kv: Record<string, string> = {};
  for (const p of parts) {
    const m = p.match(/^([a-z]+)=(.*)$/i);
    if (m) kv[m[1].toLowerCase()] = m[2].trim();
    else head.push(p);
  }
  return { head, kv };
}

export interface ParseIssue { file: string; line: number; message: string }

export function parseUniverse(text: string, file = 'universe'): { universe: Universe; issues: ParseIssue[] } {
  const issues: ParseIssue[] = [];
  let id = '' as UniverseId;
  let noun = '';
  let plural = '';
  const entities: Entity[] = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    if (line.startsWith('@universe')) {
      const { head, kv } = headerFields(line.replace('@universe', ''));
      id = head[0] as UniverseId;
      noun = kv.noun ?? id;
      plural = kv.plural ?? `${noun}s`;
      return;
    }
    const tags = [...line.matchAll(/(?:^|\s)#([a-z0-9-]+)/gi)].map((m) => m[1].toLowerCase());
    const body = line.replace(/(?:^|\s)#[a-z0-9-]+/gi, '').trim();
    const [name, ...aliases] = body.split(';').map((s) => s.trim()).filter(Boolean);
    if (!name) { issues.push({ file, line: i + 1, message: 'empty entry' }); return; }
    entities.push({ id: `${id}:${slug(name)}`, name, aliases, tags, universe: id });
  });
  if (!id) issues.push({ file, line: 1, message: 'missing @universe header' });
  return { universe: { id, noun, nounPlural: plural, entities }, issues };
}

export interface BoardFile {
  category: CategoryId;
  label: string;
  questions: QuestionDef[];
}

export function parseBoardFile(text: string, file = 'board'): { board: BoardFile; issues: ParseIssue[] } {
  const issues: ParseIssue[] = [];
  const out: BoardFile = { category: '' as CategoryId, label: '', questions: [] };
  let q: QuestionDef | null = null;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const n = i + 1;
    if (!line || line.startsWith('//')) return;
    if (line.startsWith('@category')) {
      const { head, kv } = headerFields(line.replace('@category', ''));
      out.category = head[0] as CategoryId;
      out.label = kv.label ?? head[0];
      return;
    }
    if (line.startsWith('##')) {
      const { head, kv } = headerFields(line.replace(/^##/, ''));
      q = {
        id: head[0],
        difficulty: (head[1] ?? 'medium') as Difficulty,
        version: Number(kv.v ?? 1),
        category: out.category,
        universe: kv.universe as UniverseId,
        ref: kv.ref ?? '',
        accept: (kv.accept ?? '').split(/[\s,]+/).map((t) => t.replace(/^#/, '').toLowerCase()).filter(Boolean),
        prompt: '', hint: '', dims: [], rationale: '', notes: '', exclude: [], board: [],
      };
      out.questions.push(q);
      return;
    }
    if (!q) { issues.push({ file, line: n, message: 'content before first ## question' }); return; }
    const field = line.match(/^(prompt|hint|dims|why|notes|exclude):\s*(.*)$/);
    if (field) {
      const [, k, v] = field;
      if (k === 'prompt') q.prompt = v;
      else if (k === 'hint') q.hint = v;
      else if (k === 'dims') q.dims = v.split(',').map((s) => s.trim()).filter(Boolean);
      else if (k === 'why') q.rationale = v;
      else if (k === 'exclude') q.exclude = v.split(',').map((s) => s.trim()).filter(Boolean);
      else q.notes = v;
      return;
    }
    const entry = line.match(/^(\d+)\s+(.+?)\s*(\*)?\s*::\s*(.*)$/);
    if (entry) {
      const tier = tierForPoints(Number(entry[1]));
      if (!tier) { issues.push({ file, line: n, message: `"${entry[1]}" is not a tier score (${Object.values(TIER_POINTS).join('/')})` }); return; }
      const [name, ...aliases] = entry[2].split(';').map((s) => s.trim()).filter(Boolean);
      q.board.push({ name, aliases, tier, obvious: !!entry[3], why: entry[4].trim() });
      return;
    }
    issues.push({ file, line: n, message: `unrecognized line: ${line.slice(0, 60)}` });
  });
  return { board: out, issues };
}

/** Inverse of parseBoardFile — used by the dev editor to write changes back. */
export function serializeBoardFile(b: BoardFile): string {
  const lines = [`@category ${b.category} | label=${b.label}`, ''];
  for (const q of b.questions) {
    const head = [q.id, q.difficulty, `universe=${q.universe}`, `ref=${q.ref}`, `v=${q.version}`];
    if (q.accept.length) head.push(`accept=${q.accept.map((t) => `#${t}`).join(' ')}`);
    lines.push(`## ${head.join(' | ')}`);
    lines.push(`prompt: ${q.prompt}`);
    if (q.hint) lines.push(`hint: ${q.hint}`);
    if (q.dims.length) lines.push(`dims: ${q.dims.join(', ')}`);
    if (q.rationale) lines.push(`why: ${q.rationale}`);
    if (q.exclude.length) lines.push(`exclude: ${q.exclude.join(', ')}`);
    if (q.notes) lines.push(`notes: ${q.notes}`);
    for (const e of sortEntries(q.board)) {
      const names = [e.name, ...e.aliases].join(' ; ');
      lines.push(`${TIER_POINTS[e.tier]} ${names}${e.obvious ? ' *' : ''} :: ${e.why}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function sortEntries(entries: BoardEntry[]): BoardEntry[] {
  return [...entries].sort((a, b) => TIER_POINTS[b.tier] - TIER_POINTS[a.tier]);
}

export const tierPoints = (t: TierId) => TIER_POINTS[t];
