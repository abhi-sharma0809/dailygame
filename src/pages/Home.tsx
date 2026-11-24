import { motion } from 'framer-motion';
import { useState } from 'react';
import { play } from '../audio/sfx';
import { JourneyWorld } from '../components/Journey/JourneyWorld';
import { PixelIcon } from '../components/PixelIcon';
import { SettingsDialog } from '../components/SettingsDialog';
import { Modal, Wordmark } from '../components/ui';
import { totalScore } from '../game/engine/session';
import { computeStats } from '../game/progression';
import { DESTINATIONS, TIER_COLORS, destinationIndex } from '../game/scoring';
import { dayNumber } from '../game/selection';
import type { ResultTier } from '../game/types';
import { hms, useUntilMidnight } from '../hooks/useCountdown';
import { navigate } from '../hooks/useHashRoute';
import { usePlayer } from '../state/PlayerContext';
import { HowToPlay } from './HowToPlay';

/**
 * The front door: the living world with your airship in it, and one thing
 * to do — today's Daily Quest. The Archives are the only other way in.
 */
export function Home() {
  const { data, today, reducedMotion, settings, updateSettings } = usePlayer();
  const stats = computeStats(data, today);
  const done = data.dailies[today];
  const doneSession = done ? data.sessions.find((s) => s.id === done.sessionId) : undefined;
  const inProgress = data.inProgress[`daily:${today}`];
  const score = done ? done.total : inProgress ? totalScore(inProgress) : 0;
  const tiers: ResultTier[] = done
    ? (doneSession?.rounds.map((r) => r.tier) ?? [])
    : inProgress ? inProgress.rounds.filter((r) => r.status).map((r) => r.result?.tier ?? 'none') : [];
  const answered = tiers.length;
  const untilMidnight = useUntilMidnight();
  const [howOpen, setHowOpen] = useState(!settings.seenIntro);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const number = dayNumber(today) + 1;
  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const closeIntro = () => { setHowOpen(false); if (!settings.seenIntro) updateSettings({ seenIntro: true }); };
  const begin = () => { play('click'); navigate(done ? `/results/${done.sessionId}` : '/play/daily'); };
  const cta = done ? 'See today’s journey' : inProgress ? `Continue — question ${Math.min(7, answered + 1)} of 7` : 'Start today’s quest';
  const reveal = (delay: number, y = 14) => (reducedMotion ? {} : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] } });

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="fixed inset-0 bg-night">
        <JourneyWorld score={score} reducedMotion={reducedMotion} mood="idle" reactKey={0} />
        {/* legibility: a little shade at the top and bottom edges */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#05090D]/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#05090D]/70 to-transparent" />
      </div>

      {/* ------------------------------------------------ top edge */}
      <header className="relative z-20 flex items-start justify-between gap-2 px-4 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-6">
        {stats.journeys > 0 ? (
          <div className="hud-plaque ml-0.5 mt-0.5 flex h-9 items-stretch font-pixel text-[14px] tracking-[0.03em] text-cream/80" title="Daily streak and best score">
            <span className="flex items-center gap-2 px-3"><span className="inline-block h-2.5 w-2.5 rotate-45 bg-gold shadow-[0_0_6px_rgba(233,182,92,.6)]" /><span className="readout text-[16px] font-semibold leading-none text-gold">{stats.streak.current}</span> day streak</span>
            <span className="hidden items-center gap-2 border-l-2 border-dashed border-cream/20 px-3 sm:flex">Best <span className="readout text-[16px] font-semibold leading-none text-cream">{stats.personalBest}</span></span>
          </div>
        ) : <span />}
        <nav className="flex gap-3 pr-0.5 pt-0.5" aria-label="Help and settings">
          <button onClick={() => setHowOpen(true)} className="btn-ghost btn-sm btn-icon text-[18px]" aria-label="How to play" title="How to play">?</button>
          <button onClick={() => setSettingsOpen(true)} className="btn-ghost btn-sm btn-icon" aria-label="Settings" title="Settings">
            <PixelIcon name="gear" size={16} />
          </button>
        </nav>
      </header>

      {/* ------------------------------------------------ title */}
      <motion.div {...reveal(0.15, -10)} className="relative z-10 mt-[clamp(0.5rem,5vh,3.5rem)] px-4 text-center" style={{ textShadow: '0 2px 24px rgba(5,9,13,.55)' }}>
        <h1 className="text-cream"><Wordmark size="xl" /></h1>
        <p className="mt-2 font-display text-[clamp(1rem,2.6vw,1.35rem)] italic text-cream/80">Everything has something in common.</p>
      </motion.div>

      <div className="flex-1" />

      {/* ------------------------------------------------ today's quest */}
      <motion.section {...reveal(0.35)} aria-label="Today’s Daily Quest" className="relative z-10 mx-auto w-full max-w-[560px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-8">
        <div className="journal-slip px-5 pb-4 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="eyebrow text-[10.5px] text-gold-deep">Daily Quest · No. {number}</span>
            <span className="truncate font-display text-sm italic text-ink-soft">{dateLabel}</span>
          </div>
          <p className="mt-1.5 font-display text-[clamp(1.3rem,4.4vw,1.6rem)] font-semibold leading-tight text-ink">
            {done ? 'Today’s journey is complete.' : inProgress ? 'Your journey is underway.' : 'Seven questions. One daily journey.'}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2" aria-label={`${answered} of 7 questions answered`}>
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="h-3 w-3 rotate-45 rounded-[2px] border" style={{ borderColor: i < answered ? 'transparent' : i === answered && !done ? '#26323A' : 'rgba(38,50,58,.3)', background: i < answered ? TIER_COLORS[tiers[i]] : 'transparent' }} />
              ))}
            </div>
            {(done || inProgress) && (
              <span className="text-right text-sm text-ink-soft">
                <span className="readout font-semibold text-ink">{score}</span> pts{done && <> · <em>{DESTINATIONS[destinationIndex(score)].name}</em></>}
              </span>
            )}
          </div>
        </div>
        <div className="ink-console flex flex-col gap-4 px-4 pb-4 pt-4">
          <button onClick={begin} className="btn-gold btn-lg w-full" autoFocus={settings.seenIntro}>{cta} <PixelIcon name="arrow" size={15} /></button>
          <div className="flex items-center justify-between gap-2 text-sm">
            <button onClick={() => { play('click'); navigate('/archive'); }} className="btn-ghost btn-sm">Archives</button>
            <span className="text-cream/50">{done ? 'Next quest in' : 'New quest in'} <span className="readout text-cream/75">{hms(untilMidnight)}</span></span>
          </div>
        </div>
      </motion.section>

      <Modal open={howOpen} onClose={closeIntro} title="How to play">
        <HowToPlay onDone={closeIntro} doneLabel={settings.seenIntro ? 'Got it' : 'Let’s go'} />
      </Modal>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onHowToPlay={() => { setSettingsOpen(false); setHowOpen(true); }} />
    </div>
  );
}
