import { hashString, mulberry32 } from '../selection';

/* ============================================================
 * Daily community count — SIMULATED PLACEHOLDER.
 *
 * SIMMLY has no player analytics. This number is not a measurement of
 * anything: it is drawn deterministically from the quest's date key, so
 * every player sees the same figure for the same quest, on every refresh
 * and device, and no player activity is collected, stored or inferred.
 *
 * To switch to a real metric later, replace `dailyExplorerCount` (or the
 * DailyCommunityCount component that calls it) with a fetch from the
 * backend; the results screen only depends on the component.
 * ============================================================ */

export const SIMULATED_EXPLORERS_MIN = 15_000;
export const SIMULATED_EXPLORERS_MAX = 30_000;
/** Salt for the simulated draw. Changing it changes every day's number. */
const SALT = 'simmly-explorers-v1';

/** Simulated number of explorers for a daily quest (`YYYY-MM-DD`), inclusive of both bounds. */
export function dailyExplorerCount(dateKey: string): number {
  const r = mulberry32(hashString(`${SALT}:${dateKey}`))();
  const span = SIMULATED_EXPLORERS_MAX - SIMULATED_EXPLORERS_MIN + 1;
  return SIMULATED_EXPLORERS_MIN + Math.min(span - 1, Math.floor(r * span));
}
