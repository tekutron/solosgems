// Herald quests: the homepage Dungeon Master (home.html #qp). The page owns
// the game: hero, level, XP, HP, gold, items, abilities, journal and turn
// live here and are saved in localStorage (several quests, so visitors can
// come back later on the same browser). Each turn posts the state and recent
// story to /api/quest, which rolls the d20 server-side (abilities can give
// advantage or a minimum roll), returns it in X-Quest-* headers and streams
// the scene. The model ends each scene with a status line like
// [[hp -2; gain Rusty Key; xp +10; opt Run]], parsed and clamped here; it
// never sets the numbers directly. Every few turns a "journal" call updates
// where the hero is, what they've done, who they've met and open threads.
(function () {
  "use strict";
  var ONESHOT_TURNS = 20;
  var CHAPTER_TURNS = 12;
  var JOURNAL_EVERY = 4;
  var REST_EVERY = 5;
  var MAX_SAVES = 6;
  var STORE = "solosgems-quests-v2";
  var LEVELS = [0, 50, 130, 240, 380, 550, 750, 1000, 1300, 1650];
  var BAND_XP = { Disaster: 3, Fail: 4, Mixed: 7, Success: 10, Legendary: 15 };
  var CLASSES = {
    Fighter: { hp: 14, perLevel: 6, items: ["Sword", "Dented Shield"], blurb: "Hits hard, shrugs off damage.", abilities: [
      { id: "second-wind", name: "Second Wind", lvl: 1, max: 1, kind: "heal", die: 6, desc: "Catch your breath: heal 1d6 + your level." },
      { id: "mighty-swing", name: "Mighty Swing", lvl: 1, max: 2, kind: "adv", desc: "Roll twice and keep the higher roll." },
      { id: "shield-wall", name: "Shield Wall", lvl: 3, max: 1, kind: "ward", desc: "This action can't hurt you." },
      { id: "champions-strike", name: "Champion's Strike", lvl: 5, max: 1, kind: "floor", floor: 14, desc: "This action can't roll lower than 14." },
    ] },
    Wizard: { hp: 8, perLevel: 4, items: ["Staff", "Spellbook"], blurb: "Fragile, clever, full of spells.", abilities: [
      { id: "magic-missile", name: "Magic Missile", lvl: 1, max: 2, kind: "floor", floor: 10, desc: "Magic never quite misses: the roll can't go below 10." },
      { id: "arcane-insight", name: "Arcane Insight", lvl: 1, max: 1, kind: "insight", desc: "The Herald must give you a true, useful hint." },
      { id: "shield", name: "Shield", lvl: 3, max: 1, kind: "ward", desc: "This action can't hurt you." },
      { id: "fireball", name: "Fireball", lvl: 5, max: 1, kind: "floor", floor: 14, desc: "Big, loud and reliable: the roll can't go below 14." },
    ] },
    Rogue: { hp: 10, perLevel: 5, items: ["Daggers", "Lockpicks"], blurb: "Sneaky, lucky, hard to pin down.", abilities: [
      { id: "sneak-attack", name: "Sneak Attack", lvl: 1, max: 2, kind: "adv", desc: "Roll twice and keep the higher roll." },
      { id: "slippery", name: "Slippery", lvl: 1, max: 1, kind: "ward", desc: "This action can't hurt you." },
      { id: "cunning-action", name: "Cunning Action", lvl: 3, max: 2, kind: "floor", floor: 10, desc: "The roll can't go below 10." },
      { id: "perfect-heist", name: "Perfect Heist", lvl: 5, max: 1, kind: "floor", floor: 14, desc: "The plan works: the roll can't go below 14." },
    ] },
    Bard: { hp: 10, perLevel: 5, items: ["Lute", "Suspicious Charm"], blurb: "Talks, sings and charms through trouble.", abilities: [
      { id: "vicious-mockery", name: "Vicious Mockery", lvl: 1, max: 2, kind: "adv", desc: "Roll twice and keep the higher roll." },
      { id: "healing-word", name: "Healing Word", lvl: 1, max: 1, kind: "heal", die: 4, desc: "Heal 1d4 + your level." },
      { id: "inspiration", name: "Inspiration", lvl: 3, max: 2, kind: "floor", floor: 10, desc: "The roll can't go below 10." },
      { id: "countercharm", name: "Countercharm", lvl: 5, max: 1, kind: "ward", desc: "This action can't hurt you." },
    ] },
  };
  var NAMES = ["Sir Crumbsalot", "Brenda the Unbothered", "Grimble Twelvetoes", "Lady Overdraft", "Pip Underfoot",
    "Thaddeus Lintpocket", "Marigold Stormbutton", "Old Gus", "Zephyrine Mudd", "Barnaby Nineteenth"];
  var FALLBACK_OPTS = ["Look around carefully", "Talk to someone nearby", "Press on toward the goal"];

  var $ = function (id) { return document.getElementById(id); };
  var setup = $("qp-setup");
  if (!setup) return;
  var play = $("qp-play"), log = $("qp-log"), form = $("qp-form"), q = $("qp-q"), go = $("qp-go");
  var optsBox = $("qp-opts"), endBox = $("qp-end"), nameIn = $("qp-name"), ownIn = $("qp-own"), herald = $("herald");

  var store = { active: null, games: {} };
  var game = null;
  var busy = false;
  var armed = null; // ability id armed for the next action
  var srdItems = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function roll(n) { return 1 + Math.floor(Math.random() * n); }

  // ---- Saves --------------------------------------------------------------
  function loadStore() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || "null");
      if (s && s.games && typeof s.games === "object") store = s;
    } catch (e) {}
  }
  function save() {
    if (game) {
      game.updated = Date.now();
      store.games[game.id] = game;
      store.active = game.over ? null : game.id;
    }
    var ids = Object.keys(store.games).sort(function (a, b) { return store.games[b].updated - store.games[a].updated; });
    ids.slice(MAX_SAVES).forEach(function (id) { delete store.games[id]; });
    try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (e) {}
  }
  function removeGame(id) {
    delete store.games[id];
    if (store.active === id) store.active = null;
    try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (e) {}
  }

  // ---- Tabs ---------------------------------------------------------------
  var tabs = { quest: $("tab-quest"), chat: $("tab-chat") };
  var panels = { quest: $("qp"), chat: $("chat-panel") };
  function showTab(which) {
    Object.keys(tabs).forEach(function (k) {
      tabs[k].setAttribute("aria-selected", k === which ? "true" : "false");
      panels[k].hidden = k !== which;
    });
    herald.classList.toggle("qp-wide", which === "quest" && !play.hidden);
    try { localStorage.setItem("solosgems-herald-tab", which); } catch (e) {}
  }
  tabs.quest.addEventListener("click", function () { showTab("quest"); });
  tabs.chat.addEventListener("click", function () { showTab("chat"); });

  // ---- Rules --------------------------------------------------------------
  function xpFor(level) {
    var i = level - 1;
    return i < LEVELS.length ? LEVELS[i] : LEVELS[LEVELS.length - 1] + 400 * (i - LEVELS.length + 1);
  }
  function levelFor(xp) {
    var l = 1;
    while (l < 20 && xp >= xpFor(l + 1)) l++;
    return l;
  }
  function abilities() {
    return CLASSES[game.cls].abilities.filter(function (a) { return a.lvl <= game.level; });
  }
  function usesLeft(a) {
    var u = game.uses[a.id];
    return u == null ? a.max : u;
  }
  function abilityById(id) {
    return CLASSES[game.cls].abilities.filter(function (a) { return a.id === id; })[0];
  }
  function canRest() { return game.turn - game.lastRest >= REST_EVERY; }

  // ---- Status line --------------------------------------------------------
  function narration(text) {
    return text.replace(/<\|eot_id\|>[\s\S]*$/, "").replace(/(^|\n)[ \t]*\[[\s\S]*$/, "")
      .replace(/\s*\[+\s*(hp|gold|gain|lose|opt|end|title|xp)\b[\s\S]*$/i, "").replace(/\s*\[\[[\s\S]*$/, "").trim();
  }
  function statusLine(text) {
    var m = text.replace(/<\|eot_id\|>[\s\S]*$/, "").match(/\[+([^\[\]]*)\]*\s*$/);
    return m ? m[1] : "";
  }
  var NONE = /^(none|nothing|n\/?a|no|-|null)$/i;
  function applyStatus(text, band, ward) {
    var d = { hp: 0, gold: 0, xp: 0, gained: [], lost: [], opts: [], end: false, title: "", blocked: false };
    statusLine(text).split(/\s*;\s*/).forEach(function (p) {
      p = p.trim();
      var m;
      if ((m = p.match(/^hp\s*([+-])\s*(\d+)$/i))) d.hp += (m[1] === "-" ? -1 : 1) * Number(m[2]);
      else if ((m = p.match(/^gold\s*([+-])\s*(\d+)$/i))) d.gold += (m[1] === "-" ? -1 : 1) * Number(m[2]);
      else if ((m = p.match(/^xp\s*\+?\s*(\d+)$/i))) d.xp += Number(m[1]);
      else if ((m = p.match(/^gain\s+(.+)$/i))) { var g = m[1].trim().slice(0, 32); if (!NONE.test(g) && !/\b(gold|coins?|xp)\b/i.test(g)) d.gained.push(g); }
      else if ((m = p.match(/^lose\s+(.+)$/i))) { if (!NONE.test(m[1].trim())) d.lost.push(m[1].trim()); }
      else if ((m = p.match(/^opt(?:ion)?\s+(.+)$/i))) { if (d.opts.length < 3) d.opts.push(m[1].trim().slice(0, 48)); }
      else if ((m = p.match(/^title\s+(.+)$/i))) d.title = m[1].trim().slice(0, 80);
      else if (/^end$/i.test(p)) d.end = true;
    });
    // House rules: believable swings, a Disaster always stings, wards block hits.
    var big = Math.max(5, 2 + game.level);
    d.hp = Math.max(-big, Math.min(4 + game.level, d.hp));
    d.gold = Math.max(-20 * game.level, Math.min((band === "Legendary" ? 100 : 30) * game.level, d.gold));
    d.xp = Math.min(40, d.xp) + (BAND_XP[band] || 0);
    var lost = [];
    d.lost.forEach(function (name) {
      var i = game.items.findIndex(function (it) { return it.toLowerCase() === name.toLowerCase(); });
      if (i >= 0) lost.push(game.items.splice(i, 1)[0]);
    });
    d.lost = lost;
    if (band === "Disaster" && d.hp >= 0 && !d.lost.length) d.hp = -1;
    if (ward && d.hp < 0) { d.hp = 0; d.blocked = true; }
    d.gained = d.gained.filter(function (g) {
      if (game.items.length >= 10 || game.items.some(function (it) { return it.toLowerCase() === g.toLowerCase(); })) return false;
      game.items.push(g);
      return true;
    });
    var before = game.hp;
    game.hp = Math.max(0, Math.min(game.max, game.hp + d.hp));
    d.hp = game.hp - before;
    var goldBefore = game.gold;
    game.gold = Math.max(0, game.gold + d.gold);
    d.gold = game.gold - goldBefore;
    game.xp += d.xp;
    return d;
  }
  function changeText(d) {
    var bits = [];
    if (d.hp) bits.push((d.hp > 0 ? "+" : "") + d.hp + " HP");
    if (d.blocked) bits.push("hit blocked");
    if (d.gold) bits.push((d.gold > 0 ? "+" : "") + d.gold + " gold");
    d.gained.forEach(function (g) { bits.push("gained " + g); });
    d.lost.forEach(function (g) { bits.push("lost " + g); });
    if (d.xp) bits.push("+" + d.xp + " XP");
    return bits.join(" · ");
  }
  // The status line as it should have been written, rebuilt from what was
  // applied, so the model always sees well-formed examples in its history.
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
  function checkLevelUp() {
    var nl = levelFor(game.xp);
    if (nl <= game.level) return null;
    var c = CLASSES[game.cls];
    var gained = c.abilities.filter(function (a) { return a.lvl > game.level && a.lvl <= nl; });
    game.max += c.perLevel * (nl - game.level);
    game.level = nl;
    game.hp = game.max;
    game.uses = {};
    return "Level up! " + game.name + " is now level " + nl + ". Max HP " + game.max + ", fully healed, abilities recharged." +
      (gained.length ? " New: " + gained.map(function (a) { return a.name; }).join(", ") + "." : "");
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
    var cls = entry.role === "user" ? "ak-user-msg" : entry.role === "system" ? "qp-system-msg" : "ak-herald-msg";
    var li = el("li", "ak-msg " + cls);
    var body = el("div", "ak-body");
    renderText(body, entry.text);
    li.appendChild(body);
    if (entry.ability) li.appendChild(el("span", "qp-used", entry.ability));
    if (entry.roll) {
      var chip = el("span", "qp-roll qp-roll-" + entry.band.toLowerCase());
      chip.appendChild(el("span", "qp-die", "d20"));
      chip.appendChild(document.createTextNode(" " + (entry.rolls && entry.rolls.length > 1 ? entry.rolls.join(" / ") + " → " : "") + entry.roll + " · " + entry.band));
      li.appendChild(chip);
    }
    if (entry.change) li.appendChild(el("p", "qp-change", entry.change));
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
    return { li: li, body: body };
  }
  function fillList(id, items, empty) {
    var box = $(id);
    box.innerHTML = "";
    if (!items.length) { box.appendChild(el("li", "qp-empty", empty)); return; }
    items.forEach(function (it) {
      var li = el("li");
      if (typeof it === "string") li.textContent = it;
      else { li.appendChild(el("strong", null, it.name)); if (it.note) li.appendChild(document.createTextNode(": " + it.note)); }
      box.appendChild(li);
    });
  }
  function itemNote(name) {
    var key = name.toLowerCase();
    if (game.itemNotes && game.itemNotes[key]) return game.itemNotes[key];
    return srdItems && srdItems[key] ? srdItems[key] : "";
  }
  function renderHud() {
    $("qp-quest-title").textContent = game.questTitle;
    $("qp-turn").textContent = game.length === "campaign"
      ? "Chapter " + (Math.floor(Math.max(0, game.turn - 1) / CHAPTER_TURNS) + 1) + " · Turn " + game.turn
      : "Turn " + Math.min(game.turn, ONESHOT_TURNS) + " of " + ONESHOT_TURNS;
    $("qp-hero").textContent = game.name;
    $("qp-level").textContent = "Level " + game.level + " " + game.cls;
    $("qp-hp-text").textContent = game.hp + "/" + game.max;
    var hpFill = $("qp-hp-fill");
    hpFill.style.width = Math.round((100 * game.hp) / game.max) + "%";
    hpFill.className = game.hp / game.max <= 0.3 ? "low" : "";
    var lo = xpFor(game.level), hi = xpFor(game.level + 1);
    $("qp-xp-fill").style.width = Math.max(0, Math.min(100, Math.round((100 * (game.xp - lo)) / (hi - lo)))) + "%";
    $("qp-xp-text").textContent = game.xp + "/" + hi;
    $("qp-gold").textContent = game.gold + " gold";

    var abil = $("qp-abilities");
    abil.innerHTML = "";
    abilities().forEach(function (a) {
      var li = el("li");
      var b = el("button", "qp-ability" + (armed === a.id ? " is-armed" : ""));
      b.type = "button";
      b.disabled = busy || game.over || (usesLeft(a) <= 0 && armed !== a.id);
      b.setAttribute("aria-pressed", armed === a.id ? "true" : "false");
      b.appendChild(el("span", "qp-ability-name", a.name));
      var pips = el("span", "qp-pips");
      pips.setAttribute("aria-label", usesLeft(a) + " of " + a.max + " uses left");
      for (var i = 0; i < a.max; i++) pips.appendChild(el("span", i < usesLeft(a) ? "on" : ""));
      b.appendChild(pips);
      b.appendChild(el("span", "qp-ability-desc", a.desc));
      b.addEventListener("click", function () {
        armed = armed === a.id ? null : a.id;
        renderHud();
        renderArmed();
        q.focus();
      });
      li.appendChild(b);
      abil.appendChild(li);
    });
    var rest = $("qp-rest");
    rest.disabled = busy || game.over || !canRest();
    rest.textContent = canRest() ? "Short rest (recharge, heal half)" : "Rest again in " + (REST_EVERY - (game.turn - game.lastRest)) + " turns";

    var inv = $("qp-inventory");
    inv.innerHTML = "";
    if (!game.items.length) inv.appendChild(el("li", "qp-empty", "Empty pockets."));
    game.items.forEach(function (it) {
      var li = el("li");
      var note = itemNote(it);
      li.appendChild(el("strong", null, it));
      if (note) {
        var short = note.length > 130 ? note.slice(0, note.lastIndexOf(" ", 128)) + "..." : note;
        var n = el("span", "qp-item-note", short);
        if (short !== note) n.title = note;
        li.appendChild(n);
      }
      inv.appendChild(li);
    });
    var j = game.journal || {};
    $("qp-where").textContent = j.location || "Somewhere the map hasn't caught up with yet.";
    $("qp-goal").textContent = j.goal ? "Goal: " + j.goal : "";
    fillList("qp-done", j.done || [], "Nothing yet. Give it time.");
    fillList("qp-people", j.people || [], "Nobody memorable. Yet.");
    fillList("qp-threads", j.threads || [], "No loose ends. Suspicious.");
  }
  function renderArmed() {
    var box = $("qp-armed");
    var a = armed && abilityById(armed);
    box.hidden = !a;
    if (a) box.textContent = a.name + " is ready: it applies to your next action. " + a.desc;
  }
  function renderOpts() {
    optsBox.innerHTML = "";
    if (game.over) return;
    (game.opts || []).forEach(function (o) {
      var b = el("button", "qp-opt", o);
      b.type = "button";
      b.disabled = busy;
      b.addEventListener("click", function () { act(o); });
      optsBox.appendChild(b);
    });
  }
  function renderEnd() {
    endBox.hidden = !game.over;
    form.hidden = !!game.over;
    $("qp-leave").hidden = !!game.over;
    $("qp-copy-now").hidden = !!game.over;
    if (!game.over) return;
    var fell = game.outcome === "fell";
    $("qp-end-kicker").textContent = fell ? "The hero has fallen" : "Quest complete";
    $("qp-end-title").textContent = game.endTitle || (fell ? "A Noble, Brief Career" : "A Tale Worth Retelling");
    $("qp-end-stats").textContent = game.name + " · level " + game.level + " " + game.cls + " · " + game.turn + " turns · " + game.gold + " gold" +
      (game.items.length ? " · carrying " + game.items.join(", ") : "");
  }
  function renderAll() {
    setup.hidden = true;
    $("qp-saves").hidden = true;
    play.hidden = false;
    herald.classList.add("qp-wide");
    log.innerHTML = "";
    game.entries.forEach(addEntry);
    renderHud();
    renderArmed();
    renderOpts();
    renderEnd();
    loadSrdItems();
    // On narrow screens the HUD sits above the story, so start it folded.
    try {
      if (window.matchMedia("(max-width: 900px)").matches) {
        Array.prototype.forEach.call(document.querySelectorAll("#qp-hud details"), function (d) { d.open = false; });
      }
    } catch (e) {}
  }
  function loadSrdItems() {
    if (srdItems) return;
    srdItems = {};
    fetch("/data/srd.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      ((d && d.items) || []).forEach(function (i) { srdItems[i.n.toLowerCase()] = i.r + " magic item. " + i.d; });
      if (game) renderHud();
    }).catch(function () {});
  }

  // ---- Turns --------------------------------------------------------------
  function setBusy(on) {
    busy = on;
    go.disabled = on;
    go.textContent = on ? "..." : "Act";
    Array.prototype.forEach.call(optsBox.querySelectorAll("button"), function (b) { b.disabled = on; });
    if (game) renderHud();
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
  function payload(mode, action, effect) {
    return {
      mode: mode, length: game.length, action: action || "", effect: effect || null, setting: game.setting,
      name: game.name, cls: game.cls, level: game.level, hp: game.hp, max: game.max, gold: game.gold, items: game.items,
      abilities: abilities().map(function (a) { return a.name + " (" + usesLeft(a) + " left)"; }),
      turn: game.turn, journal: game.journal, history: game.history,
    };
  }
  function updateJournal() {
    var g = game;
    fetch("/api/quest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload("journal")) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.journal || g !== game) return;
        var j = d.journal;
        g.journal = {
          location: j.location || g.journal.location, goal: j.goal || g.journal.goal,
          done: j.done && j.done.length ? j.done : g.journal.done,
          people: j.people && j.people.length ? j.people : g.journal.people,
          threads: j.threads || g.journal.threads, villain: g.journal.villain || j.villain || "",
        };
        (j.items || []).forEach(function (it) { if (it && it.name && it.note) g.itemNotes[it.name.toLowerCase()] = it.note; });
        save();
        renderHud();
      })
      .catch(function () {});
  }
  function turn(mode, action, opts) {
    if (busy || !game || game.over) return;
    opts = opts || {};
    var userEntry = null, effect = null, ability = null, heal = 0;
    if (mode === "act") {
      game.turn += 1;
      if (opts.rest) effect = { kind: "rest" };
      else if (armed) {
        ability = abilityById(armed);
        effect = { kind: ability.kind, label: ability.name, floor: ability.floor || 0 };
        if (ability.kind === "heal") {
          heal = Math.min(game.max - game.hp, roll(ability.die) + game.level);
          effect.note = "The hero heals " + heal + " HP";
        } else if (ability.kind === "insight") effect.note = "Include one true, genuinely useful hint about the current problem";
        else if (ability.kind === "ward") effect.note = "Whatever happens, this action cannot hurt the hero";
      }
      userEntry = { role: "user", text: action, ability: ability ? "Used " + ability.name : opts.rest ? "Short rest" : "" };
      userEntry.view = addEntry(userEntry);
    }
    game.opts = [];
    renderOpts();
    setBusy(true);
    var view = addEntry({ role: "assistant", text: "..." });
    fetch("/api/quest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(mode, action, effect)) })
      .then(function (res) {
        if (!res.ok || !res.body) {
          return res.json().catch(function () { return {}; }).then(function (d) {
            throw new Error(d.error || "The Herald dropped the dice. Try again in a moment.");
          });
        }
        var r = Number(res.headers.get("X-Quest-Roll")) || 0;
        var band = res.headers.get("X-Quest-Band") || "";
        var prompt = decodeURIComponent(res.headers.get("X-Quest-Prompt") || "");
        var villain = decodeURIComponent(res.headers.get("X-Quest-Villain") || "");
        var rolls = (res.headers.get("X-Quest-Rolls") || "").split(",").filter(Boolean).map(Number);
        if (villain && !game.journal.villain) game.journal.villain = villain;
        if (userEntry && r) {
          userEntry.roll = r;
          userEntry.band = band;
          userEntry.rolls = rolls;
          var fresh = addEntry(userEntry);
          log.replaceChild(fresh.li, userEntry.view.li);
          userEntry.view = fresh;
          log.appendChild(view.li);
        }
        // The ability is spent once the Herald accepts the turn.
        if (ability) { game.uses[ability.id] = usesLeft(ability) - 1; armed = null; renderArmed(); }
        if (heal) game.hp += heal;
        if (opts.rest) {
          game.uses = {};
          game.lastRest = game.turn;
          heal = Math.min(game.max - game.hp, Math.ceil(game.max / 2));
          game.hp += heal;
        }
        return readStream(res, function (t) {
          renderText(view.body, narration(t) || "...");
          log.scrollTop = log.scrollHeight;
        }).then(function (full) {
          var story = narration(full);
          if (!story) throw new Error("The Herald lost the thread. Try that again.");
          var d = applyStatus(full, band, ability && ability.kind === "ward");
          if (heal) d.hp += heal;
          if (mode === "knockout") {
            var goldLost = Math.floor(game.gold / 2);
            game.gold -= goldLost;
            d.gold -= goldLost;
            game.hp = Math.max(1, Math.ceil(game.max / 3));
            d.hp = game.hp;
          }
          var entry = { role: "assistant", text: story, change: changeText(d) };
          if (userEntry) { delete userEntry.view; game.entries.push(userEntry); }
          game.entries.push(entry);
          game.opts = d.opts.length ? d.opts : FALLBACK_OPTS;
          game.history.push({ role: "user", content: prompt || action || "Begin." }, { role: "assistant", content: story + "\n" + canonicalStatus(d, game.opts) });
          game.history = game.history.slice(-10);
          if (d.title) game.endTitle = d.title;
          view.li.remove();
          addEntry(entry);
          var up = checkLevelUp();
          if (up) { var lv = { role: "system", text: up }; game.entries.push(lv); addEntry(lv); }
          var finished = mode === "fallen" || (game.length === "oneshot" && (d.end || game.turn >= ONESHOT_TURNS));
          if (finished) { game.over = true; game.outcome = game.hp <= 0 ? "fell" : "won"; }
          save();
          setBusy(false);
          renderOpts();
          renderEnd();
          if (!game.over && game.hp <= 0) return turn(game.length === "campaign" ? "knockout" : "fallen");
          if (!game.over && (mode === "start" || mode === "knockout" || (mode === "act" && game.turn % JOURNAL_EVERY === 0))) updateJournal();
        });
      })
      .catch(function (e) {
        if (mode === "fallen") {
          view.li.remove();
          game.over = true;
          game.outcome = "fell";
          save();
          setBusy(false);
          renderEnd();
          return;
        }
        if (mode === "act") {
          game.turn -= 1;
          if (userEntry && userEntry.view) userEntry.view.li.remove();
          if (!opts.rest) q.value = action;
        }
        view.li.classList.add("ak-error");
        renderText(view.body, e && e.message ? e.message : "The Herald dropped the dice. Try again in a moment.");
        game.opts = game.entries.length && mode !== "knockout" ? FALLBACK_OPTS : [];
        setBusy(false);
        renderOpts();
        if (!game.entries.length || mode === "knockout") {
          var retry = el("button", "qp-opt", mode === "knockout" ? "Wake up" : "Try starting again");
          retry.type = "button";
          retry.addEventListener("click", function () { view.li.remove(); retry.remove(); turn(mode === "knockout" ? "knockout" : "start"); });
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

  // ---- Setup and saved quests ----------------------------------------------
  function randomName() { return NAMES[Math.floor(Math.random() * NAMES.length)]; }
  function ago(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 2) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60);
    return h < 24 ? h + " h ago" : Math.round(h / 24) + " d ago";
  }
  function renderSaves() {
    var list = $("qp-save-list");
    list.innerHTML = "";
    var games = Object.keys(store.games).map(function (id) { return store.games[id]; })
      .filter(function (g) { return !g.over; })
      .sort(function (a, b) { return b.updated - a.updated; });
    $("qp-saves").hidden = !games.length;
    games.forEach(function (g) {
      var li = el("li", "qp-save");
      var info = el("div", "qp-save-info");
      info.appendChild(el("strong", null, g.questTitle));
      info.appendChild(el("span", null, g.name + " · level " + g.level + " " + g.cls + " · " +
        (g.length === "campaign" ? "campaign, turn " + g.turn : "turn " + g.turn + " of " + ONESHOT_TURNS) + " · " + ago(g.updated)));
      li.appendChild(info);
      var cont = el("button", "ak-btn qp-save-go", "Continue");
      cont.type = "button";
      cont.addEventListener("click", function () {
        game = g;
        armed = null;
        save();
        renderAll();
        if (!game.entries.length) turn("start");
        else if (game.hp <= 0) turn(game.length === "campaign" ? "knockout" : "fallen");
      });
      var del = el("button", "herald-clear", "Delete");
      del.type = "button";
      del.addEventListener("click", function () {
        if (del.dataset.sure) { removeGame(g.id); renderSaves(); return; }
        del.dataset.sure = "1";
        del.textContent = "Sure?";
        setTimeout(function () { del.textContent = "Delete"; delete del.dataset.sure; }, 3000);
      });
      li.appendChild(cont);
      li.appendChild(del);
      list.appendChild(li);
    });
  }
  function classNote() {
    var cls = setup.querySelector('input[name="qp-class"]:checked').value;
    var c = CLASSES[cls];
    $("qp-class-note").textContent = cls + ": " + c.blurb + " Starts with " + c.items.join(" and ") + ", plus " +
      c.abilities.filter(function (a) { return a.lvl === 1; }).map(function (a) { return a.name; }).join(" and ") + ".";
  }
  function showSetup() {
    game = null;
    armed = null;
    play.hidden = true;
    setup.hidden = false;
    herald.classList.remove("qp-wide");
    nameIn.value = randomName();
    renderSaves();
    classNote();
  }
  Array.prototype.forEach.call(setup.querySelectorAll('input[name="qp-class"]'), function (r) { r.addEventListener("change", classNote); });
  ownIn.addEventListener("focus", function () { setup.querySelector('input[value="own"]').checked = true; });
  setup.addEventListener("submit", function (e) {
    e.preventDefault();
    var pick = setup.querySelector('input[name="qp-setting"]:checked');
    var setting = pick.value === "own" ? ownIn.value.trim() : pick.value;
    if (!setting) { ownIn.focus(); return; }
    var cls = setup.querySelector('input[name="qp-class"]:checked').value;
    var c = CLASSES[cls];
    game = {
      id: "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: Date.now(), updated: Date.now(),
      length: setup.querySelector('input[name="qp-length"]:checked').value, setting: setting,
      questTitle: pick.value === "own" ? (setting.length > 48 ? setting.slice(0, 46) + "..." : setting) : pick.dataset.title,
      name: nameIn.value.trim() || randomName(), cls: cls, level: 1, xp: 0, hp: c.hp, max: c.hp, gold: 10,
      items: c.items.slice(), itemNotes: {}, uses: {}, lastRest: 0, turn: 0, history: [], entries: [], opts: [],
      journal: { location: "", goal: "", done: [], people: [], threads: [], villain: "" }, over: false, outcome: "", endTitle: "",
    };
    save();
    renderAll();
    turn("start");
  });
  $("qp-again").addEventListener("click", function () { if (!busy) showSetup(); });
  $("qp-leave").addEventListener("click", function () {
    if (busy) return;
    save();
    store.active = null;
    try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (e) {}
    showSetup();
  });
  $("qp-rest").addEventListener("click", function () {
    if (busy || !game || !canRest()) return;
    armed = null;
    renderArmed();
    turn("act", "I take a short rest.", { rest: true });
  });
  function copyTale(btn) {
    var status = game.over ? (game.outcome === "fell" ? "fell after " : "finished in ") + game.turn + " turns" : "is " + game.turn + " turns in";
    var tale = (game.endTitle || game.questTitle) + "\n" + game.name + ", level " + game.level + " " + game.cls + ", " + status + " with " + game.gold + " gold.\n\n" +
      game.entries.map(function (en) { return en.role === "user" ? "> " + en.text + (en.roll ? " (d20: " + en.roll + ")" : "") : en.text; }).join("\n\n") +
      "\n\nPlayed with the Herald at https://solosgems.com/";
    var label = btn.textContent;
    var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = label; }, 1800); };
    try { navigator.clipboard.writeText(tale).then(done, function () {}); } catch (e) {}
  }
  $("qp-copy").addEventListener("click", function () { copyTale(this); });
  $("qp-copy-now").addEventListener("click", function () { copyTale(this); });

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

  // ---- Boot ---------------------------------------------------------------
  try { localStorage.removeItem("solosgems-quest-v1"); } catch (e) {}
  loadStore();
  var resume = store.active && store.games[store.active];
  if (resume && !resume.over) {
    game = resume;
    renderAll();
    if (!game.entries.length) turn("start");
    else if (game.hp <= 0) turn(game.length === "campaign" ? "knockout" : "fallen");
  } else showSetup();
  var lastTab = "quest";
  try { lastTab = localStorage.getItem("solosgems-herald-tab") === "chat" ? "chat" : "quest"; } catch (e) {}
  showTab(lastTab);
})();
