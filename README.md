# SIMMLY

**Everything has something in common.** A daily browser game of connections. You get a reference — a panda, *Friends*, pizza, Japan — and name the thing **most like it**. Your answer is judged against a hand-curated similarity board, and the stronger the connection, the further (and more spectacularly) your airship flies through the illustrated world.

*Seven questions. One daily journey.*

```bash
npm install
npm run dev        # http://localhost:5173   (board editor at /editor)
npm run build      # typecheck + production build → dist/
```

## How it plays

- **Daily Quest:** seven questions, 20 seconds each, 700 points max. Everyone gets the same seven on a given date (local midnight reset), drawn from seven different categories and ordered easiest first. You get one attempt per day. Leaving or refreshing resumes exactly where you left off, with the clock still running.
- **Archives:** every past Daily Quest, replayable as often as you like. Replays don't affect your streak. These are the only two destinations; the home screen is the live world with today's quest on it.
- **Sharing:** *Share score* sends only the quest's date, the score and one symbol per question (🌟 Perfect · 🟨 Nearly · 🟩 Family · 🟦 Close · 🟪 Distant · ⬜ Loose/Unranked · ⬛ none), led by 🏆 (600+), 🚀 (450+), ⛵ (300+) or 🧭. It uses the native share sheet where there is one, and copies to the clipboard otherwise. It never adds a link.
- **How to play:** three short steps, shown once on the first visit and available afterwards from the **?** button.
- **Answering:** answers are free text. Typos, aliases (*HIMYM*, *LOTR*, *GOT*, *Spider Man*) and plurals are handled. Wrong guesses don't end the round; you can retry until the compass runs out, or pass.
- **Scoring tiers (fixed):**

  | Tier | Points |
  | --- | --- |
  | Perfect Match | 100 |
  | Nearly Identical | 90 |
  | Same Family | 80 |
  | Close Relative | 65 |
  | Distant Cousin | 45 |
  | Loose Connection | 30 |
  | Unranked Connection (a valid answer not on the board yet, saved for curation) | 30 |
  | Pass or timeout | 0 |

- **The world:** every 100 points carries the airship to the next destination: Forgotten Forest → Glass Lake → Old Kingdom → Cloud Passage → Crystal Peaks → Starfields → **The Summit (600+)**. The last 100 points climb to the beacon.
- **Ship movement:** each answer launches the airship in its tier's style (see *The journey world* below). A Perfect Match bursts forward with a glowing trail, a ring of light and a shower of sparks. A Loose Connection drifts gently on. A pass or timeout sputters in place.

## Content: the Atlas

All content lives in plain text so editors can review diffs. The game, the validator, the simulation and the dev editor all share one parser (`src/game/atlas/format.ts`).

| Files | What they hold |
| --- | --- |
| `src/data/atlas/universes/*.txt` | Every **valid** answer per kind (animal, tv, movie, country, city, food, game, sport, person, character, object), with aliases and tags. About 2,200 answers. Valid answers that aren't ranked are what make "Unranked Connection" possible instead of a rejection. |
| `src/data/atlas/boards/*.txt` | One file per category: **101 questions, 1,300+ ranked answers**. Each question has a prompt, a player-facing interpretation, its similarity dimensions, a board rationale, review notes, optional exclusions (other foxes don't count for "fox") and accepted tags (drinks only for coffee). Every ranked answer has a tier, a written reason, and an optional `*` marking it as an "obvious first thought". |

Example board line:

```
## animal_panda | easy | universe=animal | ref=Giant panda | v=1
100 Red panda :: Shares the name, the bamboo diet and the same bony "false thumb"
90 Bear * :: The giant panda is a bear — same family, same heavy build
```

Scores are always read from the stored board, and boards never change mid-session (each question carries a `v=` version that the editor bumps on save).

### Board editor (development only)

`npm run dev`, then open `/editor`. You can browse questions, edit prompts, dimensions, rationale, tiers, aliases and reasons, pull in unranked answers players gave on this device, see live validation, and **save straight back to the board file**. A small Vite dev-server endpoint does the write, and the game hot-reloads.

## Answer resolution

`src/game/answerResolution/resolver.ts` resolves input in this order:

1. Exact name
2. Alias
3. Singular/plural
4. Whole-token partial match (*kong* → King Kong)
5. Bounded typo correction: no typos allowed under 5 letters; one typo is accepted automatically; bigger edits ask "Did you mean…?"; near-equal rivals ask "Which one?"; numbers are never corrected.
6. Category check (*Titanic* → "that's a movie — this question needs a TV show").

If what you typed is exactly something from another category (*Iran*, *Ramen*), it is never auto-corrected into a lookalike here. After resolution, the question layer rejects the reference itself, excluded "same thing" entries, and off-tag answers, each with a stated reason.

## Quality checks

| Command | What it checks |
| --- | --- |
| `npm test` | 55 tests: every tier, aliases, misspellings, cross-category rejection, accept tags, the editor round-trip, session timing/late locks/passes, daily determinism and category rotation, persistence (including migrating KINSHIP-era saves), streaks, achievements, share text. Also the flight engine: the ship never moves backwards, lands exactly on the score, chains answers that arrive mid-flight, and stronger tiers accelerate harder. Connection threads get longer, thinner, slower and dimmer as tiers weaken |
| `npm run validate` | Duplicate questions, prompts, references and canonical names; alias collisions; missing prompts, hints, dimensions, rationale and explanations; empty or thin boards; no Perfect Match; contradictory mappings; reference on its own board; ranked-and-excluded entries; boards that reward only fame. Status: **0 errors, 0 warnings.** |
| `npm run simulate` | 150 journeys over 10 strategies, typed through the real resolver and session reducer (see below). |
| `npm run e2e` | Real Chrome (needs `npx vite preview --port 4173` on a fresh build). Plays today's quest as a new player with ranked, invalid-then-corrected, misspelled, passed, timed-out and unranked answers. After every answer it checks the ship came to rest exactly at `scoreToX(total)`. It also covers the one-time intro, leave-and-resume from home, the completed-today home, one attempt per day, the Archives, refresh-resume, that retired routes redirect home, branding, mobile layout and console errors. |
| `npm run qa` | typecheck + test + validate + simulate |

Latest simulation results (average out of 700):

| Strategy | Average |
| --- | --- |
| Expert | 663 |
| Obvious answers only | 593 |
| Bad speller | 580 |
| Reasonable alternatives | 540 |
| Casual | 435 |
| Obscure | 237 |
| Misreads the reference | 244 |
| Times out | 150 |

Fairness checks from the same run:
- All 20,015 valid answers typed as named are accepted (or offered as a choice).
- 0 of 930 typed answers resolved to an unintended entity.
- 473 of 473 wrong-category, reference or gibberish attempts were rejected.
- Obvious first-thought answers average 82 points; 70 of 183 are Perfect Matches.

## Architecture

| Path | What it is |
| --- | --- |
| `src/game/types.ts` | Domain types and fixed tier points |
| `src/game/atlas/` | Text formats, atlas builder (merges boards into universes) and validator |
| `src/game/answerResolution/` | Resolver |
| `src/game/engine/` | `questions.ts` (eligibility, ranked/unranked evaluation) and `session.ts` (pure state machine with injected time) |
| `src/game/scoring/` | Tiers, destinations, journey rule |
| `src/game/selection/` | The date-seeded daily draw |
| `src/game/progression/` | Stats, streaks, achievements, share text |
| `src/game/persistence/` | Versioned `localStorage` behind a swappable KeyValueStore, ready for cloud sync. Saves from the KINSHIP era (`kinship:player`) move to `simmly:player` on first load |
| `src/components/Journey/` | The living side-on world on Home, Play and Results: `world.ts` (route, destinations, time-of-day skies), `engine.ts` (the single animation loop: travel phases, camera, events), `motion.ts` (one travel style per answer tier), `Layer.tsx` (tiled parallax layers), `art/` (near/back/foreground illustration), `canvas.ts` (stars, aurora, route, trail, sparks, weather), `Airship.tsx` |
| `src/components/WorldMap/` | The top-down SVG atlas, used only to draw the share card |
| `src/components/JourneyHud.tsx` | In-play HUD plaques and the destination card |
| `src/components/ConnectionReveal.tsx` | The compact reveal dock and the similarity board (drawer on wide screens, sheet on phones) |
| `src/components/connection.tsx` | How a connection looks, by tier: node distance, winding, thickness, glow, draw speed, particles. Also the small `StrengthGlyph` used in the voyage log |
| `src/components/QuestionScreen.tsx` | The question dock: journal slip, compass timer, answer input |
| `src/hooks/useRoute.ts` | Clean-path routing (`/play/daily`, `/archive`, `/results/:id`) on the history API; old `#/…` links are upgraded. `vercel.json` serves `index.html` for every path |
| `src/pages/` | Home, Play, Results (the voyage log over the world), Archive, HowToPlay, Editor (dev), JourneyPreview and RevealPreview (dev) |
| `src/components/PixelIcon.tsx` | Pixel-art icons (arrow, skip, close, gear) drawn from character grids |
| `src/styles/index.css` → *Buttons* | The single pixel button system: `btn-gold` (primary), `btn-ink` (primary on paper), `btn-ghost`, `btn-paper`, `btn-danger`; sizes `btn-xs`/`btn-sm`/`btn-lg`/`btn-icon`; `btn-text` for tertiary links; `tile` for whole-row list buttons; `px-switch`. Labels use Pixelify Sans |
| `src/components/SettingsDialog.tsx` | Sound and motion (plus *How to play*). A dialog on Home, not a destination |

Deadlines are absolute timestamps in session state, so re-renders, tab switches and reloads can't restart a timer. Expiry is one timeout (`useDeadline`), the numeral re-renders once per second (`useSecondsLeft`), and the compass dial reads the same deadline every animation frame and writes to the DOM directly. Reveal animations are presentation only: the round is already scored when they start.

### The journey world

The score drives an airship along a route through seven destinations, from dawn at the Forgotten Forest to an aurora night at the Summit (one leg = 100 points). The world is animated by one `requestAnimationFrame` loop (`JourneyEngine`). Layers, canvases and the airship subscribe to it and write transforms straight to the DOM, so React never renders per frame. Static art is cut into tiles and only nearby tiles are mounted. Animated details are CSS transform/opacity animations that run on the compositor. Reduced motion jumps instead of travelling, and turns off drift, particles and ambient animation.

**After an answer:** the verdict is stamped first. Then the ship reacts, winds up (rearing back as its engine glows), launches, glides and settles. Only then is *Next question* offered. Where the ship goes is always `scoreToX(total)`. The answer's tier (`motion.ts`) only decides how it gets there:

| Tier | Flight |
| --- | --- |
| Perfect Match | Longest wind-up, sharpest burst, long glide; ring of light, spark shower, camera shake, screen bloom, long gold trail, landing shimmer |
| Nearly Identical | Fast, smooth acceleration; bright trail and sparks, small burst |
| Same Family | Strong acceleration; green-gold trail, light sparks |
| Close Relative | Moderate, even acceleration; short blue trail |
| Distant Cousin | Smaller, gentle move; faint trail |
| Loose / Unranked | Gentle drift with exhaust puffs |
| Pass / timeout | Stays in place; dips and sputters dark smoke |

Position follows a velocity curve `v ∝ u^a (1−u)^b` that is monotonic by construction. A travel requested mid-flight is queued and chained, never overlapped. Everything is time-based, so a background tab can't desynchronise it, and the engine writes where the ship actually rests to `data-ship-x` for the e2e checks. Particles near the ship are pushed aside by its wake.

**The connection thread** (in the reveal) shows the same strength. The stronger the tier, the closer together the two nodes, the more direct and thicker the line, the brighter its glow, the faster it draws, and the more particles run along it once it lands. A Perfect Match is a short, straight, glowing bar. A Loose Connection is a long, faint, dotted meander. A pass or timeout frays out half-way and never reaches the answer. The score and tier are stamped when the thread arrives.

**Results** keep the world exactly where the seventh answer left the ship. The camera holds, then pans to make room (ship left on desktop, ship up on phones), and the recap rises over the landscape. It shows an achievement plate (score, destination, the route in miniature, perfect count, streak) and a voyage log with one compact entry per question. Each entry has the reference, your answer, the score and a small thread glyph, and opens to show its board.

Development previews: `npm run dev`, then open `/journey?s=350` to fly the world to any score in any tier's style, or `/reveal?tier=close` to stage the connection reveal for any tier.

## Known limitations

- **Boards are editorial.** They were drafted for this build and are internally consistent (each has stated dimensions and per-answer reasons). They have not yet been checked by independent human reviewers; the editor, reports and unranked-answer log exist for that.
- **Obvious answers score well on some boards.** Where the obvious answer genuinely is the closest relative (zebra/donkey for horse, Chicago/London for New York), it scores 100. The validator flags boards where *every* obvious answer is perfect; currently those are horse and New York.
- **Unknown answers.** Answers outside a universe file can't be recognized. The player is told so and can report the answer, but it doesn't score.
- **No server.** There are no accounts or leaderboards yet; progress lives in the browser.
- **The daily seed keeps its old name.** `DAILY_SEED = 'kinship-daily-v1'` is frozen on purpose: changing it would reshuffle every past and present Daily Quest.
