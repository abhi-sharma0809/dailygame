import { ATLAS } from '../../data/atlas';
import { compact, lookupExact, normalize, resolve } from '../answerResolution/resolver';
import { pointsFor } from '../scoring';
import type { AnswerResult, Entity, QuestionDef, RankedEntity, Resolution, RuntimeQuestion, Universe } from '../types';
import { TIER_ORDER, TIER_POINTS } from '../types';

/* ------------------------------------------------------------ building */

const cache = new Map<string, RuntimeQuestion>();

export function buildQuestion(def: QuestionDef, universes: Record<string, Universe> = ATLAS.universes): RuntimeQuestion {
  const hit = cache.get(def.id);
  if (hit && hit.def === def) return hit;
  const universe = universes[def.universe];
  if (!universe) throw new Error(`${def.id}: unknown universe ${def.universe}`);
  const reference = lookupExact(universe, def.ref)[0];
  if (!reference) throw new Error(`${def.id}: reference "${def.ref}" is not in the ${def.universe} universe`);
  const ranked: RankedEntity[] = [];
  const seen = new Set<string>();
  for (const entry of def.board) {
    const e = lookupExact(universe, entry.name)[0];
    if (!e || seen.has(e.id)) continue;
    seen.add(e.id);
    ranked.push({ entity: e, entry, points: TIER_POINTS[entry.tier] });
  }
  ranked.sort((a, b) => b.points - a.points);
  const rq: RuntimeQuestion = { def, universe, reference, ranked, rankedById: new Map(ranked.map((r) => [r.entity.id, r])) };
  cache.set(def.id, rq);
  return rq;
}

export function clearQuestionCache() {
  cache.clear();
}

/* ------------------------------------------------------------ eligibility */

/** Why an entity cannot be submitted for this question, or null if it can. */
export function rejectionReason(q: RuntimeQuestion, e: Entity): string | null {
  const noun = q.universe.noun;
  if (e.universe !== q.universe.id) return `That's not ${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}.`;
  if (e.id === q.reference.id) return `That's ${q.def.ref} itself — find something else that's like it.`;
  const ex = q.def.exclude.map((x) => compact(normalize(x)));
  if (ex.includes(compact(normalize(e.name))) || e.aliases.some((a) => ex.includes(compact(normalize(a))))) {
    return `${e.name} is a kind of ${q.def.ref.toLowerCase()} — name something different that's like it.`;
  }
  if (q.def.accept.length && !q.rankedById.has(e.id) && !e.tags.some((t) => q.def.accept.includes(t))) {
    return `${e.name} isn't a ${q.def.accept.join(' or ')} — this question asks for ${q.def.accept.map((t) => `a ${t}`).join(' or ')}.`;
  }
  return null;
}

/* ------------------------------------------------------------ evaluation */

export function evaluate(q: RuntimeQuestion, entityId: string): AnswerResult {
  const e = q.universe.entities.find((x) => x.id === entityId);
  if (!e) throw new Error(`${entityId} is not in ${q.universe.id}`);
  const why = rejectionReason(q, e);
  if (why) throw new Error(`${entityId} is not a valid answer to ${q.def.id}: ${why}`);
  const r = q.rankedById.get(entityId);
  if (!r) {
    return { questionId: q.def.id, entityId, entityName: e.name, points: pointsFor('unranked'), tier: 'unranked', why: `A valid ${q.universe.noun}, but not on this board yet — report it if you think it belongs.`, rank: null };
  }
  const rank = 1 + TIER_ORDER.filter((t) => TIER_POINTS[t] > r.points && q.ranked.some((x) => x.entry.tier === t)).length;
  return { questionId: q.def.id, entityId, entityName: e.name, points: r.points, tier: r.entry.tier, why: r.entry.why, rank };
}

/* ------------------------------------------------------------ resolution */

export type AnswerResolution =
  | { kind: 'accept'; entity: Entity; ranked: boolean }
  | { kind: 'confirm'; entity: Entity }
  | { kind: 'choose'; options: Entity[] }
  | { kind: 'reject'; message: string; entity?: Entity }
  | { kind: 'empty' };

const ALL = () => Object.values(ATLAS.universes);

export function resolveAnswer(q: RuntimeQuestion, input: string, others: Universe[] = ALL()): AnswerResolution {
  const r: Resolution = resolve(input, q.universe, others);
  switch (r.kind) {
    case 'empty':
      return r;
    case 'hint':
    case 'unknown':
      return { kind: 'reject', message: r.message };
    case 'ambiguous':
      return { kind: 'choose', options: r.options };
    case 'match':
    case 'confirm': {
      const why = rejectionReason(q, r.entity);
      if (why) return { kind: 'reject', message: why, entity: r.entity };
      return r.kind === 'match' ? { kind: 'accept', entity: r.entity, ranked: q.rankedById.has(r.entity.id) } : { kind: 'confirm', entity: r.entity };
    }
  }
}

export function checkPick(q: RuntimeQuestion, e: Entity): AnswerResolution {
  const why = rejectionReason(q, e);
  return why ? { kind: 'reject', message: why, entity: e } : { kind: 'accept', entity: e, ranked: q.rankedById.has(e.id) };
}

/** Board grouped by tier, best first — for reveal and results. */
export function boardByTier(q: RuntimeQuestion) {
  return TIER_ORDER.map((t) => ({ tier: t, entries: q.ranked.filter((r) => r.entry.tier === t) })).filter((g) => g.entries.length);
}
