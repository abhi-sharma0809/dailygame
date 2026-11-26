import { dailyExplorerCount } from '../game/community';

/**
 * A small traveller-count stamp for the results plate: how many explorers
 * sailed a given daily quest.
 *
 * SIMULATED: the count is a deterministic placeholder seeded by the quest's
 * date (see src/game/community). It is decorative — not a button — and is the
 * only place to change when a real daily metric exists.
 */
export function DailyCommunityCount({ dateKey, today, className = '' }: { dateKey: string; today: boolean; className?: string }) {
  const n = dailyExplorerCount(dateKey).toLocaleString('en-US');
  const label = today ? 'explorers today' : 'explorers that day';
  return (
    <span className={`explorer-stamp ${className}`} data-explorers={n.replace(/,/g, '')}>
      <CompassPip />
      <span><b className="readout">{n}</b> {label}</span>
    </span>
  );
}

/** an 8×8 pixel compass rose */
function CompassPip() {
  return (
    <svg viewBox="0 0 8 8" className="h-[12px] w-[12px] shrink-0" shapeRendering="crispEdges" aria-hidden>
      <path d="M3 0h2v1H3zM2 1h1v1H2zM5 1h1v1H5zM1 2h1v1H1zM6 2h1v1H6zM0 3h1v2H0zM7 3h1v2H7zM1 5h1v1H1zM6 5h1v1H6zM2 6h1v1H2zM5 6h1v1H5zM3 7h2v1H3z" fill="currentColor" opacity=".55" />
      <path d="M4 1h1v3H4z" fill="#C8693F" />
      <path d="M3 4h1v3H3z" fill="currentColor" />
      <path d="M3 3h2v2H3z" fill="#D9AD63" />
    </svg>
  );
}
