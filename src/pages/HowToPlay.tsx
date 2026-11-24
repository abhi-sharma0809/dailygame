/* The whole tutorial: three steps and one line. Shown once, then on request. */

const STEPS: { title: string; body: string; icon: JSX.Element }[] = [
  {
    title: 'Make a connection.',
    body: 'Answer each question with something most like the reference.',
    icon: (
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
        <path d="M8 22 C 12 8, 20 24, 24 10" fill="none" stroke="#D9AD63" strokeWidth="2" strokeDasharray="2.5 3" strokeLinecap="round" />
        <circle cx="8" cy="22" r="4" fill="#F0E6D1" />
        <circle cx="24" cy="10" r="4" fill="#D9AD63" />
      </svg>
    ),
  },
  {
    title: 'Earn points.',
    body: 'The stronger the connection, the more points you get.',
    icon: (
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
        <path d="M16 4 L19.2 12.8 L28 16 L19.2 19.2 L16 28 L12.8 19.2 L4 16 L12.8 12.8 Z" fill="#E9B65C" />
        <circle cx="16" cy="16" r="3" fill="#FFF4D6" />
      </svg>
    ),
  },
  {
    title: 'Journey onward.',
    body: 'Your answers move your ship through the world.',
    icon: (
      <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden>
        <ellipse cx="17" cy="12" rx="10" ry="6" fill="#E0B262" />
        <path d="M11 19 H22 Q21 23 19 24 H14 Q12 23 11 19 Z" fill="#B07A4E" />
        <path d="M13 17 L12 19 M21 17 L22 19" stroke="#F0E6D1" strokeWidth="1.2" />
        <path d="M2 15 H6 M1 19 H7" stroke="#F0E6D1" strokeOpacity=".6" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function HowToPlay({ onDone, doneLabel = 'Got it' }: { onDone: () => void; doneLabel?: string }) {
  return (
    <div className="text-ink">
      <ol className="space-y-3.5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3.5">
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink">
              {s.icon}
              <span className="readout absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-[11px] font-semibold text-ink">{i + 1}</span>
            </span>
            <span className="pt-0.5 text-[15px] leading-snug">
              <strong className="block font-display text-lg font-semibold">{s.title}</strong>
              <span className="text-ink-soft">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-center font-display text-lg italic text-ink">Seven questions. One daily journey.</p>
      <button onClick={onDone} className="btn-ink btn-lg mt-5 w-full" data-autofocus>{doneLabel}</button>
    </div>
  );
}
