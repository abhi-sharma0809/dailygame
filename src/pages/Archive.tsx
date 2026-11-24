import { PageShell, SectionTitle } from '../components/ui';
import { PixelIcon } from '../components/PixelIcon';
import { totalScore } from '../game/engine/session';
import { EPOCH, addDays, dayNumber } from '../game/selection';
import { navigate } from '../hooks/useHashRoute';
import { usePlayer } from '../state/PlayerContext';

const shortDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** Every Daily Quest so far. Today's is shown apart: it can only be played once, as the daily. */
export function ArchivePage() {
  const { data, today } = usePlayer();
  const n = dayNumber(today);
  const past = Array.from({ length: Math.max(0, n) }, (_, i) => addDays(EPOCH, n - 1 - i));
  const todays = data.dailies[today];
  const todayInProgress = data.inProgress[`daily:${today}`];

  return (
    <PageShell title="Archives">
      <SectionTitle eyebrow="Archives" sub="Replay any past Daily Quest. Replays don’t change your streak.">Past quests</SectionTitle>

      {/* ------------------------------------------------ today, set apart */}
      <button
        onClick={() => navigate(todays ? `/results/${todays.sessionId}` : '/play/daily')}
        className="tile tile-paper mt-7 flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-ink sm:px-6"
      >
        <span className="min-w-0">
          <span className="eyebrow block text-[10px] text-gold-deep">Today · Daily Quest</span>
          <span className="block font-display text-2xl font-semibold">No. {n + 1}</span>
          <span className="block text-sm text-ink-soft">{todays ? 'Completed' : todayInProgress ? `In progress · ${todayInProgress.rounds.filter((r) => r.status).length} of 7` : 'Not started yet'}</span>
        </span>
        <span className="shrink-0 text-right">
          {todays ? <span className="readout block text-2xl font-semibold">{todays.total}</span> : null}
          <span className="tile-cta text-ink">{todays ? 'See journey' : todayInProgress ? 'Continue' : 'Play'} <PixelIcon name="arrow" size={12} /></span>
        </span>
      </button>

      {/* ------------------------------------------------ past quests */}
      {past.length ? (
        <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {past.map((d) => {
            const daily = data.dailies[d];
            const runs = data.sessions.filter((s) => s.dateKey === d && (s.mode === 'archive' || s.mode === 'daily'));
            const best = runs.length ? Math.max(...runs.map((s) => s.total)) : null;
            const latest = runs[runs.length - 1];
            const open = data.inProgress[`archive:${d}`];
            const action = open ? 'Continue' : runs.length ? 'Replay' : 'Play';
            return (
              <li key={d} className="tile tile-dark flex items-stretch">
                <button onClick={() => navigate(`/play/archive/${d}`)} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-5 py-4 text-left" aria-label={`${action} quest number ${dayNumber(d) + 1}, ${shortDate(d)}`}>
                  <span className="min-w-0">
                    <span className="block font-display text-2xl font-semibold">No. {dayNumber(d) + 1}</span>
                    <span className="block text-sm text-cream/60">{shortDate(d)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {open ? (
                      <span className="block text-sm text-cream/75">In progress{totalScore(open) > 0 && <> · <span className="readout">{totalScore(open)}</span></>}</span>
                    ) : best != null ? (
                      <span className="block"><span className="readout text-xl text-gold">{best}</span><span className="ml-1 text-[11px] text-cream/45">{daily && runs.length === 1 ? 'pts' : 'best'}</span></span>
                    ) : null}
                    <span className="tile-cta mt-0.5 text-gold">{action} <PixelIcon name="arrow" size={12} /></span>
                  </span>
                </button>
                {latest && (
                  <button onClick={() => navigate(`/results/${latest.id}`)} className="tile-cta shrink-0 border-l-2 border-dashed border-cream/15 px-3 text-[13px] text-cream/60 hover:bg-cream/[0.05] hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffe7a6]" aria-label={`Results for quest number ${dayNumber(d) + 1}`}>
                    Results
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-6 text-cream/60">The first quest was today — past quests will collect here.</p>
      )}
    </PageShell>
  );
}
