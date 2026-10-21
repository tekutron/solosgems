# Maintaining solosgems.com

Pushing to `main` deploys the live site (Cloudflare Workers Builds). Everything
below runs from the repo root with `python3`. Never hand-edit ranks or tool
counts; let `tools/site.py` do it.

## House rules (non-negotiable)

- **No em dashes, en dashes, or curly quotes** anywhere. Use commas, periods,
  colons, and straight quotes ('). Check with:
  `git diff -U0 -- . ':!tools' | grep '^+' | grep -c '—\|–\|“\|”\|‘\|’'` (must print 0).
- **Voice:** funny, nerdy, D&D / fantasy "Herald" tone. Captions are clever
  observations about the tool (quests, guilds, wizards, scrolls, familiars),
  not just insults. One or two sentences.
- **Accuracy first.** Every fact (pricing, free tier, launch, shutdown, rename,
  acquisition) must come from the vendor's own site or reputable reporting you
  actually read today. If sources conflict, leave the uncertain detail out.
  Never invent numbers.
- New tools are always `basis: scouted` (scored from public info). Only the
  site owner promotes a tool to `tested`.

## Add tools

Write a JSON list (e.g. `/tmp/new.json`; the `//` comments below are explanations only, real JSON cannot contain them), then run `python3 tools/site.py add /tmp/new.json`.

```json
[{
  "slug": "napkin-ai",                 // lowercase-hyphen, unique; becomes #tool-<slug> and images/wall/<slug>.svg
  "name": "Napkin AI",
  "url": "https://www.napkin.ai/",
  "domain": "napkin.ai",               // for the favicon logo
  "category": "Presentations & Design",// must be an EXISTING category name, exactly
  "tier": "free",                      // free = permanent free plan | paid = trial/contact sales only | unlisted = unknown
  "desc": "One-sentence plain-English summary, include price if known.",
  "fact": "One genuinely interesting, verified fact.",
  "caption": "D&D-style comic caption.",
  "v": 8.5, "c": 7.5, "e": 9.0, "t": 8.5,  // value, capability, ease, trial safety (0-10, .5 steps)
  "why": "D&D-flavored one-liner explaining the rank (strengths vs weaknesses).",
  "scene": "V(\"workshop\", fig(\"scribe\", 400, 690, arms=\"hold_fwd\", scale=0.75), s.scroll_rolled(400, 590))"
}]
```

`scene` is optional (a default comic is drawn if omitted). It is a Python
expression using: `V(backdrop, *elements)` with backdrops `hall, workshop,
market, stage, tavern, sky, road, camp, river`; `fig(class, x, y, arms=..., scale=..., flip=...)`
with classes `fighter wizard rogue dwarf elf gnome bard druid merchant scribe ranger`
and arms `up down hold_fwd point_r point_l wave shrug cross out`; and props such
as `s.castle s.dragon s.owl s.fox s.gear s.crystal_ball s.scroll_rolled s.book_closed
s.envelope s.coin_purse s.coin_stack s.hourglass s.clock_face s.round_table s.candle
s.musical_note s.star s.tag(x,y,"TEXT") s.price_tag(x,y,"$9") s.speech_bubble(x,y,w,text=)
s.thought_bubble s.x_mark s.check_mark s.arrow(x1,y1,x2,y2)`, plus `golem banner wagon stall gate glow`.
Canvas is 768x768; ground figures sit around y 680-700.

Scoring guide: consumer tools with strong free tiers score high on value/trial;
enterprise-only tools (contact sales) score low on value (2-4) and trial (1-4).

Valid categories: 3D & Game Dev, AI Assistants, AI Detection & Plagiarism,
AI Phone Agents, AI Search & Browsing, Accessibility, Automation & Workflow,
Bookkeeping & Finance, CRM & Client Management, Career & Job Search,
Coding & Dev Tools, Customer Support, Cybersecurity, Data & Analytics,
Design & Photography, E-commerce, Education & Tutoring, Email & Messaging,
Forms & Surveys, HR & Recruiting, Health & Fitness, Image Generation,
Interior Design, Investing & Markets, Legal, Local Business,
Marketing & Social Media, Meetings & Transcription, Newsletters,
No-code / Database, Personal Finance, Podcasting & Video Editing,
Presentations & Design, Productivity & Notes, Project Management, Real Estate,
Research & Knowledge, SEO, Sales & Prospecting, Scheduling & Time,
Translation & Localization, Video Generation, Voice & Music, Voice Dictation,
Website & App Builders, Writing & Copywriting.

## Remove a dead tool

`python3 tools/site.py remove "Exact Tool Name"` (name as shown in its `<h3>`).
Then usually add it to the DeathStack (below).

## Rename / update an existing tool

Edit its row (`<a class="db-row" ...>`) and wall tile (`<a class="db-wall-item" ...>`)
in index.html, plus `data/tools.json` and `data/rankings.json` (`name`), keeping
the row `id="tool-..."` unchanged so old links work. Then `python3 tools/site.py rerank`.

## DeathStack grave

Copy an existing `<div class="grave-card" id="grave-...">` block in
deathstack.html, insert it just before `<h2>What this means for your stack</h2>`,
fill in name, dates, tags, caption, two paragraphs, verdict, autopsy note, and a
real source link. Comic: generate `images/ds-<slug>-hero.svg` with the same
helpers (see `make_svg` in site.py). Update the word-number in the intro
("These are thirty-four that...", "through all thirty-four") by hand, then run
`python3 tools/site.py graves`.

## Before pushing

1. `python3 tools/site.py rerank` (safe to run any time; idempotent).
2. Dash/quote check above prints 0 (it skips tools/, which holds this guide).
3. `node --check worker.js` if worker.js changed (or skip if node is absent).
4. Commit with a clear message and push to `main`.
5. New HTML pages must also be added to `assets.run_worker_first` in wrangler.jsonc.

## Herald (homepage chat)

The homepage (`/`, served from home.html) is the Herald. The AI tools
database is still index.html, but it is served at `/database` (its canonical URL);
/index.html 301s there, and home.html forwards old `/#tool-...` links to
`/database#tool-...`. Link to database rows as `/database#tool-slug`, never `/#tool-slug`.

The homepage Herald has two tabs. **Quest** (default; `quest.js`,
`quest.css`, `/api/quest` in worker.js) is an AI Dungeon Master:
- One-shot (20 turns, three acts) or campaign (no ending, 12-turn chapters;
  0 HP knocks the hero out instead of ending it).
- The worker rolls the d20 (abilities give advantage or a minimum roll),
  adds the hero, the journal, SRD 5.1 lookups for spells/creatures/items the
  player names (`data/srd.json`, CC BY 4.0, credit on about.html and under
  the Herald) and random secret cards from `data/quest-cards.json` (our own
  twists, characters, complications, oddities, places, villain schemes),
  then streams the scene. `mode: "journal"` returns the updated journal
  (location, goal, done, people, threads, item notes) as JSON; the page
  calls it every 4 turns. The villain's plan is drawn once and kept fixed.
- The page owns the rules: HP/gold/XP clamps, levels (`LEVELS`), class
  abilities and rests (`CLASSES` in quest.js), and up to 6 saves in
  localStorage (`solosgems-quests-v2`). The model only writes a status line
  like `[[hp -2; gain X; xp +10; opt ...]]`; history gets a rebuilt clean
  line so the model keeps writing it.
- Items: the bag holds 10 slots; the model adds `near X` for loose objects
  in the scene (the "Nearby" shelf, cleared on a new location). The page
  also reads the player's action, so "I give my staff to Tee" removes the
  Staff and "I pick up the key" takes a nearby Key even when the model
  forgets the `lose`/`gain` entry (`GIVE_AWAY`, `SET_DOWN`, `PICK_UP` in
  quest.js). Dropping from the HUD is free and is told to the model next turn.
- No skipping: the worker flags "skip to the end"-style actions, and the page
  ignores an `end` line in a one-shot before act three (turn 16).
- Scene art: when the journal's location changes, the page posts it to
  `/api/quest-art` (flux-1-schnell, about 3 quest turns of neurons each) and
  keeps a 640x360 copy in the save; if storage is full, paintings go first.
- Reactions: on a natural 20, a 1, a level up, a knockout, the ending and
  sometimes on other rolls, the page asks `/api/quest-gif` for a PG GIPHY
  GIF. It needs the `GIPHY_KEY` secret (Cloudflare dashboard > the worker >
  Settings > Variables and Secrets); without it the page shows its own emoji
  stickers. GIFs must keep the "Powered by GIPHY" credit.
- Models: scenes and the chat use `BIG_MODEL` (Llama 3.3 70B, Workers Paid);
  the journal stays on the 8B `CHAT_MODEL`. Chosen over Gemma 4, Mistral Small
  3.1 and Llama 4 Scout in a live comparison (see the comment on BIG_MODEL).
- Knowledge: `data/srd.json` (SRD 5.2 rules, plus SRD 5.1 entries marked
  `v: "2014"`), `data/dm-codex.json` (our DM Codex: game-running tips from
  old-school play to the 2024 rules, picked per turn by `questCraft`),
  `data/quest-cards.json` (now with `legends`, public-domain myth motifs in
  our own words) and `data/dnd-now.json` (dated release facts the chat uses
  for "what's new" questions; update it when Wizards announces books, with
  facts checked against D&D Beyond or Wizards).
- Accounts (optional): `/api/account/{signup,login,logout,me,saves,delete}`
  in worker.js. KV binding `QUESTS` (currently the same namespace as REALMS,
  keys prefixed `user:`, `sess:`, `saves:`, `fail:`, `tv:`). Passwords are
  PBKDF2-SHA256 (100k iterations, salted); sessions are an HttpOnly cookie.
  The page pushes saves 2.5 s after each change and merges on sign-in.
- Tavern board (`tavern.html`, `tavern.js`, `tavern.css`, `/api/tavern`):
  opt-in per quest. The worker tees the scene stream, runs Llama Guard over
  the action and the scene, and writes `tv:<id>` (last 40 scenes, 7-day TTL)
  and `tv:index`. Only the quest's own key can post; a report hides a quest
  at once. The page has no ads and is noindex (player-made content).
- Local testing without Cloudflare: download Node into a scratch folder and
  run worker.js with in-memory KV and a scripted AI (see the dev server used
  for the accounts work); never test accounts on the live site.
- Prompts are QUEST_SYSTEM and QUEST_JOURNAL_SYSTEM. Test prompt changes
  locally against the 8B base model first (herald-training/dm/play3.py).

**Chat** is the general assistant below.

A general-purpose chat assistant with the Solos Gems voice (`#herald` in
home.html and index.html; `herald.js`, `herald.css`). It posts the
conversation to `/api/chat` in `worker.js`, which streams a reply from
`@cf/meta/llama-3.1-8b-instruct-fp8-fast` with `CHAT_SYSTEM` (the Herald style
guide) and `CHAT_EXAMPLES` (three example exchanges). A LoRA trained on the
style dataset in `herald-training/` (outside the repo) made answers less
accurate in testing, so it is not used; retrain only with a bigger, checked
dataset. The homepage must keep the "Built with Llama" notice (Llama license).
`ASK_LIMITER` caps each visitor at 8 messages a minute; nothing is stored.
