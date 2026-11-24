import { useEffect, useRef, useState } from 'react';

/* ============================================================
 * Round timing.
 *
 * The deadline is an absolute timestamp stored in game state; it is the
 * single source of truth. Nothing here keeps its own clock:
 *
 *   useDeadline     — fires `onExpire` once when the deadline passes
 *                     (one timeout, re-armed on tab return). No renders.
 *   useSecondsLeft  — whole seconds left, re-rendering once per second,
 *                     aligned to the deadline's second boundaries.
 *
 * The visual dial (CompassTimer) reads the same deadline every animation
 * frame and writes to the DOM directly, so React never renders per frame.
 *
 * (A previous version restarted a requestAnimationFrame chain from a 500 ms
 * interval. Every interval tick spawned another self-perpetuating chain that
 * cleanup never cancelled, so after a question changed, stale chains kept
 * pushing the *old* deadline's time into state — the dial jumped back and
 * forth between two clocks.)
 * ============================================================ */

export function useDeadline(deadline: number | null, onExpire: () => void) {
  const cb = useRef(onExpire);
  cb.current = onExpire;
  useEffect(() => {
    if (deadline == null) return;
    let fired = false;
    let t = 0;
    const check = () => {
      window.clearTimeout(t);
      if (fired) return;
      const ms = deadline - Date.now();
      if (ms <= 0) { fired = true; cb.current(); return; }
      // timers are throttled in background tabs; visibilitychange re-checks on return
      t = window.setTimeout(check, Math.min(ms + 5, 2000));
    };
    check();
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearTimeout(t); document.removeEventListener('visibilitychange', onVis); };
  }, [deadline]);
}

const secsLeft = (deadline: number) => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/** Whole seconds until `deadline` (ceil), updated exactly at each second boundary. */
export function useSecondsLeft(deadline: number | null): number | null {
  const [state, setState] = useState(() => ({ deadline, s: deadline == null ? null : secsLeft(deadline) }));
  // derive synchronously when the deadline changes so the first render is never stale
  let current = state;
  if (state.deadline !== deadline) {
    current = { deadline, s: deadline == null ? null : secsLeft(deadline) };
    setState(current);
  }
  useEffect(() => {
    if (deadline == null) return;
    let t = 0;
    const step = () => {
      const s = secsLeft(deadline);
      setState((prev) => (prev.deadline === deadline && prev.s === s ? prev : { deadline, s }));
      if (s <= 0) return;
      const untilBoundary = (deadline - Date.now()) - (s - 1) * 1000;
      t = window.setTimeout(step, Math.max(16, untilBoundary + 4));
    };
    step();
    const onVis = () => { if (document.visibilityState === 'visible') { window.clearTimeout(t); step(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearTimeout(t); document.removeEventListener('visibilitychange', onVis); };
  }, [deadline]);
  return current.s;
}

/** Time until next local midnight, updating every second. */
export function useUntilMidnight(): number {
  const calc = () => { const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); return m.getTime() - n.getTime(); };
  const [ms, setMs] = useState(calc);
  useEffect(() => { const iv = setInterval(() => setMs(calc()), 1000); return () => clearInterval(iv); }, []);
  return ms;
}

export const hms = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':');
};
