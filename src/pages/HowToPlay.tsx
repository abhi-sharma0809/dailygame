import { TIER_COLORS } from '../game/scoring';
import { TIER_LABEL, TIER_ORDER, TIER_POINTS } from '../game/types';

export function HowToPlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-5 text-[15px] leading-relaxed text-ink">
      <ol className="space-y-3">
        {[
          ['Read the reference', 'A panda, Friends, pizza, Japan… Each question names one thing.'],
          ['Name what’s most like it', 'Type the closest thing you can think of. No options are given — twenty seconds, and wrong guesses don’t end the round.'],
          ['Watch the connection', 'Your answer is judged against a curated board of related things. Closer relationships score more, and your explorer travels further across the Atlas.'],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-display text-gold">{['I', 'II', 'III'][i]}</span>
            <span><strong className="font-display text-lg">{t}.</strong> <span className="text-ink-soft">{d}</span></span>
          </li>
        ))}
      </ol>
      <div className="rounded-2xl bg-ink/[0.05] p-4">
        <div className="eyebrow mb-2 text-[10px] text-ink-soft">The tiers</div>
        <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {TIER_ORDER.map((t) => (
            <div key={t} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ background: TIER_COLORS[t] }} />
              <span className="font-semibold">{TIER_LABEL[t]}</span>
              <span className="readout ml-auto text-ink-soft">{TIER_POINTS[t]}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm sm:col-span-2">
            <span className="h-3 w-3 rounded-full border border-dashed border-ink/50" />
            <span className="font-semibold">Unranked Connection</span>
            <span className="text-ink-soft">— a valid answer that isn’t on the board yet</span>
            <span className="readout ml-auto text-ink-soft">30</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-ink-soft">Every 100 points carries your explorer to the next destination; 600 reaches The Summit. The obvious answer isn’t always the best — look for the strongest connection.</p>
      <button onClick={onStart} className="btn-ink w-full" data-autofocus>Begin</button>
    </div>
  );
}
