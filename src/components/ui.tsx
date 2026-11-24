import { AnimatePresence, animate, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { navigate } from '../hooks/useRoute';
import { usePlayer } from '../state/PlayerContext';
import { PixelIcon } from './PixelIcon';

/* ------------------------------------------------------------ wordmark */

/**
 * SIMMLY. The full stop is a gold route marker — the same diamond that marks
 * each destination on the journey and each question in the HUD.
 */
export function Wordmark({ size = 'md', onClick }: { size?: 'sm' | 'md' | 'xl'; onClick?: () => void }) {
  const cls = size === 'xl' ? 'text-[clamp(3.4rem,13vw,6.8rem)]' : size === 'md' ? 'text-3xl' : 'text-[1.6rem]';
  const content = (
    <span className={`inline-flex items-baseline font-display font-semibold leading-none tracking-[0.07em] ${cls}`} style={{ fontVariationSettings: "'SOFT' 100, 'opsz' 144" }} aria-label="SIMMLY">
      <span aria-hidden>SIMMLY</span>
      <span aria-hidden className="ml-[0.1em] inline-block h-[0.17em] w-[0.17em] rotate-45 rounded-[0.02em] bg-gold shadow-[0_0_0.25em_rgba(233,182,92,.55)]" />
    </span>
  );
  return onClick ? <button onClick={onClick} className="btn-ghost wordmark-btn" aria-label="SIMMLY — home">{content}</button> : content;
}

export function TopBar({ title, right }: { title?: string; right?: ReactNode }) {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <div className="flex items-center gap-4">
        <Wordmark size="sm" onClick={() => navigate('/')} />
        {title && <span className="hidden font-display text-lg italic text-cream/60 sm:inline">— {title}</span>}
      </div>
      <div className="flex items-center gap-1">{right}</div>
    </header>
  );
}

export function PageShell({ children, title, right, wide }: { children: ReactNode; title?: string; right?: ReactNode; wide?: boolean }) {
  return (
    <div className="relative min-h-dvh pb-16">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(120,147,107,0.16),transparent_60%),radial-gradient(900px_600px_at_90%_10%,rgba(94,78,122,0.18),transparent_60%)]" />
      <TopBar title={title} right={right} />
      <main className={`relative z-10 mx-auto w-full px-4 sm:px-6 ${wide ? 'max-w-6xl' : 'max-w-5xl'}`}>{children}</main>
    </div>
  );
}

export function SectionTitle({ eyebrow, children, sub }: { eyebrow?: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mt-10">
      {eyebrow && <div className="eyebrow text-gold/90">{eyebrow}</div>}
      <h1 className="mt-1 font-display text-[clamp(2.2rem,5vw,3.4rem)] font-semibold leading-[1.02]">{children}</h1>
      {sub && <p className="mt-2 max-w-xl text-cream/70">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------ count-up */

export function CountUp({ to, from = 0, duration = 1.2, delay = 0, className = '', instant, onDone }: { to: number; from?: number; duration?: number; delay?: number; className?: string; instant?: boolean; onDone?: () => void }) {
  const [v, setV] = useState(instant ? to : from);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (instant) { setV(to); done.current?.(); return; }
    const c = animate(from, to, { duration, delay, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setV(Math.round(x)), onComplete: () => done.current?.() });
    return () => c.stop();
  }, [to, from, duration, delay, instant]);
  return <span className={`readout ${className}`}>{v}</span>;
}

/* ------------------------------------------------------------ modal */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,textarea,select,button[data-autofocus]')?.focus(), 40);
    return () => { window.removeEventListener('keydown', on); clearTimeout(t); prev?.focus?.(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-[#05090D]/75 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`paper paper-edge max-h-[90dvh] w-full overflow-y-auto p-6 sm:p-8 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
            initial={{ y: 40, opacity: 0, rotate: -0.6 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <h2 className="font-display text-3xl font-semibold text-ink">{title}</h2>
              <button onClick={onClose} className="btn-paper btn-sm btn-icon mr-0.5 mt-0.5 shrink-0" aria-label="Close"><PixelIcon name="close" size={11} /></button>
            </div>
            <div className="rule-ink mb-4" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------ toasts */

export function Toasts() {
  const { toasts, dismissToast } = usePlayer();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end" aria-live="polite">
      <AnimatePresence>
        {toasts.slice(0, 3).map((a, i) => <Toast key={a.id} a={a} delay={i * 500} onDone={() => dismissToast(a.id)} />)}
      </AnimatePresence>
    </div>
  );
}

function Toast({ a, delay, onDone }: { a: { title: string; description: string; glyph: string }; delay: number; onDone: () => void }) {
  const d = useRef(onDone);
  d.current = onDone;
  useEffect(() => { const t = setTimeout(() => d.current(), 4400 + delay); return () => clearTimeout(t); }, [delay]);
  return (
    <motion.button layout onClick={onDone} className="tile tile-paper pointer-events-auto flex w-full max-w-xs items-center gap-3 px-4 py-3 text-left" initial={{ y: 24, opacity: 0, rotate: 1 }} animate={{ y: 0, opacity: 1, rotate: 0, transition: { delay: delay / 1000 } }} exit={{ x: 40, opacity: 0 }}>
      <span className="relative grid h-10 w-10 shrink-0 place-items-center"><span className="absolute inset-[6px] rotate-45 bg-ink" /><span className="relative font-display text-lg text-gold">{a.glyph}</span></span>
      <span className="min-w-0">
        <span className="eyebrow block text-[10px] text-gold-deep">Achievement</span>
        <span className="block font-display text-lg font-semibold leading-tight text-ink">{a.title}</span>
        <span className="block truncate text-xs text-ink-soft">{a.description}</span>
      </span>
    </motion.button>
  );
}

/* ------------------------------------------------------------ misc */

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="slate px-4 py-3">
      <div className="eyebrow text-cream/55">{label}</div>
      <div className={`readout mt-1 text-2xl font-medium ${accent ? 'text-gold' : 'text-cream'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-cream/55">{sub}</div>}
    </div>
  );
}
