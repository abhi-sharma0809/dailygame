import { describe, expect, it } from 'vitest';
import { JourneyEngine } from '../src/components/Journey/engine';
import { TRAVEL_STYLES, progressAt, styleForTier } from '../src/components/Journey/motion';
import { scoreToX } from '../src/components/Journey/world';
import { TIER_ORDER, TIER_POINTS, type ResultTier } from '../src/game/types';

/** Drive an engine with a fake clock; returns every x it visited. */
function rig(startScore = 0) {
  const e = new JourneyEngine(scoreToX(startScore), false);
  let now = 1000;
  e.clock = () => now;
  e.tick(now);
  const xs: number[] = [];
  const events: string[] = [];
  e.onLaunch = (s, moving) => events.push(`launch:${s.key}:${moving}`);
  e.onArrive = () => events.push('arrive');
  e.onSettle = () => events.push('settle');
  const run = async (ms: number, step = 16) => {
    for (let t = 0; t < ms; t += step) { now += step; e.tick(now); xs.push(e.frame.ex); }
    await Promise.resolve();
  };
  return { e, xs, events, run };
}

const nonDecreasing = (xs: number[]) => xs.every((x, i) => i === 0 || x >= xs[i - 1] - 1e-9);

describe('travel styles', () => {
  it('stronger tiers launch harder, glow brighter and leave longer trails', () => {
    const order: ResultTier[] = [...TIER_ORDER, 'none'];
    for (let i = 1; i < order.length; i++) {
      const a = TRAVEL_STYLES[order[i - 1]], b = TRAVEL_STYLES[order[i]];
      expect(a.power).toBeGreaterThan(b.power);
      expect(a.trail).toBeGreaterThanOrEqual(b.trail);
      // lower accel = a sharper burst off the line ('none' never flies)
      if (b.key !== 'none') expect(a.accel).toBeLessThanOrEqual(b.accel);
    }
    expect(TRAVEL_STYLES.perfect.burst).toBeGreaterThan(0);
    expect(TRAVEL_STYLES.loose.burst).toBe(0);
  });
  it('every velocity curve covers the distance exactly and never goes backwards', () => {
    for (const s of Object.values(TRAVEL_STYLES)) {
      let prev = 0;
      for (let u = 0; u <= 1.0001; u += 0.01) { const p = progressAt(s, u); expect(p).toBeGreaterThanOrEqual(prev - 1e-12); prev = p; }
      expect(progressAt(s, 0)).toBe(0);
      expect(progressAt(s, 1)).toBe(1);
    }
  });
});

describe('journey engine', () => {
  it('winds up in place, then flies forward and lands exactly on the score', async () => {
    const { e, xs, events, run } = rig(0);
    e.travelTo(scoreToX(100), styleForTier('perfect'));
    await run(TRAVEL_STYLES.perfect.charge - 40);
    expect(e.frame.phase).toBe('charge');
    expect(e.frame.ex).toBe(scoreToX(0)); // holds position while charging
    await run(6000);
    expect(nonDecreasing(xs)).toBe(true);
    expect(e.frame.ex).toBe(scoreToX(100));
    expect(e.frame.phase).toBe('idle');
    expect(events).toEqual(['launch:perfect:true', 'arrive', 'settle']);
  });

  it('a perfect answer accelerates harder than a loose one', async () => {
    const top = async (tier: ResultTier) => {
      const { e, run } = rig(0);
      e.travelTo(scoreToX(TIER_POINTS[tier as keyof typeof TIER_POINTS]), styleForTier(tier));
      let peak = 0;
      for (let i = 0; i < 300; i++) { await run(16, 16); peak = Math.max(peak, e.frame.vx); }
      return peak;
    };
    expect(await top('perfect')).toBeGreaterThan((await top('loose')) * 2);
  });

  it('chains a travel requested mid-flight instead of overlapping or jumping', async () => {
    const { e, xs, events, run } = rig(0);
    e.travelTo(scoreToX(80), styleForTier('family'));
    await run(1200);
    const mid = e.frame.ex;
    expect(mid).toBeGreaterThan(scoreToX(0));
    expect(mid).toBeLessThan(scoreToX(80));
    e.travelTo(scoreToX(145), styleForTier('close'));
    await run(8000);
    expect(nonDecreasing(xs)).toBe(true);
    expect(e.frame.ex).toBe(scoreToX(145));
    expect(events.filter((x) => x === 'settle')).toHaveLength(1);
  });

  it('a miss sputters in place and still ends the sequence', async () => {
    const { e, events, run } = rig(200);
    e.travelTo(scoreToX(200), styleForTier('none'));
    await run(1500);
    expect(e.frame.ex).toBe(scoreToX(200));
    expect(events).toEqual(['launch:none:false', 'settle']);
  });

  it('after seven answers the ship rests exactly at the accumulated score', async () => {
    const tiers: ResultTier[] = ['perfect', 'none', 'close', 'unranked', 'family', 'distant', 'nearly'];
    const pts = (t: ResultTier) => (t === 'none' ? 0 : t === 'unranked' ? 30 : TIER_POINTS[t]);
    const { e, xs, run } = rig(0);
    let total = 0;
    for (const [i, t] of tiers.entries()) {
      total += pts(t);
      e.travelTo(scoreToX(total), styleForTier(t));
      await run(i % 2 ? 600 : 5000); // some answers arrive while the ship is still flying
    }
    await run(9000);
    expect(total).toBe(100 + 0 + 65 + 30 + 80 + 45 + 90);
    expect(e.frame.ex).toBe(scoreToX(total));
    expect(nonDecreasing(xs)).toBe(true);
  });

  it('reduced motion jumps straight to the destination', async () => {
    const e = new JourneyEngine(scoreToX(0), true);
    const ev: string[] = [];
    e.onSettle = () => ev.push('settle');
    e.travelTo(scoreToX(90), styleForTier('nearly'));
    await Promise.resolve();
    expect(e.frame.ex).toBe(scoreToX(90));
    expect(ev).toEqual(['settle']);
  });
});

describe('connection thread looks', () => {
  it('weaker connections are longer, thinner, slower, dimmer and more winding', async () => {
    const { CONNECTION_LOOKS } = await import('../src/components/connection');
    const order: ResultTier[] = [...TIER_ORDER];
    for (let i = 1; i < order.length; i++) {
      const a = CONNECTION_LOOKS[order[i - 1]], b = CONNECTION_LOOKS[order[i]];
      expect(b.gap).toBeGreaterThan(a.gap);
      expect(b.width).toBeLessThan(a.width);
      expect(b.draw).toBeGreaterThan(a.draw);
      expect(b.glow).toBeLessThan(a.glow);
      expect(b.bends).toBeGreaterThanOrEqual(a.bends);
      expect(b.particles).toBeLessThanOrEqual(a.particles);
    }
    expect(CONNECTION_LOOKS.perfect.bends).toBe(0); // direct
    expect(CONNECTION_LOOKS.none.reach).toBeLessThan(1); // never arrives
  });
});
