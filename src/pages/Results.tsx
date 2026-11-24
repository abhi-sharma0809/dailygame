import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { renderShareCard } from '../components/shareCard';
import { CountUp, PageShell } from '../components/ui';
import { WorldMap } from '../components/WorldMap/WorldMap';
import { CATEGORY_BY_ID, QUESTION_BY_ID } from '../data/atlas';
import { boardByTier, buildQuestion } from '../game/engine/questions';
import { destinationFor, shareText } from '../game/progression';
import { TIER_COLORS } from '../game/scoring';
import { TIER_LABEL, TIER_POINTS } from '../game/types';
import { hms, useUntilMidnight } from '../hooks/useCountdown';
import { navigate } from '../hooks/useHashRoute';
import { usePlayer } from '../state/PlayerContext';
import { ChallengeModal } from './Home';

export function Results({ id }: { id: string }) {
  const { data, reducedMotion } = usePlayer();
  const s = data.sessions.find((x) => x.id === id);
  const [copied, setCopied] = useState(false);
  const [challenge, setChallenge] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [mapScore, setMapScore] = useState(reducedMotion && s ? s.total : 0);
  const untilMidnight = useUntilMidnight();

  const info = useMemo(() => {
    if (!s) return null;
    const sorted = [...s.rounds].sort((a, b) => b.points - a.points);
    const cats = new Map<string, number[]>();
    for (const r of s.rounds) cats.set(r.category, [...(cats.get(r.category) ?? []), r.points]);
    return { best: sorted[0], worst: sorted[sorted.length - 1], perfect: s.rounds.filter((r) => r.tier === 'perfect').length, nearly: s.rounds.filter((r) => r.tier === 'nearly').length, cats: [...cats.entries()] };
  }, [s]);

  if (!s || !info) {
    return <PageShell title="Journey"><div className="py-24 text-center"><p className="text-cream/70">That journey isn’t recorded on this device.</p><button onClick={() => navigate('/')} className="btn-gold mt-6">Back to the atlas</button></div></PageShell>;
  }

  const journeyScore = s.rounds.length === 7 ? s.total : (s.total / Math.max(1, s.rounds.length)) * 7;
  const dest = destinationFor(s.total, s.rounds.length);
  const url = `${location.origin}${location.pathname}`;
  const isOpen = s.mode === 'endless' || s.mode === 'practice';

  const share = async () => {
    const text = shareText(s, url);
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) { try { await navigator.share({ text }); return; } catch { /* fall back */ } }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* ignore */ }
  };
  const card = async () => {
    const blob = await renderShareCard(s, document.getElementById('results-map') as SVGSVGElement | null);
    if (!blob) return;
    const file = new File([blob], 'kinship-journey.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: 'Can you find the same connections?' }); return; } catch { /* fall back */ } }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kinship-journey.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <PageShell title="Journey complete" wide>
      {/* ------------------------------------------------ final map */}
      <section className="relative mt-5 overflow-hidden rounded-[22px] border border-cream/15 shadow-lift">
        <WorldMap id="results-map" score={mapScore} travelSeconds={3.2} mood={mapScore >= 600 ? 'celebrate' : 'cheer'} burstKey={mapScore > 0 ? 1 : 0} reducedMotion={reducedMotion} className="block aspect-[16/10] max-h-[64vh] w-full" ariaLabel={`Final map: the explorer reached ${dest.name}`} />
        <motion.div initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="paper paper-edge absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] px-5 py-4 sm:bottom-6 sm:left-6 sm:px-7 sm:py-5">
          <div className="eyebrow text-gold-deep">{s.label}</div>
          <h1 className="font-display text-[clamp(2rem,5vw,3.6rem)] font-semibold leading-none text-ink">Journey complete<span className="text-gold-deep">.</span></h1>
          <div className="mt-3 eyebrow text-[10px] text-ink-soft">Your connection score</div>
          <div className="flex items-baseline gap-2 text-ink">
            <CountUp to={s.total} duration={2} delay={0.4} instant={reducedMotion} onDone={() => setMapScore(journeyScore)} className="font-display text-[clamp(3rem,8vw,5rem)] font-semibold leading-none" />
            <span className="font-display text-2xl text-ink-soft">/ {s.maxTotal}</span>
          </div>
          <AnimatePresence>
            {mapScore > 0 || reducedMotion ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 font-display text-lg italic text-ink-soft">You reached <span className="font-semibold text-ink">{dest.name}</span> — {dest.blurb.toLowerCase()}</motion.p>
            ) : null}
          </AnimatePresence>
          {s.challenge?.fromScore != null && (
            <p className="mt-2 text-sm font-semibold text-ink">
              {s.challenge.fromName || 'Your friend'}: {s.challenge.fromScore} · {s.total > s.challenge.fromScore ? 'You found more connections!' : s.total === s.challenge.fromScore ? 'A perfect tie.' : 'They found more this time.'}
            </p>
          )}
        </motion.div>
      </section>

      {/* ------------------------------------------------ actions */}
      <section className="mt-6 flex flex-wrap items-center gap-2">
        <button onClick={share} className="btn-gold">{copied ? 'Copied to clipboard' : 'Share score'}</button>
        <button onClick={card} className="btn-ghost">Save journey card</button>
        {!isOpen && <button onClick={() => setChallenge(true)} className="btn-ghost">Challenge a friend</button>}
        <button onClick={() => navigate('/play/endless')} className="btn-ghost">Another journey</button>
        <button onClick={() => navigate('/')} className="btn-text">Back to the atlas</button>
        {s.mode === 'daily' && <span className="ml-auto text-sm text-cream/55">Next daily journey in <span className="readout text-cream">{hms(untilMidnight)}</span></span>}
      </section>

      {/* ------------------------------------------------ summary */}
      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Perfect matches', String(info.perfect)],
          ['Nearly identical', String(info.nearly)],
          ['Best answer', info.best ? `${info.best.points}` : '—', info.best?.entityName],
          ['Lowest answer', info.worst ? `${info.worst.points}` : '—', info.worst?.entityName ?? (info.worst?.status === 'timeout' ? 'Out of time' : 'Passed')],
        ].map(([l, v, sub]) => (
          <div key={l} className="slate px-4 py-3">
            <div className="eyebrow text-[10px] text-cream/55">{l}</div>
            <div className="mt-1 font-display text-3xl font-semibold">{v}</div>
            {sub && <div className="truncate font-display text-sm italic text-cream/60">{sub}</div>}
          </div>
        ))}
      </section>

      {/* ------------------------------------------------ the seven answers */}
      <section className="mt-10">
        <div className="flex items-center gap-4"><h2 className="font-display text-3xl font-semibold">Your connections</h2><div className="rule-ornament flex-1" /></div>
        <ol className="mt-4 space-y-2">
          {s.rounds.map((r, i) => {
            const def = QUESTION_BY_ID.get(r.questionId);
            const color = TIER_COLORS[r.tier];
            const expanded = open === i;
            return (
              <motion.li key={i} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }} className="slate overflow-hidden">
                <button onClick={() => setOpen(expanded ? null : i)} aria-expanded={expanded} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left sm:px-5">
                  <span className="grid h-9 w-9 place-items-center rounded-full font-display text-sm font-bold text-ink" style={{ background: color }}>{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i] ?? i + 1}</span>
                  <span className="min-w-0">
                    <span className="eyebrow block text-[10px] text-cream/50">{CATEGORY_BY_ID[r.category]?.label}</span>
                    <span className="block truncate">{def?.prompt}</span>
                    <span className="block truncate font-display italic text-cream/75">{r.status === 'answered' ? `→ ${r.entityName}` : r.status === 'timeout' ? '→ out of time' : '→ passed'} <span className="not-italic text-cream/45">· {TIER_LABEL[r.tier]}</span></span>
                  </span>
                  <span className="readout text-xl" style={{ color }}>{r.points}</span>
                </button>
                <AnimatePresence>
                  {expanded && def && <BoardPanel questionId={r.questionId} mine={r.entityName} />}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ol>
      </section>

      {/* ------------------------------------------------ categories */}
      <section className="mt-10">
        <div className="flex items-center gap-4"><h2 className="font-display text-2xl font-semibold">By category</h2><div className="rule-ornament flex-1" /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {info.cats.map(([c, pts]) => (
            <div key={c} className="slate px-4 py-3">
              <div className="eyebrow text-[10px] text-cream/55">{CATEGORY_BY_ID[c]?.label}</div>
              <div className="mt-1 flex items-baseline justify-between"><span className="font-display text-2xl font-semibold">{Math.round(pts.reduce((a, b) => a + b, 0) / pts.length)}</span><span className="text-xs text-cream/50">{pts.length} round{pts.length > 1 ? 's' : ''}</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream/10"><div className="h-full rounded-full bg-gold" style={{ width: `${pts.reduce((a, b) => a + b, 0) / pts.length}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      <ChallengeModal open={challenge} onClose={() => setChallenge(false)} seedIds={s.rounds.map((r) => r.questionId)} score={s.total} />
    </PageShell>
  );
}

function BoardPanel({ questionId, mine }: { questionId: string; mine?: string }) {
  const q = buildQuestion(QUESTION_BY_ID.get(questionId)!);
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-cream/10">
      <div className="paper m-3 p-4 text-ink sm:m-4">
        {boardByTier(q).map((g) => (
          <div key={g.tier} className="mb-2">
            <span className="eyebrow text-[10px] text-ink-soft">{TIER_LABEL[g.tier]} · {TIER_POINTS[g.tier]}</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {g.entries.map((e) => <span key={e.entity.id} title={e.entry.why} className={`rounded-full px-2.5 py-0.5 text-sm ${e.entity.name === mine ? 'bg-ink text-parchment ring-2 ring-gold' : 'bg-ink/[0.06]'}`}>{e.entity.name}</span>)}
            </div>
          </div>
        ))}
        <p className="mt-2 text-xs text-ink-soft">{q.def.rationale}</p>
      </div>
    </motion.div>
  );
}
