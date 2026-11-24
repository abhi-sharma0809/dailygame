import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { play, setSoundEnabled } from '../audio/sfx';
import type { SessionState } from '../game/engine/session';
import { STORAGE_KEY, browserStore, loadPlayer, savePlayer, type AnswerReport, type PlayerData, type Settings } from '../game/persistence/store';
import { recordSession, type AchievementDef } from '../game/progression';
import { dateKey } from '../game/selection';

interface Ctx {
  data: PlayerData;
  today: string;
  settings: Settings;
  reducedMotion: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  saveProgress: (slot: string, s: SessionState | null) => void;
  finishSession: (slot: string, s: SessionState) => void;
  addReport: (r: Omit<AnswerReport, 'id' | 'timestamp' | 'status'>) => void;
  toasts: AchievementDef[];
  dismissToast: (id: string) => void;
}

const PlayerCtx = createContext<Ctx | null>(null);

function useSystemReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!m) return;
    const on = () => setR(m.matches);
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return r;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PlayerData>(() => loadPlayer(browserStore));
  const [toasts, setToasts] = useState<AchievementDef[]>([]);
  const [today, setToday] = useState(dateKey());
  const dataRef = useRef(data);
  dataRef.current = data;

  // roll over at midnight
  useEffect(() => {
    const iv = setInterval(() => setToday((t) => (t === dateKey() ? t : dateKey())), 15_000);
    return () => clearInterval(iv);
  }, []);

  const commit = useCallback((next: PlayerData) => {
    dataRef.current = next;
    setData(next);
    savePlayer(browserStore, next);
  }, []);

  // keep tabs in sync
  useEffect(() => {
    const on = (e: StorageEvent) => { if (e.key === STORAGE_KEY) setData(loadPlayer(browserStore)); };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  useEffect(() => setSoundEnabled(data.settings.sound), [data.settings.sound]);

  const system = useSystemReducedMotion();
  const reducedMotion = data.settings.motion === 'reduced' || (data.settings.motion === 'system' && !!system);
  useEffect(() => { document.documentElement.classList.toggle('reduced-motion', reducedMotion); }, [reducedMotion]);

  const value = useMemo<Ctx>(() => ({
    data,
    today,
    settings: data.settings,
    reducedMotion,
    updateSettings: (patch) => commit({ ...dataRef.current, settings: { ...dataRef.current.settings, ...patch } }),
    saveProgress: (slot, s) => {
      const inProgress = { ...dataRef.current.inProgress };
      if (s) inProgress[slot] = s; else delete inProgress[slot];
      commit({ ...dataRef.current, inProgress });
    },
    finishSession: (slot, s) => {
      const { data: next, unlocked } = recordSession(dataRef.current, s, today);
      const inProgress = { ...next.inProgress };
      delete inProgress[slot];
      commit({ ...next, inProgress });
      if (unlocked.length) {
        setToasts((t) => [...t, ...unlocked]);
        setTimeout(() => play('achievement'), 600);
      }
    },
    addReport: (r) => commit({ ...dataRef.current, reports: [...dataRef.current.reports, { ...r, id: `r_${Date.now().toString(36)}`, timestamp: Date.now(), status: 'pending' }] }),
    toasts,
    dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
  }), [data, today, reducedMotion, toasts, commit]);

  return <PlayerCtx.Provider value={value}>{children}</PlayerCtx.Provider>;
}

export function usePlayer(): Ctx {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error('usePlayer outside PlayerProvider');
  return c;
}
