import { useState } from 'react';
import { Modal, PageShell, SectionTitle, Stat } from '../components/ui';
import { LANDMARKS } from '../components/WorldMap/geometry';
import { WorldMap } from '../components/WorldMap/WorldMap';
import { BANK_VERSION, CATEGORIES, QUESTION_BY_ID, QUESTIONS } from '../data/atlas';
import { ACHIEVEMENTS, computeStats, decodeChallenge } from '../game/progression';
import { TIER_COLORS } from '../game/scoring';
import { EPOCH, EXPEDITIONS, addDays, dayNumber, expeditionSessionCount } from '../game/selection';
import { TIER_LABEL, TIER_ORDER, type CategoryId } from '../game/types';
import { navigate } from '../hooks/useHashRoute';
import { usePlayer } from '../state/PlayerContext';

/* ============================================================ FIELD JOURNAL */

export function StatsPage() {
  const { data, today } = usePlayer();
  const st = computeStats(data, today);
  const [showAll, setShowAll] = useState(false);
  const maxTier = Math.max(1, ...TIER_ORDER.map((t) => st.tierCounts[t]), st.tierCounts.unranked);
  const recent = data.sessions.filter((s) => s.mode !== 'endless' && s.mode !== 'practice').slice(-20);
  const best = st.bestQuestion ? QUESTION_BY_ID.get(st.bestQuestion.questionId) : null;
  return (
    <PageShell title="Field Journal">
      <SectionTitle eyebrow="Field Journal" sub="Every journey you’ve taken, written down.">Your travels</SectionTitle>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Journeys" value={st.journeys} sub={`${st.dailies} daily`} />
        <Stat label="Daily streak" value={st.streak.current} sub={`best ${st.streak.best}`} accent />
        <Stat label="Personal best" value={st.personalBest || '—'} sub="of 700" accent />
        <Stat label="Average journey" value={st.averageJourney ? Math.round(st.averageJourney) : '—'} sub="per seven rounds" />
        <Stat label="Total points" value={st.totalPoints.toLocaleString()} />
        <Stat label="Perfect matches" value={st.perfectMatches} />
        <Stat label="Questions answered" value={st.answered} sub={`avg ${st.averageRound.toFixed(1)} per round`} />
        <Stat label="Best question" value={st.bestQuestion ? st.bestQuestion.points : '—'} sub={best ? `${best.ref} → ${st.bestQuestion?.entityName}` : undefined} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="slate p-5">
          <div className="eyebrow text-cream/55">Journey scores</div>
          {recent.length ? (
            <svg viewBox="0 0 300 110" className="mt-3 w-full" role="img" aria-label="Recent journey scores">
              {[100, 200, 300, 400, 500, 600].map((y) => <line key={y} x1="0" x2="300" y1={105 - y / 7} y2={105 - y / 7} stroke="#F0E6D1" strokeOpacity="0.08" />)}
              <polyline fill="none" stroke="#D9AD63" strokeWidth="2" points={recent.map((s, i) => `${recent.length === 1 ? 150 : (i / (recent.length - 1)) * 292 + 4},${105 - (s.total / Math.max(1, s.rounds.length)) * 7 / 7}`).join(' ')} />
              {recent.map((s, i) => <circle key={s.id} cx={recent.length === 1 ? 150 : (i / (recent.length - 1)) * 292 + 4} cy={105 - (s.total / Math.max(1, s.rounds.length))} r="3" fill={s.mode === 'daily' ? '#ECCB8B' : '#89B7CE'}><title>{`${s.label}: ${s.total}`}</title></circle>)}
            </svg>
          ) : <p className="mt-3 text-sm text-cream/60">Finish a journey to start your chart.</p>}
        </section>
        <section className="slate p-5">
          <div className="eyebrow text-cream/55">Tiers earned</div>
          <div className="mt-3 space-y-2">
            {[...TIER_ORDER, 'unranked' as const].map((t) => (
              <div key={t} className="grid grid-cols-[9.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_COLORS[t] }} />{TIER_LABEL[t]}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-cream/10"><span className="block h-full rounded-full" style={{ width: `${(st.tierCounts[t] / maxTier) * 100}%`, background: TIER_COLORS[t] }} /></span>
                <span className="readout text-right">{st.tierCounts[t]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="slate mt-4 p-5">
        <div className="eyebrow text-cream/55">By category</div>
        <div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {st.categories.map((c) => (
            <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_7rem_3.5rem] items-center gap-3 text-sm">
              <span className="truncate">{c.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-cream/10"><span className="block h-full rounded-full bg-moss-light" style={{ width: `${c.avg}%` }} /></span>
              <span className="readout text-right text-cream/80">{c.count ? Math.round(c.avg) : '—'}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-4"><h2 className="font-display text-3xl font-semibold">Achievements</h2><span className="text-cream/50">{Object.keys(data.achievements).length}/{ACHIEVEMENTS.length}</span><div className="rule-ornament flex-1" /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const at = data.achievements[a.id];
            return (
              <div key={a.id} className={at ? 'paper flex items-center gap-3 p-4 text-ink' : 'slate flex items-center gap-3 p-4 opacity-70'}>
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-xl ${at ? 'bg-ink text-gold' : 'border border-cream/20 text-cream/40'}`}>{at ? a.glyph : '?'}</span>
                <span className="min-w-0">
                  <span className="block font-display text-lg font-semibold leading-tight">{a.title}</span>
                  <span className={`block text-xs ${at ? 'text-ink-soft' : 'text-cream/55'}`}>{a.description}</span>
                  {at && <span className="block text-[11px] italic text-gold-deep">Earned {new Date(at).toLocaleDateString()}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center gap-4"><h2 className="font-display text-3xl font-semibold">Answer history</h2><div className="rule-ornament flex-1" /></div>
        {st.history.length ? (
          <ul className="slate mt-4 divide-y divide-cream/10">
            {st.history.slice(0, showAll ? 200 : 15).map((h, i) => {
              const q = QUESTION_BY_ID.get(h.questionId);
              return (
                <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-cream/80">{q?.prompt ?? h.questionId}</span>
                    <span className="block truncate font-display italic">{h.entityName ? `→ ${h.entityName}` : '→ no answer'} <span className="not-italic text-cream/45">· {TIER_LABEL[h.tier]}</span></span>
                  </span>
                  <span className="readout" style={{ color: TIER_COLORS[h.tier] }}>{h.points}</span>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-3 text-cream/60">No answers yet.</p>}
        {st.history.length > 15 && <button onClick={() => setShowAll((v) => !v)} className="btn-text mt-2">{showAll ? 'Show fewer' : `Show all ${st.history.length}`}</button>}
      </section>
    </PageShell>
  );
}

/* ============================================================ ARCHIVE */

export function ArchivePage() {
  const { data, today } = usePlayer();
  const n = dayNumber(today);
  const days = Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(EPOCH, n - i));
  const archiveBest = (key: string) => Math.max(-1, ...data.sessions.filter((s) => s.mode === 'archive' && s.dateKey === key).map((s) => s.total));
  return (
    <PageShell title="Archive">
      <SectionTitle eyebrow="Archive" sub="Every daily journey since the atlas was drawn. Archive journeys are timed but don’t touch your streak.">Past journeys</SectionTitle>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {days.map((d) => {
          const daily = data.dailies[d];
          const best = archiveBest(d);
          const isToday = d === today;
          return (
            <button key={d} onClick={() => navigate(isToday ? (daily ? `/results/${daily.sessionId}` : '/play/daily') : `/play/archive/${d}`)} className="slate flex items-center justify-between gap-3 px-5 py-4 text-left transition hover:border-gold/50">
              <span>
                <span className="block font-display text-2xl font-semibold">No. {dayNumber(d) + 1}{isToday && <span className="ml-2 text-base italic text-gold">today</span>}</span>
                <span className="text-sm text-cream/60">{new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              </span>
              <span className="text-right">
                {daily ? <span className="readout text-xl text-gold">{daily.total}</span> : best >= 0 ? <span className="readout text-xl text-sky">{best}</span> : <span className="text-cream/40">→</span>}
                {(daily || best >= 0) && <span className="block text-[11px] text-cream/50">{daily ? 'daily' : 'archive best'}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </PageShell>
  );
}

/* ============================================================ PRACTICE */

export function PracticePage() {
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const count = QUESTIONS.filter((q) => cat === 'all' || q.category === cat).length;
  return (
    <PageShell title="Practice">
      <SectionTitle eyebrow="Practice" sub="No compass, no pressure. Every answer shows its board straight away, and you can retry any question.">Sharpen your eye</SectionTitle>
      <div className="paper paper-edge mt-6 p-6 text-ink sm:p-8">
        <div className="eyebrow text-[10px] text-ink-soft">Choose a region of the atlas</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[{ id: 'all' as const, label: 'Everywhere' }, ...CATEGORIES].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id as CategoryId | 'all')} aria-pressed={cat === c.id} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${cat === c.id ? 'border-ink bg-ink text-parchment' : 'border-ink/25 hover:border-ink/60'}`}>{c.label}</button>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <span className="font-display italic text-ink-soft">{count} questions to explore</span>
          <button onClick={() => navigate(`/play/practice?cat=${cat}&t=${Date.now().toString(36)}`)} className="btn-ink">Start practising →</button>
        </div>
      </div>
    </PageShell>
  );
}

/* ============================================================ EXPEDITIONS */

export function ExpeditionsPage() {
  const { data, reducedMotion } = usePlayer();
  return (
    <PageShell title="Expeditions" wide>
      <SectionTitle eyebrow="Themed expeditions" sub="Seven-question journeys through a single corner of the atlas. Timed like the daily; play them as often as you like.">Expeditions</SectionTitle>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {EXPEDITIONS.map((e) => {
          const n = expeditionSessionCount(e.id);
          const lm = LANDMARKS[e.landmark];
          return (
            <article key={e.id} className="slate overflow-hidden">
              <div className="relative h-36 overflow-hidden border-b border-cream/10">
                <WorldMap score={e.landmark * 100} view="follow" zoom={560} explorer={false} showLabels={false} reducedMotion={reducedMotion} className="h-full w-full" ariaLabel={`${e.title} — near ${lm.name}`} />
                <span className="absolute bottom-2 left-3 rounded-full bg-night/80 px-3 py-1 font-display text-sm italic">{lm.name}</span>
              </div>
              <div className="p-5">
                <h2 className="font-display text-2xl font-semibold">{e.title}</h2>
                <p className="text-sm text-cream/65">{e.tagline}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {Array.from({ length: n }, (_, i) => {
                    const best = Math.max(-1, ...data.sessions.filter((s) => s.expeditionId === e.id && s.expeditionSession === i).map((s) => s.total));
                    return (
                      <button key={i} onClick={() => navigate(`/play/expedition/${e.id}/${i}`)} className="rounded-xl border border-cream/20 px-4 py-2 text-left transition hover:border-gold/70">
                        <span className="block text-xs text-cream/55">Route {['I', 'II', 'III', 'IV', 'V'][i] ?? i + 1}</span>
                        <span className="readout text-sm">{best >= 0 ? <span className="text-gold">{best}</span> : 'Set out →'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </PageShell>
  );
}

/* ============================================================ CHALLENGE */

export function ChallengeLanding({ token }: { token: string }) {
  const p = decodeChallenge(token);
  const { reducedMotion } = usePlayer();
  if (!p) return <PageShell title="Challenge"><div className="py-24 text-center"><p className="text-cream/70">This challenge link is torn or out of date.</p><button onClick={() => navigate('/')} className="btn-gold mt-6">Back to the atlas</button></div></PageShell>;
  return (
    <PageShell title="Challenge">
      <div className="relative mx-auto mt-8 max-w-2xl overflow-hidden rounded-[22px] border border-cream/15">
        <WorldMap score={p.s ?? 0} reducedMotion={reducedMotion} className="block aspect-[16/10] w-full" ariaLabel="Where your friend's explorer landed" />
        <div className="paper paper-edge absolute inset-x-4 bottom-4 p-5 text-center text-ink sm:inset-x-12">
          <div className="eyebrow text-gold-deep">A sealed letter</div>
          <h1 className="font-display text-3xl font-semibold">{p.n ? `${p.n} challenges you` : 'You’ve been challenged'}</h1>
          {p.s != null && <p className="mt-1 text-ink-soft">Their explorer scored <span className="readout font-semibold text-ink">{p.s}</span> on these {p.q.length} questions.</p>}
          <button onClick={() => navigate(`/play/challenge/${token}`)} className="btn-ink mt-4">Accept the challenge →</button>
        </div>
      </div>
    </PageShell>
  );
}

/* ============================================================ SETTINGS */

export function SettingsPage() {
  const { settings, updateSettings, data, resetAll } = usePlayer();
  const [confirm, setConfirm] = useState(false);
  const download = (name: string, payload: unknown) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    a.download = name;
    a.click();
  };
  return (
    <PageShell title="Settings">
      <SectionTitle eyebrow="Settings">Provisions</SectionTitle>
      <div className="slate mt-6 divide-y divide-cream/10">
        <Row label="Sound" desc="Soft chimes and sweeps, synthesized in your browser."><Toggle on={settings.sound} onChange={(v) => updateSettings({ sound: v })} label="Sound" /></Row>
        <Row label="Motion" desc="Reduce animation. ‘System’ follows your device.">
          <div className="inline-flex rounded-full border border-cream/20 p-0.5" role="radiogroup" aria-label="Motion">
            {(['system', 'reduced', 'full'] as const).map((m) => <button key={m} role="radio" aria-checked={settings.motion === m} onClick={() => updateSettings({ motion: m })} className={`rounded-full px-3 py-1.5 text-sm capitalize ${settings.motion === m ? 'bg-cream text-ink' : 'text-cream/70'}`}>{m}</button>)}
          </div>
        </Row>
        <Row label="Explorer’s name" desc="Signs the challenge letters you send."><input value={settings.playerName} onChange={(e) => updateSettings({ playerName: e.target.value.slice(0, 24) })} placeholder="Anonymous" className="w-48 rounded-xl border border-cream/20 bg-night px-3 py-2 text-sm outline-none focus:border-gold" /></Row>
      </div>

      <section className="slate mt-6 p-5">
        <h2 className="font-display text-2xl font-semibold">Field reports</h2>
        <p className="mt-1 text-sm text-cream/60">{data.reports.length} report(s) and {data.unranked.length} unranked answer(s) collected on this device for the board editors.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => download('kinship-reports.json', { bank: BANK_VERSION, reports: data.reports })} disabled={!data.reports.length} className="btn-ghost">Export reports</button>
          <button onClick={() => download('kinship-unranked.json', { bank: BANK_VERSION, unranked: data.unranked })} disabled={!data.unranked.length} className="btn-ghost">Export unranked answers</button>
        </div>
        {data.reports.length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {[...data.reports].reverse().slice(0, 6).map((r) => <li key={r.id} className="rounded-xl bg-cream/5 px-3 py-2"><span className="text-cream/50">{r.questionId} · {r.status}</span><div>“{r.submitted}” {r.proposed && <>→ {r.proposed}</>}</div></li>)}
          </ul>
        )}
      </section>

      <section className="slate mt-6 p-5">
        <h2 className="font-display text-2xl font-semibold">How the boards work</h2>
        <p className="mt-2 text-sm leading-relaxed text-cream/75">Every question has a hand-curated similarity board ({QUESTIONS.length} boards, version {BANK_VERSION}). Each answer sits in a fixed tier with a written reason, judged on dimensions stated for that question. Valid answers that aren’t on a board yet earn an Unranked Connection (30) and are collected for review. Scores never come from an AI judgment and never change mid-game. Public figures are compared only on their public work and persona; countries only on stated traits like geography, language and history.</p>
        <p className="mt-2 text-xs text-cream/50">Type: Fraunces, DM Sans, IBM Plex Mono (SIL OFL). Country names: mledoze/countries (ODbL). Illustration and sound are original to KINSHIP.</p>
      </section>

      <section className="slate mt-6 p-5">
        <h2 className="font-display text-2xl font-semibold">Your journal</h2>
        <p className="mt-1 text-sm text-cream/60">Progress is stored in this browser. Erasing removes every journey, streak and achievement.</p>
        <button onClick={() => setConfirm(true)} className="btn-ghost mt-3 border-ember/50 text-ember hover:border-ember hover:text-ember">Erase journal</button>
      </section>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Erase your journal?">
        <p className="text-ink-soft">This permanently deletes every journey, streak, achievement and report on this device.</p>
        <div className="mt-5 flex gap-2">
          <button onClick={() => { resetAll(); setConfirm(false); navigate('/'); }} className="btn-ink flex-1" data-autofocus>Erase everything</button>
          <button onClick={() => setConfirm(false)} className="btn border border-ink/25 text-ink">Keep it</button>
        </div>
      </Modal>
    </PageShell>
  );
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">{label}</div><div className="text-sm text-cream/60">{desc}</div></div><div className="shrink-0">{children}</div></div>;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 rounded-full border transition ${on ? 'border-gold bg-gold/30' : 'border-cream/25 bg-night'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${on ? 'left-6 bg-gold' : 'left-0.5 bg-cream/50'}`} />
    </button>
  );
}
