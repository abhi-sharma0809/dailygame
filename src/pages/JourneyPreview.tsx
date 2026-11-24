import { useRef, useState } from 'react';
import { JourneyWorld, type ExplorerMood, type TravelStyle } from '../components/Journey/JourneyWorld';
import { DEFAULT_STYLE, styleForTier } from '../components/Journey/motion';
import { TIER_LABEL, type ResultTier } from '../game/types';
import { useRoute } from '../hooks/useRoute';

const TIERS: [ResultTier, number][] = [['perfect', 100], ['nearly', 90], ['family', 80], ['close', 65], ['distant', 45], ['loose', 30], ['none', 0]];
const moodFor = (t: ResultTier): ExplorerMood => (t === 'perfect' ? 'celebrate' : t === 'nearly' || t === 'family' ? 'cheer' : t === 'none' ? 'miss' : 'travel');

/** Development-only: fly the journey world to any score in any tier's style (/journey?s=350). */
export function JourneyPreview() {
  const route = useRoute();
  const [score, setScore] = useState(() => Number(route.query.get('s') ?? 0));
  const [mood, setMood] = useState<ExplorerMood>('idle');
  const [travel, setTravel] = useState<TravelStyle>(DEFAULT_STYLE);
  const [k, setK] = useState(0);
  const [phase, setPhase] = useState('idle');
  const kRef = useRef(0);
  if (!import.meta.env.DEV) return null;
  const go = (t: ResultTier, d: number) => {
    setScore((s) => Math.max(0, Math.min(700, s + d)));
    setTravel(styleForTier(t));
    setMood(moodFor(t));
    setPhase('travelling');
    kRef.current += 1;
    setK(kRef.current);
  };
  return (
    <div className="fixed inset-0">
      <JourneyWorld score={score} reducedMotion={false} mood={mood} reactKey={k} travel={travel} onSettle={() => setPhase('settled')} />
      <div className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-wrap justify-center gap-2 rounded-xl bg-night/80 p-2 text-sm">
        <span className="readout px-2 py-1 text-gold" data-score>{score}</span>
        <span className="px-1 py-1 text-cream/60" data-phase>{phase}</span>
        {TIERS.map(([t, d]) => <button key={t} onClick={() => go(t, d)} className="rounded bg-cream/10 px-3 py-1" title={TIER_LABEL[t]} data-tier={t}>+{d}</button>)}
      </div>
    </div>
  );
}
