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
