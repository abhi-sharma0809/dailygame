/**
 * Original, synthesized sound effects (Web Audio API — no samples).
 * Everything is optional: if audio is unavailable or disabled, calls are no-ops.
 */
type Sfx = 'click' | 'lock' | 'reject' | 'sweep' | 'calc' | 'acquire' | 'reveal' | 'achievement' | 'tick' | 'miss' | 'skip' | 'connect' | 'travel';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (master) master.gain.value = on ? 0.55 : 0;
}

function audio(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; glide?: number; attack?: number } = {}) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (opts.glide) o.frequency.exponentialRampToValueAtTime(opts.glide, t + dur);
  const peak = opts.gain ?? 0.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, opts: { from: number; to: number; gain?: number; delay?: number; q?: number }) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + (opts.delay ?? 0);
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = opts.q ?? 4;
  f.frequency.setValueAtTime(opts.from, t);
  f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.15, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function play(s: Sfx, intensity = 0) {
  switch (s) {
    case 'click':
      return tone(1320, 0.05, { type: 'triangle', gain: 0.05 });
    case 'connect':
      // a glassy run of chimes as the connection line travels
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5, { type: 'sine', gain: 0.06, delay: i * 0.16 }));
      return;
    case 'travel':
      return noise(1.4, { from: 250, to: 900, gain: 0.05, q: 2 });
    case 'tick':
      return tone(660, 0.07, { type: 'triangle', gain: 0.06 });
    case 'skip':
      return tone(420, 0.12, { type: 'triangle', gain: 0.08, glide: 260 });
    case 'reject':
      tone(220, 0.09, { type: 'square', gain: 0.06 });
      return tone(180, 0.12, { type: 'square', gain: 0.06, delay: 0.09 });
    case 'lock':
      tone(520, 0.08, { type: 'triangle', gain: 0.14 });
      return tone(1040, 0.14, { type: 'triangle', gain: 0.12, delay: 0.07 });
    case 'sweep':
      return noise(1.2, { from: 300, to: 2400, gain: 0.07, q: 6 });
    case 'calc':
      for (let i = 0; i < 9; i++) tone(1200 + ((i * 337) % 900), 0.03, { type: 'square', gain: 0.025, delay: i * 0.075 });
      return;
    case 'acquire':
      return tone(300, 0.5, { type: 'sawtooth', gain: 0.05, glide: 1500, attack: 0.05 });
    case 'miss':
      return tone(330, 0.5, { type: 'sine', gain: 0.1, glide: 200 });
    case 'reveal': {
      // brighter, fuller chord for better tiers (intensity 0–5)
      const base = [261.63, 329.63, 392, 523.25, 659.25, 783.99];
      const n = 2 + Math.round(intensity * 0.8);
      base.slice(0, n).forEach((f, i) => tone(f, 0.7 + intensity * 0.08, { type: i % 2 ? 'triangle' : 'sine', gain: 0.07, delay: i * 0.05 }));
      if (intensity >= 5) noise(0.8, { from: 4000, to: 9000, gain: 0.05, delay: 0.1 });
      return;
    }
    case 'achievement':
      [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.09, delay: i * 0.09 }));
      return;
  }
}

/* Create the audio graph on the first user gesture rather than at the first
 * sound — otherwise the first countdown tick (5 s left) pays for AudioContext
 * start-up in the middle of the most time-critical animation. */
if (typeof window !== 'undefined') {
  const prime = () => { audio(); window.removeEventListener('pointerdown', prime, true); window.removeEventListener('keydown', prime, true); };
  window.addEventListener('pointerdown', prime, true);
  window.addEventListener('keydown', prime, true);
}
