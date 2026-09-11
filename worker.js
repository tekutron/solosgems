// Worker entry point. Static assets (HTML/CSS/JS/images) under assets.directory
// are served automatically without hitting this script. This fetch handler only
// runs for requests that don't match a static asset, i.e. the /api/subscribe,
// /api/submit, and /api/news routes. The scheduled() export runs on a cron
// trigger to refresh the news feed stored in the NEWS KV namespace.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // html_handling is set to "none" in wrangler.jsonc (so /foo.html doesn't
    // auto-redirect to /foo). That also turns off the default "/" -> index.html
    // mapping, so a bare root request falls through to this handler instead of
    // being served as a static asset. Rewrite it explicitly so the homepage
    // still loads at https://solosgems.com/.
    if (url.pathname === "/") {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }

    if (url.pathname === "/api/subscribe") {
      if (request.method === "POST") {
        return handleSubscribe(request, env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/submit") {
      if (request.method === "POST") {
        return handleSubmit(request, env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/news") {
      if (request.method === "GET") {
        return handleGetNews(env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/news/refresh") {
      if (request.method === "GET" || request.method === "POST") {
        return handleRefreshNews(env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/realms") {
      if (request.method === "GET") {
        return handleGetRealms(env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/api/realms/refresh") {
      if (request.method === "GET" || request.method === "POST") {
        return handleRefreshRealms(env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    // Temporary, manually-keyed endpoint used to batch-regenerate the D&D-style
    // review hero images via Workers AI. Not linked anywhere on the site.
    // Remove this route once the one-time image batch is regenerated.
    if (url.pathname === "/api/gen-image") {
      if (request.method === "GET") {
        return handleGenImage(request, env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(gatherNews(env));
    ctx.waitUntil(gatherRealms(env));
  },
};

async function handleSubscribe(request, env) {
  let email = "";
  try {
    const formData = await request.formData();
    email = (formData.get("email") || "").toString().trim().toLowerCase();
  } catch (err) {
    return new Response("Bad request", { status: 400 });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailPattern.test(email) || email.length > 254) {
    return Response.redirect(new URL("/?subscribe=invalid", request.url), 303);
  }

  if (!env.SUBSCRIBERS) {
    return new Response(
      "Signup storage isn't configured yet. Bind a KV namespace named SUBSCRIBERS to this Worker.",
      { status: 500 }
    );
  }

  const existing = await env.SUBSCRIBERS.get(email);
  if (!existing) {
    await env.SUBSCRIBERS.put(email, new Date().toISOString());
  }

  return Response.redirect(new URL("/thanks.html", request.url), 303);
}

async function handleSubmit(request, env) {
  let fields;
  try {
    const formData = await request.formData();
    fields = {
      type: (formData.get("type") || "tool").toString().trim().slice(0, 32),
      tool_name: (formData.get("tool_name") || "").toString().trim().slice(0, 200),
      tool_url: (formData.get("tool_url") || "").toString().trim().slice(0, 500),
      category: (formData.get("category") || "").toString().trim().slice(0, 200),
      pitch: (formData.get("pitch") || "").toString().trim().slice(0, 2000),
      submitter_email: (formData.get("submitter_email") || "").toString().trim().slice(0, 254),
    };
  } catch (err) {
    return new Response("Bad request", { status: 400 });
  }

  if (!fields.tool_name) {
    return Response.redirect(new URL("/submit.html?error=missing_name", request.url), 303);
  }

  if (!env.SUBMISSIONS) {
    return new Response(
      "Submission storage isn't configured yet. Bind a KV namespace named SUBMISSIONS to this Worker.",
      { status: 500 }
    );
  }

  const timestamp = new Date().toISOString();
  const rand = Math.random().toString(36).slice(2, 8);
  const safeName = fields.tool_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const key = `${fields.type}:${timestamp}:${safeName}:${rand}`;

  await env.SUBMISSIONS.put(key, JSON.stringify({ ...fields, received_at: timestamp }));

  return Response.redirect(new URL("/submitted.html", request.url), 303);
}

// ---------------- News aggregation ----------------
// Pulls headlines from a handful of free, public RSS feeds plus Hacker News'
// free Algolia search API, tags items as "controversial" (keyword match) or
// "highly discussed" (HN points/comments), tags items that mention a tool in
// our own database, and stores the merged list as JSON in the NEWS KV
// namespace. No paid API keys involved anywhere in this pipeline.

const RSS_FEEDS = [
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", source: "TechCrunch" },
  { url: "https://venturebeat.com/category/ai/feed/", source: "VentureBeat" },
  { url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", source: "MIT Technology Review" },
  { url: "https://www.wired.com/feed/tag/ai/latest/rss", source: "Wired" },
];

const CONTROVERSY_KEYWORDS = [
  "lawsuit", "sues", "sued", "backlash", "slams", "blasts", "accuses", "accused",
  "scandal", "fraud", "fired", "resigns", "resignation", "shuts down", "shutting down",
  "shut down", "layoffs", "laid off", "controversy", "controversial", "warns",
  "warning", "bans", "banned", "criticized", "criticizes", "outrage", "under fire",
  "probe", "investigation", "fined", "copyright", "plagiar", "deepfake", "backlash",
  "whistleblower", "leaked", "exploited", "misled", "deceptive", "recall",
];

const TOOL_NAMES = ["10Web", "AI2SQL", "AIVA", "Adobe Firefly", "Airtable", "AltText.ai", "Amazon Q Developer", "Apollo.io", "Astra Security", "Auphonic", "Beautiful.ai", "Beehiiv", "Bland AI", "Bolt.new", "Bonsai", "Buffer", "Calendly", "Calm", "Canva Magic Studio", "CapCut", "ChatGPT", "ChatGPT Atlas", "Chatbase", "Chattermill", "Claude", "Clay", "Cleo", "ClickUp Brain", "CodeRabbit", "Consensus", "Copilot Money", "Copy.ai", "Craft", "Creatify", "Cursor", "D-ID", "Danelfin", "DeepL", "DeepSeek", "Descript", "Devin", "DocuSign", "Dovetail", "Durable", "ElevenLabs", "Elicit", "Epique AI", "Fathom", "Fireflies.ai", "Fitbod", "Flux", "Framer", "Freepik AI", "GPTZero", "Gamma", "Gemini", "GitHub Copilot", "Grain", "Grammarly", "Grok", "Harness AI", "HeyGen", "HireVue", "Hootsuite", "HubSpot Free CRM", "Ideogram", "Instantly.ai", "Intercom Fin", "Interior AI", "Ironclad", "Jasper", "Jobscan", "Juicebox", "Julius AI", "Kagi", "Kapwing", "Khanmigo", "Klevu", "Kling AI", "Koala AI", "Krea AI", "Leonardo AI", "Lokalise", "Looka", "Loom", "Lovable", "Luma Dream Machine", "Luminance", "MagicSchool AI", "Make", "Manus", "Mem", "Meshy", "Meta AI", "Microsoft Copilot", "Midjourney", "Mistral Le Chat", "Monarch Money", "Motion", "Murf AI", "MyFitnessPal", "Noom", "NotebookLM", "Notion AI", "Numerous.ai", "Obviously AI", "OpusClip", "Originality.ai", "Otter.ai", "PandaDoc", "Paradox", "Perplexity Comet", "Perplexity Pro", "Photoroom", "Pictory", "Pika", "Play.ht", "Plus AI", "Podium", "Poe", "QuickBooks Solopreneur", "QuillBot", "Quizlet", "Rask AI", "Reclaim.ai", "Recraft", "Recruiterflow", "Reflect", "RemodelAI", "Replit Agent", "Respeecher", "Rev", "Rezi", "Riverside.fm", "Robin AI", "Rocket Money", "Rows", "Runway", "Rytr", "Seeking Alpha Premium", "Semrush", "Shopify Magic", "Shortwave", "Soundraw", "Spellbook", "Stable Diffusion", "StoryChief", "Sudowrite", "Suno", "Surfer SEO", "Synthesia", "Tabnine", "Tana", "Teal", "Tidio", "Toggl Track", "Tripo AI", "Typeform", "Udio", "Uizard", "Vanna AI", "Vapi", "Veo", "Virtual Staging AI", "Webflow", "Whoop", "Windsurf", "Wispr Flow", "Wix", "Wiz", "Writesonic", "You.com", "Zapier AI Actions", "n8n", "v0"];

// Common-word tool names excluded from auto-tagging to avoid false matches
// against ordinary headline text (e.g. "Motion", "Craft", "Clay").
const TOOL_MATCH_EXCLUDE = new Set([
  "Clay", "Craft", "Motion", "Rev", "Wix", "Poe", "Grain", "Mem", "Cleo", "Whoop",
  "Rows", "Teal", "Calm", "Buffer", "Flux", "Loom", "Jasper", "Devin", "Elicit",
  "Consensus", "Reflect", "Durable", "Fathom", "Podium", "Paradox", "Wiz",
]);

function cleanText(s) {
  if (!s) return "";
  s = s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
  s = s.replace(/<[^>]+>/g, " ");
  // Decode numeric HTML entities generically (smart quotes, en/em dashes,
  // ellipses, etc. all come through RSS as &#8217; / &#x2019; style codes).
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  s = s.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  s = s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
  return s.replace(/\s+/g, " ").trim();
}

function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? m[1] : "";
}

function matchTools(text) {
  const found = [];
  for (const name of TOOL_NAMES) {
    if (TOOL_MATCH_EXCLUDE.has(name)) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(text)) found.push(name);
    if (found.length >= 3) break;
  }
  return found;
}

function isControversial(text) {
  const lower = text.toLowerCase();
  return CONTROVERSY_KEYWORDS.some((kw) => lower.includes(kw));
}

function parseRSS(xml, source) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/g) || [];
  for (const block of blocks) {
    const title = cleanText(extractTag(block, "title"));
    const link = cleanText(extractTag(block, "link") || extractTag(block, "guid"));
    const pubDateRaw = extractTag(block, "pubDate") || extractTag(block, "dc:date");
    const excerpt = cleanText(extractTag(block, "description")).slice(0, 220);
    if (!title || !link) continue;
    let published;
    const parsed = pubDateRaw ? new Date(pubDateRaw) : null;
    published = parsed && !isNaN(parsed) ? parsed.toISOString() : new Date().toISOString();
    const combined = `${title} ${excerpt}`;
    items.push({
      title,
      link,
      source,
      published,
      excerpt,
      controversial: isControversial(combined),
      tools: matchTools(combined),
    });
  }
  return items;
}

async function fetchHackerNews() {
  try {
    const res = await fetch(
      "https://hn.algolia.com/api/v1/search_by_date?tags=story&query=AI&hitsPerPage=50"
    );
    if (!res.ok) return [];
    const data = await res.json();
    const hits = data.hits || [];
    return hits
      // Hacker News posts far more often than the RSS sources here, so only
      // keep stories with real discussion behind them (or a controversy
      // keyword hit). Otherwise HN's raw volume crowds out TechCrunch,
      // VentureBeat, MIT Technology Review, and Wired in the merged feed.
      .filter((h) => h.title && ((h.points || 0) >= 20 || (h.num_comments || 0) >= 15 || isControversial(h.title)))
      .map((h) => {
        const link = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
        const title = cleanText(h.title);
        const highlyDiscussed = (h.points || 0) >= 150 || (h.num_comments || 0) >= 100;
        return {
          title,
          link,
          source: "Hacker News",
          published: h.created_at ? new Date(h.created_at).toISOString() : new Date().toISOString(),
          excerpt: highlyDiscussed
            ? `${h.points || 0} points, ${h.num_comments || 0} comments on Hacker News.`
            : "",
          controversial: highlyDiscussed || isControversial(title),
          tools: matchTools(title),
        };
      });
  } catch (err) {
    return [];
  }
}

// ---------------- D&D flavor text ----------------
// Generates a short, nerdy, sarcastic Dungeons & Dragons-flavored one-liner
// for a news item via Workers AI (free-tier model, no external API key).
// Failures are swallowed and simply leave the item without flavor text, this
// is decoration, not core functionality, so it should never break the feed.

const FLAVOR_SYSTEM_PROMPT =
  "You are a snarky, nerdy Dungeon Master narrating tech industry news headlines " +
  "as quest-log entries from a tabletop RPG campaign. Given a news headline and a " +
  "short excerpt, write exactly ONE short, funny, sarcastic sentence, maximum 22 " +
  "words, using Dungeons & Dragons flavor: things like quests, loot, saving throws, " +
  "NPCs, dice rolls, dungeons, critical fails or hits, XP, campaigns, alignment, " +
  "or party wipes. Do not use hashtags or emoji. Do not repeat the headline " +
  "verbatim. Output ONLY the sentence itself, no quotation marks, no preamble, no " +
  "label.";

async function generateFlavor(title, excerpt, env) {
  if (!env.AI) return null;
  try {
    const result = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
      messages: [
        { role: "system", content: FLAVOR_SYSTEM_PROMPT },
        { role: "user", content: `Headline: ${title}\nExcerpt: ${excerpt || "(none)"}` },
      ],
      max_tokens: 60,
    });
    let text = (result && (result.response || result.result || "")).toString().trim();
    // Strip wrapping quotes and any stray "DM:" style prefix the model adds.
    text = text.replace(/^["'“]+|["'”]+$/g, "").trim();
    text = text.replace(/^(DM|Narrator|Quest Log)\s*[:\-]\s*/i, "").trim();
    if (!text) return null;
    return text.length > 220 ? text.slice(0, 217).trimEnd() + "..." : text;
  } catch (err) {
    return null;
  }
}

// Cap how many brand-new items get a flavor-text AI call per scheduled run,
// so a big batch of fresh headlines can't blow the Worker's CPU/time budget.
// Leftover new items without flavor text just get picked up on the next run.
const MAX_FLAVOR_PER_RUN = 15;

async function attachFlavor(items, previousByLink, env) {
  let budget = MAX_FLAVOR_PER_RUN;
  for (const item of items) {
    const prev = previousByLink.get(item.link);
    if (prev && prev.flavor) {
      item.flavor = prev.flavor;
      continue;
    }
    if (budget <= 0) {
      item.flavor = prev ? prev.flavor || null : null;
      continue;
    }
    budget -= 1;
    item.flavor = await generateFlavor(item.title, item.excerpt, env);
  }
  return items;
}

async function gatherNews(env) {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "SolosGemsNewsBot/1.0 (+https://solosgems.com)" },
      });
      if (!res.ok) return [];
      const xml = await res.text();
      return parseRSS(xml, feed.source);
    })
  );

  let items = [];
  for (const r of results) {
    if (r.status === "fulfilled") items = items.concat(r.value);
  }

  const hnItems = await fetchHackerNews();
  items = items.concat(hnItems);

  // Dedupe by link, keep newest, sort by published desc, cap the list.
  const byLink = new Map();
  for (const item of items) {
    const existing = byLink.get(item.link);
    if (!existing || new Date(item.published) > new Date(existing.published)) {
      byLink.set(item.link, item);
    }
  }
  const deduped = Array.from(byLink.values()).sort(
    (a, b) => new Date(b.published) - new Date(a.published)
  );
  const capped = deduped.slice(0, 70);

  // Load the previous run's items so already-flavored stories keep their
  // flavor text instead of paying for a fresh AI call every 6 hours.
  let previousByLink = new Map();
  if (env.NEWS) {
    const prevRaw = await env.NEWS.get("latest");
    if (prevRaw) {
      try {
        const prev = JSON.parse(prevRaw);
        for (const it of prev.items || []) previousByLink.set(it.link, it);
      } catch (err) {
        // ignore malformed previous payload
      }
    }
  }

  await attachFlavor(capped, previousByLink, env);

  const payload = {
    generated_at: new Date().toISOString(),
    count: capped.length,
    items: capped,
  };

  if (env.NEWS) {
    await env.NEWS.put("latest", JSON.stringify(payload));
  }
  return payload;
}

async function handleGetNews(env) {
  if (!env.NEWS) {
    return new Response(JSON.stringify({ generated_at: null, count: 0, items: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  const stored = await env.NEWS.get("latest");
  const body = stored || JSON.stringify({ generated_at: null, count: 0, items: [] });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}

async function handleRefreshNews(env) {
  if (!env.NEWS) {
    return new Response(JSON.stringify({ ok: false, error: "NEWS KV not bound" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cooldown: skip if refreshed in the last 10 minutes, to stop this endpoint
  // from being hammered into spamming outbound requests to news sites.
  const existingRaw = await env.NEWS.get("latest");
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw);
      if (existing.generated_at) {
        const age = Date.now() - new Date(existing.generated_at).getTime();
        if (age < 10 * 60 * 1000) {
          return new Response(
            JSON.stringify({ ok: true, skipped: true, reason: "refreshed recently", ...existing }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    } catch (err) {
      // fall through and refresh anyway if stored value is malformed
    }
  }

  const payload = await gatherNews(env);
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------- Temporary: batch image generation ----------------
// Manually-keyed, undocumented endpoint used to regenerate the D&D-style
// review hero images via Workers AI (flux-1-schnell). Not linked anywhere on
// the site and not meant to stay live long-term, remove this route and
// function once the one-time image batch is done.
const GEN_IMAGE_KEY = "sg-dnd-batch-8h2p4n";

async function handleGenImage(request, env) {
  if (!env.AI) {
    return new Response(JSON.stringify({ ok: false, error: "AI binding not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== GEN_IMAGE_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const prompt = url.searchParams.get("prompt");
  if (!prompt) {
    return new Response(JSON.stringify({ ok: false, error: "missing prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const seed = url.searchParams.get("seed");
  try {
    const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: prompt.slice(0, 2048),
      steps: 6,
      ...(seed ? { seed: parseInt(seed, 10) } : {}),
    });
    return new Response(JSON.stringify({ ok: true, image: result.image }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ---------------- Realm map (AI activity by region) ----------------
// Powers /realms.html. Three real, free, no-key data sources, each doing a
// different honest job rather than pretending to be one unified "usage"
// number:
//   1. GDELT (api.gdeltproject.org) - a free, no-auth global news-monitoring
//      API. mode=timelinesourcecountry gives a same-request breakdown of
//      which countries are publishing the most news mentioning AI tools
//      right now. This drives the map markers.
//   2. Wikipedia's official Pageviews REST API (wikimedia.org) - real daily
//      article view counts, no key required. Used as a "what people are
//      reading about" interest signal per tool. It is NOT a per-country
//      breakdown (Wikipedia doesn't expose that), so it is presented as a
//      global interest ranking, not mapped to the globe.
//   3. GitHub's public search API - real repo data. GitHub does not expose
//      contributor location at any usable scale for free, so this is a
//      global "what's being built" trending list, not a per-country map
//      layer either.
// NOTE: an earlier version of this fired ~20 separate GDELT requests per
// run (one global timeline query plus one per probe tool plus one per top
// country for headlines). GDELT's API explicitly asks for one request every
// 5 seconds; confirmed live that hitting it faster returns a plain-text
// rate-limit notice instead of JSON, which silently produced empty country
// data. gatherGlobalCountryMentions() below makes exactly one GDELT call
// per run and derives everything else (counts, headlines, hot tool) from
// that single response.

// A curated set of countries GDELT commonly attributes AI-related coverage
// to, with approximate centroids (lat, lon) used to place map markers via
// an equirectangular projection, and the FIPS 10-4 two-letter code GDELT's
// sourcecountry: filter expects (used only for the follow-up per-country
// and per-tool queries below, not for the initial global breakdown).
const REALM_COUNTRIES = {
  "United States": { fips: "US", lat: 39.8, lon: -98.6 },
  "United Kingdom": { fips: "UK", lat: 54.0, lon: -2.0 },
  "Canada": { fips: "CA", lat: 56.1, lon: -106.3 },
  "Germany": { fips: "GM", lat: 51.2, lon: 10.4 },
  "France": { fips: "FR", lat: 46.6, lon: 2.2 },
  "Japan": { fips: "JA", lat: 36.2, lon: 138.3 },
  "China": { fips: "CH", lat: 35.9, lon: 104.2 },
  "India": { fips: "IN", lat: 22.0, lon: 79.0 },
  "Brazil": { fips: "BR", lat: -10.3, lon: -53.2 },
  "Australia": { fips: "AS", lat: -25.3, lon: 133.8 },
  "South Korea": { fips: "KS", lat: 36.5, lon: 127.8 },
  "Russia": { fips: "RS", lat: 61.5, lon: 100.0 },
  "South Africa": { fips: "SF", lat: -30.6, lon: 22.9 },
  "Mexico": { fips: "MX", lat: 23.6, lon: -102.5 },
  "Italy": { fips: "IT", lat: 41.9, lon: 12.6 },
  "Spain": { fips: "SP", lat: 40.5, lon: -3.7 },
  "Netherlands": { fips: "NL", lat: 52.1, lon: 5.3 },
  "Singapore": { fips: "SN", lat: 1.35, lon: 103.8 },
  "Indonesia": { fips: "ID", lat: -0.8, lon: 113.9 },
  "Israel": { fips: "IS", lat: 31.0, lon: 34.8 },
  "Nigeria": { fips: "NI", lat: 9.1, lon: 8.7 },
  "Poland": { fips: "PL", lat: 51.9, lon: 19.1 },
  "Sweden": { fips: "SW", lat: 60.1, lon: 18.6 },
  "Ukraine": { fips: "UP", lat: 48.4, lon: 31.2 },
  "Taiwan": { fips: "TW", lat: 23.7, lon: 121.0 },
};

// Used for the Wikipedia pageviews "search interest" column.
// Article titles must match Wikipedia's exact page title.
const REALM_WIKI_TOOLS = [
  { tool: "ChatGPT", article: "ChatGPT" },
  { tool: "Claude", article: "Claude_(language_model)" },
  { tool: "Gemini", article: "Gemini_(chatbot)" },
  { tool: "Midjourney", article: "Midjourney" },
  { tool: "Perplexity", article: "Perplexity_AI" },
  { tool: "GitHub Copilot", article: "GitHub_Copilot" },
  { tool: "Grok", article: "Grok_(chatbot)" },
  { tool: "DeepSeek", article: "DeepSeek" },
  { tool: "Runway", article: "Runway_(company)" },
  { tool: "Notion AI", article: "Notion_(productivity_software)" },
];

const GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc";
const MAX_REALM_FLAVOR_PER_RUN = 6; // caption+image generation is the expensive part

function slugifyToolName(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function fetchJsonSafe(url, options) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      return null;
    }
  } catch (err) {
    return null;
  }
}

// A single GDELT ArtList call, grouped locally by each article's documented
// "sourcecountry" field. This replaces an earlier design that fired off
// roughly 20 separate GDELT requests per run (one global + one per probe
// tool + one per top country for headlines) - GDELT's API explicitly asks
// for one request every 5 seconds, so that design got silently rate-limited
// (confirmed live: GDELT returns a plain-text "Please limit requests to one
// every 5 seconds..." message instead of JSON when hit too fast, which
// fetchJsonSafe correctly treats as unparseable and returns null for,
// resulting in empty countries). One call avoids the problem entirely and
// gets mention counts, sample headlines, and hot-tool detection (via the
// existing matchTools() used by the news pipeline) all from the same
// response.
async function gatherGlobalCountryMentions() {
  const query = encodeURIComponent(
    '"artificial intelligence" OR "AI tool" OR "AI chatbot" OR chatgpt OR claude'
  );
  const url = `${GDELT_BASE}?query=${query}&mode=artlist&maxrecords=250&format=json&timespan=3d&sort=hybridrel`;
  const json = await fetchJsonSafe(url, {
    headers: { "User-Agent": "SolosGemsRealmBot/1.0 (+https://solosgems.com)" },
  });
  const articles = (json && (json.articles || json.Articles)) || [];

  const byCountry = new Map();
  for (const a of articles) {
    const country = ((a.sourcecountry || a.SourceCountry || a.sourceCountry || "") + "").trim();
    if (!country || !REALM_COUNTRIES[country]) continue;
    const title = cleanText(a.title || a.Title || "");
    const link = a.url || a.URL || "";
    const domain = a.domain || a.Domain || "";
    if (!byCountry.has(country)) byCountry.set(country, { count: 0, headlines: [], titles: [] });
    const entry = byCountry.get(country);
    entry.count += 1;
    if (title) entry.titles.push(title);
    if (entry.headlines.length < 3 && title && link) {
      entry.headlines.push({ title, link, source: domain });
    }
  }

  return Array.from(byCountry.entries())
    .map(([country, data]) => ({
      country,
      value: data.count,
      headlines: data.headlines,
      hotTool: matchTools(data.titles.join(" . "))[0] || null,
    }))
    .sort((a, b) => b.value - a.value);
}

async function gatherGithubTrending(env) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
    `topic:ai created:>${since}`
  )}&sort=stars&order=desc&per_page=10`;
  const headers = {
    "User-Agent": "SolosGemsRealmBot/1.0 (+https://solosgems.com)",
    Accept: "application/vnd.github+json",
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const json = await fetchJsonSafe(url, { headers });
  const items = (json && json.items) || [];
  return items.slice(0, 10).map((r) => ({
    name: r.full_name,
    url: r.html_url,
    description: cleanText(r.description || "").slice(0, 160),
    stars: r.stargazers_count || 0,
    language: r.language || null,
    createdAt: r.created_at || null,
  }));
}

async function gatherWikiInterest() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const results = await Promise.allSettled(
    REALM_WIKI_TOOLS.map(async ({ tool, article }) => {
      const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${article}/daily/${fmt(
        start
      )}/${fmt(end)}`;
      const json = await fetchJsonSafe(url, {
        headers: { "User-Agent": "SolosGemsRealmBot/1.0 (+https://solosgems.com)" },
      });
      const items = (json && json.items) || [];
      if (!items.length) return null;
      const totalViews = items.reduce((sum, it) => sum + (it.views || 0), 0);
      const half = Math.ceil(items.length / 2);
      const firstHalf = items.slice(0, half).reduce((s, it) => s + (it.views || 0), 0);
      const secondHalf = items.slice(half).reduce((s, it) => s + (it.views || 0), 0);
      const trendPct = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : null;
      return {
        tool,
        article,
        views7d: totalViews,
        trendPct,
        wikipediaUrl: `https://en.wikipedia.org/wiki/${article}`,
      };
    })
  );
  return results
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value)
    .sort((a, b) => b.views7d - a.views7d);
}

const REALM_CAPTION_SYSTEM_PROMPT =
  "You are a snarky, nerdy Dungeon Master narrating real-world AI adoption data as a " +
  "region on a fantasy campaign map. You will be given real numbers about one country's " +
  "AI-related news coverage. Use ONLY the facts given to you, do not invent any statistic, " +
  "date, or claim not present in the input. Respond with ONLY a JSON object, no markdown " +
  "fencing, no commentary, with exactly these keys: " +
  '{"dndCaption": "one sarcastic D&D-flavored sentence, max 22 words, using quest/loot/dice/NPC ' +
  'style language, about this region", "meaning": "1-2 plain sentences on what this region\'s ' +
  'AI coverage volume and top tool could mean, grounded only in the given numbers", ' +
  '"whyInteresting": "1 sentence on why this specific data point is interesting", ' +
  '"coolFact": "1 short sentence restating or contextualizing one of the given numbers in a ' +
  'fun way, not a new invented fact"}';

async function generateRealmCaption(countryName, stats, env) {
  if (!env.AI) return null;
  const input = `Country: ${countryName}\nAI news mentions (3-day GDELT volume score): ${stats.mentions}\nRank among tracked countries: ${stats.rank}\nMost-mentioned AI tool in this country's coverage: ${stats.hotTool || "unclear"}\nSample headline: ${stats.sampleHeadline || "none available"}`;
  try {
    const result = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
      messages: [
        { role: "system", content: REALM_CAPTION_SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
      max_tokens: 220,
    });
    let text = (result && (result.response || result.result || "")).toString().trim();
    text = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(text);
    if (!parsed.dndCaption || !parsed.meaning) return null;
    return {
      dndCaption: String(parsed.dndCaption).slice(0, 240),
      meaning: String(parsed.meaning).slice(0, 400),
      whyInteresting: String(parsed.whyInteresting || "").slice(0, 240),
      coolFact: String(parsed.coolFact || "").slice(0, 240),
    };
  } catch (err) {
    return null;
  }
}

async function generateRealmImage(countryName, hotTool, env) {
  if (!env.AI) return null;
  const prompt =
    `Retro pixel-art fantasy video game illustration representing the AI-adoption region of ` +
    `${countryName} as a glowing rune tower or adventurer's camp on a fantasy world map, ` +
    `subtly nodding to ${hotTool || "artificial intelligence"}, warm amber and rust color ` +
    `palette, no readable text, no logos, no real brand marks`;
  try {
    const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: prompt.slice(0, 2048),
      steps: 6,
    });
    return result && result.image ? `data:image/jpeg;base64,${result.image}` : null;
  } catch (err) {
    return null;
  }
}

async function gatherRealms(env) {
  if (env.REALMS) {
    const prevRaw = await env.REALMS.get("latest");
    if (prevRaw) {
      try {
        const prev = JSON.parse(prevRaw);
        if (prev.generated_at) {
          const age = Date.now() - new Date(prev.generated_at).getTime();
          if (age < 6 * 60 * 60 * 1000) return prev; // self-throttle, refreshed less than 6h ago
        }
      } catch (err) {
        // fall through and regenerate if stored value is malformed
      }
    }
  }

  const globalCountries = await gatherGlobalCountryMentions();
  const topGlobal = globalCountries.slice(0, 12);

  let previousByCountry = new Map();
  if (env.REALMS) {
    const prevRaw = await env.REALMS.get("latest");
    if (prevRaw) {
      try {
        const prev = JSON.parse(prevRaw);
        for (const c of prev.countries || []) previousByCountry.set(c.name, c);
      } catch (err) {
        // ignore malformed previous payload
      }
    }
  }

  let flavorBudget = MAX_REALM_FLAVOR_PER_RUN;
  const countries = [];
  for (let i = 0; i < topGlobal.length; i++) {
    const entry = topGlobal[i];
    const meta = REALM_COUNTRIES[entry.country];
    const headlines = entry.headlines || [];
    const stats = {
      mentions: entry.value,
      rank: i + 1,
      hotTool: entry.hotTool || null,
      sampleHeadline: headlines[0] ? headlines[0].title : null,
    };

    const prev = previousByCountry.get(entry.country);
    let caption = null;
    let image = null;
    const sameHotTool = prev && prev.hotTool === stats.hotTool;
    if (prev && sameHotTool && prev.caption) {
      caption = prev.caption;
      image = prev.image || null;
    } else if (flavorBudget > 0) {
      flavorBudget -= 1;
      caption = await generateRealmCaption(entry.country, stats, env);
      image = await generateRealmImage(entry.country, stats.hotTool, env);
    } else if (prev) {
      caption = prev.caption || null;
      image = prev.image || null;
    }

    const reviewLink = stats.hotTool ? `reviews/${slugifyToolName(stats.hotTool)}.html` : null;

    countries.push({
      name: entry.country,
      fips: meta.fips,
      lat: meta.lat,
      lon: meta.lon,
      mentions: stats.mentions,
      rank: stats.rank,
      hotTool: stats.hotTool,
      reviewLink,
      headlines,
      caption,
      image,
    });
  }

  const [githubTrending, wikiInterest] = await Promise.all([
    gatherGithubTrending(env),
    gatherWikiInterest(),
  ]);

  const payload = {
    generated_at: new Date().toISOString(),
    countries,
    categories: {
      newsMentions: countries.map((c) => ({
        name: c.name,
        mentions: c.mentions,
        rank: c.rank,
        hotTool: c.hotTool,
        headlines: c.headlines,
      })),
      searchInterest: wikiInterest,
      buildActivity: githubTrending,
    },
  };

  if (env.REALMS) {
    await env.REALMS.put("latest", JSON.stringify(payload));
  }
  return payload;
}

async function handleGetRealms(env) {
  if (!env.REALMS) {
    return new Response(
      JSON.stringify({ generated_at: null, countries: [], categories: {} }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
  const stored = await env.REALMS.get("latest");
  const body = stored || JSON.stringify({ generated_at: null, countries: [], categories: {} });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}

async function handleRefreshRealms(env) {
  if (!env.REALMS) {
    return new Response(JSON.stringify({ ok: false, error: "REALMS KV not bound" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const payload = await gatherRealms(env);
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
