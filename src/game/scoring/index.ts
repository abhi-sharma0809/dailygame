import { TIER_LABEL, TIER_ORDER, TIER_POINTS, UNRANKED_POINTS, type ResultTier, type TierId } from '../types';

/* ============================================================
 * Scoring — fixed editorial tiers, no numeric similarity math.
 *   PERFECT MATCH 100 · NEARLY IDENTICAL 90 · SAME FAMILY 80
 *   CLOSE RELATIVE 65 · DISTANT COUSIN 45 · LOOSE CONNECTION 30
 *   UNRANKED CONNECTION 30 (valid but not on the board)
 *   no answer / pass / timeout 0
 * ============================================================ */

export const ROUNDS_PER_JOURNEY = 7;
export const MAX_JOURNEY_SCORE = ROUNDS_PER_JOURNEY * 100;
export const SECONDS_PER_ROUND = 20;

export const pointsFor = (tier: ResultTier): number =>
  tier === 'unranked' ? UNRANKED_POINTS : tier === 'none' ? 0 : TIER_POINTS[tier];

export const tierLabel = (t: ResultTier) => TIER_LABEL[t];

/** Brighter celebration for better tiers: 0 = perfect … 6 = none. */
export const tierIntensity = (t: ResultTier): number => (t === 'unranked' ? 5 : t === 'none' ? 6 : TIER_ORDER.indexOf(t as TierId));

export const TIER_COLORS: Record<ResultTier, string> = {
  perfect: '#E9B65C',
  nearly: '#D9AD63',
  family: '#8FB58A',
  close: '#89B7CE',
  distant: '#A79BC4',
  loose: '#B9A88C',
  unranked: '#B9A88C',
  none: '#7C8790',
};

export const TIER_SHORT: Record<ResultTier, string> = {
  perfect: '✦', nearly: '◆', family: '●', close: '◐', distant: '○', loose: '·', unranked: '?', none: '–',
};

export interface JourneyRank { title: string; min: number; blurb: string }

/** Where the explorer ends up, by journey score. */
export const DESTINATIONS = [
  { id: 'forest', name: 'The Forgotten Forest', blurb: 'Every journey begins among the old trees.' },
  { id: 'lake', name: 'The Glass Lake', blurb: 'Still water reflects what you already know.' },
  { id: 'kingdom', name: 'The Old Kingdom', blurb: 'Ruins full of half-remembered links.' },
  { id: 'clouds', name: 'The Cloud Passage', blurb: 'Bridges between islands of thought.' },
  { id: 'peaks', name: 'The Crystal Peaks', blurb: 'Connections that catch the light.' },
  { id: 'stars', name: 'The Starfields', blurb: 'Patterns emerge from the scattered points.' },
  { id: 'summit', name: 'The Summit', blurb: 'Everything has something in common.' },
] as const;

/**
 * Journey rule: every 100 points carries the explorer to the next destination.
 * 0 = The Forgotten Forest … 600 = The Summit; 600–700 climbs to the beacon.
 */
export const POINTS_PER_DESTINATION = 100;

/** Explorer progress 0..1 along the whole trail for a journey total. */
export const journeyProgress = (total: number, max = MAX_JOURNEY_SCORE) => Math.max(0, Math.min(1, total / max));

/** Index of the destination reached with this many points. */
export const destinationIndex = (total: number) => Math.max(0, Math.min(DESTINATIONS.length - 1, Math.floor(total / POINTS_PER_DESTINATION + 1e-9)));
