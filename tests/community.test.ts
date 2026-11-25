import { describe, expect, it } from 'vitest';
import { SIMULATED_EXPLORERS_MAX, SIMULATED_EXPLORERS_MIN, dailyExplorerCount } from '../src/game/community';

const days = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10));

describe('simulated daily explorer count', () => {
  it('is stable for the same quest', () => {
    expect(dailyExplorerCount('2026-11-25')).toBe(dailyExplorerCount('2026-11-25'));
  });
  it('stays within 15,000–30,000 across years of quests', () => {
    for (const d of days(3650)) {
      const n = dailyExplorerCount(d);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(SIMULATED_EXPLORERS_MIN);
      expect(n).toBeLessThanOrEqual(SIMULATED_EXPLORERS_MAX);
    }
  });
  it('differs from day to day', () => {
    const ds = days(365);
    const counts = ds.map(dailyExplorerCount);
    expect(new Set(counts).size).toBeGreaterThan(355);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).not.toBe(counts[i - 1]);
  });
});
