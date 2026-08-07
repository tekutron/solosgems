// Worker entry point. Static assets (HTML/CSS/JS/images) under assets.directory
// are served automatically without hitting this script. This fetch handler only
// runs for requests that don't match a static asset, i.e. the /api/subscribe,
// /api/submit, and /api/news routes. The scheduled() export runs on a cron
// trigger to refresh the news feed stored in the NEWS KV namespace.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(gatherNews(env));
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
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
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
      .filter((h) => h.title)
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
  const capped = deduped.slice(0, 60);

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
