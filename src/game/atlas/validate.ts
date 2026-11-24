import { compact, normalize } from '../answerResolution/resolver';
import { buildQuestion } from '../engine/questions';
import type { CategoryId, QuestionDef, Universe } from '../types';
import { TIER_ORDER } from '../types';
import type { Atlas } from './build';

export type Severity = 'error' | 'warning' | 'info';
export interface Issue { severity: Severity; where: string; message: string }

const CATEGORIES: CategoryId[] = ['animals', 'tv', 'movies', 'geography', 'food', 'games', 'sports', 'people', 'characters', 'objects'];
const MIN_BOARD = 8;

export function validateUniverse(u: Universe): Issue[] {
  const issues: Issue[] = [];
  const where = `universe:${u.id}`;
  const names = new Map<string, string>();
  const keys = new Map<string, string>();
  for (const e of u.entities) {
    if (!e.name.trim()) issues.push({ severity: 'error', where, message: 'entity with an empty canonical name' });
    const n = compact(normalize(e.name));
    if (names.has(n)) issues.push({ severity: 'error', where, message: `duplicate canonical name "${e.name}" (also "${names.get(n)}")` });
    names.set(n, e.name);
  }
  for (const e of u.entities) {
    for (const a of e.aliases) {
      const k = compact(normalize(a));
      if (!k) continue;
      if (names.has(k) && names.get(k) !== e.name) issues.push({ severity: 'error', where, message: `alias "${a}" of "${e.name}" is the name of another entry ("${names.get(k)}")` });
      else if (keys.has(k) && keys.get(k) !== e.name) issues.push({ severity: 'warning', where, message: `alias "${a}" is shared by "${e.name}" and "${keys.get(k)}" — players typing it will be asked which` });
      keys.set(k, e.name);
    }
  }
  return issues;
}

export function validateQuestion(def: QuestionDef, atlas: Atlas): Issue[] {
  const issues: Issue[] = [];
  const where = def.id;
  const err = (m: string) => issues.push({ severity: 'error', where, message: m });
  const warn = (m: string) => issues.push({ severity: 'warning', where, message: m });
  if (!CATEGORIES.includes(def.category)) err(`invalid category "${def.category}"`);
  if (!['easy', 'medium', 'hard'].includes(def.difficulty)) err(`invalid difficulty "${def.difficulty}"`);
  if (!def.prompt) err('missing prompt');
  else if (!/^Name /.test(def.prompt)) warn('prompt should start with "Name …"');
  if (!def.hint) err('missing hint (the tailored interpretation shown to players)');
  if (!def.dims.length) err('missing similarity dimensions');
  if (!def.rationale) err('missing board rationale (why:)');
  if (!(def.version >= 1)) err('version must be ≥ 1');
  const u = atlas.universes[def.universe];
  if (!u) { err(`unknown universe "${def.universe}"`); return issues; }

  let q;
  try { q = buildQuestion(def, atlas.universes); } catch (e) { err(String((e as Error).message)); return issues; }

  if (def.board.length === 0) { err('empty answer board'); return issues; }
  if (def.board.length < MIN_BOARD) warn(`only ${def.board.length} ranked answers (aim for ${MIN_BOARD}+)`);
  if (!def.board.some((b) => b.tier === 'perfect')) err('no Perfect Match on the board');
  const tiersUsed = new Set(def.board.map((b) => b.tier));
  if (tiersUsed.size < 3) warn('board uses fewer than three tiers');
  if (def.board.filter((b) => b.tier === 'perfect').length > 3) warn('more than three Perfect Matches dilutes the top tier');
  if (!def.board.some((b) => b.obvious)) warn('no answer marked as an obvious first thought (*)');

  const seen = new Map<string, string>();
  for (const b of def.board) {
    if (!b.name) err('board entry missing a canonical name');
    if (!b.why) err(`"${b.name}" has no explanation`);
    const e = q.universe.entities.find((x) => compact(normalize(x.name)) === compact(normalize(b.name)));
    if (!e) { err(`"${b.name}" does not resolve to a ${u.noun}`); continue; }
    if (seen.has(e.id)) err(`contradictory mapping: "${b.name}" appears twice (also as "${seen.get(e.id)}")`);
    seen.set(e.id, b.name);
    if (e.id === q.reference.id) err(`the reference "${def.ref}" is on its own board`);
    const ex = def.exclude.map((x) => compact(normalize(x)));
    if (ex.includes(compact(normalize(e.name)))) err(`"${b.name}" is both excluded and ranked`);
  }
  for (const x of def.exclude) if (!u.entities.some((e) => compact(normalize(e.name)) === compact(normalize(x)))) err(`excluded "${x}" is not in the ${u.id} universe`);
  // obvious answers should not all sit at the top: the game rewards connections, not fame
  const obvious = def.board.filter((b) => b.obvious);
  if (obvious.length >= 3 && obvious.every((b) => b.tier === 'perfect')) warn('every obvious answer is a Perfect Match — is the board rewarding fame?');
  // tier order sanity: explanations should exist for every tier used
  for (const t of TIER_ORDER) if (tiersUsed.has(t) && !def.board.some((b) => b.tier === t && b.why)) err(`tier ${t} has no explained entry`);
  return issues;
}

export function validateAtlas(atlas: Atlas): Issue[] {
  const issues: Issue[] = atlas.issues.map((i) => ({ severity: 'error' as const, where: `${i.file}:${i.line}`, message: i.message }));
  for (const u of Object.values(atlas.universes)) issues.push(...validateUniverse(u));
  const ids = new Set<string>();
  const prompts = new Map<string, string>();
  const refs = new Map<string, string>();
  for (const q of atlas.questions) {
    if (ids.has(q.id)) issues.push({ severity: 'error', where: q.id, message: 'duplicate question id' });
    ids.add(q.id);
    const p = q.prompt.toLowerCase();
    if (prompts.has(p)) issues.push({ severity: 'error', where: q.id, message: `duplicate prompt (also ${prompts.get(p)})` });
    prompts.set(p, q.id);
    const r = `${q.universe}|${compact(normalize(q.ref))}|${q.accept.join()}`;
    if (refs.has(r)) issues.push({ severity: 'error', where: q.id, message: `duplicate question: same reference as ${refs.get(r)}` });
    refs.set(r, q.id);
    issues.push(...validateQuestion(q, atlas));
  }
  for (const b of atlas.boardOnly) issues.push({ severity: 'info', where: b.questionId, message: `"${b.name}" was only on the board — added to its universe` });
  return issues;
}
