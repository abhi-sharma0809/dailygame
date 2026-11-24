import type { SessionState } from '../engine/session';
import type { CategoryId, Difficulty, ResultTier } from '../types';

/* ============================================================
 * Persistence
 *
 * A tiny key-value abstraction so the local implementation can later be
 * swapped for (or mirrored to) a cloud account without touching game code.
 * ============================================================ */

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryStore(init: Record<string, string> = {}): KeyValueStore {
  const m = new Map(Object.entries(init));
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}

export const browserStore: KeyValueStore = {
  get: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* storage full or blocked */ } },
  remove: (k) => { try { window.localStorage.removeItem(k); } catch { /* ignore */ } },
};

/* ------------------------------------------------------------ schema */

export const STORAGE_KEY = 'kinship:player';
export const SCHEMA_VERSION = 1;

export interface Settings {
  sound: boolean;
  motion: 'system' | 'reduced' | 'full';
  seenIntro: boolean;
  playerName: string;
}

export interface RoundSummary {
  questionId: string;
  category: CategoryId;
  difficulty: Difficulty;
  status: 'answered' | 'skipped' | 'timeout';
  points: number;
  tier: ResultTier;
  entityName?: string;
  input?: string;
}

export interface SessionSummary {
  id: string;
  mode: SessionState['config']['mode'];
  label: string;
  dateKey?: string;
  expeditionId?: string;
  expeditionSession?: number;
  startedAt: number;
  endedAt: number;
  rounds: RoundSummary[];
  total: number;
  maxTotal: number;
  challenge?: { fromName?: string; fromScore?: number };
}

export interface AnswerReport {
  id: string;
  questionId: string;
  questionVersion: number;
  submitted: string;
  proposed: string;
  note: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface PlayerData {
  version: number;
  createdAt: number;
  settings: Settings;
  sessions: SessionSummary[];
  /** dateKey → session id of the (single) daily attempt */
  dailies: Record<string, { sessionId: string; total: number; completedAt: number }>;
  achievements: Record<string, number>;
  /** most recent last */
  recentQuestions: string[];
  reports: AnswerReport[];
  /** valid-but-unranked answers players submitted, kept for curation */
  unranked: { questionId: string; questionVersion: number; entityId: string; name: string; timestamp: number }[];
  /** resumable sessions keyed by slot (e.g. "daily:2026-11-16") */
  inProgress: Record<string, SessionState>;
}

export const DEFAULT_SETTINGS: Settings = { sound: true, motion: 'system', seenIntro: false, playerName: '' };

export function emptyPlayer(now = Date.now()): PlayerData {
  return { version: SCHEMA_VERSION, createdAt: now, settings: { ...DEFAULT_SETTINGS }, sessions: [], dailies: {}, achievements: {}, recentQuestions: [], reports: [], unranked: [], inProgress: {} };
}

/** Load, tolerating corrupt or older data (unknown fields are dropped, missing ones defaulted). */
export function loadPlayer(store: KeyValueStore): PlayerData {
  const raw = store.get(STORAGE_KEY);
  if (!raw) return emptyPlayer();
  try {
    const d = JSON.parse(raw) as Partial<PlayerData>;
    const base = emptyPlayer(d.createdAt ?? Date.now());
    return {
      ...base,
      ...d,
      version: SCHEMA_VERSION,
      settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
      sessions: Array.isArray(d.sessions) ? d.sessions : [],
      dailies: d.dailies ?? {},
      achievements: d.achievements ?? {},
      recentQuestions: Array.isArray(d.recentQuestions) ? d.recentQuestions : [],
      reports: Array.isArray(d.reports) ? d.reports : [],
      unranked: Array.isArray(d.unranked) ? d.unranked : [],
      inProgress: d.inProgress ?? {},
    };
  } catch {
    return emptyPlayer();
  }
}

export function savePlayer(store: KeyValueStore, data: PlayerData): void {
  store.set(STORAGE_KEY, JSON.stringify(data));
}
