import { BANK_VERSION } from '../data/atlas';
import { usePlayer } from '../state/PlayerContext';
import { Modal } from './ui';

/** Sound and motion — a dialog over the home screen, not a destination. */
export function SettingsDialog({ open, onClose, onHowToPlay }: { open: boolean; onClose: () => void; onHowToPlay: () => void }) {
  const { settings, updateSettings } = usePlayer();

  return (
    <Modal open={open} onClose={onClose} title="Settings">
        <div className="divide-y divide-ink/10 text-ink">
          <Row label="Sound">
            <Toggle on={settings.sound} onChange={(v) => updateSettings({ sound: v })} label="Sound" />
          </Row>
          <Row label="Motion">
            <div className="inline-flex gap-2.5 pr-0.5" role="radiogroup" aria-label="Motion">
              {(['system', 'reduced', 'full'] as const).map((m) => (
                <button key={m} role="radio" aria-checked={settings.motion === m} onClick={() => updateSettings({ motion: m })} className="btn-paper btn-xs capitalize">{m}</button>
              ))}
            </div>
          </Row>
          <div className="flex flex-wrap gap-x-4 gap-y-4 px-0.5 pb-1 pt-5">
            <button onClick={onHowToPlay} className="btn-paper btn-sm">How to play</button>
          </div>
          <p className="mt-4 border-0 text-xs leading-relaxed text-ink-soft">Progress is saved in this browser. Boards {BANK_VERSION}.</p>
        </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-3"><span className="font-semibold">{label}</span>{children}</div>;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="px-switch mr-0.5">
      <span />
    </button>
  );
}
