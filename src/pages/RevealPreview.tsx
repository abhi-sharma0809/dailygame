import { useMemo } from 'react';
import { ConnectionReveal } from '../components/ConnectionReveal';
import { QUESTION_BY_ID } from '../data/atlas';
import { buildQuestion, evaluate } from '../game/engine/questions';
import type { RoundRecord } from '../game/engine/session';
import type { ResultTier } from '../game/types';
import { useRoute } from '../hooks/useRoute';

/** Development-only: stage the connection reveal for any tier (/reveal?tier=perfect&q=animal_panda). */
export function RevealPreview() {
  const route = useRoute();
  const tier = (route.query.get('tier') ?? 'perfect') as ResultTier;
  const qid = route.query.get('q') ?? 'city_new_york';
  const q = useMemo(() => buildQuestion(QUESTION_BY_ID.get(qid)!), [qid]);
  const round = useMemo<RoundRecord>(() => {
    const base = { questionId: qid, startedAt: 0, deadline: null };
    if (tier === 'none') return { ...base, status: 'skipped' };
    const e = tier === 'unranked'
      ? q.universe.entities.find((x) => !q.rankedById.has(x.id) && x.id !== q.reference.id && !q.def.exclude.includes(x.name))!
      : q.ranked.find((x) => x.entry.tier === tier)!.entity;
    return { ...base, status: 'answered', input: e.name, result: evaluate(q, e.id) };
  }, [q, qid, tier]);
  if (!import.meta.env.DEV) return null;
  return (
    <div className="fixed inset-0 flex items-end justify-center bg-[#2b4a5e] p-6">
      <ConnectionReveal key={`${qid}:${tier}`} q={q} round={round} reducedMotion={false} isLast={false} settled={false} onTravel={() => {}} onNext={() => {}} onReport={() => {}} />
    </div>
  );
}
