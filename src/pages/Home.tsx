import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { play } from '../audio/sfx';
import { Modal, Wordmark } from '../components/ui';
import { LANDMARKS } from '../components/WorldMap/geometry';
import { WorldMap } from '../components/WorldMap/WorldMap';
import { QUESTIONS } from '../data/atlas';
import { totalScore } from '../game/engine/session';
import { computeStats, encodeChallenge } from '../game/progression';
import { DESTINATIONS, destinationIndex } from '../game/scoring';
import { dailyQuestionIds, dayNumber } from '../game/selection';
import { hms, useUntilMidnight } from '../hooks/useCountdown';
import { navigate } from '../hooks/useHashRoute';
import { usePlayer } from '../state/PlayerContext';
import { HowToPlay } from './HowToPlay';

const MODES: { title: string; sub: string; to: string; mark: string }[] = [
  { title: 'Daily Journey', sub: 'Seven shared questions, once a day', to: '/play/daily', mark: 'I' },
  { title: 'Endless Journey', sub: 'Keep travelling as long as you like', to: '/play/endless', mark: '∞' },
  { title: 'Practice', sub: 'No clock — pick a category', to: '/practice', mark: '✎' },
  { title: 'Expeditions', sub: 'Themed sets of seven', to: '/expeditions', mark: '⚑' },
  { title: 'Archive', sub: 'Every past daily journey', to: '/archive', mark: '❦' },
  { title: 'Field Journal', sub: 'Statistics, history, achievements', to: '/stats', mark: '✦' },
];

export function Home() {
  const { data, today, reducedMotion, settings, updateSettings } = usePlayer();
  const stats = computeStats(data, today);
  const done = data.dailies[today];
  const inProgress = data.inProgress[`daily:${today}`];
  const progressNow = done ? done.total : inProgress ? totalScore(inProgress) : 0;
  const roundsDone = inProgress ? inProgress.rounds.filter((r) => r.status).length : 0;
  const untilMidnight = useUntilMidnight();
  const [howOpen, setHowOpen] = useState(!settings.seenIntro);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [landmark, setLandmark] = useState<number | null>(null);
  const number = dayNumber(today) + 1;
  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const [wide] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 640px)').matches);
  const begin = () => { play('click'); navigate(done ? `/results/${done.sessionId}` : '/play/daily'); };

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cream/70">
          <span title="Daily streak"><span className="font-display text-lg text-gold">{stats.streak.current}</span> day streak</span>
          <span className="hidden sm:inline" title="Best journey">Best <span className="readout text-cream">{stats.personalBest || '—'}</span></span>
          {stats.previousScore != null && <span className="hidden md:inline">Last <span className="readout text-cream">{stats.previousScore}</span></span>}
        </div>
        <nav className="flex items-center gap-1" aria-label="Secondary">
          <button className="btn-text" onClick={() => setHowOpen(true)}>How to play</button>
          <button className="btn-text" onClick={() => navigate('/settings')}>Settings</button>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-3 pb-16 sm:px-6">
        {/* ------------------------------------------------ the atlas */}
        <section className="relative mt-3">
          <motion.div initial={reducedMotion ? false : { opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="relative overflow-hidden rounded-[22px] border border-cream/15 shadow-lift">
            <WorldMap score={progressNow} showLabels={wide} interactive onLandmark={(i) => setLandmark(i)} selected={landmark} reducedMotion={reducedMotion} className="block aspect-[16/10] max-h-[74vh] w-full" ariaLabel="The Atlas of Connections — select a destination to read about it" />

            {/* title cartouche */}
            <motion.div initial={reducedMotion ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.7 }} className="paper paper-edge absolute left-3 top-3 hidden px-6 py-4 sm:block lg:left-6 lg:top-6 lg:px-8 lg:py-6">
              <h1 className="text-ink"><Wordmark size="xl" /></h1>
              <p className="mt-1 font-display text-lg italic text-ink-soft lg:text-xl">Everything has something in common.</p>
            </motion.div>

            {/* today's journey, pinned to the map */}
            <motion.div initial={reducedMotion ? false : { opacity: 0, y: 16, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: -0.6 }} transition={{ delay: 0.4, duration: 0.7 }} className="paper paper-edge absolute bottom-4 right-4 hidden w-[340px] p-6 lg:block">
              <TodayCard number={number} dateLabel={dateLabel} done={!!done} total={progressNow} roundsDone={roundsDone} inProgress={!!inProgress} untilMidnight={untilMidnight} onBegin={begin} />
            </motion.div>

            <AnimatePresence>
              {landmark != null && (
                <motion.div key={landmark} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="paper absolute left-1/2 top-4 w-[min(360px,90%)] -translate-x-1/2 px-5 py-4 text-center sm:top-auto sm:bottom-4 lg:left-auto lg:right-[380px] lg:translate-x-0">
                  <div className="eyebrow text-[10px] text-gold-deep">Destination {LANDMARKS[landmark].numeral} · {landmark * 100}+ points</div>
                  <div className="font-display text-xl font-semibold text-ink">{DESTINATIONS[landmark].name}</div>
                  <p className="mt-1 text-sm italic text-ink-soft">{DESTINATIONS[landmark].blurb}</p>
                  <p className="mt-2 text-xs text-ink-soft">{stats.personalBest >= landmark * 100 ? 'You have reached this place on a journey.' : 'You have not reached this place yet.'}</p>
                  <button onClick={() => setLandmark(null)} className="mt-2 text-xs font-semibold text-ink underline">Close</button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* small screens: title + journey card below the map */}
          <div className="mt-5 text-center sm:hidden">
            <h1><Wordmark size="xl" /></h1>
            <p className="mt-1 font-display text-lg italic text-cream/70">Everything has something in common.</p>
          </div>
          <div className="paper paper-edge mx-auto mt-5 max-w-md p-6 lg:hidden">
            <TodayCard number={number} dateLabel={dateLabel} done={!!done} total={progressNow} roundsDone={roundsDone} inProgress={!!inProgress} untilMidnight={untilMidnight} onBegin={begin} />
          </div>
        </section>

        {/* ------------------------------------------------ legend of modes */}
        <section className="mt-12" aria-label="Ways to play">
          <div className="flex items-center gap-4">
            <h2 className="font-display text-2xl font-semibold">Ways to travel</h2>
            <div className="rule-ornament flex-1" />
          </div>
          <ul className="mt-5 grid gap-x-10 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {MODES.map((m) => (
              <li key={m.title}>
                <button onClick={() => { play('click'); navigate(m.to); }} className="group flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-cream/[0.04]">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold/40 font-display text-lg text-gold transition group-hover:bg-gold group-hover:text-ink">{m.mark}</span>
                  <span className="min-w-0">
                    <span className="block font-display text-xl font-semibold">{m.title}</span>
                    <span className="block text-sm text-cream/60">{m.sub}</span>
                  </span>
                  <span className="ml-auto text-cream/30 transition group-hover:translate-x-1 group-hover:text-gold">→</span>
                </button>
              </li>
            ))}
            <li>
              <button onClick={() => setChallengeOpen(true)} className="group flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-cream/[0.04]">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold/40 font-display text-lg text-gold transition group-hover:bg-gold group-hover:text-ink">⚔</span>
                <span><span className="block font-display text-xl font-semibold">Challenge a Friend</span><span className="block text-sm text-cream/60">Send the same seven questions</span></span>
                <span className="ml-auto text-cream/30 transition group-hover:translate-x-1 group-hover:text-gold">→</span>
              </button>
            </li>
          </ul>
        </section>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-cream/10 pt-5 text-sm text-cream/50">
          <span>{QUESTIONS.length} questions · curated similarity boards · no AI judging your answers</span>
          <button onClick={() => navigate('/settings')} className="hover:text-gold">About the boards</button>
        </footer>
      </main>

      <Modal open={howOpen} onClose={() => { setHowOpen(false); if (!settings.seenIntro) updateSettings({ seenIntro: true }); }} title="How to play" wide>
        <HowToPlay onStart={() => { setHowOpen(false); updateSettings({ seenIntro: true }); }} />
      </Modal>
      <ChallengeModal open={challengeOpen} onClose={() => setChallengeOpen(false)} />
    </div>
  );
}

function TodayCard({ number, dateLabel, done, total, roundsDone, inProgress, untilMidnight, onBegin }: { number: number; dateLabel: string; done: boolean; total: number; roundsDone: number; inProgress: boolean; untilMidnight: number; onBegin: () => void }) {
  return (
    <div className="text-ink">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow text-gold-deep">Today’s Journey</span>
        <span className="font-display text-sm italic text-ink-soft">No. {number}</span>
      </div>
      <div className="mt-1 font-display text-lg italic text-ink-soft">{dateLabel}</div>
      <div className="rule-ink my-3" />
      <dl className="grid grid-cols-3 text-center">
        {[['7', 'questions'], ['20s', 'each'], ['700', 'max points']].map(([v, l]) => (
          <div key={l}><dt className="sr-only">{l}</dt><dd><span className="block font-display text-3xl font-semibold leading-none">{v}</span><span className="eyebrow mt-1 block text-[9px] text-ink-soft">{l}</span></dd></div>
        ))}
      </dl>
      {(inProgress || done) && (
        <p className="mt-4 rounded-xl bg-ink/[0.06] px-3 py-2 text-center text-sm">
          {done ? <>Completed — <span className="readout font-semibold">{total}</span> points, reached <em>{DESTINATIONS[destinationIndex(total)].name}</em></> : <>In progress — round {roundsDone + 1} of 7, <span className="readout font-semibold">{total}</span> points so far</>}
        </p>
      )}
      <button onClick={onBegin} className="btn-ink mt-4 w-full py-3.5 text-base">
        {done ? 'View today’s journey' : inProgress ? 'Continue exploring' : 'Start exploring'} →
      </button>
      <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
        <span>{done ? 'Next journey in' : 'New journey in'}</span>
        <span className="readout">{hms(untilMidnight)}</span>
      </div>
    </div>
  );
}

export function ChallengeModal({ open, onClose, seedIds, score }: { open: boolean; onClose: () => void; seedIds?: string[]; score?: number }) {
  const { today, data, settings, updateSettings } = usePlayer();
  const [copied, setCopied] = useState(false);
  const [salt] = useState(() => Math.random().toString(36).slice(2, 8));
  const todays = data.dailies[today];
  const ids = seedIds ?? (todays ? dailyQuestionIds(today) : dailyQuestionIds(today, `challenge-${salt}`));
  const s = score ?? todays?.total;
  const url = `${location.origin}${location.pathname}#/c/${encodeChallenge({ q: ids, s, n: settings.playerName || undefined })}`;
  return (
    <Modal open={open} onClose={() => { onClose(); setCopied(false); }} title="Challenge a friend">
      <div className="space-y-4 text-ink">
        <p className="text-sm text-ink-soft">Your friend travels the same seven questions under the same rules, then sees your score beside theirs. Nothing is spoiled by the link.</p>
        <label className="block text-sm font-semibold">Sign it
          <input value={settings.playerName} onChange={(e) => updateSettings({ playerName: e.target.value.slice(0, 24) })} placeholder="Anonymous explorer" className="mt-1 w-full rounded-xl border border-ink/25 bg-cream/70 px-3 py-2.5 outline-none focus:border-gold-deep" />
        </label>
        <div className="break-all rounded-xl bg-ink/5 p-3 font-mono text-xs text-ink-soft">{url}</div>
        <div className="flex gap-2">
          <button className="btn-ink flex-1" onClick={async () => {
            if (navigator.share) { try { await navigator.share({ title: 'KINSHIP challenge', text: 'Can you find the same connections?', url }); return; } catch { /* fall back */ } }
            try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* ignore */ }
          }}>{copied ? 'Link copied' : 'Share the link'}</button>
          <a className="btn border border-ink/25 text-ink" href={url}>Open</a>
        </div>
      </div>
    </Modal>
  );
}
