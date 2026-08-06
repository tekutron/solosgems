// Solos Gems tool finder quiz
// Data mirrors data/rankings.json (regenerate data/quiz-tools.json and re-paste if scores change).
(function () {
  var TOOLS = [
  {
    "slug": "canva-magic-studio",
    "name": "Canva Magic Studio",
    "category": "Design",
    "rank": 1,
    "score": 8.7,
    "value": 9.0,
    "capability": 8.0,
    "ease": 9.5,
    "trial": 8.5,
    "badge": null,
    "url": "reviews/canva-magic-studio.html"
  },
  {
    "slug": "notebooklm",
    "name": "NotebookLM",
    "category": "Research & Knowledge",
    "rank": 2,
    "score": 8.6,
    "value": 9.5,
    "capability": 8.0,
    "ease": 8.5,
    "trial": 9.5,
    "badge": "Best Free Tier",
    "url": "reviews/notebooklm.html"
  },
  {
    "slug": "fireflies-ai",
    "name": "Fireflies.ai",
    "category": "Meetings & Notes",
    "rank": 3,
    "score": 8.4,
    "value": 9.0,
    "capability": 8.0,
    "ease": 8.5,
    "trial": 9.5,
    "badge": "Best Value",
    "url": "reviews/fireflies-ai.html"
  },
  {
    "slug": "beehiiv",
    "name": "Beehiiv",
    "category": "Newsletters",
    "rank": 4,
    "score": 8.2,
    "value": 8.5,
    "capability": 8.0,
    "ease": 8.0,
    "trial": 8.5,
    "badge": "Safest Free Trial",
    "url": "reviews/beehiiv.html"
  },
  {
    "slug": "grammarly",
    "name": "Grammarly",
    "category": "Writing Assistant",
    "rank": 5,
    "score": 8.1,
    "value": 8.0,
    "capability": 7.0,
    "ease": 9.5,
    "trial": 8.5,
    "badge": null,
    "url": "reviews/grammarly.html"
  },
  {
    "slug": "otter-ai",
    "name": "Otter.ai",
    "category": "Meetings & Notes",
    "rank": 6,
    "score": 8.0,
    "value": 7.5,
    "capability": 8.0,
    "ease": 8.5,
    "trial": 8.0,
    "badge": null,
    "url": "reviews/otter-ai.html"
  },
  {
    "slug": "photoroom",
    "name": "Photoroom",
    "category": "Product Photography",
    "rank": 7,
    "score": 7.9,
    "value": 8.5,
    "capability": 7.5,
    "ease": 8.5,
    "trial": 8.0,
    "badge": null,
    "url": "reviews/photoroom.html"
  },
  {
    "slug": "descript",
    "name": "Descript",
    "category": "Video & Audio",
    "rank": 8,
    "score": 7.8,
    "value": 7.0,
    "capability": 9.0,
    "ease": 7.5,
    "trial": 7.5,
    "badge": "Most Powerful",
    "url": "reviews/descript.html"
  },
  {
    "slug": "koala-ai",
    "name": "Koala AI",
    "category": "SEO Content",
    "rank": 9,
    "score": 7.7,
    "value": 8.0,
    "capability": 7.0,
    "ease": 7.5,
    "trial": 8.0,
    "badge": null,
    "url": "reviews/koala-ai.html"
  },
  {
    "slug": "airtable",
    "name": "Airtable",
    "category": "No-code / Database",
    "rank": 10,
    "score": 7.6,
    "value": 7.5,
    "capability": 8.5,
    "ease": 6.5,
    "trial": 8.5,
    "badge": null,
    "url": "reviews/airtable.html"
  },
  {
    "slug": "wispr-flow",
    "name": "Wispr Flow",
    "category": "Voice Dictation",
    "rank": 11,
    "score": 7.55,
    "value": 8.0,
    "capability": 7.0,
    "ease": 9.0,
    "trial": 8.5,
    "badge": null,
    "url": "reviews/wispr-flow.html"
  },
  {
    "slug": "clickup-ai",
    "name": "ClickUp Brain",
    "category": "Project Management",
    "rank": 12,
    "score": 7.5,
    "value": 7.5,
    "capability": 8.0,
    "ease": 6.5,
    "trial": 7.5,
    "badge": null,
    "url": "reviews/clickup-ai.html"
  },
  {
    "slug": "toggl-track",
    "name": "Toggl Track",
    "category": "Time Tracking",
    "rank": 13,
    "score": 7.4,
    "value": 8.0,
    "capability": 6.0,
    "ease": 8.5,
    "trial": 8.5,
    "badge": null,
    "url": "reviews/toggl-track.html"
  },
  {
    "slug": "calendly",
    "name": "Calendly",
    "category": "Scheduling",
    "rank": 14,
    "score": 7.3,
    "value": 7.0,
    "capability": 6.0,
    "ease": 8.5,
    "trial": 8.0,
    "badge": "Easiest Start",
    "url": "reviews/calendly.html"
  },
  {
    "slug": "bonsai",
    "name": "Bonsai",
    "category": "Client Management",
    "rank": 15,
    "score": 7.2,
    "value": 7.5,
    "capability": 7.0,
    "ease": 7.0,
    "trial": 7.5,
    "badge": null,
    "url": "reviews/bonsai.html"
  },
  {
    "slug": "hubspot-free-crm",
    "name": "HubSpot Free CRM",
    "category": "CRM & Sales",
    "rank": 16,
    "score": 7.1,
    "value": 7.0,
    "capability": 6.5,
    "ease": 7.0,
    "trial": 7.8,
    "badge": null,
    "url": "reviews/hubspot-free-crm.html"
  },
  {
    "slug": "loom",
    "name": "Loom",
    "category": "Video & Async Comms",
    "rank": 17,
    "score": 7.0,
    "value": 6.5,
    "capability": 7.0,
    "ease": 9.0,
    "trial": 6.0,
    "badge": null,
    "url": "reviews/loom.html"
  },
  {
    "slug": "numerous-ai",
    "name": "Numerous.ai",
    "category": "Spreadsheet AI",
    "rank": 18,
    "score": 6.95,
    "value": 8.0,
    "capability": 5.5,
    "ease": 8.5,
    "trial": 7.5,
    "badge": null,
    "url": "reviews/numerous-ai.html"
  },
  {
    "slug": "gamma",
    "name": "Gamma",
    "category": "Presentations",
    "rank": 19,
    "score": 6.9,
    "value": 6.0,
    "capability": 7.5,
    "ease": 8.0,
    "trial": 6.0,
    "badge": null,
    "url": "reviews/gamma.html"
  },
  {
    "slug": "make",
    "name": "Make",
    "category": "Automation",
    "rank": 20,
    "score": 6.8,
    "value": 7.5,
    "capability": 7.0,
    "ease": 6.0,
    "trial": 7.5,
    "badge": null,
    "url": "reviews/make.html"
  },
  {
    "slug": "midjourney",
    "name": "Midjourney",
    "category": "Image Generation",
    "rank": 21,
    "score": 6.7,
    "value": 6.0,
    "capability": 9.0,
    "ease": 6.0,
    "trial": 4.5,
    "badge": null,
    "url": "reviews/midjourney.html"
  },
  {
    "slug": "shortwave",
    "name": "Shortwave",
    "category": "Email Management",
    "rank": 22,
    "score": 6.6,
    "value": 6.0,
    "capability": 7.0,
    "ease": 7.5,
    "trial": 6.0,
    "badge": null,
    "url": "reviews/shortwave.html"
  },
  {
    "slug": "copyai-vs-jasper",
    "name": "Copy.ai vs. Jasper",
    "category": "Copywriting",
    "rank": 23,
    "score": 6.5,
    "value": 6.5,
    "capability": 6.0,
    "ease": 7.0,
    "trial": 7.0,
    "badge": null,
    "url": "reviews/copyai-vs-jasper.html"
  },
  {
    "slug": "framer",
    "name": "Framer",
    "category": "Website Builder",
    "rank": 24,
    "score": 6.4,
    "value": 6.0,
    "capability": 7.0,
    "ease": 6.5,
    "trial": 6.5,
    "badge": null,
    "url": "reviews/framer.html"
  },
  {
    "slug": "zapier-ai",
    "name": "Zapier AI Actions",
    "category": "Automation",
    "rank": 25,
    "score": 6.3,
    "value": 5.5,
    "capability": 7.5,
    "ease": 6.0,
    "trial": 6.5,
    "badge": null,
    "url": "reviews/zapier-ai.html"
  },
  {
    "slug": "riverside",
    "name": "Riverside.fm",
    "category": "Podcasting",
    "rank": 26,
    "score": 6.2,
    "value": 5.5,
    "capability": 7.0,
    "ease": 7.0,
    "trial": 6.0,
    "badge": null,
    "url": "reviews/riverside.html"
  },
  {
    "slug": "suno",
    "name": "Suno",
    "category": "Music Generation",
    "rank": 27,
    "score": 6.15,
    "value": 7.0,
    "capability": 6.5,
    "ease": 8.5,
    "trial": 6.5,
    "badge": null,
    "url": "reviews/suno.html"
  },
  {
    "slug": "elevenlabs",
    "name": "ElevenLabs",
    "category": "AI Voice",
    "rank": 28,
    "score": 6.1,
    "value": 5.5,
    "capability": 8.0,
    "ease": 6.5,
    "trial": 5.0,
    "badge": null,
    "url": "reviews/elevenlabs.html"
  },
  {
    "slug": "chatbase",
    "name": "Chatbase",
    "category": "Customer Support",
    "rank": 29,
    "score": 6.0,
    "value": 5.0,
    "capability": 7.0,
    "ease": 6.5,
    "trial": 6.5,
    "badge": null,
    "url": "reviews/chatbase.html"
  },
  {
    "slug": "cursor",
    "name": "Cursor",
    "category": "Coding",
    "rank": 30,
    "score": 5.9,
    "value": 6.5,
    "capability": 8.0,
    "ease": 5.5,
    "trial": 6.0,
    "badge": null,
    "url": "reviews/cursor.html"
  },
  {
    "slug": "quickbooks-solopreneur",
    "name": "QuickBooks Solopreneur",
    "category": "Bookkeeping",
    "rank": 31,
    "score": 5.8,
    "value": 5.5,
    "capability": 4.5,
    "ease": 7.0,
    "trial": 6.5,
    "badge": null,
    "url": "reviews/quickbooks-solopreneur.html"
  },
  {
    "slug": "opusclip",
    "name": "OpusClip",
    "category": "Video Repurposing",
    "rank": 32,
    "score": 5.7,
    "value": 5.5,
    "capability": 6.5,
    "ease": 7.0,
    "trial": 5.5,
    "badge": null,
    "url": "reviews/opusclip.html"
  },
  {
    "slug": "vercel-v0",
    "name": "v0",
    "category": "UI Generation",
    "rank": 33,
    "score": 5.65,
    "value": 4.5,
    "capability": 8.5,
    "ease": 6.0,
    "trial": 6.0,
    "badge": null,
    "url": "reviews/vercel-v0.html"
  },
  {
    "slug": "runway",
    "name": "Runway",
    "category": "Video Generation",
    "rank": 34,
    "score": 5.6,
    "value": 5.0,
    "capability": 9.0,
    "ease": 5.5,
    "trial": 5.5,
    "badge": null,
    "url": "reviews/runway.html"
  },
  {
    "slug": "notion-ai",
    "name": "Notion AI",
    "category": "Workspace & Notes",
    "rank": 35,
    "score": 5.5,
    "value": 4.5,
    "capability": 7.5,
    "ease": 6.0,
    "trial": 4.5,
    "badge": null,
    "url": "reviews/notion-ai.html"
  },
  {
    "slug": "motion",
    "name": "Motion",
    "category": "Productivity",
    "rank": 36,
    "score": 5.4,
    "value": 4.5,
    "capability": 7.0,
    "ease": 7.5,
    "trial": 4.5,
    "badge": null,
    "url": "reviews/motion.html"
  },
  {
    "slug": "typeform",
    "name": "Typeform",
    "category": "Forms & Surveys",
    "rank": 37,
    "score": 5.3,
    "value": 4.5,
    "capability": 6.0,
    "ease": 7.0,
    "trial": 5.5,
    "badge": null,
    "url": "reviews/typeform.html"
  },
  {
    "slug": "semrush",
    "name": "Semrush",
    "category": "SEO",
    "rank": 38,
    "score": 5.2,
    "value": 3.5,
    "capability": 9.0,
    "ease": 5.0,
    "trial": 5.0,
    "badge": null,
    "url": "reviews/semrush.html"
  },
  {
    "slug": "apollo-io",
    "name": "Apollo.io",
    "category": "Sales Prospecting",
    "rank": 39,
    "score": 5.1,
    "value": 4.0,
    "capability": 8.0,
    "ease": 5.5,
    "trial": 5.0,
    "badge": null,
    "url": "reviews/apollo-io.html"
  },
  {
    "slug": "perplexity-pro",
    "name": "Perplexity Pro",
    "category": "Research",
    "rank": 40,
    "score": 5.0,
    "value": 4.0,
    "capability": 5.5,
    "ease": 6.5,
    "trial": 5.0,
    "badge": null,
    "url": "reviews/perplexity-pro.html"
  },
  {
    "slug": "synthesia",
    "name": "Synthesia",
    "category": "AI Avatar Video",
    "rank": 41,
    "score": 4.9,
    "value": 4.0,
    "capability": 7.5,
    "ease": 6.0,
    "trial": 4.5,
    "badge": null,
    "url": "reviews/synthesia.html"
  },
  {
    "slug": "bland-ai",
    "name": "Bland AI",
    "category": "AI Phone Agent",
    "rank": 42,
    "score": 4.8,
    "value": 3.5,
    "capability": 8.5,
    "ease": 4.5,
    "trial": 4.5,
    "badge": null,
    "url": "reviews/bland-ai.html"
  },
  {
    "slug": "lovable",
    "name": "Lovable",
    "category": "App Builder",
    "rank": 43,
    "score": 4.7,
    "value": 3.5,
    "capability": 7.5,
    "ease": 5.5,
    "trial": 4.5,
    "badge": null,
    "url": "reviews/lovable.html"
  }
];

  var DIMENSIONS = {
    value: { label: "best value for the price", key: "value" },
    capability: { label: "the most raw capability", key: "capability" },
    ease: { label: "the easiest to pick up", key: "ease" },
    trial: { label: "the safest to try before committing", key: "trial" }
  };

  var state = { category: null, dimension: null };

  var root = document.getElementById("quiz-root");
  if (!root) return;

  function uniqueCategories() {
    var seen = {};
    var out = [];
    TOOLS.forEach(function (t) {
      if (!seen[t.category]) {
        seen[t.category] = true;
        out.push(t.category);
      }
    });
    out.sort();
    return out;
  }

  function renderStep1() {
    var cats = uniqueCategories();
    var html = '<h3>1. What\'s eating your time?</h3><div class="quiz-options">';
    cats.forEach(function (c) {
      html += '<button type="button" class="quiz-option-btn" data-category="' + c + '">' + c + "</button>";
    });
    html += '<button type="button" class="quiz-option-btn" data-category="__any__">No idea, just show me the champion</button>';
    html += "</div>";
    root.innerHTML = html;
    root.querySelectorAll(".quiz-option-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.category = btn.getAttribute("data-category");
        renderStep2();
      });
    });
  }

  function renderStep2() {
    var html = '<h3>2. What matters most, besides sleep?</h3><div class="quiz-options">';
    Object.keys(DIMENSIONS).forEach(function (key) {
      html += '<button type="button" class="quiz-option-btn" data-dimension="' + key + '">' + DIMENSIONS[key].label + "</button>";
    });
    html += "</div>";
    html += '<button type="button" class="quiz-restart" data-back="1">&larr; back</button>';
    root.innerHTML = html;
    root.querySelectorAll(".quiz-option-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.dimension = btn.getAttribute("data-dimension");
        renderResults();
      });
    });
    root.querySelector('[data-back]').addEventListener("click", renderStep1);
  }

  function renderResults() {
    var pool = state.category === "__any__"
      ? TOOLS.slice()
      : TOOLS.filter(function (t) { return t.category === state.category; });

    var dimKey = DIMENSIONS[state.dimension].key;
    pool.sort(function (a, b) { return b[dimKey] - a[dimKey]; });
    var top = pool.slice(0, 3);

    var html = "<h3>Your matches (no swiping required)</h3>";
    if (top.length === 0) {
      html += "<p>Nothing reviewed fits that exact combo yet, the full ranking below has more options.</p>";
    } else {
      html += '<div class="quiz-results">';
      top.forEach(function (t, i) {
        var badge = t.badge ? '<span class="fun-badge">' + t.badge + "</span>" : "";
        html +=
          '<a class="quiz-result-card" href="' + t.url + '">' +
          '<span class="rank-badge">#' + t.rank + "</span>" +
          '<span class="quiz-result-name">' + t.name + badge + "</span>" +
          '<span class="quiz-result-score">' + t.score.toFixed(1) + "/10 overall</span>" +
          "</a>";
      });
      html += "</div>";
    }
    html += '<button type="button" class="quiz-restart" data-restart="1">&larr; start over</button>';
    root.innerHTML = html;
    root.querySelector('[data-restart]').addEventListener("click", function () {
      state = { category: null, dimension: null };
      renderStep1();
    });
  }

  renderStep1();
})();
