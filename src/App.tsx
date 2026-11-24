import { useMemo } from 'react';
import { Toasts } from './components/ui';
import { BANK_VERSION, QUESTION_BY_ID } from './data/atlas';
import type { SessionConfig } from './game/engine/session';
import { decodeChallenge } from './game/progression';
import { SECONDS_PER_ROUND } from './game/scoring';
import { EPOCH, EXPEDITIONS, dailyQuestionIds, dayNumber, expeditionSessionCount, expeditionSessionIds, hashString, mulberry32, nextOpenQuestion } from './game/selection';
import type { CategoryId } from './game/types';
import { navigate, useHashRoute } from './hooks/useHashRoute';
import { EditorPage } from './pages/Editor';
import { JourneyPreview } from './pages/JourneyPreview';
import { Home } from './pages/Home';
import { Play, type PlaySpec } from './pages/Play';
import { Results } from './pages/Results';
import { ArchivePage, ChallengeLanding, ExpeditionsPage, PracticePage, SettingsPage, StatsPage } from './pages/Secondary';
import { usePlayer } from './state/PlayerContext';

export default function App() {
  const route = useHashRoute();
  const { data, today } = usePlayer();
  const [a, b, c, d] = route.path;

  const spec = useMemo<PlaySpec | 'home' | null>(() => {
    if (a !== 'play') return null;
    const fixed = (mode: SessionConfig['mode'], questionIds: string[], label: string, extra: Partial<SessionConfig> = {}): SessionConfig => ({ mode, questionIds, seconds: SECONDS_PER_ROUND, fixedLength: true, label, bankVersion: BANK_VERSION, ...extra });
    switch (b) {
      case 'daily':
        if (data.dailies[today]) return 'home';
        return { slot: `daily:${today}`, makeConfig: () => fixed('daily', dailyQuestionIds(today), `Daily Journey No. ${dayNumber(today) + 1}`, { dateKey: today }) };
      case 'archive':
        if (!c || !/^\d{4}-\d{2}-\d{2}$/.test(c) || c >= today || c < EPOCH) return 'home';
        return { slot: `archive:${c}`, makeConfig: () => fixed('archive', dailyQuestionIds(c), `Archive Journey No. ${dayNumber(c) + 1}`, { dateKey: c }) };
      case 'expedition': {
        const ex = EXPEDITIONS.find((e) => e.id === c);
        const n = Number(d ?? 0);
        if (!ex || !(n >= 0 && n < expeditionSessionCount(ex.id))) return 'home';
        return { slot: `expedition:${ex.id}:${n}`, makeConfig: () => fixed('expedition', expeditionSessionIds(ex.id, n), `${ex.title} · route ${n + 1}`, { expeditionId: ex.id, expeditionSession: n }) };
      }
      case 'challenge': {
        const p = c ? decodeChallenge(c) : null;
        if (!p) return 'home';
        return { slot: `challenge:${hashString(c!).toString(36)}`, makeConfig: () => fixed('challenge', p.q, p.n ? `Challenge from ${p.n}` : 'Friend’s challenge', { challenge: { fromName: p.n, fromScore: p.s } }) };
      }
      case 'endless':
        return {
          slot: 'endless',
          makeConfig: () => ({ mode: 'endless', seconds: SECONDS_PER_ROUND, fixedLength: false, label: 'Endless Journey', token: 'endless', bankVersion: BANK_VERSION, questionIds: [nextOpenQuestion({ rand: Math.random, recent: data.recentQuestions })!] }),
          open: { category: 'all' },
        };
      case 'practice': {
        const cat = (route.query.get('cat') ?? 'all') as CategoryId | 'all';
        const t = route.query.get('t') ?? 'p';
        const first = nextOpenQuestion({ rand: mulberry32(hashString(t)), recent: data.recentQuestions, category: cat });
        if (!first || !QUESTION_BY_ID.has(first)) return 'home';
        return { slot: 'practice', makeConfig: () => ({ mode: 'practice', seconds: null, fixedLength: false, label: 'Practice', token: t, bankVersion: BANK_VERSION, questionIds: [first] }), open: { category: cat } };
      }
    }
    return 'home';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b, c, d, today, route.query.toString()]);

  let page;
  if (spec === 'home') { queueMicrotask(() => navigate(b === 'daily' && data.dailies[today] ? `/results/${data.dailies[today].sessionId}` : '/', true)); page = null; }
  else if (spec) page = <Play key={spec.slot + (route.query.get('t') ?? '')} spec={spec} />;
  else if (a === 'results' && b) page = <Results id={b} />;
  else if (a === 'stats') page = <StatsPage />;
  else if (a === 'archive') page = <ArchivePage />;
  else if (a === 'practice') page = <PracticePage />;
  else if (a === 'expeditions') page = <ExpeditionsPage />;
  else if (a === 'settings') page = <SettingsPage />;
  else if (a === 'editor') page = <EditorPage />;
  else if (a === 'journey' && import.meta.env.DEV) page = <JourneyPreview />;
  else if (a === 'c' && b) page = <ChallengeLanding token={b} />;
  else page = <Home />;

  return (
    <div className="atmosphere min-h-dvh">
      <button onClick={() => document.getElementById('main')?.focus()} className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded focus:bg-night focus:px-3 focus:py-2">Skip to content</button>
      <div id="main" tabIndex={-1} className="relative z-[2] outline-none">{page}</div>
      <Toasts />
    </div>
  );
}
