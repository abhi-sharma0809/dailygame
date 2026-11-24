import type { SessionSummary } from '../game/persistence/store';
import { destinationFor } from '../game/progression';
import { TIER_COLORS } from '../game/scoring';
import { dayNumber } from '../game/selection';

/**
 * Renders a 1080×1350 share card: the live Atlas illustration on top, a
 * parchment plate with the score below. Shows no questions or answers.
 */
export async function renderShareCard(s: SessionSummary, mapSvg: SVGSVGElement | null): Promise<Blob | null> {
  const Wd = 1080, Ht = 1350;
  const c = document.createElement('canvas');
  c.width = Wd; c.height = Ht;
  const g = c.getContext('2d');
  if (!g) return null;
  try { await document.fonts?.ready; } catch { /* ignore */ }

  g.fillStyle = '#101923';
  g.fillRect(0, 0, Wd, Ht);

  // the illustrated map
  if (mapSvg) {
    try {
      const clone = mapSvg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('viewBox', '0 0 1600 1000');
      clone.setAttribute('width', '1600');
      clone.setAttribute('height', '1000');
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      g.drawImage(img, 0, 0, 1600, 1000, -90, 0, 1260, 788);
      URL.revokeObjectURL(url);
    } catch { /* the plate still renders without the map */ }
  }
  const fade = g.createLinearGradient(0, 560, 0, 800);
  fade.addColorStop(0, 'rgba(16,25,35,0)');
  fade.addColorStop(1, 'rgba(16,25,35,1)');
  g.fillStyle = fade;
  g.fillRect(0, 560, Wd, 240);

  // parchment plate
  const px = 70, py = 700, pw = Wd - 140, ph = 580;
  g.fillStyle = '#F0E6D1';
  g.beginPath(); g.roundRect?.(px, py, pw, ph, 28); g.fill();
  g.strokeStyle = 'rgba(38,50,58,.25)'; g.lineWidth = 2;
  g.beginPath(); g.roundRect?.(px + 12, py + 12, pw - 24, ph - 24, 20); g.stroke();

  g.textAlign = 'center';
  g.fillStyle = '#B4843C';
  g.font = '700 26px "DM Sans", sans-serif';
  const title = s.mode === 'daily' && s.dateKey ? `KINSHIP — DAILY JOURNEY #${dayNumber(s.dateKey) + 1}` : `KINSHIP — ${s.label.toUpperCase()}`;
  g.fillText(title.split('').join(String.fromCharCode(8202)), Wd / 2, py + 80);

  g.fillStyle = '#26323A';
  g.font = '600 170px Fraunces, Georgia, serif';
  g.fillText(String(s.total), Wd / 2 - 70, py + 270);
  g.fillStyle = '#4A5761';
  g.font = '500 60px Fraunces, Georgia, serif';
  g.textAlign = 'left';
  const w = g.measureText(String(s.total)).width;
  g.font = '600 170px Fraunces, Georgia, serif';
  const bw = g.measureText(String(s.total)).width;
  void w;
  g.font = '500 60px Fraunces, Georgia, serif';
  g.fillText(`/ ${s.maxTotal}`, Wd / 2 - 70 + bw / 2 + 14, py + 270);

  g.textAlign = 'center';
  g.font = 'italic 600 44px Fraunces, Georgia, serif';
  g.fillStyle = '#26323A';
  g.fillText(`Reached ${destinationFor(s.total, s.rounds.length).name}`, Wd / 2, py + 350);

  const perfect = s.rounds.filter((r) => r.tier === 'perfect').length;
  if (perfect) {
    g.font = '700 30px "DM Sans", sans-serif';
    g.fillStyle = '#B4843C';
    g.fillText(`${perfect} PERFECT CONNECTION${perfect === 1 ? '' : 'S'}`, Wd / 2, py + 410);
  }

  // seven tier gems
  const n = s.rounds.length, gem = 40, gap = 22, tw = n * gem + (n - 1) * gap;
  s.rounds.forEach((r, i) => {
    const x = Wd / 2 - tw / 2 + i * (gem + gap) + gem / 2;
    const y = py + 470;
    g.save();
    g.translate(x, y); g.rotate(Math.PI / 4);
    g.fillStyle = TIER_COLORS[r.tier];
    g.fillRect(-gem / 2.8, -gem / 2.8, gem / 1.4, gem / 1.4);
    g.strokeStyle = '#26323A'; g.lineWidth = 2; g.strokeRect(-gem / 2.8, -gem / 2.8, gem / 1.4, gem / 1.4);
    g.restore();
  });
  g.font = 'italic 500 30px Fraunces, Georgia, serif';
  g.fillStyle = '#4A5761';
  g.fillText('Can you find the same connections?', Wd / 2, py + 545);

  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
