import { useEffect, useMemo } from 'react';
import { Toasts } from './components/ui';
import { BANK_VERSION } from './data/atlas';
import type { SessionConfig } from './game/engine/session';
import { SECONDS_PER_ROUND } from './game/scoring';
import { EPOCH, dailyQuestionIds, dayNumber } from './game/selection';
import { navigate, useHashRoute } from './hooks/useHashRoute';
import { ArchivePage } from './pages/Archive';
import { EditorPage } from './pages/Editor';
import { Home } from './pages/Home';
import { JourneyPreview } from './pages/JourneyPreview';
import { Play, type PlaySpec } from './pages/Play';
import { Results } from './pages/Results';
import { RevealPreview } from './pages/RevealPreview';
import { usePlayer } from './state/PlayerContext';

/*
 * Routes. SIMMLY has two destinations — today's Daily Quest and the Archives —
 * plus the results of a finished quest:
 *   /                      home (today's quest)
 *   /play/daily            today's quest (once; afterwards → its results)
 *   /play/archive/:date    a past quest
 *   /results/:id           a finished quest
 *   /archive               the Archives
 * Anything else (including links to modes that no longer exist) goes home.
 */

const quest = (mode: SessionConfig['mode'], dateKey: string, label: string): SessionConfig => ({
  mode, dateKey, label, questionIds: dailyQuestionIds(dateKey), seconds: SECONDS_PER_ROUND, bankVersion: BANK_VERSION,
});

type Resolved = { page: 'play'; spec: PlaySpec } | { page: 'results'; id: string } | { page: 'archive' | 'home' | 'editor' | 'journey' | 'reveal' } | { page: 'redirect'; to: string };

export default function App() {
  const route = useHashRoute();
  const { data, today } = usePlayer();
  const [a, b, c] = route.path;

  const resolved = useMemo<Resolved>(() => {
    if (!a) return { page: 'home' };
    if (a === 'play' && b === 'daily') {
      const done = data.dailies[today];
      if (done) return { page: 'redirect', to: `/results/${done.sessionId}` };
      return { page: 'play', spec: { slot: `daily:${today}`, makeConfig: () => quest('daily', today, `Daily Quest No. ${dayNumber(today) + 1}`) } };
    }
    if (a === 'play' && b === 'archive' && c && /^\d{4}-\d{2}-\d{2}$/.test(c) && c < today && c >= EPOCH) {
      return { page: 'play', spec: { slot: `archive:${c}`, makeConfig: () => quest('archive', c, `Archives · Quest No. ${dayNumber(c) + 1}`) } };
    }
    if (a === 'play' && b === 'archive' && c === today) return { page: 'redirect', to: '/play/daily' };
    if (a === 'results' && b) return { page: 'results', id: b };
    if (a === 'archive' || a === 'archives') return { page: 'archive' };
    if (a === 'editor') return { page: 'editor' };
    if (a === 'journey' && import.meta.env.DEV) return { page: 'journey' };
    if (a === 'reveal' && import.meta.env.DEV) return { page: 'reveal' };
    return { page: 'redirect', to: '/' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b, c, today, data.dailies[today]?.sessionId]);

  useEffect(() => { if (resolved.page === 'redirect') navigate(resolved.to, true); }, [resolved]);

  let page = null;
  switch (resolved.page) {
    case 'play': page = <Play key={resolved.spec.slot} spec={resolved.spec} />; break;
    case 'results': page = <Results id={resolved.id} />; break;
    case 'archive': page = <ArchivePage />; break;
    case 'editor': page = <EditorPage />; break;
    case 'journey': page = <JourneyPreview />; break;
    case 'reveal': page = <RevealPreview />; break;
    case 'home': page = <Home />; break;
  }

  return (
    <div className="atmosphere min-h-dvh">
      <button onClick={() => document.getElementById('main')?.focus()} className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded focus:bg-night focus:px-3 focus:py-2">Skip to content</button>
      <div id="main" tabIndex={-1} className="relative z-[2] outline-none">{page}</div>
      <Toasts />
    </div>
  );
}
