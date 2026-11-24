import { useEffect, useMemo, useState } from 'react';
import { PageShell } from '../components/ui';
import { ATLAS } from '../data/atlas';
import { serializeBoardFile } from '../game/atlas/format';
import { validateQuestion } from '../game/atlas/validate';
import { clearQuestionCache } from '../game/engine/questions';
import { TIER_LABEL, TIER_ORDER, TIER_POINTS, type BoardEntry, type QuestionDef, type TierId } from '../game/types';
import { usePlayer } from '../state/PlayerContext';

/* Development-only board editor. Writes to src/data/atlas/boards/*.txt via the
 * dev server (see vite.config.ts); Vite then hot-reloads the atlas. */

const clone = (q: QuestionDef): QuestionDef => JSON.parse(JSON.stringify(q));
const input = 'w-full rounded-lg border border-ink/20 bg-cream/80 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold-deep';

export function EditorPage() {
  const { data } = usePlayer();
  const [selId, setSelId] = useState(ATLAS.questions[0]?.id);
  const [filter, setFilter] = useState('');
  const original = ATLAS.byId.get(selId ?? '');
  const [draft, setDraft] = useState<QuestionDef | null>(original ? clone(original) : null);
  const [status, setStatus] = useState('');
  useEffect(() => { if (original) setDraft(clone(original)); setStatus(''); }, [selId, original]);

  const issues = useMemo(() => {
    if (!draft) return [];
    clearQuestionCache();
    return validateQuestion({ ...draft, board: draft.board.map((b) => ({ ...b })) }, ATLAS);
  }, [draft]);
  const dirty = !!draft && !!original && JSON.stringify(draft) !== JSON.stringify(original);
  const unranked = data.unranked.filter((u) => u.questionId === selId);
  const reports = data.reports.filter((r) => r.questionId === selId);

  const list = ATLAS.questions.filter((q) => `${q.id} ${q.prompt}`.toLowerCase().includes(filter.toLowerCase()));
  const set = (patch: Partial<QuestionDef>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const setEntry = (i: number, patch: Partial<BoardEntry>) => setDraft((d) => (d ? { ...d, board: d.board.map((b, j) => (j === i ? { ...b, ...patch } : b)) } : d));

  const save = async () => {
    if (!draft) return;
    const file = ATLAS.boards[draft.category];
    const content = serializeBoardFile({ ...file, questions: file.questions.map((q) => (q.id === draft.id ? { ...draft, version: dirty ? draft.version + 1 : draft.version } : q)) });
    setStatus('Saving…');
    const res = await fetch('/__kinship/save-board', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category: draft.category, content }) });
    setStatus(res.ok ? 'Saved — the game will hot-reload with the new board (version bumped).' : `Save failed: ${await res.text()}`);
  };

  if (!import.meta.env.DEV) return <PageShell title="Editor"><p className="mt-20 text-center text-cream/70">The board editor is only available in development (npm run dev).</p></PageShell>;

  return (
    <PageShell title="Board editor" wide>
      <div className="mt-6 grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="slate max-h-[80vh] overflow-y-auto p-3 scrollbar-thin">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter questions…" className="mb-2 w-full rounded-lg border border-cream/20 bg-night px-3 py-2 text-sm outline-none focus:border-gold" />
          {ATLAS.categories.map((c) => (
            <div key={c.id} className="mb-3">
              <div className="eyebrow px-2 text-[10px] text-cream/45">{c.label}</div>
              {list.filter((q) => q.category === c.id).map((q) => (
                <button key={q.id} onClick={() => setSelId(q.id)} className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm ${q.id === selId ? 'bg-gold text-ink' : 'text-cream/80 hover:bg-cream/5'}`}>{q.ref} <span className="opacity-60">· {q.board.length}</span></button>
              ))}
            </div>
          ))}
        </aside>

        {draft && (
          <section className="paper p-5 text-ink sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="font-mono text-xs text-ink-soft">{draft.id} · v{draft.version} · universe {draft.universe}</div><h2 className="font-display text-2xl font-semibold">{draft.prompt}</h2></div>
              <div className="flex gap-2">
                <button onClick={() => original && setDraft(clone(original))} disabled={!dirty} className="btn border border-ink/25 py-2 text-sm text-ink">Revert</button>
                <button onClick={save} disabled={!dirty || issues.some((i) => i.severity === 'error')} className="btn-ink py-2 text-sm">Save to board file</button>
              </div>
            </div>
            {status && <p className="mt-2 text-sm text-ink-soft">{status}</p>}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">Prompt<input className={input} value={draft.prompt} onChange={(e) => set({ prompt: e.target.value })} /></label>
              <label className="text-xs font-semibold">Reference entity<input className={input} value={draft.ref} onChange={(e) => set({ ref: e.target.value })} /></label>
              <label className="text-xs font-semibold sm:col-span-2">Player-facing interpretation<input className={input} value={draft.hint} onChange={(e) => set({ hint: e.target.value })} /></label>
              <label className="text-xs font-semibold">Similarity dimensions (comma-separated)<input className={input} value={draft.dims.join(', ')} onChange={(e) => set({ dims: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></label>
              <label className="text-xs font-semibold">Excluded as “the same thing”<input className={input} value={draft.exclude.join(', ')} onChange={(e) => set({ exclude: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></label>
              <label className="text-xs font-semibold">Difficulty
                <select className={input} value={draft.difficulty} onChange={(e) => set({ difficulty: e.target.value as QuestionDef['difficulty'] })}>{['easy', 'medium', 'hard'].map((d) => <option key={d}>{d}</option>)}</select>
              </label>
              <label className="text-xs font-semibold">Accepted tags (valid-but-unranked filter)<input className={input} value={draft.accept.join(' ')} onChange={(e) => set({ accept: e.target.value.split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean) })} /></label>
              <label className="text-xs font-semibold sm:col-span-2">Board rationale<textarea rows={2} className={input} value={draft.rationale} onChange={(e) => set({ rationale: e.target.value })} /></label>
              <label className="text-xs font-semibold sm:col-span-2">Source / review notes<input className={input} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
            </div>

            <h3 className="mt-6 font-display text-xl font-semibold">Ranked answers</h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="text-left text-xs text-ink-soft"><th className="py-1">Tier</th><th>Canonical name</th><th>Extra aliases</th><th title="Obvious first-thought answer">Obv.</th><th>Why</th><th /></tr></thead>
                <tbody>
                  {draft.board.map((b, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-1 pr-2"><select className={input} value={b.tier} onChange={(e) => setEntry(i, { tier: e.target.value as TierId })}>{TIER_ORDER.map((t) => <option key={t} value={t}>{TIER_POINTS[t]} {TIER_LABEL[t]}</option>)}</select></td>
                      <td className="pr-2"><input className={input} value={b.name} onChange={(e) => setEntry(i, { name: e.target.value })} /></td>
                      <td className="pr-2"><input className={input} value={b.aliases.join('; ')} onChange={(e) => setEntry(i, { aliases: e.target.value.split(';').map((s) => s.trim()).filter(Boolean) })} /></td>
                      <td className="pr-2 text-center"><input type="checkbox" checked={b.obvious} onChange={(e) => setEntry(i, { obvious: e.target.checked })} /></td>
                      <td className="pr-2"><input className={input} value={b.why} onChange={(e) => setEntry(i, { why: e.target.value })} /></td>
                      <td><button onClick={() => setDraft((d) => (d ? { ...d, board: d.board.filter((_, j) => j !== i) } : d))} className="px-2 text-ink-soft hover:text-ember" aria-label={`Remove ${b.name}`}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => set({ board: [...draft.board, { name: '', aliases: [], tier: 'loose', why: '', obvious: false }] })} className="btn-text mt-2 text-ink">+ Add answer</button>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-display text-lg font-semibold">Validation</h3>
                {issues.length ? <ul className="mt-1 space-y-1 text-sm">{issues.map((i, k) => <li key={k} className={i.severity === 'error' ? 'text-ember' : 'text-ink-soft'}>{i.severity === 'error' ? '✗' : '⚠'} {i.message}</li>)}</ul> : <p className="mt-1 text-sm text-ink-soft">No issues.</p>}
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">Unranked answers players gave</h3>
                {unranked.length ? (
                  <ul className="mt-1 space-y-1 text-sm">{[...new Set(unranked.map((u) => u.name))].map((n) => (
                    <li key={n} className="flex items-center justify-between gap-2">{n}<button onClick={() => set({ board: [...draft.board, { name: n, aliases: [], tier: 'loose', why: 'Added from player submissions — review tier and reason', obvious: false }] })} className="text-xs font-semibold text-gold-deep">Add to board</button></li>
                  ))}</ul>
                ) : <p className="mt-1 text-sm text-ink-soft">None recorded on this device yet.</p>}
                {reports.length > 0 && <><h3 className="mt-3 font-display text-lg font-semibold">Reports</h3><ul className="text-sm">{reports.map((r) => <li key={r.id}>“{r.submitted}” → {r.proposed || '—'} <span className="text-ink-soft">{r.note}</span></li>)}</ul></>}
              </div>
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}
