# KINSHIP.

**Everything has something in common.** A daily browser game of connections. You get a reference — a panda, *Friends*, pizza, Japan — and name the thing **most like it**. Your answer is judged against a hand-curated similarity board, and an airship explorer carries you across the illustrated **Atlas of Connections**.

```bash
npm install
npm run dev        # http://localhost:5173   (board editor at /#/editor)
npm run build      # typecheck + production build → dist/
```

## How it plays

- **Daily Journey:** seven questions, 20 seconds each, 700 points max. Everyone gets the same seven on a given date (local midnight reset), drawn from seven different categories and ordered easiest first. You get one attempt per day, and a refresh resumes where you left off with the clock still running.
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

- **The map:** every 100 points carries the explorer to the next destination: Forgotten Forest → Glass Lake → Old Kingdom → Cloud Passage → Crystal Peaks → Starfields → **The Summit (600+)**. The last 100 points climb to the beacon.
- **Modes:** Daily, Endless, Practice (untimed, choose a category, retry any question), 9 themed Expeditions, Archive, and Friend Challenge links.

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

Scores are always read from the stored board. No LLM judges answers, and boards never change mid-session (each question carries a `v=` version that the editor bumps on save).

### Board editor (development only)

`npm run dev`, then open `/#/editor`. You can browse questions, edit prompts, dimensions, rationale, tiers, aliases and reasons, pull in unranked answers players gave on this device, see live validation, and **save straight back to the board file**. A small Vite dev-server endpoint does the write, and the game hot-reloads.

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
| `npm test` | 46 tests: every tier, aliases, misspellings, cross-category rejection, accept tags, the editor round-trip, session timing/late locks/passes, daily determinism and category rotation, expeditions, persistence, streaks, achievements, share text, challenge links |
| `npm run validate` | Duplicate questions, prompts, references and canonical names; alias collisions; missing prompts, hints, dimensions, rationale and explanations; empty or thin boards; no Perfect Match; contradictory mappings; reference on its own board; ranked-and-excluded entries; boards that reward only fame. Status: **0 errors, 0 warnings.** |
| `npm run simulate` | 150 journeys over 10 strategies, typed through the real resolver and session reducer (see below). |
| `npm run e2e` | Real Chrome (needs `npx vite preview --port 4173`). Plays a full daily with ranked, invalid-then-corrected, misspelled, passed, timed-out and unranked answers. Then checks persistence, one attempt per day, refresh-resume, the other modes, mobile layout and console errors. |
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
| `src/game/selection/` | Daily (date-seeded), expeditions, endless/practice draws |
| `src/game/progression/` | Stats, streaks, achievements, share text, challenge links |
| `src/game/persistence/` | Versioned `localStorage` behind a swappable KeyValueStore, ready for cloud sync |
| `src/components/Journey/` | The living side-on journey world used during play: `world.ts` (route, destinations, time-of-day skies), `engine.ts` (the single animation loop: explorer travel, camera, events), `Layer.tsx` (tiled parallax layers), `art/` (near/back/foreground illustration), `canvas.ts` (stars, aurora, route, weather), `Airship.tsx` |
| `src/components/WorldMap/` | The top-down SVG atlas used on Home, Results and Challenge pages |
| `src/components/JourneyHud.tsx` | In-play HUD plaques and the destination card |
| `src/components/ConnectionReveal.tsx` | The compact reveal dock and the similarity board (drawer on wide screens, sheet on phones) |
| `src/components/QuestionScreen.tsx` | The question dock: journal slip, compass timer, answer input |
| `src/pages/` | Home, Play (all modes), Results, Field Journal, Archive, Practice, Expeditions, Challenge, Settings, Editor |

Deadlines are absolute timestamps in session state, so re-renders, tab switches and reloads can't restart a timer. Expiry is one timeout (`useDeadline`), the numeral re-renders once per second (`useSecondsLeft`), and the compass dial reads the same deadline every animation frame and writes to the DOM directly. Reveal animations are presentation only: the round is already scored when they start.

### The journey world

During play the score drives an airship along a route through seven destinations, from dawn at the Forgotten Forest to an aurora night at the Summit (one leg = 100 points). The world is animated by one `requestAnimationFrame` loop (`JourneyEngine`). Layers, canvases and the airship subscribe to it and write transforms straight to the DOM, so React never renders per frame. Static art is cut into tiles and only nearby tiles are mounted. Animated details are CSS transform/opacity animations that run on the compositor. Reduced motion jumps instead of travelling, and turns off drift, particles and ambient animation.

Development preview: `npm run dev`, then open `/#/journey?s=350` to fly the world to any score.

## Known limitations

- **Boards are editorial.** They were drafted for this build and are internally consistent (each has stated dimensions and per-answer reasons). They have not yet been checked by independent human reviewers; the editor, reports and unranked-answer log exist for that.
- **Obvious answers score well on some boards.** Where the obvious answer genuinely is the closest relative (zebra/donkey for horse, Chicago/London for New York), it scores 100. The validator flags boards where *every* obvious answer is perfect; currently those are horse and New York.
- **Unknown answers.** Answers outside a universe file can't be recognized. The player is told so and can report the answer, but it doesn't score.
- **No server.** Challenge links carry the sender's score in the URL, and there are no accounts or leaderboards yet.
- **Expedition size.** People has 7 questions and Sports has 9, so those expeditions have a single route.
