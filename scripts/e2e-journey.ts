/**
 * End-to-end quest in real Chrome. Start a server first:
 *   npx vite preview --port 4173   (or dev)   then   npx vite-node scripts/e2e-journey.ts [outDir]
 *
 * Plays today's Daily Quest through the UI as a new player — ranked, invalid-
 * then-corrected, misspelled, passed, timed-out and unranked answers — and
 * after every answer checks that the airship came to rest exactly where the
 * accumulated score puts it. Also checks: the one-time intro, resuming an
 * unfinished quest, the completed-today home, one attempt per day, the
 * Archives, refresh-resume, retired routes, SIMMLY branding, mobile layout and
 * console errors. Screenshots every stage.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { type Page } from 'puppeteer-core';
import { scoreToX } from '../src/components/Journey/world';
import { QUESTION_BY_ID } from '../src/data/atlas';
import { buildQuestion } from '../src/game/engine/questions';
import { addDays, dailyQuestionIds, dateKey } from '../src/game/selection';

const URL = process.env.SIMMLY_URL ?? 'http://localhost:4173/';
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
const waitReveal = (p: Page) => p.waitForFunction(() => /The board/.test(document.body.innerText), { timeout: 30000, polling: 200 });
/** the reveal only offers "Next question" once the ship has landed and settled */
const waitSettled = (p: Page) => p.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /^(Next question|See where you landed)/.test(b.innerText.trim())), { timeout: 20000, polling: 200 })
  .catch(async (e) => { await shot(p, 'zz-stuck'); console.log('  [stuck] buttons:', await p.$$eval('button', (bs) => bs.map((x) => (x as HTMLElement).innerText.trim()).join(' | '))); throw e; });
const shipAt = (p: Page) => p.evaluate(() => {
  const el = document.querySelector('[data-target-x]') as HTMLElement | null;
  return { ship: Number(el?.dataset.shipX), target: Number(el?.dataset.targetX) };
});
const RETIRED = /Endless|Practice|Expedition|Challenge a friend|Field Journal/i;

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
  await sleep(1400);

  /* ------------------------------------------------ new player */
  console.log('\nNew player');
  await shot(p, '01-first-visit');
  const t1 = await text(p);
  check(/HOW TO PLAY|How to play/.test(t1) && /Make a connection/.test(t1) && /Journey onward/.test(t1), 'first visit shows the three-step intro');
  check(/Seven questions\. One daily journey\./.test(t1), 'intro closes on “Seven questions. One daily journey.”');
  check((await p.title()).startsWith('SIMMLY'), `tab title is SIMMLY (“${await p.title()}”)`);
  await click(p, /^Let’s go$/);
  await sleep(900);
  await shot(p, '02-home');
  const home = await text(p);
  check(/Start today’s quest/.test(home), 'home offers START TODAY’S QUEST');
  check(/Archives/.test(home), 'home offers the Archives');
  check(!RETIRED.test(home), 'home shows no retired modes');
  check(!/KINSHIP/i.test(home), 'no old branding on home');
  check(!/\bAI\b/.test(home), 'home never mentions AI');
  const buttons = await p.$$eval('button', (bs) => bs.map((b) => (b.getAttribute('aria-label') || (b as HTMLElement).innerText).trim()).filter(Boolean));
  console.log(`  • home controls: ${buttons.join(' | ')}`);
  await p.reload({ waitUntil: 'networkidle0' });
  await sleep(900);
  check(!/Make a connection/.test(await text(p)), 'returning visit does not repeat the intro');

  /* ------------------------------------------------ the quest */
  console.log('\nDaily Quest');
  await click(p, /Start today’s quest/);
  await p.waitForSelector('#answer');
  await sleep(900);
  await shot(p, '03-question');
  console.log(`  Daily ${today}: ${ids.join(', ')}`);
  let total = 0;

  for (let i = 0; i < 7; i++) {
    const q = qs[i];
    await p.waitForSelector('#answer', { timeout: 8000 }).catch(async () => { await shot(p, 'zz-no-question'); console.log('  [stuck] buttons:', await p.$$eval('button', (bs) => bs.map((x) => (x as HTMLElement).innerText.trim()).join(' | '))); });
    const prompt = await p.$eval('h1', (h) => h.textContent ?? '');
    check(prompt.trim() === q.def.prompt, `question ${i + 1}: “${q.def.prompt}”`);
    const perfect = q.ranked[0].entity;
    const mid = q.ranked.find((r) => r.points === 65) ?? q.ranked[Math.floor(q.ranked.length / 2)];
    const unrankedEntity = q.universe.entities.find((e) => !q.rankedById.has(e.id) && e.id !== q.reference.id && !q.def.exclude.includes(e.name) && (!q.def.accept.length || e.tags.some((t) => q.def.accept.includes(t))));
    switch (i) {
      case 0: await type(p, perfect.name); break;
      case 1:
        await type(p, 'zzqx florp');
        check(/isn't in the Atlas|Try again/.test(await text(p)), 'invalid answer explained, round stays open');
        await type(p, q.def.ref);
        check(/itself/.test(await text(p)), 'the reference itself is rejected');
        await type(p, mid.entity.name);
        break;
      case 2: {
        const n = perfect.name;
        const typo = n.length > 6 ? n.slice(0, 3) + n[4] + n[3] + n.slice(5) : n.toLowerCase();
        await type(p, typo);
        const t = await text(p);
        if (/Did you mean/.test(t)) await p.keyboard.press('Enter');
        else if (/Which one/.test(t)) await click(p, new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
        break;
      }
      case 3: await click(p, /^Pass this one/); break;
      case 4:
        await sleep(9000);
        await shot(p, '07-compass');
        break;
      case 5: await type(p, unrankedEntity?.name ?? mid.entity.name); break;
      default: await type(p, (perfect.aliases[0] ?? perfect.name)); break;
    }
    await waitReveal(p);
    const expectTier = i === 0 ? 'perfect' : i === 3 || i === 4 ? 'none' : i === 5 && unrankedEntity ? 'unranked' : null;
    if (expectTier) {
      const drawn = await p.$eval('[data-connection]', (el) => el.getAttribute('data-connection'));
      check(drawn === expectTier, `connection thread drawn as ${expectTier} (${drawn})`);
    }
    if (i === 0) {
      // film the perfect-match flight: verdict → wind-up → burst → glide
      await sleep(1650); await shot(p, '04a-perfect-verdict');
      await sleep(450); await shot(p, '04b-perfect-charge');
      await sleep(420); await shot(p, '04c-perfect-burst');
      await sleep(700); await shot(p, '04d-perfect-glide');
      check(/Perfect Match/i.test(await text(p)), 'perfect answer → PERFECT MATCH');
    }
    if (i === 1) { await sleep(2350); await shot(p, '05-close-flight'); }
    if (i === 3) { check(/Passed/i.test(await text(p)), 'pass reveal shown'); await sleep(1900); await shot(p, '06-pass-sputter'); }
    if (i === 4) check(/compass ran out/i.test(await text(p)), 'timeout reveal shown');
    if (i === 5 && unrankedEntity) check(/Unranked Connection/i.test(await text(p)), `valid-but-unranked “${unrankedEntity.name}” → UNRANKED CONNECTION`);

    await waitSettled(p);
    const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('simmly:player') ?? '{}'));
    const st = stored.inProgress?.[`daily:${today}`];
    total = (st?.rounds ?? []).reduce((a: number, r: { result?: { points: number } }) => a + (r.result?.points ?? 0), 0);
    const pos = await shipAt(p);
    check(Math.abs(pos.ship - scoreToX(total)) < 0.6 && Math.abs(pos.target - scoreToX(total)) < 0.6, `ship rests at the score after question ${i + 1} (${total} pts → x ${scoreToX(total).toFixed(0)}, ship ${pos.ship.toFixed(0)})`);

    if (i === 2) {
      // leave mid-quest, come back from home
      await p.goto(URL + '#/', { waitUntil: 'networkidle0' });
      await sleep(1200);
      await shot(p, '08-home-in-progress');
      check(/Continue — question 4 of 7/.test(await text(p)), 'home offers CONTINUE at question 4');
      await click(p, /^Continue — question/);
      await waitSettled(p); // the unfinished reveal reopens, already settled
      const back = await shipAt(p);
      check(Math.abs(back.ship - scoreToX(total)) < 0.6, 'resumed with the ship where home showed it');
      await click(p, /^Next question/);
      await p.waitForSelector('#answer');
      await sleep(500);
      check((await p.$eval('h1', (h) => h.textContent ?? '')).trim() === qs[3].def.prompt, 'resumed exactly at question 4');
      continue;
    }
    await sleep(200);
    await click(p, /^(Next question|See where you landed)/);
    await sleep(500);
  }

  /* ------------------------------------------------ results */
  console.log('\nResults');
  await p.waitForFunction(() => /Journey complete/.test(document.body.innerText), { timeout: 15000 });
  await sleep(2600);
  await shot(p, '09-results-flight');
  await p.waitForFunction(() => /Voyage log/i.test(document.body.innerText), { timeout: 15000 });
  await sleep(2200);
  await shot(p, '10-results');
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('simmly:player') ?? '{}'));
  const final = stored.dailies?.[today]?.total;
  check(final === total, `daily recorded (${final})`);
  const session = stored.sessions.find((x: { id: string }) => x.id === stored.dailies[today].sessionId);
  const rows = await p.$$eval('ol > li', (ls) => ls.map((l) => (l as HTMLElement).innerText));
  check(rows.length === 7, `voyage log lists all seven answers (${rows.length})`);
  check(session.rounds.every((r: { points: number; entityName?: string; status: string }, k: number) => rows[k]?.includes(String(r.points)) && rows[k]?.includes(r.entityName ?? (r.status === 'timeout' ? 'Out of time' : 'Passed'))), 'each log entry shows its answer and score');
  check(new RegExp(`\\b${final}\\b`).test(await text(p)) && /Reached/i.test(await text(p)), 'summary shows the total and destination');
  await p.evaluate(() => (document.querySelectorAll('ol > li button')[1] as HTMLElement).click());
  await sleep(600);
  await shot(p, '10b-results-expanded');
  check(new RegExp(qs[1].def.prompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(await text(p)), 'a log entry opens to show its board');
  const rpos = await shipAt(p);
  check(Math.abs(rpos.ship - scoreToX(final)) < 0.6, `results open with the ship at the final score (ship ${rpos.ship.toFixed(0)} = x ${scoreToX(final).toFixed(0)})`);
  check(!(await text(p)).match(/Another journey|Challenge a friend|By category/), 'results offer no retired modes');
  check(!/\bAI\b/.test(await text(p)), 'results never mention AI');
  check(Object.keys(stored.achievements ?? {}).includes('perfect-pair'), 'PERFECT PAIR earned');
  check((stored.unranked ?? []).length >= 1, 'unranked answer saved for curation');
  // Share score: what reaches the native share sheet, and the clipboard fallback where there is none
  const shareShape = /^SIMMLY \| [A-Z]+ \d{1,2}\n\n(🏆|🚀|⛵|🧭) \d{1,3} \/ 700\n(🌟|🟨|🟩|🟦|🟪|⬜|⬛){7}$/u;
  const sheet = await p.evaluate(async () => {
    let got: ShareData | null = null;
    (navigator as Navigator & { share: unknown }).share = async (d: ShareData) => { got = d; };
    [...document.querySelectorAll('button')].find((x) => /^Share score/.test((x as HTMLElement).innerText))!.click();
    await new Promise((r) => setTimeout(r, 300));
    return got;
  }) as ShareData | null;
  console.log('  • share sheet received:\n' + String(sheet?.text).split('\n').map((l) => '      ' + l).join('\n'));
  check(!!sheet && shareShape.test(sheet.text ?? '') && Object.keys(sheet).join() === 'text', 'native share gets only date, score and seven symbols (no url, no title)');
  check((sheet?.text ?? '').includes(`${final} / 700`) && (sheet?.text ?? '').includes(new Date(`${today}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()), 'share text carries today’s date and the final score');
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(URL.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await sleep(2700);
  const clip = await p.evaluate(async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    [...document.querySelectorAll('button')].find((x) => /^Share score/.test((x as HTMLElement).innerText))!.click();
    await new Promise((r) => setTimeout(r, 400));
    return { text: await navigator.clipboard.readText().catch(() => ''), label: [...document.querySelectorAll('button')].map((b) => (b as HTMLElement).innerText).find((t) => /Copied|Share score/.test(t)) };
  });
  check(shareShape.test(clip.text) && clip.label === 'Copied!', `without a share sheet it copies the same text (${clip.label})`);
  await shot(p, '10c-results-copied');

  /* ------------------------------------------------ completed today */
  console.log('\nCompleted today');
  await p.goto(URL + '#/', { waitUntil: 'networkidle0' });
  await sleep(1500);
  await shot(p, '11-home-complete');
  const hc = await text(p);
  check(/See today’s journey/.test(hc) && /complete/i.test(hc), 'home shows today is complete');
  check(!/Start today’s quest/.test(hc), 'no second attempt offered');
  await p.goto(URL + '#/play/daily', { waitUntil: 'networkidle0' });
  check(await p.waitForFunction(() => /Journey complete/.test(document.body.innerText), { timeout: 5000 }).then(() => true, () => false), 'one Daily Quest attempt per day');

  /* ------------------------------------------------ archives */
  console.log('\nArchives');
  await p.goto(URL + '#/archive', { waitUntil: 'networkidle0' });
  await sleep(900);
  await shot(p, '12-archives');
  const at = await text(p);
  check(/Today · Daily Quest|TODAY · DAILY QUEST/i.test(at), 'today is set apart in the Archives');
  check(/No\. 1\b/.test(at), 'the first quest is listed');
  const past = addDays(today, -2);
  await p.goto(URL + `#/play/archive/${past}`, { waitUntil: 'networkidle0' });
  await p.waitForSelector('#answer');
  const pq = (await p.$eval('h1', (h) => h.textContent ?? '')).trim();
  check(pq === buildQuestion(QUESTION_BY_ID.get(dailyQuestionIds(past)[0])!).def.prompt, 'an archived quest plays that day’s questions');
  await sleep(3000);
  await p.reload({ waitUntil: 'networkidle0' });
  await p.waitForSelector('#answer');
  const secs = await p.$eval('[role=timer]', (t) => Number((t as HTMLElement).innerText.trim()));
  check((await p.$eval('h1', (h) => h.textContent ?? '')).trim() === pq, 'refresh resumes the same question');
  check(secs <= 17, `timer kept running across refresh (${secs}s left)`);
  await p.goto(URL + '#/archive', { waitUntil: 'networkidle0' });
  await sleep(600);
  check(/\bContinue\b/.test(await text(p)), 'Archives show the unfinished replay as Continue');
  await p.goto(URL + `#/play/archive/${today}`, { waitUntil: 'networkidle0' });
  check(await p.waitForFunction(() => /Journey complete/.test(document.body.innerText), { timeout: 5000 }).then(() => true, () => false), 'today can’t be replayed through the Archives');

  /* ------------------------------------------------ retired routes */
  console.log('\nRetired routes');
  for (const r of ['#/play/endless', '#/practice', '#/play/practice?cat=movies', '#/expeditions', '#/play/expedition/wild-connections/0', '#/stats', '#/settings', '#/c/abc', '#/play/challenge/abc', '#/nowhere']) {
    await p.goto(URL + r, { waitUntil: 'networkidle0' });
    await sleep(400);
    const h = await p.evaluate(() => location.hash);
    check(h === '#/' && /See today’s journey/.test(await text(p)), `${r} → home`);
  }

  /* ------------------------------------------------ mobile */
  console.log('\nMobile');
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(URL + '#/', { waitUntil: 'networkidle0' }); await sleep(1800); await shot(p, '20-mobile-home');
  check((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, 'no horizontal scroll on mobile home');
  await p.goto(URL + '#/archive', { waitUntil: 'networkidle0' }); await sleep(800); await shot(p, '21-mobile-archives');
  check((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, 'no horizontal scroll on mobile archives');
  const mday = addDays(today, -3);
  await p.goto(URL + `#/play/archive/${mday}`, { waitUntil: 'networkidle0' }); await p.waitForSelector('#answer'); await sleep(800); await shot(p, '22-mobile-question');
  const mq = buildQuestion(QUESTION_BY_ID.get(dailyQuestionIds(mday)[0])!);
  await type(p, mq.ranked[0].entity.name); await waitReveal(p); await sleep(2700); await shot(p, '23-mobile-flight');
  await waitSettled(p); await shot(p, '24-mobile-settled');
  const mpos = await shipAt(p);
  check(Math.abs(mpos.ship - scoreToX(mq.ranked[0].points)) < 0.6, 'mobile: ship rests at the score');
  check((await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, 'no horizontal scroll on mobile play');
  await p.goto(URL + `#/results/${stored.dailies[today].sessionId}`, { waitUntil: 'networkidle0' }); await sleep(5500); await shot(p, '25-mobile-results');

  check(errors.length === 0, `no console/page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close();
  console.log(`\n${failures ? `${failures} check(s) failed` : 'All quest checks passed'} — screenshots in ${OUT}\n`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
