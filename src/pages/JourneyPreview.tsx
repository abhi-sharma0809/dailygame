import { useState } from 'react';
import { JourneyWorld, type ExplorerMood } from '../components/Journey/JourneyWorld';
import { useHashRoute } from '../hooks/useHashRoute';

/** Development-only: fly the journey world to any score (#/journey?s=350). */
export function JourneyPreview() {
  const route = useHashRoute();
  const [score, setScore] = useState(() => Number(route.query.get('s') ?? 0));
  const [mood, setMood] = useState<ExplorerMood>('idle');
  const [k, setK] = useState(0);
  if (!import.meta.env.DEV) return null;
  const go = (d: number) => { setScore((s) => Math.max(0, Math.min(700, s + d))); setMood(d >= 100 ? 'celebrate' : d >= 65 ? 'cheer' : d > 0 ? 'travel' : 'miss'); setK((x) => x + 1); };
  return (
    <div className="fixed inset-0">
      <JourneyWorld score={score} reducedMotion={false} mood={mood} reactKey={k} />
      <div className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-2 rounded-xl bg-night/80 p-2 text-sm">
        <span className="readout px-2 py-1 text-gold" data-score>{score}</span>
        {[0, 30, 65, 100].map((d) => <button key={d} onClick={() => go(d)} className="rounded bg-cream/10 px-3 py-1">+{d}</button>)}
        <button onClick={() => { setScore(0); setK((x) => x + 1); }} className="rounded bg-cream/10 px-3 py-1">reset</button>
      </div>
    </div>
  );
}
