// Herald quests: the homepage Dungeon Master (home.html #qp). The page owns
// the game: hero, HP, gold, items and the turn count live here (and in
// localStorage, so a refresh doesn't lose the quest). Each turn posts the
// state and recent story to /api/quest, which rolls the d20 server-side,
// returns it in the X-Quest-Roll header and streams the scene. The model ends
// each scene with a status line like [[hp -2; gain Rusty Key; opt Run]],
// which is parsed and clamped here; it never sets the numbers directly.
(function () {
  "use strict";
  var MAX_TURNS = 20;
  var STORE = "solosgems-quest-v1";
  var CLASSES = {
    Fighter: { hp: 14, items: ["Sword", "Dented Shield"] },
    Wizard: { hp: 8, items: ["Staff", "Spellbook"] },
    Rogue: { hp: 10, items: ["Daggers", "Lockpicks"] },
    Bard: { hp: 10, items: ["Lute", "Suspicious Charm"] },
  };
  var NAMES = ["Sir Crumbsalot", "Brenda the Unbothered", "Grimble Twelvetoes", "Lady Overdraft", "Pip Underfoot",
    "Thaddeus Lintpocket", "Marigold Stormbutton", "Old Gus", "Zephyrine Mudd", "Barnaby Nineteenth"];
  var FALLBACK_OPTS = ["Look around carefully", "Talk to someone nearby", "Press on toward the goal"];

  var $ = function (id) { return document.getElementById(id); };
  var setup = $("qp-setup"), play = $("qp-play"), log = $("qp-log"), form = $("qp-form"), q = $("qp-q"), go = $("qp-go");
  var optsBox = $("qp-opts"), endBox = $("qp-end"), nameIn = $("qp-name"), ownIn = $("qp-own");
  if (!setup) return;

  var game = null; // { setting, title, name, cls, hp, max, gold, items, turn, history, entries, opts, over, outcome }
  var busy = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function save() {
    try { if (game) localStorage.setItem(STORE, JSON.stringify(game)); else localStorage.removeItem(STORE); } catch (e) {}
  }
  function load() {
    try { var g = JSON.parse(localStorage.getItem(STORE) || "null"); return g && g.setting && Array.isArray(g.entries) ? g : null; } catch (e) { return null; }
  }

  // ---- Tabs -------------------------------------------------------------
  var tabs = { quest: $("tab-quest"), chat: $("tab-chat") };
  var panels = { quest: $("qp"), chat: $("chat-panel") };
  function showTab(which) {
    Object.keys(tabs).forEach(function (k) {
      tabs[k].setAttribute("aria-selected", k === which ? "true" : "false");
      panels[k].hidden = k !== which;
    });
    try { localStorage.setItem("solosgems-herald-tab", which); } catch (e) {}
  }
  tabs.quest.addEventListener("click", function () { showTab("quest"); });
  tabs.chat.addEventListener("click", function () { showTab("chat"); });
  try { if (localStorage.getItem("solosgems-herald-tab") === "chat") showTab("chat"); } catch (e) {}

  // ---- Status line --------------------------------------------------------
  // Hide the bracketed status line while it streams in.
  function narration(text) {
    return text.replace(/<\|eot_id\|>[\s\S]*$/, "").replace(/(^|\n)[ \t]*\[[\s\S]*$/, "")
      .replace(/\s*\[\[?\s*(hp|gold|gain|lose|opt|end|title)\b[\s\S]*$/i, "").replace(/\s*\[\[[\s\S]*$/, "").trim();
  }
  // The status line as it should have been written, rebuilt from what was
  // applied. It goes back into the story history so the model always sees
  // well-formed examples and keeps writing the line.
  function canonicalStatus(d, opts) {
    var bits = [];
    if (d.end) bits.push("end");
    if (d.hp) bits.push("hp " + (d.hp > 0 ? "+" : "") + d.hp);
    if (d.gold) bits.push("gold " + (d.gold > 0 ? "+" : "") + d.gold);
    d.gained.forEach(function (g) { bits.push("gain " + g); });
    d.lost.forEach(function (g) { bits.push("lose " + g); });
    if (d.end) { if (d.title) bits.push("title " + d.title); }
    else opts.forEach(function (o) { bits.push("opt " + o); });
    return "[[" + bits.join("; ") + "]]";
  }
  function statusLine(text) {
    var m = text.replace(/<\|eot_id\|>[\s\S]*$/, "").match(/\[\[?([^\[\]]*)\]?\]?\s*$/);
    return m ? m[1] : "";
  }
  var NONE = /^(none|nothing|n\/?a|no|-|null)$/i;
  function applyStatus(text, band) {
    var parts = statusLine(text).split(/\s*;\s*/);
    var d = { hp: 0, gold: 0, gained: [], lost: [], opts: [], end: false, title: "" };
    parts.forEach(function (p) {
      p = p.trim();
      var m;
      if ((m = p.match(/^hp\s*([+-])\s*(\d+)$/i))) d.hp += (m[1] === "-" ? -1 : 1) * Number(m[2]);
      else if ((m = p.match(/^gold\s*([+-])\s*(\d+)$/i))) d.gold += (m[1] === "-" ? -1 : 1) * Number(m[2]);
      else if ((m = p.match(/^gain\s+(.+)$/i))) { var g = m[1].trim().slice(0, 32); if (!NONE.test(g) && !/\b(gold|coins?)\b/i.test(g)) d.gained.push(g); }
      else if ((m = p.match(/^lose\s+(.+)$/i))) { if (!NONE.test(m[1].trim())) d.lost.push(m[1].trim()); }
      else if ((m = p.match(/^opt(?:ion)?\s+(.+)$/i))) { if (d.opts.length < 3) d.opts.push(m[1].trim().slice(0, 48)); }
      else if ((m = p.match(/^title\s+(.+)$/i))) d.title = m[1].trim().slice(0, 80);
      else if (/^end$/i.test(p)) d.end = true;
    });
    // House rules: small, believable swings, and a Disaster always stings.
    d.hp = Math.max(-5, Math.min(4, d.hp));
    d.gold = Math.max(-20, Math.min(band === "Legendary" ? 100 : 30, d.gold));
    var lost = [];
    d.lost.forEach(function (name) {
      var i = game.items.findIndex(function (it) { return it.toLowerCase() === name.toLowerCase(); });
      if (i >= 0) lost.push(game.items.splice(i, 1)[0]);
    });
    d.lost = lost;
    if (band === "Disaster" && d.hp >= 0 && !d.lost.length) d.hp = -1;
    d.gained = d.gained.filter(function (g) {
      if (game.items.length >= 8 || game.items.some(function (it) { return it.toLowerCase() === g.toLowerCase(); })) return false;
      game.items.push(g);
      return true;
    });
    var before = game.hp;
    game.hp = Math.max(0, Math.min(game.max, game.hp + d.hp));
    d.hp = game.hp - before;
    var goldBefore = game.gold;
    game.gold = Math.max(0, game.gold + d.gold);
    d.gold = game.gold - goldBefore;
    return d;
  }
  function changeText(d) {
    var bits = [];
    if (d.hp) bits.push((d.hp > 0 ? "+" : "") + d.hp + " HP");
    if (d.gold) bits.push((d.gold > 0 ? "+" : "") + d.gold + " gold");
    d.gained.forEach(function (g) { bits.push("gained " + g); });
    d.lost.forEach(function (g) { bits.push("lost " + g); });
    return bits.join(" · ");
  }

  // ---- Rendering ----------------------------------------------------------
  function renderText(body, text) {
    body.innerHTML = "";
    text.split(/\n{2,}/).forEach(function (para) {
      if (!para.trim()) return;
      var p = el("p");
      para.split("\n").forEach(function (line, i) {
        if (i) p.appendChild(el("br"));
        line.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/).forEach(function (part) {
          if (/^\*\*[^*]+\*\*$/.test(part)) p.appendChild(el("strong", null, part.slice(2, -2)));
          else if (/^\*[^*]+\*$/.test(part)) p.appendChild(el("em", null, part.slice(1, -1)));
          else if (part) p.appendChild(document.createTextNode(part));
        });
      });
      body.appendChild(p);
    });
  }
  function addEntry(entry) {
    var li = el("li", "ak-msg " + (entry.role === "user" ? "ak-user-msg" : "ak-herald-msg"));
    var body = el("div", "ak-body");
    renderText(body, entry.text);
    li.appendChild(body);
    if (entry.roll) {
      var chip = el("span", "qp-roll qp-roll-" + entry.band.toLowerCase());
      chip.appendChild(el("span", "qp-die", "d20"));
      chip.appendChild(document.createTextNode(" " + entry.roll + " · " + entry.band));
      li.appendChild(chip);
    }
    if (entry.change) li.appendChild(el("p", "qp-change", entry.change));
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
    return { li: li, body: body };
  }
  function renderStats() {
    $("qp-hero").textContent = game.name + " the " + game.cls;
    $("qp-hp-text").textContent = game.hp + "/" + game.max + " HP";
    var fill = $("qp-hp-fill");
    fill.style.width = Math.round((100 * game.hp) / game.max) + "%";
    fill.className = game.hp / game.max <= 0.3 ? "low" : "";
    $("qp-gold").textContent = game.gold + " gold";
    $("qp-turn").textContent = "Turn " + Math.min(game.turn, MAX_TURNS) + "/" + MAX_TURNS;
    var items = $("qp-items");
    items.innerHTML = "";
    game.items.forEach(function (it) { items.appendChild(el("li", null, it)); });
  }
  function renderOpts() {
    optsBox.innerHTML = "";
    if (game.over) return;
    (game.opts || []).forEach(function (o) {
      var b = el("button", "qp-opt", o);
      b.type = "button";
      b.addEventListener("click", function () { act(o); });
      optsBox.appendChild(b);
    });
  }
  function renderEnd() {
    endBox.hidden = !game.over;
    form.hidden = !!game.over;
    $("qp-abandon").hidden = !!game.over;
    if (!game.over) return;
    var fell = game.outcome === "fell";
    $("qp-end-kicker").textContent = fell ? "The hero has fallen" : "Quest complete";
    $("qp-end-title").textContent = game.title || (fell ? "A Noble, Brief Career" : "A Tale Worth Retelling");
    $("qp-end-stats").textContent = game.name + " the " + game.cls + " · " + game.turn + " turns · " + game.gold + " gold" +
      (game.items.length ? " · carrying " + game.items.join(", ") : "");
  }
  function renderAll() {
    setup.hidden = true;
    play.hidden = false;
    log.innerHTML = "";
    game.entries.forEach(addEntry);
    renderStats();
    renderOpts();
    renderEnd();
  }

  // ---- Turns --------------------------------------------------------------
  function setBusy(on) {
    busy = on;
    go.disabled = on;
    go.textContent = on ? "..." : "Act";
    Array.prototype.forEach.call(optsBox.querySelectorAll("button"), function (b) { b.disabled = on; });
  }
  function readStream(res, onText) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "", text = "";
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return text;
        buffer += decoder.decode(r.value, { stream: true });
        var lines = buffer.split("\n");
        buffer = lines.pop();
        lines.forEach(function (line) {
          if (line.indexOf("data:") !== 0) return;
          var data = line.slice(5).trim();
          if (!data || data === "[DONE]") return;
          try {
            var j = JSON.parse(data);
            // Prefer choices[0].delta.content: "response" turns numeric tokens into numbers.
            var delta = j.choices && j.choices[0] && j.choices[0].delta;
            var piece = delta && typeof delta.content === "string" ? delta.content : j.response != null ? String(j.response) : "";
            if (piece) { text += piece; onText(text); }
          } catch (e) { /* partial line */ }
        });
        return pump();
      });
    }
    return pump();
  }
  function turn(mode, action) {
    if (busy || !game || game.over) return;
    var userEntry = null;
    if (mode === "act") {
      game.turn += 1;
      userEntry = { role: "user", text: action };
      userEntry.view = addEntry(userEntry);
    }
    game.opts = [];
    renderOpts();
    renderStats();
    setBusy(true);
    var view = addEntry({ role: "assistant", text: "..." });
    fetch("/api/quest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: mode, action: action || "", setting: game.setting, name: game.name, cls: game.cls,
        hp: game.hp, max: game.max, gold: game.gold, items: game.items, turn: game.turn, history: game.history,
      }),
    })
      .then(function (res) {
        if (!res.ok || !res.body) {
          return res.json().catch(function () { return {}; }).then(function (d) {
            throw new Error(d.error || "The Herald dropped the dice. Try again in a moment.");
          });
        }
        var roll = Number(res.headers.get("X-Quest-Roll")) || 0;
        var band = res.headers.get("X-Quest-Band") || "";
        var prompt = decodeURIComponent(res.headers.get("X-Quest-Prompt") || "");
        if (userEntry && roll) {
          userEntry.roll = roll;
          userEntry.band = band;
          var fresh = addEntry(userEntry);
          log.replaceChild(fresh.li, userEntry.view.li);
          userEntry.view = fresh;
          log.appendChild(view.li);
        }
        return readStream(res, function (t) {
          renderText(view.body, narration(t) || "...");
          log.scrollTop = log.scrollHeight;
        }).then(function (full) {
          var story = narration(full);
          if (!story) throw new Error("The Herald lost the thread. Try that again.");
          var d = applyStatus(full, band);
          var entry = { role: "assistant", text: story, change: changeText(d) };
          if (userEntry) { delete userEntry.view; game.entries.push(userEntry); }
          game.entries.push(entry);
          game.opts = d.opts.length ? d.opts : FALLBACK_OPTS;
          game.history.push({ role: "user", content: prompt || action || "Begin." }, { role: "assistant", content: story + "\n" + canonicalStatus(d, game.opts) });
          game.history = game.history.slice(-10);
          if (d.title) game.title = d.title;
          var finished = mode === "fallen" || d.end || game.turn >= MAX_TURNS;
          if (finished) {
            game.over = true;
            game.outcome = game.hp <= 0 ? "fell" : "won";
          }
          view.li.remove();
          addEntry(entry);
          save();
          renderStats();
          renderOpts();
          renderEnd();
          setBusy(false);
          if (!game.over && game.hp <= 0) return turn("fallen");
        });
      })
      .catch(function (e) {
        if (mode === "act") {
          game.turn -= 1;
          if (userEntry && userEntry.view) userEntry.view.li.remove();
          q.value = action;
        }
        if (mode === "fallen") {
          view.li.remove();
          game.over = true;
          game.outcome = "fell";
          save();
          renderEnd();
          setBusy(false);
          return;
        }
        view.li.classList.add("ak-error");
        renderText(view.body, e && e.message ? e.message : "The Herald dropped the dice. Try again in a moment.");
        game.opts = game.entries.length ? FALLBACK_OPTS : [];
        renderStats();
        renderOpts();
        setBusy(false);
        if (!game.entries.length) {
          var retry = el("button", "qp-opt", "Try starting again");
          retry.type = "button";
          retry.addEventListener("click", function () { view.li.remove(); retry.remove(); turn("start"); });
          optsBox.appendChild(retry);
        }
      });
  }
  function act(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    q.value = "";
    grow();
    turn("act", text);
  }

  // ---- Setup --------------------------------------------------------------
  function randomName() { return NAMES[Math.floor(Math.random() * NAMES.length)]; }
  nameIn.value = randomName();
  ownIn.addEventListener("focus", function () { setup.querySelector('input[value="own"]').checked = true; });
  setup.addEventListener("submit", function (e) {
    e.preventDefault();
    var pick = setup.querySelector('input[name="qp-setting"]:checked');
    var setting = pick.value === "own" ? ownIn.value.trim() : pick.value;
    if (!setting) { ownIn.focus(); return; }
    var cls = setup.querySelector('input[name="qp-class"]:checked').value;
    var c = CLASSES[cls];
    game = {
      setting: setting, name: nameIn.value.trim() || randomName(), cls: cls, hp: c.hp, max: c.hp, gold: 10,
      items: c.items.slice(), turn: 0, history: [], entries: [], opts: [], over: false, outcome: "", title: "",
    };
    renderAll();
    turn("start");
  });
  function reset() {
    if (busy) return;
    game = null;
    save();
    play.hidden = true;
    setup.hidden = false;
    nameIn.value = randomName();
  }
  $("qp-again").addEventListener("click", reset);
  $("qp-abandon").addEventListener("click", reset);
  $("qp-copy").addEventListener("click", function () {
    var btn = this;
    var tale = (game.title || "A Tale Worth Retelling") + "\n" + game.name + " the " + game.cls +
      (game.outcome === "fell" ? " fell after " : " finished in ") + game.turn + " turns with " + game.gold + " gold.\n\n" +
      game.entries.map(function (en) { return en.role === "user" ? "> " + en.text + (en.roll ? " (d20: " + en.roll + ")" : "") : en.text; }).join("\n\n") +
      "\n\nPlayed with the Herald at https://solosgems.com/";
    var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy the tale"; }, 1800); };
    try { navigator.clipboard.writeText(tale).then(done, function () {}); } catch (e) {}
  });

  // ---- Input --------------------------------------------------------------
  function grow() {
    q.style.height = "auto";
    q.style.height = Math.min(q.scrollHeight, 120) + "px";
    q.style.overflowY = q.scrollHeight > 120 ? "auto" : "hidden";
  }
  form.addEventListener("submit", function (e) { e.preventDefault(); act(q.value); });
  q.addEventListener("input", grow);
  q.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); act(q.value); }
  });

  game = load();
  if (game) {
    renderAll();
    if (!game.entries.length && !game.over) turn("start");
    else if (!game.over && game.hp <= 0) turn("fallen");
  }
})();
