import type { Entity, Resolution, Universe } from '../types';

/* ============================================================
 * Entity resolution
 *
 * Deterministic, layered matching — never "closest string wins":
 *   1. exact name            → match
 *   2. exact alias / alt key → match
 *   3. singular/plural form  → match
 *   4. whole-token partial   → match / confirm / ambiguous
 *   5. bounded edit distance → match (1 typo) / confirm (2+) / ambiguous (ties)
 *   6. other universes       → "that's a movie, not a TV show"
 * ============================================================ */

const TOKEN_SYNONYMS: Record<string, string> = { st: 'saint', ste: 'sainte', mt: 'mount', mtn: 'mountain', ft: 'fort', pt: 'point', jr: 'jr', usa: 'usa' };
const ARTICLES = new Set(['the', 'a', 'an']);

/** Normalize free text into space-separated canonical tokens. */
export function normalize(input: string): string {
  let t = input.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  t = t.replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/ł/g, 'l');
  t = t.replace(/(\d),(?=\d{3}\b)/g, '$1'); // 10,000 → 10000
  t = t.replace(/[’'`´ʻ]/g, '');
  t = t.replace(/&/g, ' and ');
  t = t.replace(/\.(?!\d)/g, ' '); // drop dots except decimals
  t = t.replace(/[^a-z0-9.]+/g, ' ');
  t = t.replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2');
  const tokens = t.split(' ').filter(Boolean).map((w) => TOKEN_SYNONYMS[w] ?? w);
  while (tokens.length > 1 && ARTICLES.has(tokens[0]) && (tokens[0] === 'the' || /^[a-z]/.test(tokens[1]))) tokens.shift();
  return tokens.join(' ');
}

export const compact = (normalized: string) => normalized.replace(/ /g, '');

/** Simple singularization of the final token (pandas → panda, foxes → fox). */
function singularVariants(normalized: string): string[] {
  const parts = normalized.split(' ');
  const last = parts[parts.length - 1];
  const out: string[] = [];
  const set = (w: string) => out.push([...parts.slice(0, -1), w].join(' '));
  if (last.length > 4 && last.endsWith('ies')) set(last.slice(0, -3) + 'y');
  if (last.length > 4 && /(ses|xes|zes|ches|shes|oes)$/.test(last)) set(last.slice(0, -2));
  if (last.length > 3 && last.endsWith('s') && !last.endsWith('ss')) set(last.slice(0, -1));
  if (!last.endsWith('s')) set(last + 's');
  return out;
}

/** Optimal-string-alignment distance with an early-exit bound. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length, m = b.length;
  let prev2: number[] = new Array(m + 1).fill(0);
  let prev: number[] = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[m];
}

/** Typo budget by query length — short strings get no slack at all. */
export function typoBudget(len: number): number {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  if (len <= 11) return 2;
  return 3;
}

/* ------------------------------------------------------------- indexing */

interface Key {
  compact: string;
  tokens: string[];
  entity: Entity;
}

interface Index {
  names: Map<string, Entity[]>;
  aliases: Map<string, Entity[]>;
  keys: Key[];
}

const cache = new WeakMap<Universe, Index>();

function push(map: Map<string, Entity[]>, k: string, e: Entity) {
  if (!k) return;
  const arr = map.get(k);
  if (!arr) map.set(k, [e]);
  else if (!arr.includes(e)) arr.push(e);
}

function getIndex(u: Universe): Index {
  let idx = cache.get(u);
  if (idx) return idx;
  idx = { names: new Map(), aliases: new Map(), keys: [] };
  for (const e of u.entities) {
    const n = normalize(e.name);
    push(idx.names, compact(n), e);
    idx.keys.push({ compact: compact(n), tokens: n.split(' '), entity: e });
    for (const a of e.aliases) {
      const an = normalize(a);
      if (!an) continue;
      push(idx.aliases, compact(an), e);
      idx.keys.push({ compact: compact(an), tokens: an.split(' '), entity: e });
    }
  }
  cache.set(u, idx);
  return idx;
}

/** Exact (name or alias) lookup only — used when building boards. */
export function lookupExact(u: Universe, text: string): Entity[] {
  const idx = getIndex(u);
  const c = compact(normalize(text));
  return [...new Map([...(idx.names.get(c) ?? []), ...(idx.aliases.get(c) ?? [])].map((e) => [e.id, e])).values()];
}

export function invalidateIndex(u: Universe) {
  cache.delete(u);
}

/* ------------------------------------------------------------- resolve */

const uniq = (arr: Entity[]) => [...new Map(arr.map((e) => [e.id, e])).values()];

export function resolve(input: string, universe: Universe, others: Universe[] = []): Resolution {
  const raw = input.trim();
  const norm = normalize(raw);
  if (!norm) return { kind: 'empty' };
  const q = compact(norm);
  const idx = getIndex(universe);

  // 1–3: exact names, then aliases, including singular/plural forms
  for (const variant of [norm, ...singularVariants(norm)]) {
    const c = compact(variant);
    const byName = idx.names.get(c);
    if (byName?.length === 1) return { kind: 'match', entity: byName[0], via: 'exact' };
    const all = uniq([...(byName ?? []), ...(idx.aliases.get(c) ?? [])]);
    if (all.length === 1) return { kind: 'match', entity: all[0], via: 'alias' };
    if (all.length > 1) return { kind: 'ambiguous', options: all.slice(0, 8) };
  }

  // If the text is exactly something from another category ("Iran", "Ramen"),
  // never auto-correct it into a lookalike here — at most ask.
  const elsewhere = others.filter((o) => o.id !== universe.id).map((o) => ({ o, hit: lookupExact(o, raw)[0] })).find((x) => x.hit);

  // 4: whole-token partial ("grizzly" → brown bear, "kong" → King Kong)
  const qTokens = norm.split(' ');
  if (q.length >= 3) {
    const hits = new Map<string, { e: Entity; cover: number }>();
    for (const k of idx.keys) {
      if (k.tokens.length <= qTokens.length) continue;
      if (!qTokens.every((t) => k.tokens.includes(t))) continue;
      const cover = q.length / k.compact.length;
      const prev = hits.get(k.entity.id);
      if (!prev || cover > prev.cover) hits.set(k.entity.id, { e: k.entity, cover });
    }
    if (hits.size === 1) {
      const [{ e, cover }] = hits.values();
      return cover >= 0.4 && q.length >= 4 && !elsewhere ? { kind: 'match', entity: e, via: 'partial' } : { kind: 'confirm', entity: e };
    }
    if (hits.size > 1 && hits.size <= 8) return { kind: 'ambiguous', options: [...hits.values()].sort((a, b) => b.cover - a.cover).map((h) => h.e) };
    if (hits.size > 8) return { kind: 'hint', message: `“${raw}” matches lots of ${universe.nounPlural}. Be more specific.` };
  }

  // 5: bounded edit distance
  const budget = elsewhere ? 0 : typoBudget(q.length);
  const qDigits = q.replace(/\D/g, '');
  if (budget > 0) {
    const best = new Map<string, { e: Entity; d: number }>();
    for (const k of idx.keys) {
      if (Math.abs(k.compact.length - q.length) > budget) continue;
      const d = editDistance(q, k.compact, budget);
      if (d > budget) continue;
      if (d >= 2 && k.compact[0] !== q[0]) continue; // larger edits must keep the first letter
      if (k.compact.replace(/\D/g, '') !== qDigits) continue; // never "correct" numbers (GTA 4 ≠ GTA 5)
      const prev = best.get(k.entity.id);
      if (!prev || d < prev.d) best.set(k.entity.id, { e: k.entity, d });
    }
    if (best.size) {
      const sorted = [...best.values()].sort((a, b) => a.d - b.d);
      const top = sorted[0];
      const rivals = sorted.filter((s) => s.d <= top.d + (top.d >= 1 ? 1 : 0));
      if (rivals.length > 1) return { kind: 'ambiguous', options: rivals.slice(0, 6).map((r) => r.e) };
      if (top.d <= 1) return { kind: 'match', entity: top.e, via: 'fuzzy' };
      return { kind: 'confirm', entity: top.e };
    }
  }

  // 6: is it a different kind of thing?
  if (elsewhere) {
    return { kind: 'unknown', message: `“${elsewhere.hit.name}” is ${article(elsewhere.o.noun)} ${elsewhere.o.noun} — this question needs ${article(universe.noun)} ${universe.noun}.` };
  }

  return { kind: 'unknown', message: `“${raw}” isn't in the Atlas of ${universe.nounPlural} yet. Check the spelling, try another — or report it.` };
}

const article = (noun: string) => (/^[aeiou]/i.test(noun) && !/^(us|uni|one)/i.test(noun) ? 'an' : 'a');
