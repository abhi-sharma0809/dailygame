/* Question-bank + universe validation. Run: npm run validate  (-v lists info items) */
import { ATLAS, BANK_VERSION } from '../src/data/atlas';
import { validateAtlas } from '../src/game/atlas/validate';

const verbose = process.argv.includes('-v');
const issues = validateAtlas(ATLAS);
const count = (s: string) => issues.filter((i) => i.severity === s).length;

console.log(`\nKINSHIP atlas ${BANK_VERSION}`);
console.log(`  ${ATLAS.questions.length} questions · ${ATLAS.questions.reduce((a, q) => a + q.board.length, 0)} ranked answers`);
for (const u of Object.values(ATLAS.universes)) console.log(`  universe ${u.id.padEnd(10)} ${String(u.entities.length).padStart(4)} valid answers`);
const byCat: Record<string, Record<string, number>> = {};
for (const q of ATLAS.questions) { byCat[q.category] ??= {}; byCat[q.category][q.difficulty] = (byCat[q.category][q.difficulty] ?? 0) + 1; }
for (const [c, d] of Object.entries(byCat)) console.log(`  ${c.padEnd(11)} ${JSON.stringify(d)}`);
console.log('');
for (const i of issues) {
  if (i.severity === 'info' && !verbose) continue;
  console.log(`  ${i.severity === 'error' ? '✗' : i.severity === 'warning' ? '⚠' : '·'} ${i.where}: ${i.message}`);
}
console.log(`\n${count('error')} errors, ${count('warning')} warnings, ${count('info')} info\n`);
process.exit(count('error') ? 1 : 0);
