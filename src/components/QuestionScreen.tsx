import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { play } from '../audio/sfx';
import { CATEGORY_BY_ID } from '../data/atlas';
import { checkPick, resolveAnswer, type AnswerResolution } from '../game/engine/questions';
import type { Entity, RuntimeQuestion } from '../game/types';
import { useSecondsLeft } from '../hooks/useCountdown';
import { PixelIcon } from './PixelIcon';

/* ------------------------------------------------------------ compass timer */

const R = 23;
const CIRC = 2 * Math.PI * R;

/**
 * A brass compass bezel that drains as time runs out.
 *
 * The round's deadline (game state) is the only clock. One rAF loop per
 * mounted timer reads it each frame and writes the arc and marker straight
 * to the DOM — no React renders per frame, nothing to retarget, nothing to
 * restart. React re-renders once per second for the numeral, and the
 * final-seconds state fades in through CSS rather than restarting an
 * animation.
 */
export function CompassTimer({ deadline, total, size = 56 }: { deadline: number | null; total: number; size?: number }) {
  const arc = useRef<SVGCircleElement>(null);
  const marker = useRef<SVGGElement>(null);
  const secs = useSecondsLeft(deadline);

  // layout effect: the first paint already shows the true remaining time
  useLayoutEffect(() => {
    if (deadline == null) return;
    let raf = 0;
    const paint = () => {
      const frac = Math.max(0, Math.min(1, (deadline - Date.now()) / (total * 1000)));
      arc.current?.setAttribute('stroke-dashoffset', (CIRC * (1 - frac)).toFixed(2));
      marker.current?.setAttribute('transform', `rotate(${(frac * 360).toFixed(2)} 28 28)`);
      if (frac > 0) raf = requestAnimationFrame(paint);
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [deadline, total]);

  const s = secs ?? total;
  const urgent = s <= 5;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="ct-face" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stopColor="#1F2E3C" /><stop offset="1" stopColor="#0C141C" /></radialGradient>
        </defs>
        {/* urgent halo: always mounted and always animating; only its wrapper's opacity changes */}
        <g style={{ opacity: urgent ? 1 : 0, transition: 'opacity .5s ease' }}>
          <circle cx="28" cy="28" r="27" fill="none" stroke="#E07A4A" strokeWidth="2" className="timer-halo" />
        </g>
        <circle cx="28" cy="28" r="27" fill="url(#ct-face)" stroke="#C9A255" strokeOpacity="0.55" strokeWidth="1" />
        {Array.from({ length: 20 }, (_, i) => {
          const a = (i / 20) * Math.PI * 2;
          const long = i % 5 === 0;
          return <line key={i} x1={28 + Math.sin(a) * 18.5} y1={28 - Math.cos(a) * 18.5} x2={28 + Math.sin(a) * (long ? 15.5 : 17)} y2={28 - Math.cos(a) * (long ? 15.5 : 17)} stroke="#F0E6D1" strokeOpacity={long ? 0.55 : 0.25} strokeWidth={long ? 1.2 : 0.8} />;
        })}
        <circle cx="28" cy="28" r={R} fill="none" stroke="#F0E6D1" strokeOpacity="0.1" strokeWidth="3.2" />
        <circle
          ref={arc}
          cx="28" cy="28" r={R} fill="none" strokeWidth="3.2" strokeLinecap="round"
          strokeDasharray={CIRC.toFixed(2)}
          strokeDashoffset="0"
          transform="rotate(-90 28 28)"
          style={{ stroke: urgent ? '#E07A4A' : '#E2B868', transition: 'stroke .6s ease' }}
        />
        <g ref={marker}>
          <path d="M28 1.8 L31 6.4 L28 9 L25 6.4 Z" style={{ fill: urgent ? '#FFB48A' : '#FFE7A6', transition: 'fill .6s ease' }} />
        </g>
        <path d="M28 2 L28 5" stroke="#F0E6D1" strokeOpacity="0.6" strokeWidth="1" />
      </svg>
      <div role="timer" aria-live={urgent ? 'assertive' : 'off'} aria-label={`${s} seconds left`} className="absolute inset-0 grid place-items-center">
        <span className="readout text-[15px] font-semibold leading-none" style={{ color: urgent ? '#FFB48A' : '#F8F3E8', transition: 'color .6s ease' }}>{String(Math.max(0, s)).padStart(2, '0')}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ prompt */

function highlightRef(prompt: string, ref: string): ReactNode {
  const m = prompt.match(/most like (.+?)\??$/i);
  const target = m ? m[1].replace(/^(a|an|the) /i, '') : ref;
  const i = prompt.toLowerCase().lastIndexOf(target.toLowerCase());
  if (i < 0) return prompt;
  return (
    <>
      {prompt.slice(0, i)}
      <span className="relative whitespace-nowrap">
        <svg className="pointer-events-none absolute -bottom-[0.18em] left-0 h-[0.32em] w-full" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden>
          <path d="M2 8 C 20 2, 40 11, 60 6 S 90 3, 98 7" fill="none" stroke="#D9AD63" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
        <span className="relative">{prompt.slice(i, i + target.length)}</span>
      </span>
      {prompt.slice(i + target.length)}
    </>
  );
}

/* ------------------------------------------------------------ the dock */

type Feedback = { kind: 'reject'; message: string } | { kind: 'confirm'; entity: Entity } | { kind: 'choose'; options: Entity[] } | null;

interface DockProps {
  q: RuntimeQuestion;
  stageLabel: string;
  deadline: number | null;
  seconds: number;
  disabled?: boolean;
  onLock: (e: Entity, input: string) => void;
  onPass: () => void;
  onReport: (s: string) => void;
}

/**
 * The question as a field-journal slip tucked into an ink console: the prompt
 * on paper, the compass, answer and submit underneath. Compact by design —
 * the world above is the main event.
 */
export function QuestionDock({ q, stageLabel, deadline, seconds, disabled, onLock, onPass, onReport }: DockProps) {
  const cat = CATEGORY_BY_ID[q.def.category];
  const [text, setText] = useState('');
  const [fb, setFb] = useState<Feedback>(null);
  const shake = useAnimationControls();
  const [lastRejected, setLastRejected] = useState('');
  const locked = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    locked.current = false;
    setText('');
    setFb(null);
    // don't pop the keyboard over the world on phones until they tap
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse) return;
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 120);
    return () => clearTimeout(t);
  }, [q.def.id]);

  const lock = (e: Entity, input: string) => {
    if (locked.current || disabled) return;
    locked.current = true;
    play('lock');
    onLock(e, input);
  };

  const handle = (r: AnswerResolution, input: string) => {
    switch (r.kind) {
      case 'empty': setFb({ kind: 'reject', message: 'Write an answer first, or pass this one.' }); return;
      case 'accept': lock(r.entity, input); return;
      case 'confirm': play('click'); setFb({ kind: 'confirm', entity: r.entity }); return;
      case 'choose': play('click'); setFb({ kind: 'choose', options: r.options }); return;
      case 'reject': play('reject'); void shake.start({ x: [0, -6, 5, -3, 2, 0], transition: { duration: 0.32 } }); setLastRejected(input); setFb({ kind: 'reject', message: r.message });
    }
  };

  const submit = () => {
    if (disabled || locked.current) return;
    if (fb?.kind === 'confirm') return lock(fb.entity, text);
    handle(resolveAnswer(q, text), text);
  };

  const pass = () => { if (!locked.current && !disabled) { locked.current = true; play('skip'); onPass(); } };

  return (
    <div className="relative w-full max-w-[600px]">
      {/* feedback floats above the slip so the dock never jumps */}
      <div id="answer-feedback" aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-full mb-2.5 flex justify-center">
        {/* plain keyed elements with a CSS entrance: a new message is never held back
            behind the previous one's exit (rapid corrections stay instant) */}
          {fb?.kind === 'reject' && (
            <div key={`r:${fb.message}`} className="hud-tag fb-in pointer-events-auto border-l-[3px] border-l-ember">
              <span>{fb.message} <span className="text-cream/60">Try again while the compass turns.</span></span>
              {lastRejected.trim().length > 1 && <button type="button" onClick={() => onReport(lastRejected)} className="btn-text ml-2 whitespace-nowrap py-0 text-[13px] text-gold-light">It should count</button>}
            </div>
          )}
          {fb?.kind === 'confirm' && (
            <div key={`c:${fb.entity.id}`} className="hud-tag fb-in pointer-events-auto border-l-[3px] border-l-gold">
              <span>Did you mean <strong className="font-display text-base italic text-gold-light">{fb.entity.name}</strong>?</span>
              <span className="ml-3 flex shrink-0 gap-2.5">
                <button type="button" onClick={() => lock(fb.entity, text)} className="btn-gold btn-xs">Yes</button>
                <button type="button" onClick={() => { setFb(null); inputRef.current?.focus(); }} className="btn-ghost btn-xs">No</button>
              </span>
            </div>
          )}
          {fb?.kind === 'choose' && (
            <div key={`h:${fb.options.map((o) => o.id).join()}`} className="hud-tag fb-in pointer-events-auto flex-col items-start border-l-[3px] border-l-gold">
              <span className="text-cream/75">Which one?</span>
              <span className="mt-2 flex flex-wrap gap-2.5 pb-0.5">
                {fb.options.map((o) => (
                  <button key={o.id} type="button" onClick={() => handle(checkPick(q, o), text)} className="btn-ghost btn-xs">{o.name}</button>
                ))}
              </span>
            </div>
          )}
      </div>

      <div className="journal-slip px-4 pb-3 pt-3 sm:px-5 sm:pb-3.5 sm:pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="eyebrow min-w-0 truncate text-[10px] text-[#5B6F4E]">{cat?.label}<span className="text-ink/35"> · </span><span className="normal-case tracking-normal text-ink-soft" style={{ letterSpacing: 0 }}>{stageLabel}</span></div>
          <button type="button" onClick={pass} disabled={disabled} className="btn-text on-paper shrink-0 py-0 text-[13px]">
            Pass this one
          </button>
        </div>
        <h1 className="mt-1 text-balance font-display text-[clamp(1.2rem,4.6vw,1.6rem)] font-semibold leading-[1.15] text-ink" style={{ fontVariationSettings: "'SOFT' 80, 'opsz' 72" }}>
          {highlightRef(q.def.prompt, q.def.ref)}
        </h1>
        <p className="mt-1 line-clamp-2 text-pretty text-[13px] leading-snug text-ink-soft">{q.def.hint}</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} aria-describedby="answer-feedback" className="ink-console flex items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3">
        <CompassTimer deadline={deadline} total={seconds} size={52} />
        <motion.div animate={shake} className="min-w-0 flex-1">
          <label htmlFor="answer" className="sr-only">Your answer</label>
          <input
            ref={inputRef}
            id="answer"
            value={text}
            disabled={disabled}
            onChange={(e) => { setText(e.target.value); if (fb) setFb(null); }}
            onKeyDown={(e) => { if (e.key === 'Escape') setFb(null); }}
            placeholder={`Name ${/^[aeiou]/i.test(q.universe.noun) ? 'an' : 'a'} ${q.universe.noun}…`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={80}
            className="h-12 w-full rounded-[3px] border-2 border-parchment/15 bg-[#0B131B] px-4 font-display text-[17px] italic text-cream outline-none transition placeholder:text-cream/35 focus:border-gold/70 focus:shadow-[0_0_0_3px_rgba(217,173,99,.18)] sm:text-lg"
          />
        </motion.div>
        <button type="submit" disabled={disabled} aria-label="Submit answer" className="btn-gold mx-1 shrink-0 px-4 sm:px-5">
          <span className="hidden sm:inline">{fb?.kind === 'confirm' ? 'Confirm' : 'Submit'}</span>
          <PixelIcon name="arrow" size={15} />
        </button>
      </form>
    </div>
  );
}
