/* ============================================================
 * SIMMLY — core domain types
 * ============================================================ */

export type CategoryId =
  | 'animals' | 'tv' | 'movies' | 'geography' | 'food' | 'games' | 'sports' | 'people' | 'characters' | 'objects';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type UniverseId = 'animal' | 'tv' | 'movie' | 'country' | 'city' | 'food' | 'game' | 'sport' | 'person' | 'character' | 'object';

/** One valid answer in a universe. */
export interface Entity {
  id: string;
  name: string;
  aliases: string[];
  tags: string[];
  universe: UniverseId;
}

/** Every valid answer of one kind ("animals", "TV shows"…). */
export interface Universe {
  id: UniverseId;
  noun: string;
  nounPlural: string;
  entities: Entity[];
}

/* ---------------------------------------------------------------- tiers */

export type TierId = 'perfect' | 'nearly' | 'family' | 'close' | 'distant' | 'loose';
export type ResultTier = TierId | 'unranked' | 'none';

export const TIER_POINTS: Record<TierId, number> = { perfect: 100, nearly: 90, family: 80, close: 65, distant: 45, loose: 30 };
export const UNRANKED_POINTS = 30;

export const TIER_LABEL: Record<ResultTier, string> = {
  perfect: 'Perfect Match',
  nearly: 'Nearly Identical',
  family: 'Same Family',
  close: 'Close Relative',
  distant: 'Distant Cousin',
  loose: 'Loose Connection',
  unranked: 'Unranked Connection',
  none: 'No Connection',
};

export const TIER_ORDER: TierId[] = ['perfect', 'nearly', 'family', 'close', 'distant', 'loose'];

export function tierForPoints(p: number): TierId | null {
  return (Object.entries(TIER_POINTS).find(([, v]) => v === p)?.[0] as TierId) ?? null;
}

/* ---------------------------------------------------------------- boards */

export interface BoardEntry {
  /** canonical answer name; resolved to an entity of the question's universe */
  name: string;
  /** extra aliases declared on the board (merged into the universe) */
  aliases: string[];
  tier: TierId;
  why: string;
  /** editorial marker: an "obvious" first-thought answer (used to test that fame isn't rewarded by default) */
  obvious: boolean;
}

export interface QuestionDef {
  id: string;
  version: number;
  category: CategoryId;
  difficulty: Difficulty;
  universe: UniverseId;
  /** name of the reference entity in that universe */
  ref: string;
  /** only entities carrying one of these tags are valid (e.g. #drink) */
  accept: string[];
  prompt: string;
  hint: string;
  dims: string[];
  rationale: string;
  board: BoardEntry[];
  /** names in the universe that count as "the same thing" as the reference and are rejected */
  exclude: string[];
  /** source notes for editors */
  notes: string;
}

/* ---------------------------------------------------------------- runtime */

export interface RankedEntity {
  entity: Entity;
  entry: BoardEntry;
  points: number;
}

export interface RuntimeQuestion {
  def: QuestionDef;
  universe: Universe;
  reference: Entity;
  /** ranked answers, best first */
  ranked: RankedEntity[];
  rankedById: Map<string, RankedEntity>;
}

export interface AnswerResult {
  questionId: string;
  entityId: string;
  entityName: string;
  points: number;
  tier: ResultTier;
  why: string;
  /** 1-based position among distinct ranked tiers, null for unranked */
  rank: number | null;
}

export type Resolution =
  | { kind: 'match'; entity: Entity; via: 'exact' | 'alias' | 'partial' | 'fuzzy' }
  | { kind: 'confirm'; entity: Entity }
  | { kind: 'ambiguous'; options: Entity[] }
  | { kind: 'hint'; message: string }
  | { kind: 'unknown'; message: string }
  | { kind: 'empty' };
