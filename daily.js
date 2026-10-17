/* The Herald's Riddle: a daily "name the AI tool" puzzle.
   Answers come from data/daily.json (built by tools/site.py on every rerank).
   Progress lives only in this browser's localStorage. */
(function () {
  "use strict";

  var MAX = 6;
  var BLUR = [18, 13, 9, 6, 3, 1.5, 0];
  var KEY = "sg-daily-v1";
  var $ = function (id) { return document.getElementById(id); };

  var DATA, TOOLS, BY_SLUG = {}, TODAY, PUZZLE_NO;
  var mode = "daily";
  var game; // {answer, guesses:[slug|null], done, won}

  // ------------------------------------------------------------ storage
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; } catch (e) { return { days: {} }; }
  }
  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* private mode: play on */ }
  }

  // ------------------------------------------------------------ dates
  function localISO(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }
  function dayDiff(a, b) {
    var pa = a.split("-"), pb = b.split("-");
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
  }
  function shiftISO(iso, n) {
    var p = iso.split("-"), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  function answerFor(iso) {
    var s = DATA.schedule[iso];
    if (s && BY_SLUG[s]) return s;
    // past the published schedule: fall back to a stable pick
    var pool = TOOLS.filter(function (t) { return t.img && (t.rank <= 110 || t.basis === "tested"); });
    pool.sort(function (a, b) { return hash(iso + a.slug) - hash(iso + b.slug); });
    return pool[0].slug;
  }

  // ------------------------------------------------------------ helpers
  function norm(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function free(t) { return t.tier === "free"; }
  function tierLabel(t) { return free(t) ? "Has a permanent free plan" : (t.tier === "paid" ? "Paid, trial, or contact sales only" : "Pricing not published"); }
  function redact(text, t) {
    var out = text;
    var words = [t.name].concat(t.name.split(/[\s.]+/).filter(function (w) { return w.length > 3; }));
    words.forEach(function (w) {
      var re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      out = out.replace(re, "?????");
    });
    return out;
  }
  function nameShape(name) {
    var first = true;
    return name.split("").map(function (c) {
      if (/[a-z0-9]/i.test(c)) { if (first) { first = false; return c.toUpperCase(); } return "_"; }
      return c === " " ? "  " : c;
    }).join(" ");
  }

  function clues(t) {
    return [
      ["Guild", t.category],
      ["Coin", tierLabel(t)],
      ["Standing", "#" + t.rank + " on the Herald's list, scoring " + t.score + "/10 (" + (t.basis === "tested" ? "tested hands-on" : "scouted") + ")"],
      ["The comic says", redact(t.caption, t)],
      ["Rumor has it", redact(t.fact, t)],
      ["Its true name", nameShape(t.name)]
    ];
  }

  // ------------------------------------------------------------ render
  function render() {
    var t = BY_SLUG[game.answer];
    var used = game.guesses.length;
    var img = $("dr-img");
    if (img.getAttribute("src") !== t.img) img.src = t.img;
    img.style.filter = "blur(" + (game.done ? 0 : BLUR[Math.min(used, MAX)]) + "px)";
    img.alt = game.done ? t.name + " comic" : "A blurred comic hiding the answer";

    $("dr-num").textContent = mode === "daily" ? "#" + PUZZLE_NO : "(practice)";

    var tries = "";
    for (var i = 0; i < MAX; i++) {
      var g = game.guesses[i];
      var cls = i < used ? (g === game.answer ? "win" : (g ? "miss" : "skip")) : "";
      tries += '<span class="dr-try ' + cls + '"></span>';
    }
    $("dr-tries").innerHTML = tries;

    var cl = clues(t), shown = game.done ? cl.length : Math.min(used + 1, cl.length), html = "";
    for (var k = 0; k < cl.length; k++) {
      html += k < shown
        ? '<li><span class="dr-clue-k">' + esc(cl[k][0]) + '</span>' + esc(cl[k][1]) + "</li>"
        : '<li class="locked"><span class="dr-clue-k">Sealed</span>Revealed after guess ' + k + "</li>";
    }
    $("dr-clues").innerHTML = html;

    var gl = "";
    game.guesses.forEach(function (s) {
      if (!s) { gl += '<li class="dr-g skip"><span class="dr-g-name">Skipped</span></li>'; return; }
      var g = BY_SLUG[s], r = runes(g, t);
      gl += '<li class="dr-g' + (s === game.answer ? " win" : "") + '"><span class="dr-g-name">' + esc(g.name) + "</span>" +
        '<span class="dr-rune ' + (r.cat ? "ok" : "no") + '" title="Category">' + esc(g.category) + "</span>" +
        '<span class="dr-rune ' + (r.tier ? "ok" : "no") + '" title="Pricing">' + (free(g) ? "Free plan" : "Paid") + "</span>" +
        '<span class="dr-rune ' + (r.rank === 0 ? "ok" : "dir") + '" title="Rank">#' + g.rank + (r.rank < 0 ? " ↑" : r.rank > 0 ? " ↓" : "") + "</span></li>";
    });
    $("dr-guesses").innerHTML = gl;

    $("dr-form").hidden = game.done;
    $("dr-result").hidden = !game.done;
    if (game.done) renderResult(t);
    renderStats();
  }

  function runes(g, t) {
    return { cat: g.category === t.category, tier: free(g) === free(t), rank: t.rank - g.rank };
  }

  var WIN_LINES = [
    "Natural 20. You named it on the first roll and the Herald is visibly annoyed.",
    "Two guesses. The bards will sing of this, briefly.",
    "Three guesses. A clean, professional piece of adventuring.",
    "Four guesses. Not elegant, but the dungeon is cleared.",
    "Five guesses. You were sweating, the Herald saw it.",
    "Last guess. Saved by a death save and pure stubbornness."
  ];

  function renderResult(t) {
    $("dr-verdict").textContent = game.won ? WIN_LINES[game.guesses.length - 1] : "Critical fail. The fog wins today, the answer was " + t.name + ".";
    $("dr-verdict").className = "dr-verdict " + (game.won ? "won" : "lost");
    $("dr-answer-name").textContent = t.name;
    $("dr-answer-meta").textContent = t.category + " · #" + t.rank + " ranked · " + t.score + "/10 · " + (free(t) ? "free plan" : "paid");
    $("dr-answer-desc").textContent = t.desc;
    $("dr-answer-cap").textContent = t.caption;
    $("dr-answer-row").href = "/#tool-" + t.slug;
    $("dr-answer-url").href = t.url;
    $("dr-again").hidden = mode !== "practice";
    $("dr-share").hidden = mode !== "daily";
    $("dr-sharebox").hidden = true;
    tickNext();
  }

  function shareText() {
    var t = BY_SLUG[game.answer];
    var lines = game.guesses.map(function (s) {
      if (!s) return "⬛⬛⬛";
      if (s === game.answer) return "🟩🟩🟩";
      var r = runes(BY_SLUG[s], t);
      return (r.cat ? "🟩" : "🟥") + (r.tier ? "🟩" : "🟥") + (r.rank < 0 ? "⬆️" : "⬇️");
    });
    return "The Herald's Riddle #" + PUZZLE_NO + " " + (game.won ? game.guesses.length : "X") + "/" + MAX + "\n" +
      lines.join("\n") + "\nsolosgems.com/daily";
  }

  function tickNext() {
    if (mode !== "daily") { $("dr-next").textContent = ""; return; }
    var now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    var s = Math.max(0, Math.floor((mid - now) / 1000));
    var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    $("dr-next").textContent = "Next riddle in " + h + "h " + (m < 10 ? "0" : "") + m + "m";
  }

  function renderStats() {
    var st = load(), days = Object.keys(st.days).sort(), played = 0, won = 0, dist = [0, 0, 0, 0, 0, 0];
    days.forEach(function (d) {
      var g = st.days[d];
      if (!g.done) return;
      played++;
      if (g.won) { won++; dist[g.guesses.length - 1]++; }
    });
    // streaks: consecutive won days ending today or yesterday
    var best = 0, run = 0, prev = null;
    days.forEach(function (d) {
      var g = st.days[d];
      if (!g.done) return;
      if (g.won && prev && dayDiff(prev, d) === 1 && run > 0) run++;
      else run = g.won ? 1 : 0;
      prev = d;
      if (run > best) best = run;
    });
    var cur = 0;
    if (prev && (prev === TODAY || dayDiff(prev, TODAY) === 1) && st.days[prev].won) cur = run;
    $("st-played").textContent = played;
    $("st-win").textContent = played ? Math.round(won / played * 100) + "%" : "0%";
    $("st-streak").textContent = cur;
    $("st-best").textContent = best;
    var mx = Math.max.apply(null, dist.concat([1])), html = "";
    var mine = mode === "daily" && game && game.done && game.won ? game.guesses.length : 0;
    dist.forEach(function (n, i) {
      html += '<li' + (mine === i + 1 ? ' class="me"' : "") + '><span>' + (i + 1) + '</span><i style="width:' + Math.max(6, n / mx * 100) + '%">' + n + "</i></li>";
    });
    $("dr-dist").innerHTML = html;
  }

  function renderYesterday() {
    var y = shiftISO(TODAY, -1);
    if (y < DATA.start) return;
    var t = BY_SLUG[answerFor(y)];
    if (!t) return;
    $("dr-y-img").src = t.img;
    $("dr-y-img").alt = t.name + " comic";
    $("dr-y-name").innerHTML = '<a href="/#tool-' + esc(t.slug) + '">' + esc(t.name) + "</a>";
    $("dr-y-desc").textContent = t.desc;
    $("dr-y-fact").textContent = "Cool fact: " + t.fact;
    $("dr-yesterday").hidden = false;
  }

  // ------------------------------------------------------------ play
  function commit() {
    if (mode !== "daily") return;
    var st = load();
    st.days[TODAY] = { answer: game.answer, guesses: game.guesses, done: game.done, won: game.won };
    save(st);
  }

  function guess(slug) {
    if (game.done) return;
    if (slug && game.guesses.indexOf(slug) !== -1) { $("dr-msg").textContent = "You already tried that one."; return; }
    game.guesses.push(slug);
    if (slug === game.answer) { game.done = true; game.won = true; }
    else if (game.guesses.length >= MAX) { game.done = true; game.won = false; }
    $("dr-msg").textContent = slug && slug !== game.answer ? "Not it. The fog thins..." : "";
    commit();
    render();
  }

  function findTool(text) {
    var n = norm(text);
    if (!n) return null;
    for (var i = 0; i < TOOLS.length; i++) if (norm(TOOLS[i].name) === n) return TOOLS[i];
    var m = matches(text);
    return m.length === 1 ? m[0] : null;
  }
  function matches(text) {
    var n = norm(text);
    if (!n) return [];
    var starts = [], has = [];
    TOOLS.forEach(function (t) {
      var tn = norm(t.name);
      if (tn.indexOf(n) === 0) starts.push(t); else if (tn.indexOf(n) > 0) has.push(t);
    });
    return starts.concat(has).slice(0, 8);
  }

  // ------------------------------------------------------------ autocomplete
  var sugIdx = -1;
  function showSuggest() {
    var list = matches($("dr-input").value), ul = $("dr-suggest");
    sugIdx = -1;
    if (!list.length) { ul.hidden = true; return; }
    ul.innerHTML = list.map(function (t, i) {
      return '<li role="option" data-slug="' + esc(t.slug) + '" id="sg-opt-' + i + '">' + esc(t.name) + "</li>";
    }).join("");
    ul.hidden = false;
  }
  function pick(slug) {
    $("dr-input").value = "";
    $("dr-suggest").hidden = true;
    guess(slug);
  }

  function bind() {
    var input = $("dr-input"), ul = $("dr-suggest");
    input.addEventListener("input", showSuggest);
    input.addEventListener("keydown", function (e) {
      var items = ul.querySelectorAll("li");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!items.length) return;
        e.preventDefault();
        sugIdx = (sugIdx + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach(function (li, i) { li.classList.toggle("on", i === sugIdx); });
        input.setAttribute("aria-activedescendant", "sg-opt-" + sugIdx);
      } else if (e.key === "Enter" && sugIdx >= 0 && items[sugIdx]) {
        e.preventDefault();
        pick(items[sugIdx].getAttribute("data-slug"));
      } else if (e.key === "Escape") { ul.hidden = true; }
    });
    ul.addEventListener("mousedown", function (e) {
      var li = e.target.closest("li");
      if (li) { e.preventDefault(); pick(li.getAttribute("data-slug")); }
    });
    input.addEventListener("blur", function () { setTimeout(function () { ul.hidden = true; }, 120); });

    $("dr-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var t = findTool(input.value);
      if (!t) { $("dr-msg").textContent = input.value.trim() ? "The Herald knows no tool by that name. Pick one from the list." : "Type a tool name first."; return; }
      pick(t.slug);
    });
    $("dr-skip").addEventListener("click", function () { guess(null); });

    $("dr-share").addEventListener("click", function () {
      var text = shareText(), box = $("dr-sharebox"), btn = $("dr-share");
      box.textContent = text;
      box.hidden = false;
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        navigator.share({ text: text }).catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { btn.textContent = "Copied! Paste it anywhere"; }, function () { btn.textContent = "Copy the text below"; });
      } else { btn.textContent = "Copy the text below"; }
    });
    $("dr-again").addEventListener("click", startPractice);

    document.querySelectorAll(".dr-mode").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll(".dr-mode").forEach(function (x) {
          x.classList.toggle("is-on", x === b);
          x.setAttribute("aria-selected", x === b ? "true" : "false");
        });
        if (b.getAttribute("data-mode") === "practice") startPractice(); else startDaily();
      });
    });
    setInterval(tickNext, 30000);
  }

  function startDaily() {
    mode = "daily";
    var st = load(), saved = st.days[TODAY], ans = answerFor(TODAY);
    game = saved && saved.answer === ans ? saved : { answer: ans, guesses: [], done: false, won: false };
    $("dr-msg").textContent = "";
    render();
  }
  function startPractice() {
    mode = "practice";
    var pool = TOOLS.filter(function (t) { return t.img; });
    var t = pool[Math.floor(Math.random() * pool.length)];
    game = { answer: t.slug, guesses: [], done: false, won: false };
    $("dr-msg").textContent = "";
    render();
  }

  // ------------------------------------------------------------ boot
  fetch("data/daily.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) {
    DATA = d;
    TOOLS = d.tools.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    TOOLS.forEach(function (t) { BY_SLUG[t.slug] = t; });
    TODAY = localISO(new Date());
    if (TODAY < d.start) TODAY = d.start;
    PUZZLE_NO = dayDiff(d.start, TODAY) + 1;
    bind();
    startDaily();
    renderYesterday();
  }).catch(function () {
    $("dr-msg").textContent = "The Herald misplaced today's riddle. Refresh to try again.";
  });
})();
