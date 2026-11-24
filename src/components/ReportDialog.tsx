import { useEffect, useState } from 'react';
import type { RuntimeQuestion } from '../game/types';
import { usePlayer } from '../state/PlayerContext';
import { Modal } from './ui';

const field = 'mt-1 w-full rounded-xl border border-ink/25 bg-cream/70 px-3 py-2.5 text-ink outline-none placeholder:text-ink/40 focus:border-gold-deep';

export function ReportDialog({ q, submitted, open, onClose }: { q: RuntimeQuestion | null; submitted: string; open: boolean; onClose: () => void }) {
  const { addReport } = usePlayer();
  const [typed, setTyped] = useState(submitted);
  const [proposed, setProposed] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) { setTyped(submitted); setProposed(''); setNote(''); setSent(false); }
  }, [open, submitted]);

  if (!q) return null;
  return (
    <Modal open={open} onClose={onClose} title="Report an answer">
      {sent ? (
        <div className="space-y-4 text-ink">
          <p className="text-ink-soft">Noted in your field journal. Reports are kept on this device (Settings → Field reports) as <span className="font-mono">PENDING</span> so the board can be reviewed — scores already earned never change.</p>
          <button className="btn-ink w-full" onClick={onClose}>Back to the journey</button>
        </div>
      ) : (
        <form
          className="space-y-4 text-ink"
          onSubmit={(e) => {
            e.preventDefault();
            addReport({ questionId: q.def.id, questionVersion: q.def.version, submitted: typed.trim(), proposed: proposed.trim(), note: note.trim() });
            setSent(true);
          }}
        >
          <p className="text-sm text-ink-soft">Think an answer deserves a place on the board — or a different tier? Tell the cartographers.</p>
          <div className="rounded-xl bg-ink/5 p-3 font-display text-lg italic">{q.def.prompt}</div>
          <label className="block text-sm font-semibold">Your answer
            <input value={typed} onChange={(e) => setTyped(e.target.value)} required className={field} />
          </label>
          <label className="block text-sm font-semibold">What should happen?
            <input value={proposed} onChange={(e) => setProposed(e.target.value)} placeholder="e.g. accept it, rank it higher, it's a typo of…" className={field} />
          </label>
          <label className="block text-sm font-semibold">Why (optional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={field} />
          </label>
          <button type="submit" className="btn-ink w-full">Send report</button>
        </form>
      )}
    </Modal>
  );
}
