/**
 * Player simulation: npm run simulate
 * Plays full daily journeys through the real resolver → session reducer →
 * scoring, with different strategies, then audits fairness.
 */
import { ATLAS, QUESTION_BY_ID, QUESTIONS } from '../src/data/atlas';
import { lookupExact } from '../src/game/answerResolution/resolver';
import { buildQuestion, checkPick, rejectionReason, resolveAnswer } from '../src/game/engine/questions';
import { createSession, sessionReducer, totalScore } from '../src/game/engine/session';
import { addDays, dailyQuestionIds, hashString, mulberry32 } from '../src/game/selection';
import { TIER_LABEL, type Entity, type ResultTier, type RuntimeQuestion } from '../src/game/types';

type Rand = () => number;
const pick = <T,>(a: T[], r: Rand) => a[Math.floor(r() * a.length)];

function typo(s: string, r: Rand) {
  if (s.length < 6) return s.toLowerCase();
  const i = 1 + Math.floor(r() * (s.length - 3));
  return [() => s.slice(0, i) + s.slice(i + 1), () => s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2)][Math.floor(r() * 2)]().toLowerCase();
}

interface Plan { target?: Entity; text?: string; pre?: string[]; status?: 'skip' | 'timeout' }
type Strategy = { name: string; plan: (q: RuntimeQuestion, r: Rand) => Plan };

const knownBoard = (q: RuntimeQuestion, r: Rand, p: Record<number, number>) => q.ranked.filter((x) => r() < (p[x.points] ?? 0.2));
const validUnranked = (q: RuntimeQuestion) => q.universe.entities.filter((e) => !q.rankedById.has(e.id) && !rejectionReason(q, e));

const STRATEGIES: Strategy[] = [
  { name: 'Expert', plan: (q, r) => { const k = knownBoard(q, r, { 100: 0.45, 90: 0.55, 80: 0.65, 65: 0.75, 45: 0.8, 30: 0.8 }); return { target: (k[0] ?? q.ranked[0]).entity }; } },
  { name: 'Casual player', plan: (q, r) => { const k = knownBoard(q, r, { 100: 0.12, 90: 0.18, 80: 0.25, 65: 0.3, 45: 0.3, 30: 0.3 }); const u = validUnranked(q); return { target: k.length ? pick(k, r).entity : u.length ? pick(u, r) : q.ranked[q.ranked.length - 1].entity }; } },
  { name: 'Obvious answerer', plan: (q, r) => { const o = q.ranked.filter((x) => x.entry.obvious); return { target: (o.length ? pick(o, r) : q.ranked[Math.min(2, q.ranked.length - 1)]).entity }; } },
  { name: 'Reasonable alternative', plan: (q, r) => { const m = q.ranked.filter((x) => x.points >= 65 && x.points <= 90); return { target: (m.length ? pick(m, r) : pick(q.ranked, r)).entity }; } },
  { name: 'Obscure answerer', plan: (q, r) => { const u = validUnranked(q); const low = q.ranked.filter((x) => x.points <= 45); return { target: r() < 0.6 && u.length ? pick(u, r) : (low.length ? pick(low, r) : pick(q.ranked, r)).entity }; } },
  { name: 'Misreads the reference', plan: (q, r) => {
    const others = Object.values(ATLAS.universes).filter((u) => u.id !== q.universe.id);
    let wrong = pick(pick(others, r).entities, r);
    for (let k = 0; k < 20 && lookupExact(q.universe, wrong.name).length; k++) wrong = pick(pick(others, r).entities, r); // names valid in both (e.g. Aladdin) aren't mistakes
    return r() < 0.5 ? { pre: [wrong.name], target: pick(q.ranked, r).entity } : { pre: [wrong.name, q.def.ref], status: 'timeout' };
  } },
  { name: 'Alias typer', plan: (q, r) => { const withAlias = q.ranked.filter((x) => x.entity.aliases.length); const t = withAlias.length ? pick(withAlias, r) : pick(q.ranked, r); return { target: t.entity, text: t.entity.aliases.length ? pick(t.entity.aliases, r) : t.entity.name }; } },
  { name: 'Bad speller', plan: (q, r) => { const t = pick(q.ranked.slice(0, 8), r).entity; return { target: t, text: typo(t.name, r) }; } },
  { name: 'Invalid then corrects', plan: (q, r) => ({ pre: ['asdfgh', 'the thing', q.def.ref], target: pick(q.ranked, r).entity }) },
  { name: 'Slow / times out', plan: (q, r) => (r() < 0.5 ? { status: 'timeout' } : r() < 0.3 ? { status: 'skip' } : { target: pick(q.ranked, r).entity }) },
];

interface Round { qid: string; tier: ResultTier; points: number; intended?: string; got?: string; resolverMiss: boolean }
const results: { strategy: string; total: number; rounds: Round[] }[] = [];
let wrongEntity = 0;
let typed = 0;
let preRejected = 0;
let preAccepted = 0;

function attempt(q: RuntimeQuestion, text: string, target?: Entity): Entity | null {
  const res = resolveAnswer(q, text);
  if (res.kind === 'accept') return res.entity;
  if (res.kind === 'confirm') return !target || res.entity.id === target.id ? res.entity : null;
  if (res.kind === 'choose') { const m = res.options.find((o) => o.id === target?.id); if (m) { const c = checkPick(q, m); return c.kind === 'accept' ? c.entity : null; } }
  return null;
}

const JOURNEYS_PER_STRATEGY = 15;
for (const st of STRATEGIES) {
  for (let i = 0; i < JOURNEYS_PER_STRATEGY; i++) {
    const day = addDays('2026-11-15', i * 2 + STRATEGIES.indexOf(st));
    const ids = dailyQuestionIds(day);
    const r = mulberry32(hashString(`${st.name}:${i}`));
    let s = createSession({ mode: 'daily', questionIds: ids, seconds: 20, dateKey: day, label: 'sim' }, 0, `sim${i}`);
    const rounds: Round[] = [];
    let now = 0;
    for (const qid of ids) {
      const q = buildQuestion(QUESTION_BY_ID.get(qid)!);
      const plan = st.plan(q, r);
      for (const bad of plan.pre ?? []) { const got = resolveAnswer(q, bad); if (got.kind === "accept") { preAccepted++; console.log(`  · "${bad}" accepted for ${q.def.id} as ${got.entity.name}`); } else preRejected++; }
      let entity: Entity | null = null;
      if (plan.target && !plan.status) {
        typed++;
        entity = attempt(q, plan.text ?? plan.target.name, plan.target) ?? attempt(q, plan.target.name, plan.target);
      }
      if (entity) s = sessionReducer(s, { type: 'LOCK', entityId: entity.id, input: plan.text ?? '', now: now + 5000 });
      else if (plan.status === 'skip') s = sessionReducer(s, { type: 'SKIP', now: now + 3000 });
      else s = sessionReducer(s, { type: 'TIMEOUT', now: now + 20000 });
      const res = s.rounds[s.index].result;
      const miss = !!entity && !!plan.target && entity.id !== plan.target.id;
      if (miss) wrongEntity++;
      rounds.push({ qid, tier: res?.tier ?? 'none', points: res?.points ?? 0, intended: plan.target?.name, got: entity?.name, resolverMiss: miss });
      now += 25000;
      s = sessionReducer(s, { type: 'NEXT', now });
    }
    if (s.phase !== 'complete') throw new Error('journey did not complete');
    results.push({ strategy: st.name, total: totalScore(s), rounds });
  }
}

/* ------------------------------------------------------------------ report */
const mean = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0);
const sd = (x: number[]) => { const m = mean(x); return Math.sqrt(mean(x.map((v) => (v - m) ** 2))); };
const pad = (v: string | number, n: number) => String(v).padStart(n);

console.log(`\nSIMMLY player simulation — ${results.length} journeys, ${results.length * 7} rounds\n`);
console.log('STRATEGY                  mean   sd   min   max   perfect  unranked  no answer');
for (const st of STRATEGIES) {
  const rs = results.filter((x) => x.strategy === st.name);
  const all = rs.flatMap((x) => x.rounds);
  const share = (f: (r: Round) => boolean) => `${Math.round((all.filter(f).length / all.length) * 100)}%`;
  const t = rs.map((x) => x.total);
  console.log(`${st.name.padEnd(24)} ${pad(mean(t).toFixed(0), 5)} ${pad(sd(t).toFixed(0), 4)} ${pad(Math.min(...t), 5)} ${pad(Math.max(...t), 5)}   ${pad(share((r) => r.tier === 'perfect'), 6)}  ${pad(share((r) => r.tier === 'unranked'), 7)}  ${pad(share((r) => r.tier === 'none'), 8)}`);
}

const all = results.flatMap((r) => r.rounds);
console.log('\nTier distribution, all strategies:');
for (const t of ['perfect', 'nearly', 'family', 'close', 'distant', 'loose', 'unranked', 'none'] as ResultTier[]) {
  const n = all.filter((r) => r.tier === t).length;
  console.log(`  ${TIER_LABEL[t].padEnd(20)} ${pad(n, 4)}  ${'█'.repeat(Math.round((n / all.length) * 60))}`);
}

/* fairness audits over the whole bank */
let wrongRejects = 0;
let checkedValid = 0;
let obviousPerfect = 0, obviousTotal = 0, obviousPts = 0;
const fameFlags: string[] = [];
for (const def of QUESTIONS) {
  const q = buildQuestion(def);
  for (const e of q.universe.entities) {
    if (rejectionReason(q, e)) continue;
    checkedValid++;
    const r = resolveAnswer(q, e.name);
    const ok = (r.kind === 'accept' && r.entity.id === e.id) || (r.kind === 'choose' && r.options.some((o) => o.id === e.id));
    if (!ok) { wrongRejects++; if (wrongRejects <= 5) console.log(`  ! "${e.name}" (${def.id}) → ${r.kind}${'message' in r ? ': ' + r.message : ''}`); }
  }
  const obvious = q.ranked.filter((x) => x.entry.obvious);
  obviousTotal += obvious.length;
  obviousPerfect += obvious.filter((x) => x.points === 100).length;
  obviousPts += obvious.reduce((a, x) => a + x.points, 0);
  if (obvious.length && obvious.every((x) => x.points === 100) && obvious.length >= 2) fameFlags.push(def.id);
}

console.log('\nFairness');
console.log(`  Valid answers typed exactly as named: ${checkedValid - wrongRejects}/${checkedValid} accepted (or offered in a "which one?" list)`);
console.log(`  Obvious first-thought answers: avg ${(obviousPts / Math.max(1, obviousTotal)).toFixed(1)} pts; ${obviousPerfect}/${obviousTotal} are Perfect Matches`);
console.log(`  Typed answers resolving to an unintended entity: ${wrongEntity}/${typed}`);
console.log(`  Wrong-category / reference / gibberish attempts rejected: ${preRejected}/${preRejected + preAccepted}`);
const expert = mean(results.filter((r) => r.strategy === 'Expert').map((r) => r.total));
const obviousMean = mean(results.filter((r) => r.strategy === 'Obvious answerer').map((r) => r.total));
console.log(`  Expert (${expert.toFixed(0)}) vs obvious-answer player (${obviousMean.toFixed(0)}): knowledge beats fame by ${(expert - obviousMean).toFixed(0)} points per journey`);
if (fameFlags.length) console.log(`  ⚠ boards where every obvious answer is perfect: ${fameFlags.join(', ')}`);
console.log('');
if (wrongRejects || preAccepted) process.exit(1);
