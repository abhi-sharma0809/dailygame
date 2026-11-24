/**
 * End-to-end journey in real Chrome. Start a server first:
 *   npx vite preview --port 4173   (or dev)   then   npx vite-node scripts/e2e-journey.ts [outDir]
 * Plays today's daily through the UI with ranked, aliased, misspelled,
 * unranked, invalid-then-corrected, passed and timed-out answers; checks
 * persistence, one attempt per day, refresh-resume, mobile layout and the
 * other modes. Screenshots every stage.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { type Page } from 'puppeteer-core';
import { QUESTION_BY_ID } from '../src/data/atlas';
import { buildQuestion } from '../src/game/engine/questions';
import { encodeChallenge } from '../src/game/progression';
import { dailyQuestionIds, dateKey } from '../src/game/selection';

const URL = process.env.KINSHIP_URL ?? 'http://localhost:4173/';
const OUT = process.argv[2] ?? 'e2e-shots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok: boolean, msg: string) => { console.log(ok ? `  ✓ ${msg}` : `  ✗ ${msg}`); if (!ok) failures++; };
const shot = (p: Page, n: string) => p.screenshot({ path: path.join(OUT, `${n}.png`) as `${string}.png` });
const text = (p: Page) => p.evaluate(() => document.body.innerText);
const click = (p: Page, re: RegExp) => p.evaluate((src: string) => {
  const el = [...document.querySelectorAll('button, a')].find((b) => new RegExp(src, 'i').test((b as HTMLElement).innerText.trim()));
  (el as HTMLElement | undefined)?.click();
  return !!el;
}, re.source);

async function type(p: Page, v: string) {
  await p.waitForSelector('#answer:not([disabled])', { timeout: 15000 });
  await p.click('#answer', { clickCount: 3 });
  await p.keyboard.press('Backspace');
  await p.type('#answer', v, { delay: 12 });
  await p.keyboard.press('Enter');
  await sleep(300);
}
const waitReveal = (p: Page) => p.waitForFunction(() => /The board/.test(document.body.innerText), { timeout: 30000 });
async function next(p: Page) {
  await sleep(250);
  for (let i = 0; i < 4 && !(await p.$('#answer')) && !/Journey complete/.test(await text(p)); i++) { await p.keyboard.press('Enter'); await sleep(450); }
}

const today = dateKey();
const ids = dailyQuestionIds(today);
const qs = ids.map((id) => buildQuestion(QUESTION_BY_ID.get(id)!));

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await browser.newPage();
  const errors: string[] = [];
  p.on('pageerror', (e) => { errors.push(String(e)); console.log('  [pageerror]', String(e).slice(0, 200)); });
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle0' });
  await sleep(1200);
  await shot(p, '01-first-visit');
  check(/How to play/.test(await text(p)), 'first visit explains the game');
  await click(p, /^Begin$/);
  await sleep(2400);
  await shot(p, '02-home');
  check(/Start exploring/.test(await text(p)), 'home offers START EXPLORING');

  await click(p, /Start exploring/);
  await p.waitForSelector('#answer');
  await sleep(900);
  await shot(p, '03-question');
  console.log(`\n  Daily ${today}: ${ids.join(', ')}\n`);

  for (let i = 0; i < 7; i++) {
    const q = qs[i];
    const prompt = await p.$eval('h1', (h) => h.textContent ?? '');
    check(prompt.trim() === q.def.prompt, `round ${i + 1}: "${q.def.prompt}"`);
    const perfect = q.ranked[0].entity;
    const mid = q.ranked.find((r) => r.points === 65) ?? q.ranked[Math.floor(q.ranked.length / 2)];
    const unrankedEntity = q.universe.entities.find((e) => !q.rankedById.has(e.id) && e.id !== q.reference.id && !q.def.exclude.includes(e.name) && (!q.def.accept.length || e.tags.some((t) => q.def.accept.includes(t))));
    switch (i) {
      case 0: await type(p, perfect.name); break;
      case 1:
        await type(p, 'zzqx florp');
        check(/isn't in the Atlas|Try again/.test(await text(p)), 'invalid answer explained, round stays open');
        await shot(p, '04-invalid');
        await type(p, q.def.ref);
        check(/itself/.test(await text(p)), 'the reference itself is rejected');
        await type(p, mid.entity.name);
        break;
      case 2: {
        const n = perfect.name;
        const typo = n.length > 6 ? n.slice(0, 3) + n[4] + n[3] + n.slice(5) : n.toLowerCase();
        await type(p, typo);
        const t = await text(p);
        if (/Did you mean/.test(t)) { await shot(p, '05-did-you-mean'); await p.keyboard.press('Enter'); }
        else if (/Which one/.test(t)) await click(p, new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
        break;
      }
      case 3: await click(p, /^Pass this one/); break;
      case 4:
        await sleep(9000);
        await shot(p, '06-compass');
        await p.waitForFunction(() => /\b0[1-5]\b/.test((document.querySelector('[role=timer]') as HTMLElement)?.innerText ?? ''), { timeout: 20000 });
        await shot(p, '07-compass-urgent');
        break;
      case 5: await type(p, unrankedEntity?.name ?? mid.entity.name); break;
      default: await type(p, (perfect.aliases[0] ?? perfect.name)); break;
    }
    if (i === 0) { await sleep(700); await shot(p, '08-connection-drawing'); }
    await waitReveal(p);
    if (i === 0) { await sleep(2200); await shot(p, '09-reveal-perfect'); check(/Perfect Match/i.test(await text(p)), 'perfect answer → PERFECT MATCH'); }
    if (i === 1) { await sleep(2000); await shot(p, '10-reveal-mid'); }
    if (i === 3) check(/Passed/i.test(await text(p)), 'pass reveal shown');
    if (i === 4) { await sleep(1500); await shot(p, '11-reveal-timeout'); check(/compass ran out/i.test(await text(p)), 'timeout reveal shown'); }
    if (i === 5 && unrankedEntity) { await sleep(1800); await shot(p, '12-reveal-unranked'); check(/Unranked Connection/i.test(await text(p)), `valid-but-unranked "${unrankedEntity.name}" → UNRANKED CONNECTION`); }
    await next(p);
  }

  await p.waitForFunction(() => /Journey complete/.test(document.body.innerText), { timeout: 15000 });
  await sleep(5200);
  await shot(p, '13-results');
  await p.evaluate(() => window.scrollTo(0, 900));
  await sleep(500);
  await shot(p, '14-results-answers');
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('kinship:player') ?? '{}'));
  check(!!stored.dailies?.[today], 'daily attempt recorded');
  check(Object.keys(stored.achievements ?? {}).includes('first-connection'), 'FIRST CONNECTION earned');
  check(Object.keys(stored.achievements ?? {}).includes('perfect-pair'), 'PERFECT PAIR earned');
  check((stored.unranked ?? []).length >= 1, 'unranked answer saved for curation');
  console.log(`  • final score ${stored.dailies?.[today]?.total}`);

  await p.reload({ waitUntil: 'networkidle0' });
  await p.goto(URL + '#/', { waitUntil: 'networkidle0' });
  await sleep(1500);
  check(/View today’s journey/.test(await text(p)), 'after reload, home shows today is complete');
  await shot(p, '15-home-after');
  await p.goto(URL + '#/play/daily', { waitUntil: 'networkidle0' });
  await sleep(900);
  check(/Journey complete/.test(await text(p)), 'one daily attempt per day');
  await p.goto(URL + '#/stats', { waitUntil: 'networkidle0' });
  await sleep(900);
  await shot(p, '16-journal');
  check(/Answer history/.test(await text(p)), 'field journal shows answer history');

  // refresh mid-question
  await p.goto(URL + '#/play/archive/2026-11-16', { waitUntil: 'networkidle0' });
  await p.waitForSelector('#answer');
  const a1 = await p.$eval('h1', (h) => h.textContent);
  await sleep(3000);
  await p.reload({ waitUntil: 'networkidle0' });
  await p.waitForSelector('#answer');
  const a2 = await p.$eval('h1', (h) => h.textContent);
  const secs = await p.$eval('[role=timer]', (t) => Number((t as HTMLElement).innerText.trim()));
  check(a1 === a2, 'refresh resumes the same question');
  check(secs <= 17, `timer kept running across refresh (${secs}s left)`);

  // other modes
  await p.goto(URL + '#/expeditions', { waitUntil: 'networkidle0' }); await sleep(1500); await shot(p, '17-expeditions');
  check(/Wild Connections/.test(await text(p)), 'expeditions listed');
  await p.goto(URL + '#/practice', { waitUntil: 'networkidle0' }); await click(p, /^Movies$/); await click(p, /Start practising/);
  await p.waitForSelector('#answer'); check(/No\s*clock/i.test(await text(p)), 'practice is untimed');
  const pq = await p.$eval('h1', (h) => h.textContent ?? '');
  check(/movie/i.test(pq), 'practice honors category');
  await p.goto(URL + '#/play/endless', { waitUntil: 'networkidle0' }); await p.waitForSelector('#answer');
  await click(p, /^Pass this one/); await waitReveal(p); await next(p); await p.waitForSelector('#answer');
  await click(p, /^End journey$/); await sleep(1000);
  check(/Journey complete/.test(await text(p)), 'endless journey can be ended');
  const token = encodeChallenge({ q: dailyQuestionIds('2026-11-17'), s: 432, n: 'Sam' });
  await p.goto(URL + `#/c/${token}`, { waitUntil: 'networkidle0' }); await sleep(1500); await shot(p, '18-challenge');
  check(/Sam challenges you/.test(await text(p)), 'challenge letter');
  await p.goto(URL + '#/editor', { waitUntil: 'networkidle0' }); await sleep(800); await shot(p, '19-editor');

  // mobile
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(URL + '#/', { waitUntil: 'networkidle0' }); await sleep(1800); await shot(p, '20-mobile-home');
  await p.goto(URL + '#/play/archive/2026-11-17', { waitUntil: 'networkidle0' }); await p.waitForSelector('#answer'); await sleep(800); await shot(p, '21-mobile-question');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, `no horizontal scroll on mobile (${overflow}px)`);
  const mq = buildQuestion(QUESTION_BY_ID.get(dailyQuestionIds('2026-11-17')[0])!);
  await type(p, mq.ranked[1].entity.name); await waitReveal(p); await sleep(2600); await shot(p, '22-mobile-reveal');
  await p.evaluate(() => window.scrollTo(0, 3000)); await sleep(300); await shot(p, '23-mobile-board');

  check(errors.length === 0, `no console/page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(`\n${failures ? `${failures} check(s) failed` : 'All journey checks passed'} — screenshots in ${OUT}\n`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
