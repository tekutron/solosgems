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
  var MAX_ITEMS = 10, MAX_NEARBY = 6;
  // Little pictures for items, by keyword (first match wins).
  var ICONS = [
    [/sword|blade|sabre|saber|cutlass/, "\u2694\uFE0F"], [/dagger|knife|shiv/, "\uD83D\uDDE1\uFE0F"], [/staff|wand|rod|scepter|sceptre/, "\uD83E\uDE84"],
    [/shield|buckler/, "\uD83D\uDEE1\uFE0F"], [/bow|arrow|crossbow/, "\uD83C\uDFF9"], [/axe|hatchet/, "\uD83E\uDE93"], [/hammer|mace|club/, "\uD83D\uDD28"],
    [/lockpick|pick/, "\uD83D\uDD13"], [/key/, "\uD83D\uDDDD\uFE0F"], [/potion|vial|flask|elixir|tonic/, "\uD83E\uDDEA"], [/scroll|parchment|letter|note|message|poster|warrant|contract|deed/, "\uD83D\uDCDC"],
    [/book|tome|grimoire|ledger|journal|bylaws|manual/, "\uD83D\uDCD6"], [/map|chart/, "\uD83D\uDDFA\uFE0F"], [/lute|harp|flute|horn|drum|instrument/, "\uD83E\uDE95"],
    [/ring/, "\uD83D\uDC8D"], [/amulet|charm|necklace|pendant|talisman|locket/, "\uD83D\uDCFF"], [/gem|crystal|jewel|ruby|emerald|sapphire|diamond|orb/, "\uD83D\uDC8E"],
    [/coin|gold|purse|pouch/, "\uD83E\uDE99"], [/crown|tiara/, "\uD83D\uDC51"], [/lantern|lamp|torch|candle/, "\uD83C\uDFEE"], [/rope|chain/, "\uD83E\uDEA2"],
    [/cloak|cape|robe|hat|boots|glove|armor|armour|helm/, "\uD83E\uDDE5"], [/bread|cheese|food|pie|apple|snack|soup|ration|cake|pizza/, "\uD83E\uDDC0"],
    [/ale|wine|beer|mug|tea|cup|bottle/, "\uD83C\uDF7A"], [/compass|clock|hourglass/, "\uD83E\uDDED"], [/mirror/, "\uD83E\uDE9E"], [/banner|flag/, "\uD83D\uDEA9"],
    [/bone|skull/, "\uD83D\uDC80"], [/feather|quill|pen/, "\uD83E\uDEB6"], [/frog|toad/, "\uD83D\uDC38"], [/egg/, "\uD83E\uDD5A"], [/bag|sack|chest|box|crate|jar/, "\uD83D\uDCE6"],
  ];
  var CLASS_ICONS = { Fighter: "\uD83D\uDEE1\uFE0F", Wizard: "\uD83E\uDDD9", Rogue: "\uD83D\uDDE1\uFE0F", Bard: "\uD83E\uDE95" };
  function itemIcon(name) {
    var n = name.toLowerCase();
    for (var i = 0; i < ICONS.length; i++) if (ICONS[i][0].test(n)) return ICONS[i][1];
    return "\u2728";
  }

  var $ = function (id) { return document.getElementById(id); };
  var setup = $("qp-setup");
  if (!setup) return;
  var play = $("qp-play"), log = $("qp-log"), form = $("qp-form"), q = $("qp-q"), go = $("qp-go");
  var optsBox = $("qp-opts"), endBox = $("qp-end"), nameIn = $("qp-name"), ownIn = $("qp-own"), herald = $("herald");

  var store = { active: null, games: {}, gone: {} };
  var account = null; // signed-in username, when the player has an account
  var game = null;
  var busy = false;
  var armed = null; // ability id armed for the next action
  var srdItems = null;
  var picked = null; // { from: "inv" | "near", name } selected in the HUD

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
    // If the browser's storage is full, the paintings go first, never the story.
    if (account) schedulePush();
    for (var k = ids.length; k >= 0; k--) {
      try { localStorage.setItem(STORE, JSON.stringify(store)); return; } catch (e) {}
      var drop = ids[k] && store.games[ids[k]];
      if (drop) drop.art = null;
    }
  }
  function removeGame(id) {
    delete store.games[id];
    store.gone = store.gone || {};
    store.gone[id] = Date.now();
    if (store.active === id) store.active = null;
    try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (e) {}
    if (account) schedulePush();
  }

  // ---- Accounts: the same saves, kept on the server too ------------------------
  // Signed-in players get their quests on any device. Each save is pushed a
  // couple of seconds after it changes; signing in merges the two lists,
  // keeping the newer copy of each quest and honoring deletions.
  var pushTimer = 0;
  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushSaves, 2500);
  }
  function pushSaves() {
    if (!account) return;
    fetch("/api/account/saves", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ games: store.games, gone: store.gone || {} }) })
      .then(function (r) { if (r.status === 401) signedOut(); })
      .catch(function () {});
  }
  function pullSaves() {
    return fetch("/api/account/saves").then(function (r) { return r.ok ? r.json() : null; }).then(function (remote) {
      if (!remote) return;
      store.gone = store.gone || {};
      Object.keys(remote.gone || {}).forEach(function (id) { store.gone[id] = Math.max(store.gone[id] || 0, remote.gone[id]); });
      Object.keys(remote.games || {}).forEach(function (id) {
        var r = remote.games[id], mine = store.games[id];
        if (!r || store.gone[id]) return;
        if (!mine || (r.updated || 0) > (mine.updated || 0)) {
          if (game && game.id === id) return; // never swap the quest being played
          store.games[id] = r;
        }
      });
      Object.keys(store.gone).forEach(function (id) { if (!(game && game.id === id)) delete store.games[id]; });
      try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (e) {}
      if (!game) renderSaves();
      pushSaves();
    }).catch(function () {});
  }
  function renderAccount() {
    $("qp-account-text").textContent = account
      ? "Signed in as " + account + ". Your quests follow you to any device."
      : "Quests save in this browser. Sign in to keep them on any device.";
    $("qp-account-btn").textContent = account ? "Sign out" : "Sign in";
    $("qp-del-btn").hidden = !account;
    if (account) $("qp-auth").hidden = true;
    else $("qp-del").hidden = true;
  }
  $("qp-del-btn").addEventListener("click", function () { $("qp-del").hidden = false; $("qp-del-pass").focus(); });
  $("qp-del-cancel").addEventListener("click", function () { $("qp-del").hidden = true; $("qp-del-pass").value = ""; });
  $("qp-del").addEventListener("submit", function (e) {
    e.preventDefault();
    var note = $("qp-del-note");
    fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("qp-del-pass").value }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        $("qp-del-pass").value = "";
        if (!x.ok) { note.textContent = x.d.error || "That didn't work."; note.classList.add("is-error"); return; }
        note.classList.remove("is-error");
        signedOut();
        $("qp-account-text").textContent = "Account deleted. Your quests are still saved in this browser.";
      })
      .catch(function () { note.textContent = "Couldn't reach the server. Try again."; note.classList.add("is-error"); });
  });
  function signedOut() {
    account = null;
    renderAccount();
  }
  function authNote(text, bad) {
    var n = $("qp-auth-note");
    n.textContent = text;
    n.classList.toggle("is-error", !!bad);
  }
  function auth(kind) {
    var name = $("qp-user").value.trim(), pass = $("qp-pass").value;
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(name)) { authNote("Usernames are 3 to 20 letters, numbers, - or _.", true); return; }
    if (pass.length < 8) { authNote("Passwords need at least 8 characters.", true); return; }
    authNote(kind === "signup" ? "Carving your name into the guild ledger..." : "Checking the guild ledger...");
    fetch("/api/account/" + kind, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: name, password: pass }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (!x.ok || !x.d.user) { authNote(x.d.error || "That didn't work. Try again.", true); return; }
        account = x.d.user;
        $("qp-pass").value = "";
        authNote("No email needed. There is no password reset, so pick one you'll remember.");
        renderAccount();
        pullSaves();
      })
      .catch(function () { authNote("The guild ledger is out of reach. Try again in a moment.", true); });
  }
  $("qp-account-btn").addEventListener("click", function () {
    if (account) {
      fetch("/api/account/logout", { method: "POST" }).catch(function () {});
      signedOut();
      return;
    }
    var f = $("qp-auth");
    f.hidden = !f.hidden;
    if (!f.hidden) $("qp-user").focus();
  });
  $("qp-auth").addEventListener("submit", function (e) { e.preventDefault(); auth("login"); });
  $("qp-signup").addEventListener("click", function () {
    $("qp-pass").setAttribute("autocomplete", "new-password");
    auth("signup");
  });

  // ---- Tabs ---------------------------------------------------------------
  var tabs = { quest: $("tab-quest"), chat: $("tab-chat") };
  var panels = { quest: $("qp"), chat: $("chat-panel") };
  function showTab(which) {
    Object.keys(tabs).forEach(function (k) {
      tabs[k].setAttribute("aria-selected", k === which ? "true" : "false");
      panels[k].hidden = k !== which;
    });
    herald.classList.toggle("qp-wide", which === "quest" && !play.hidden);
    document.body.classList.toggle("qp-playing", which === "quest" && !play.hidden);
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
  // Items by loose name: "my staff", "the Staff" and "Staff" are the same thing.
  function norm(s) {
    return s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\b(my|the|a|an|your|his|her|their|some|old)\b/g, " ").replace(/\s+/g, " ").trim();
  }
  function findItem(list, name) {
    var n = norm(name);
    if (!n) return -1;
    var i = list.findIndex(function (it) { return norm(it) === n; });
    if (i < 0 && n.length >= 4) i = list.findIndex(function (it) { var m = norm(it); return m.indexOf(n) >= 0 || n.indexOf(m) >= 0; });
    return i;
  }
  // Does the player's action name this item? Full name, its last word
  // ("staff") or its head word ("map" for "Map of the Tower").
  function mentions(action, item) {
    var a = " " + norm(action).replace(/s\b/g, "") + " ";
    var n = norm(item).replace(/s\b/g, "");
    var last = n.split(" ").pop(), head = n.split(" of ")[0].split(" ").pop();
    return a.indexOf(" " + n + " ") >= 0 || (last.length >= 4 && a.indexOf(" " + last + " ") >= 0) ||
      (head.length >= 3 && a.indexOf(" " + head + " ") >= 0);
  }
  var GIVE_AWAY = /\b(give|gives|giving|gave|hand|hands|handing|handed|sell|sells|sold|trade|trades|traded|donate|donates|gift|gifts|surrender|surrenders|eat|eats|ate|feed|feeds|pay|pays)\b/i;
  var SET_DOWN = /\b(drop|drops|dropped|throw|throws|threw|toss|tosses|tossed|hurl|hurls|leave|leaves|discard|discards|abandon|abandons|put down|puts down|set down|sets down)\b/i;
  var PICK_UP = /\b(pick up|picks up|pick it up|grab|grabs|take|takes|collect|collects|pocket|pockets|loot|loots|snatch|snatches|steal|steals|retrieve|retrieves|scoop|scoops|get)\b/i;
  // The words from the verb to the end of its clause: "give the troll my staff, then run" -> "give the troll my staff".
  function clause(action, verb) {
    var m = action.match(verb);
    return m ? action.slice(m.index).split(/[,.;!?]|\b(?:and (?:i|then)|then|but|while|before|after|so)\b/i)[0] : "";
  }
  // Who got it: "give my staff to the apprentice" -> "the apprentice",
  // "hand Tee the map" -> "Tee".
  function recipient(text, item) {
    var t = text.replace(/[,.;!?][\s\S]*$/, "");
    var word = "[A-Za-z][\\w'-]*";
    var m = t.match(new RegExp("\\b(?:to|with)\\s+(?:the\\s+|a\\s+|an\\s+|my\\s+)?(" + word + "(?:\\s+(?!(?:as|so|in|for|and|then|because|while|before|after|if)\\b)" + word + "){0,2})", "i"));
    if (!m) m = t.match(new RegExp("^\\w+(?:\\s+over)?\\s+(?:the\\s+)?(" + word + "(?:\\s+" + word + ")?)\\s+(?:my|the|a|an|his|her|our|this|that|some)\\b", "i"));
    if (!m) return "";
    var who = m[1].trim();
    if (mentions(who, item) || /^(my|it|them|him|her)$/i.test(who)) return "";
    return /^[a-z]/.test(who) && !/^the /i.test(who) ? "the " + who : who;
  }
  function howGone(text) {
    if (/\b(sell|sells|sold)\b/i.test(text)) return "sold";
    if (/\b(trade|trades|traded)\b/i.test(text)) return "traded";
    if (/\b(eat|eats|ate)\b/i.test(text)) return "eaten";
    if (/\b(feed|feeds)\b/i.test(text)) return "fed";
    if (/\b(pay|pays)\b/i.test(text)) return "paid";
    return "given";
  }
  function addNearby(name) {
    if (findItem(game.nearby, name) >= 0 || findItem(game.items, name) >= 0) return;
    game.nearby.push(name);
    if (game.nearby.length > MAX_NEARBY) game.nearby.shift();
  }
  function applyStatus(text, band, ward, action) {
    var d = { hp: 0, gold: 0, xp: 0, gained: [], lost: [], dropped: [], near: [], opts: [], end: false, title: "", blocked: false };
    statusLine(text).split(/\s*;\s*/).forEach(function (p) {
      p = p.trim();
      var m;
      if ((m = p.match(/^hp\s*([+-])\s*(\d+)$/i))) d.hp += (m[1] === "-" ? -1 : 1) * Number(m[2]);
      else if ((m = p.match(/^gold\s*([+-])\s*(\d+)$/i))) d.gold += (m[1] === "-" ? -1 : 1) * Number(m[2]);
      else if ((m = p.match(/^xp\s*\+?\s*(\d+)$/i))) d.xp += Number(m[1]);
      else if ((m = p.match(/^gain\s+(.+)$/i))) { var g = m[1].trim().slice(0, 32); if (!NONE.test(g) && !/\b(gold|coins?|xp)\b/i.test(g)) d.gained.push(g); }
      else if ((m = p.match(/^lose\s+(.+)$/i))) { if (!NONE.test(m[1].trim())) d.lost.push(m[1].trim()); }
      else if ((m = p.match(/^near(?:by)?\s+(.+)$/i))) { var nm = m[1].trim().slice(0, 32); if (!NONE.test(nm) && d.near.length < 2) d.near.push(nm); }
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
      var i = findItem(game.items, name);
      if (i >= 0) lost.push(game.items.splice(i, 1)[0]);
    });
    // The small model often forgets to write "lose" when the hero hands
    // something over, or "gain" when they pick something up, so read the
    // action too (unless the roll says it didn't work).
    var worked = band !== "Fail" && band !== "Disaster";
    var away = "";
    if (action && worked) {
      away = clause(action, GIVE_AWAY);
      var down = away ? "" : clause(action, SET_DOWN), up = clause(action, PICK_UP);
      if (away || down) {
        game.items.slice().forEach(function (it) {
          if (!mentions(away || down, it) || findItem(d.lost, it) >= 0) return;
          game.items.splice(game.items.indexOf(it), 1);
          if (down) { d.dropped.push(it); addNearby(it); } else lost.push(it);
        });
      }
      if (up) {
        game.nearby.forEach(function (it) {
          if (mentions(up, it) && findItem(d.gained, it) < 0) d.gained.push(it);
        });
      }
    }
    d.lost = lost;
    d.given = lost.map(function (it) {
      var g = away && mentions(away, it) ? { item: it, how: howGone(away), to: recipient(away, it), turn: game.turn } : { item: it, how: "lost", to: "", turn: game.turn };
      game.given.unshift(g);
      return g;
    });
    game.given = game.given.slice(0, 8);
    if (band === "Disaster" && d.hp >= 0 && !d.lost.length) d.hp = -1;
    if (ward && d.hp < 0) { d.hp = 0; d.blocked = true; }
    d.gained = d.gained.filter(function (g) {
      var k = findItem(game.nearby, g);
      if (k >= 0) { g = game.nearby[k]; game.nearby.splice(k, 1); }
      if (game.items.length >= MAX_ITEMS || game.items.some(function (it) { return it.toLowerCase() === g.toLowerCase(); })) return false;
      game.items.push(g);
      game.given = game.given.filter(function (x) { return norm(x.item) !== norm(g); });
      return true;
    });
    d.near = d.near.filter(function (n) {
      if (findItem(game.nearby, n) >= 0 || findItem(game.items, n) >= 0) return false;
      addNearby(n);
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
    (d.given || []).forEach(function (g) { bits.push(g.how === "lost" ? "lost " + g.item : g.how + " " + g.item + (g.to ? " to " + g.to : "")); });
    d.dropped.forEach(function (g) { bits.push("set down " + g); });
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
    d.lost.concat(d.dropped).forEach(function (g) { bits.push("lose " + g); });
    d.near.forEach(function (g) { bits.push("near " + g); });
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
  // Story text the way games print it: dialogue in its own color, item and
  // character names lit up, and comic sound effects that wobble.
  var SFX = "boom|kaboom|crash|bang|thud|whoosh|splash|crack|zap|pow|splat|clang|thwack|smash|poof|snap|crunch|roar|thunk|bonk|boing|kapow|whack|ka-?ching|squelch|sploosh|rumble|creak|ribbit";
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function hlNames() {
    if (!game) return { src: "", kind: {} };
    var kind = {};
    (game.items || []).concat(game.nearby || []).forEach(function (n) { if (n.length >= 3) kind[n.toLowerCase()] = "qp-hl-item"; });
    ((game.journal && game.journal.people) || []).forEach(function (p) {
      var n = (p.name || "").replace(/\s*\(.*$/, "").trim();
      if (n.length >= 3) kind[n.toLowerCase()] = "qp-hl-npc";
      var first = n.split(" ")[0];
      if (first && first.length >= 4 && !kind[first.toLowerCase()]) kind[first.toLowerCase()] = "qp-hl-npc";
    });
    if (game.name) kind[game.name.toLowerCase()] = "qp-hl-hero";
    var names = Object.keys(kind).sort(function (a, b) { return b.length - a.length; });
    return { src: names.map(esc).join("|"), kind: kind };
  }
  function appendRich(parent, text, hl) {
    var re = new RegExp("(\"[^\"\\n]{1,400}\"?|\u201c[^\u201d\\n]{1,400}\u201d?)|\\b(" + SFX + ")\\b(!*)" + (hl.src ? "|\\b(" + hl.src + ")\\b" : ""), "gi");
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[1]) parent.appendChild(el("span", "qp-say", m[1]));
      else if (m[2]) parent.appendChild(el("span", "qp-sfx", m[2].toUpperCase() + (m[3] || "!")));
      else parent.appendChild(el("span", hl.kind[m[4].toLowerCase()] || "qp-hl-item", m[4]));
      last = re.lastIndex;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }
  function renderText(body, text, rich) {
    body.innerHTML = "";
    var hl = rich ? hlNames() : null;
    text.split(/\n{2,}/).forEach(function (para) {
      if (!para.trim()) return;
      var p = el("p");
      para.split("\n").forEach(function (line, i) {
        if (i) p.appendChild(el("br"));
        line.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/).forEach(function (part) {
          if (/^\*\*[^*]+\*\*$/.test(part)) p.appendChild(el("strong", null, part.slice(2, -2)));
          else if (/^\*[^*]+\*$/.test(part)) p.appendChild(el("em", null, part.slice(1, -1)));
          else if (part && hl) appendRich(p, part, hl);
          else if (part) p.appendChild(document.createTextNode(part));
        });
      });
      body.appendChild(p);
    });
  }

  // ---- Game feel: shakes, flashes, floating numbers, spinning dice ----------
  var calm = false;
  try { calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  function fx(cls, ms) {
    if (calm) return;
    var box = document.querySelector(".qp-main");
    box.classList.remove(cls);
    void box.offsetWidth;
    box.classList.add(cls);
    setTimeout(function () { box.classList.remove(cls); }, ms || 700);
  }
  function floatText(text, cls, anchor) {
    if (calm || !anchor) return;
    var r = anchor.getBoundingClientRect();
    if (!r.width) return;
    var f = el("span", "qp-float " + cls, text);
    f.style.left = Math.round(r.left + r.width / 2) + "px";
    f.style.top = Math.round(r.top) + "px";
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 1500);
  }
  function banner(text, cls) {
    if (calm) return;
    var b = el("div", "qp-banner " + cls, text);
    document.querySelector(".qp-main").appendChild(b);
    setTimeout(function () { b.remove(); }, 1600);
  }
  function feel(d, band) {
    var t = 0;
    var later = function (fn) { setTimeout(fn, t); t += 180; };
    if (d.hp) later(function () { floatText((d.hp > 0 ? "+" : "") + d.hp + " HP", d.hp > 0 ? "is-heal" : "is-hurt", $("qp-hp-fill").parentNode); });
    if (d.xp) later(function () { floatText("+" + d.xp + " XP", "is-xp", $("qp-xp-fill").parentNode); });
    if (d.gold) later(function () { floatText((d.gold > 0 ? "+" : "") + d.gold + " gold", "is-gold", $("qp-gold")); });
    d.gained.forEach(function (g) { later(function () { floatText("+ " + g, "is-item", document.querySelector('.qp-hud-tab[data-pane="bag"]')); }); });
    (d.given || []).forEach(function (g) { later(function () { floatText("- " + g.item, "is-gone", document.querySelector('.qp-hud-tab[data-pane="bag"]')); }); });
    if (d.gained.length || (d.given || []).length || d.near.length) newsOn("bag");
    if (band === "Disaster") { fx("fx-shake", 600); fx("fx-red", 900); banner("NATURAL 1", "is-bad"); }
    else if (band === "Fail" && d.hp < 0) fx("fx-shake-small", 400);
    else if (band === "Legendary") { fx("fx-gold", 1100); banner("NATURAL 20!", "is-good"); }
    if (d.hp < 0 && band !== "Disaster") fx("fx-red", 600);
  }
  function spinChip(chip, final) {
    if (calm) return;
    var node = chip.querySelector(".qp-roll-n");
    if (!node) return;
    var n = 0;
    chip.classList.add("is-spinning");
    var tick = setInterval(function () {
      node.textContent = String(1 + Math.floor(Math.random() * 20));
      if (++n >= 9) { clearInterval(tick); node.textContent = final; chip.classList.remove("is-spinning"); }
    }, 55);
  }
  function addEntry(entry) {
    var cls = entry.role === "user" ? "ak-user-msg" : entry.role === "system" ? "qp-system-msg" : "ak-herald-msg";
    var li = el("li", "ak-msg " + cls);
    var body = el("div", "ak-body");
    renderText(body, entry.text, entry.role === "assistant");
    li.appendChild(body);
    if (entry.ability) li.appendChild(el("span", "qp-used", entry.ability));
    if (entry.roll) {
      var chip = el("span", "qp-roll qp-roll-" + entry.band.toLowerCase());
      chip.appendChild(el("span", "qp-die", "d20"));
      chip.appendChild(document.createTextNode(" " + (entry.rolls && entry.rolls.length > 1 ? entry.rolls.join(" / ") + " \u2192 " : "")));
      chip.appendChild(el("span", "qp-roll-n", String(entry.roll)));
      chip.appendChild(document.createTextNode(" \u00b7 " + entry.band));
      li.appendChild(chip);
      if (entry.spin) spinChip(chip, String(entry.roll));
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
    $("qp-portrait").textContent = CLASS_ICONS[game.cls] || "";
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
    rest.textContent = canRest() ? "Short rest (recharge, heal half)" : "Rest again in " + (REST_EVERY - (game.turn - game.lastRest)) + (REST_EVERY - (game.turn - game.lastRest) === 1 ? " turn" : " turns");

    renderBag();
    var j = game.journal || {};
    $("qp-where").textContent = j.location || "Somewhere the map hasn't caught up with yet.";
    $("qp-goal").textContent = j.goal || "Work out what's going on. The tracker fills in as the story moves.";
    var recent = $("qp-recent");
    recent.innerHTML = "";
    (j.done || []).slice(-3).forEach(function (x) { recent.appendChild(el("li", null, x)); });
    if (j.threads && j.threads.length) recent.appendChild(el("li", "qp-track-open", j.threads.length + " open thread" + (j.threads.length === 1 ? "" : "s") + ": " + j.threads[0]));
    fillList("qp-done", j.done || [], "Nothing yet. Give it time.");
    fillList("qp-people", j.people || [], "Nobody memorable. Yet.");
    fillList("qp-threads", j.threads || [], "No loose ends. Suspicious.");
    renderScene();
  }
  // Inventory: a bag of slots and a shelf of things lying nearby. Pick a
  // slot to see the item and what you can do with it.
  function slot(name, from, i) {
    var b = el("button", "qp-slot" + (picked && picked.from === from && picked.name === name ? " is-picked" : ""));
    b.type = "button";
    b.title = name;
    b.setAttribute("aria-label", (from === "near" ? "Nearby: " : "") + name);
    b.appendChild(el("span", "qp-slot-icon", itemIcon(name)));
    b.appendChild(el("span", "qp-slot-name", name));
    b.addEventListener("click", function () {
      var same = picked && picked.from === from && picked.name === name;
      picked = same ? null : { from: from, name: name };
      if (!same && !busy && !game.over) insertItem(name, from);
      renderBag();
    });
    return b;
  }
  // HUD tabs; a dot marks a tab with news the player hasn't looked at.
  var hudPane = "bag";
  function small() {
    try { return window.matchMedia("(max-width: 900px)").matches; } catch (e) { return false; }
  }
  // On phones the tabs fold: tap a tab to open it, tap it again to close.
  if (small()) hudPane = null;
  function showPane(name, toggle) {
    if (toggle && small() && name === hudPane) name = null;
    hudPane = name;
    document.querySelector(".qp-hud-body").hidden = !name;
    Array.prototype.forEach.call(document.querySelectorAll(".qp-hud-tab"), function (t) {
      var on = t.dataset.pane === name;
      t.setAttribute("aria-selected", on ? "true" : "false");
      if (on) t.classList.remove("has-news");
    });
    Array.prototype.forEach.call(document.querySelectorAll(".qp-pane"), function (p) { p.hidden = p.dataset.pane !== name; });
  }
  function newsOn(name) {
    if (name === hudPane) return;
    var t = document.querySelector('.qp-hud-tab[data-pane="' + name + '"]');
    if (t) t.classList.add("has-news");
  }
  Array.prototype.forEach.call(document.querySelectorAll(".qp-hud-tab"), function (t) {
    t.addEventListener("click", function () { showPane(t.dataset.pane, true); });
  });
  // Clicking an item puts it into the action box: "I use my Staff ", or
  // adds "my Staff" to what the player is already writing.
  function insertItem(name, from) {
    var v = q.value;
    if (!v.trim()) q.value = (from === "inv" ? "I use my " : "I pick up the ") + name + " ";
    else q.value = v.replace(/\s*$/, " ") + (from === "inv" ? "my " : "the ") + name + " ";
    grow();
    q.focus();
    try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) {}
  }
  function renderBag() {
    if (picked && (picked.from === "inv" ? game.items : game.nearby).indexOf(picked.name) < 0) picked = null;
    var inv = $("qp-inventory");
    inv.innerHTML = "";
    for (var i = 0; i < MAX_ITEMS; i++) {
      var li = el("li");
      if (game.items[i]) li.appendChild(slot(game.items[i], "inv", i));
      else li.appendChild(el("span", "qp-slot qp-slot-empty"));
      inv.appendChild(li);
    }
    $("qp-inv-count").textContent = game.items.length + "/" + MAX_ITEMS;
    var near = $("qp-nearby");
    near.innerHTML = "";
    if (!game.nearby.length) near.appendChild(el("li", "qp-empty", "Nothing lying around. Look harder."));
    game.nearby.forEach(function (n, i) { var li = el("li"); li.appendChild(slot(n, "near", i)); near.appendChild(li); });
    var gone = $("qp-given");
    gone.innerHTML = "";
    if (!game.given.length) gone.appendChild(el("li", "qp-empty", "Nothing given away. Generous, you are not."));
    game.given.forEach(function (g) {
      var li = el("li");
      li.appendChild(el("span", "qp-given-icon", itemIcon(g.item)));
      li.appendChild(el("strong", null, g.item));
      li.appendChild(document.createTextNode(" " + (g.how === "lost" ? "lost" : g.how + (g.to ? " to " + g.to : "")) + " (turn " + g.turn + ")"));
      gone.appendChild(li);
    });

    var box = $("qp-item-detail");
    box.innerHTML = "";
    box.hidden = !picked;
    if (!picked) return;
    var head = el("div", "qp-detail-head");
    head.appendChild(el("span", "qp-detail-icon", itemIcon(picked.name)));
    head.appendChild(el("strong", null, picked.name));
    box.appendChild(head);
    var note = itemNote(picked.name);
    if (picked.from === "near") note = note || "Lying right there. Finders keepers?";
    if (note) {
      var short = note.length > 160 ? note.slice(0, note.lastIndexOf(" ", 158)) + "..." : note;
      var n = el("p", "qp-item-note", short);
      if (short !== note) n.title = note;
      box.appendChild(n);
    }
    var row = el("div", "qp-detail-actions");
    var off = busy || game.over;
    var btn = function (label, fn, dis) {
      var b = el("button", "qp-mini", label);
      b.type = "button";
      b.disabled = off || !!dis;
      b.addEventListener("click", fn);
      row.appendChild(b);
    };
    var name = picked.name;
    if (picked.from === "inv") {
      btn("Use", function () { draft("I use my " + name + " to "); });
      btn("Give", function () { draft("I give my " + name + " to "); });
      btn("Drop", function () { dropItem(name); });
    } else {
      btn(game.items.length >= MAX_ITEMS ? "Bag full" : "Pick up", function () { picked = null; act("I pick up the " + name + "."); }, game.items.length >= MAX_ITEMS);
      btn("Look closer", function () { picked = null; act("I take a closer look at the " + name + "."); });
    }
    box.appendChild(row);
  }
  // Start an action in the box for the player to finish ("I give my Staff to ...").
  function draft(text) {
    picked = null;
    renderBag();
    q.value = text;
    grow();
    q.focus();
    try { q.setSelectionRange(text.length, text.length); } catch (e) {}
  }
  // Dropping is free: the item moves to the floor and the Herald hears about it next turn.
  function dropItem(name) {
    var i = game.items.indexOf(name);
    if (i < 0 || busy || game.over) return;
    game.items.splice(i, 1);
    addNearby(name);
    game.pending = (game.pending ? game.pending + " " : "") + "The hero has set down the " + name + ".";
    picked = null;
    var e = { role: "system", text: "You set down the " + name + ". It's on the floor if you change your mind." };
    game.entries.push(e);
    addEntry(e);
    save();
    renderHud();
  }
  // ---- Scene art: a new picture of what just happened, every turn ------------
  var artBusy = false, artNext = null;
  function renderScene() {
    var fig = $("qp-scene"), img = $("qp-scene-img"), old = $("qp-scene-old");
    var art = game.art;
    fig.hidden = !art || game.artOn === false;
    $("qp-scene-busy").hidden = !artBusy;
    if (!art) return;
    if (img.getAttribute("src") !== art.src) {
      if (img.getAttribute("src")) old.setAttribute("src", img.getAttribute("src"));
      img.classList.remove("is-new");
      void img.offsetWidth;
      img.setAttribute("src", art.src);
      img.classList.add("is-new");
    }
    img.alt = art.place ? "Picture of " + art.place : "Picture of the scene";
    $("qp-scene-cap").textContent = art.place || game.questTitle;
  }
  // Keep a small copy so six saved quests still fit in the browser's storage.
  function shrink(src) {
    return new Promise(function (done) {
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement("canvas");
          c.width = 640; c.height = 360;
          var sh = im.width * 9 / 16, sy = Math.max(0, (im.height - sh) / 2);
          c.getContext("2d").drawImage(im, 0, sy, im.width, sh, 0, 0, 640, 360);
          done(c.toDataURL("image/jpeg", 0.72));
        } catch (e) { done(null); }
      };
      im.onerror = function () { done(null); };
      im.src = src;
    });
  }
  function paintScene(g, scene) {
    if (g.artOn === false || !scene) return;
    if (artBusy) { artNext = { g: g, scene: scene }; return; }
    artBusy = true;
    if (g === game) $("qp-scene-busy").hidden = false;
    var place = (g.journal && g.journal.location) || "";
    var body = { scene: scene.slice(0, 500), place: place, setting: g.questTitle, style: g.artStyle || "pixel", hero: g.name + ", a " + g.cls };
    if (g.tavern && g.tavern.on) body.tavern = { id: g.id, key: g.tavern.key };
    fetch("/api/quest-art", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return d && d.image ? shrink(d.image) : null; })
      .then(function (src) {
        artBusy = false;
        if (src) {
          g.art = { place: place, src: src };
          save();
          if (g.party) partyPost(g, "art", { src: src }).then(function (x) { if (x.ok && x.d.artV) g.party.artV = x.d.artV; });
        }
        if (g === game) renderScene();
        if (artNext) { var n = artNext; artNext = null; paintScene(n.g, n.scene); }
      })
      .catch(function () { artBusy = false; if (g === game) renderScene(); });
  }
  function renderArtToggle() {
    $("qp-art-toggle").textContent = game && game.artOn === false ? "Pictures: off" : "Pictures: on";
  }
  $("qp-art-toggle").addEventListener("click", function () {
    if (!game) return;
    game.artOn = game.artOn === false;
    save();
    renderArtToggle();
    renderScene();
    if (game.artOn && !game.art) {
      var lastScene = game.entries.filter(function (e) { return e.role === "assistant"; }).pop();
      if (lastScene) paintScene(game, lastScene.text);
    }
  });

  // ---- Reactions: a GIF (or a sticker) for the big moments --------------------
  var REACT = {
    Legendary: { p: 1, e: "\uD83C\uDF89", q: ["mic drop", "nailed it", "epic win", "flawless victory", "standing ovation"], c: ["NAT 20. Fine, I'm impressed. Don't let it go to your head.", "The dice just asked for your autograph.", "Legendary. The bards are already arguing over the rhyme."] },
    Success: { p: 0.15, e: "\uD83D\uDE0E", q: ["nailed it", "smooth", "too easy", "deal with it"], c: ["Look at you, being competent.", "Clean. Suspiciously clean.", "Okay, that was actually good."] },
    Mixed: { p: 0.12, e: "\uD83E\uDD37", q: ["close enough", "well that happened", "awkward", "it worked i guess"], c: ["Technically a win. Technically.", "Close enough for a bard's song.", "It worked. Mostly. Kind of."] },
    Fail: { p: 0.2, e: "\uD83D\uDE43", q: ["nope", "fail", "oops", "bruh", "that went well"], c: ["Bold. Wrong, but bold.", "The dice said no. Loudly.", "That was a choice."] },
    Disaster: { p: 1, e: "\uD83D\uDD25", q: ["this is fine", "epic fail", "facepalm", "everything is fine", "dumpster fire"], c: ["NAT 1. Everything is fine.", "Somewhere, a bard is writing this down.", "The dice remember what you did."] },
    levelup: { p: 1, e: "\uD83C\uDF1F", q: ["level up", "power up", "glow up"], c: ["LEVEL UP. The tavern will hear about this."] },
    knockout: { p: 1, e: "\uD83D\uDCA4", q: ["knocked out", "fainting", "passed out"], c: ["Lights out. Naptime is a valid strategy."] },
    rich: { p: 0.6, e: "\uD83D\uDCB0", q: ["make it rain", "money money", "cha ching"], c: ["Money! Try not to spend it all on hats."] },
    won: { p: 1, e: "\uD83C\uDFC6", q: ["slow clap", "victory dance", "applause"], c: ["Quest complete. Roll the credits."] },
    fell: { p: 1, e: "\uD83E\uDEA6", q: ["press f", "rip", "dramatic death"], c: ["Rest in pieces. Gloriously."] },
  };
  var BIG = { Legendary: 1, Disaster: 1, levelup: 1, knockout: 1, won: 1, fell: 1 };
  var lastPop = -10, gifOff = false, popTimer = 0, popsOn = true;
  try { popsOn = localStorage.getItem("solosgems-quest-pops") !== "off"; } catch (e) {}
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function react(kind) {
    var r = REACT[kind];
    if (!r || !popsOn || !game) return;
    if (!BIG[kind] && (Math.random() > r.p || game.turn - lastPop < 3)) return;
    lastPop = game.turn;
    var cap = pickOne(r.c);
    if (gifOff) { showPop(null, r.e, cap); return; }
    fetch("/api/quest-gif?q=" + encodeURIComponent(pickOne(r.q)))
      .then(function (res) { return res.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (d && d.off) gifOff = true;
        showPop(d && d.url ? d : null, r.e, cap);
      })
      .catch(function () { showPop(null, r.e, cap); });
  }
  function showPop(gif, emoji, caption) {
    var box = $("qp-pop");
    clearTimeout(popTimer);
    box.innerHTML = "";
    box.className = "qp-pop";
    var show = function () {
      box.hidden = false;
      void box.offsetWidth;
      box.classList.add("is-on");
      popTimer = setTimeout(hidePop, gif ? 5200 : 3600);
    };
    if (gif) {
      var img = el("img");
      img.alt = gif.title || caption;
      img.width = gif.w || 200;
      img.height = gif.h || 200;
      box.appendChild(img);
      box.appendChild(el("p", "qp-pop-cap", caption));
      box.appendChild(el("span", "qp-pop-credit", "Powered by GIPHY"));
      var shown = false;
      img.onload = function () { if (!shown) { shown = true; show(); } };
      img.onerror = function () { if (!shown) { shown = true; showPop(null, emoji, caption); } };
      img.src = gif.url;
    } else {
      box.classList.add("qp-pop-sticker");
      box.appendChild(el("span", "qp-pop-emoji", emoji));
      box.appendChild(el("p", "qp-pop-cap", caption));
      show();
    }
  }
  function hidePop() {
    var box = $("qp-pop");
    box.classList.remove("is-on");
    setTimeout(function () { if (!box.classList.contains("is-on")) box.hidden = true; }, 300);
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
    if (!game.nearby) game.nearby = [];
    if (!game.given) game.given = [];
    if (!game.artStyle) game.artStyle = "painted";
    if (game.pending == null) game.pending = "";
    picked = null;
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
    renderTavern();
    loadSrdItems();
    if (!game.art && game.entries.length) {
      var lastScene = game.entries.filter(function (e) { return e.role === "assistant"; }).pop();
      if (lastScene) paintScene(game, lastScene.text);
    }
    showPane(hudPane);
    renderArtToggle();
    renderParty();
    renderGate();
    if (game.party) partyPoll(50);
    document.body.classList.add("qp-playing");
    $("qp-account").hidden = true;
    fitPlay(true);
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
    go.disabled = on || (game && game.party ? !myTurn() : false);
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
  function payload(mode, action, effect, shownAction) {
    return {
      mode: mode, length: game.length, action: action || "", effect: effect || null, setting: game.setting,
      name: game.name, cls: game.cls, level: game.level, hp: game.hp, max: game.max, gold: game.gold, items: game.items, nearby: game.nearby, given: game.given.slice(0, 6),
      abilities: abilities().map(function (a) { return a.name + " (" + usesLeft(a) + " left)"; }),
      turn: game.turn, journal: game.journal, history: game.history,
      party: game.party ? { code: game.party.code, pid: game.party.pid, key: game.party.key } : null,
      tavern: !game.party && game.tavern && game.tavern.on && mode !== "journal" ? { id: game.id, key: game.tavern.key, title: game.questTitle, shown: shownAction || "" } : null,
    };
  }
  function updateJournal() {
    var g = game;
    fetch("/api/quest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload("journal")) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.journal || g !== game) return;
        var j = d.journal;
        var moved = j.location && norm(j.location) !== norm(g.journal.location || "");
        if (moved && g.journal.location) g.nearby = [];
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
    if (game.party && mode === "act" && !myTurn()) return;
    opts = opts || {};
    var userEntry = null, effect = null, ability = null, heal = 0;
    var sent = action;
    if (mode === "act" && game.pending && !opts.rest) sent = "(" + game.pending + ") " + action;
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
    fetch("/api/quest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(mode, sent, effect, action)) })
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
          userEntry.spin = true;
          var fresh = addEntry(userEntry);
          delete userEntry.spin;
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
        view.li.classList.add("is-typing");
        return readStream(res, function (t) {
          renderText(view.body, narration(t) || "...", true);
          log.scrollTop = log.scrollHeight;
        }).then(function (full) {
          var story = narration(full);
          if (!story) throw new Error("The Herald lost the thread. Try that again.");
          var d = applyStatus(full, band, ability && ability.kind === "ward", mode === "act" && !opts.rest ? action : "");
          if (mode === "act") game.pending = "";
          // One-shots end on the last turn or in act three, never earlier,
          // however hard the player (or the model) tries to skip ahead.
          if (d.end && game.length === "oneshot" && game.turn < ONESHOT_TURNS - 4) { d.end = false; d.title = ""; }
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
          var shown = addEntry(entry);
          shown.li.classList.add("is-fresh");
          feel(d, band);
          paintScene(game, story);
          var up = checkLevelUp();
          if (up) { var lv = { role: "system", text: up }; game.entries.push(lv); addEntry(lv); }
          var finished = !game.party && (mode === "fallen" || (game.length === "oneshot" && (d.end || game.turn >= ONESHOT_TURNS)));
          if (finished) { game.over = true; game.outcome = game.hp <= 0 ? "fell" : "won"; }
          react(finished ? (game.outcome === "fell" ? "fell" : "won") : up ? "levelup" : mode === "knockout" ? "knockout" : d.gold >= 20 ? "rich" : band);
          save();
          setBusy(false);
          renderOpts();
          renderEnd();
          if (game.party) {
            // Party rules: nobody dies; a hero at 0 HP blacks out and gets back up.
            if (game.hp <= 0) {
              var lostGold = Math.floor(game.gold / 2);
              game.gold -= lostGold;
              game.hp = Math.max(1, Math.ceil(game.max / 3));
              var ko = { role: "system", text: game.name + " blacks out, wakes up with " + game.hp + " HP and " + lostGold + " fewer gold, and pretends it was a tactical nap." };
              game.entries.push(ko);
              addEntry(ko);
              save();
            }
            partyHeroSync();
            renderGate();
            if (mode === "start" || (mode === "act" && game.turn % JOURNAL_EVERY === 0)) updateJournal();
            partyPoll(600);
            return;
          }
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
        if (game.party) { renderGate(); partyPoll(300); }
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
      info.appendChild(el("span", null, (g.party ? "Party " + g.party.code + " · " : "") + g.name + " · level " + g.level + " " + g.cls + " · " +
        (g.length === "campaign" ? "campaign, turn " + g.turn : "turn " + g.turn + " of " + ONESHOT_TURNS) + " · " + ago(g.updated)));
      li.appendChild(info);
      var cont = el("button", "ak-btn qp-save-go", "Continue");
      cont.type = "button";
      cont.addEventListener("click", function () {
        game = g;
        armed = null;
        save();
        renderAll();
        if (!game.entries.length && !game.party) turn("start");
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
  // Bring the whole game into view and size it to the window, so the story,
  // the HUD and the input box all fit without scrolling the page.
  function fitPlay(scroll) {
    if (play.hidden) return;
    try {
      var head = document.querySelector(".site-header");
      var headH = head ? head.getBoundingClientRect().height : 0;
      if (scroll) {
        var top = herald.getBoundingClientRect().top + window.scrollY - headH - 8;
        window.scrollTo(0, Math.max(0, top));
      }
      var avail = window.innerHeight - Math.max(play.getBoundingClientRect().top, headH) - 12;
      play.style.setProperty("--qp-h", Math.max(520, Math.round(avail)) + "px");
    } catch (e) {}
    if (scroll) setTimeout(function () { fitPlay(false); }, 80);
  }
  window.addEventListener("resize", function () { fitPlay(false); });
  function showSetup() {
    clearTimeout(partyTimer);
    document.body.classList.remove("qp-playing");
    $("qp-account").hidden = false;
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
  function setupMode() { return setup.querySelector('input[name="qp-mode"]:checked').value; }
  function modeChanged() {
    var join = setupMode() === "join";
    Array.prototype.forEach.call(setup.querySelectorAll(".qp-quests, .qp-lengths, .qp-styles, .qp-check"), function (f) { f.hidden = join; });
    setup.querySelector(".qp-begin").textContent = join ? "Join the party" : setupMode() === "host" ? "Start the party quest" : "Begin the quest";
    partyNote("");
  }
  function partyNote(text, bad) {
    var n = $("qp-party-note");
    n.hidden = !text;
    n.textContent = text;
    n.classList.toggle("is-error", !!bad);
  }
  Array.prototype.forEach.call(setup.querySelectorAll('input[name="qp-mode"]'), function (r) { r.addEventListener("change", modeChanged); });
  $("qp-code").addEventListener("focus", function () { setup.querySelector('input[value="join"]').checked = true; modeChanged(); });
  $("qp-code").addEventListener("input", function () { this.value = this.value.toUpperCase().replace(/[^A-Z2-9]/g, ""); });
  function newHero(cls) {
    var c = CLASSES[cls];
    return {
      id: "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: Date.now(), updated: Date.now(),
      name: nameIn.value.trim() || randomName(), cls: cls, level: 1, xp: 0, hp: c.hp, max: c.hp, gold: 10,
      items: c.items.slice(), nearby: [], given: [], pending: "", art: null, itemNotes: {}, uses: {}, lastRest: 0, turn: 0, history: [], entries: [], opts: [],
      journal: { location: "", goal: "", done: [], people: [], threads: [], villain: "" }, over: false, outcome: "", endTitle: "",
    };
  }
  function joinParty(cls) {
    var code = $("qp-code").value.trim().toUpperCase();
    if (code.length !== 6) { partyNote("Party codes are 6 letters and numbers.", true); $("qp-code").focus(); return; }
    var g = newHero(cls);
    partyNote("Knocking on the tavern door...");
    fetch("/api/party/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code, hero: { name: g.name, cls: g.cls, level: 1, hp: g.hp, max: g.max } }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (!x.ok) { partyNote(x.d.error || "Couldn't join that party.", true); return; }
        var r = x.d;
        g.setting = r.setting;
        g.questTitle = r.title;
        g.length = r.length;
        g.artStyle = r.style;
        g.turn = r.turn;
        g.party = { code: r.code, pid: r.pid, key: r.key, host: false, lastN: 0, artV: 0, players: r.players, turnPid: r.turnPid, started: r.started };
        g.entries.push({ role: "system", text: "You joined " + (r.players[0] ? r.players[0].name + "'s" : "the") + " party. Party code " + r.code + "." });
        game = g;
        applyRoom(r);
        save();
        renderAll();
      })
      .catch(function () { partyNote("The tavern door is stuck. Try again in a moment.", true); });
  }
  setup.addEventListener("submit", function (e) {
    e.preventDefault();
    var mode = setupMode();
    if (mode === "join") { joinParty(setup.querySelector('input[name="qp-class"]:checked').value); return; }
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
      items: c.items.slice(), nearby: [], given: [], pending: "", art: null, artStyle: setup.querySelector('input[name="qp-style"]:checked').value, itemNotes: {}, uses: {}, lastRest: 0, turn: 0, history: [], entries: [], opts: [],
      journal: { location: "", goal: "", done: [], people: [], threads: [], villain: "" }, over: false, outcome: "", endTitle: "",
    };
    if (mode === "host") {
      var hostGame = game;
      game = null;
      partyNote("Booking a table for the party...");
      fetch("/api/party/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setting: hostGame.setting, title: hostGame.questTitle, length: hostGame.length, style: hostGame.artStyle, hero: { name: hostGame.name, cls: hostGame.cls, level: 1, hp: hostGame.hp, max: hostGame.max } }) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) {
          if (!x.ok) { partyNote(x.d.error || "Couldn't open a party room.", true); return; }
          hostGame.party = { code: x.d.code, pid: x.d.pid, key: x.d.key, host: true, lastN: 0, artV: 0, players: [{ pid: x.d.pid, name: hostGame.name, cls: hostGame.cls, level: 1, hp: hostGame.hp, max: hostGame.max }], turnPid: x.d.pid, started: false };
          hostGame.entries.push({ role: "system", text: "Party code " + x.d.code + ". Send it (or the invite link above) to your friends. They join on this page and take turns after you." });
          game = hostGame;
          save();
          renderAll();
          turn("start");
        })
        .catch(function () { partyNote("Couldn't reach the tavern. Try again in a moment.", true); });
      return;
    }
    if ($("qp-tavern").checked) game.tavern = { on: true, key: tavernKey() };
    save();
    renderAll();
    turn("start");
  });

  // ---- Party play ------------------------------------------------------------
  // The room is the source of truth for the shared story and the turn order;
  // each player's page owns their own hero. Other players' scenes arrive by
  // polling every few seconds and are added to this player's log.
  var partyTimer = 0;
  function partyPost(g, op, body) {
    return fetch("/api/party/" + g.party.code + "/" + op, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ pid: g.party.pid, key: g.party.key }, body || {})) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); });
  }
  function myTurn() {
    var P = game && game.party;
    if (!P) return true;
    if (P.gone || game.over) return false;
    if (!P.started) return false;
    return P.turnPid === P.pid && (!P.busy || P.busy === P.pid);
  }
  function partyHeroSync() {
    if (!game || !game.party) return;
    partyPost(game, "hero", { hero: { name: game.name, cls: game.cls, level: game.level, hp: game.hp, max: game.max } }).catch(function () {});
  }
  function partyPoll(delay) {
    clearTimeout(partyTimer);
    if (!game || !game.party || game.party.gone) return;
    var g = game;
    partyTimer = setTimeout(function () {
      if (g !== game || play.hidden) return;
      partyPost(g, "state", { since: g.party.lastN || 0 }).then(function (x) {
        if (g !== game) return;
        if (x.status === 403 || x.status === 404) {
          g.party.gone = true;
          var e = { role: "system", text: "This party room has closed. Your hero and the story so far are still saved here." };
          g.entries.push(e);
          addEntry(e);
          save();
          renderGate();
          return;
        }
        if (x.ok) applyRoom(x.d);
        partyPoll(document.hidden ? 8000 : 2500);
      }).catch(function () { partyPoll(5000); });
    }, delay == null ? 2500 : delay);
  }
  // "hp -2; gain Rope" from someone else's turn, for their scene's change line.
  function statusSummary(st, name) {
    var bits = [];
    st.split(/\s*;\s*/).forEach(function (p) {
      var m;
      if ((m = p.match(/^hp\s*([+-]\s*\d+)$/i))) bits.push(m[1].replace(/\s/g, "") + " HP");
      else if ((m = p.match(/^gold\s*([+-]\s*\d+)$/i))) bits.push(m[1].replace(/\s/g, "") + " gold");
      else if ((m = p.match(/^gain\s+(.+)$/i)) && !NONE.test(m[1])) bits.push("gained " + m[1]);
      else if ((m = p.match(/^lose\s+(.+)$/i)) && !NONE.test(m[1])) bits.push("lost " + m[1]);
    });
    return bits.length ? name + ": " + bits.join(" \u00b7 ") : "";
  }
  function applyRoom(r) {
    var P = game.party;
    P.players = r.players || P.players;
    P.turnPid = r.turnPid;
    P.busy = r.busy;
    P.started = r.started;
    P.last = r.last;
    if (r.journal && (r.journal.location || r.journal.goal || (r.journal.done && r.journal.done.length))) {
      game.journal = Object.assign({ location: "", goal: "", done: [], people: [], threads: [], villain: "" }, r.journal);
    }
    if (typeof r.turn === "number") game.turn = r.turn;
    var fresh = [];
    (r.entries || []).forEach(function (e) {
      if (e.n <= (P.lastN || 0)) return;
      P.lastN = e.n;
      if (e.pid === P.pid) return; // our own scenes are already on screen
      if (e.a) {
        var u = { role: "user", text: e.name + ": " + e.a, roll: e.r || 0, band: e.b || "", who: e.name };
        game.entries.push(u);
        addEntry(u);
      }
      var h = { role: "assistant", text: e.s, change: e.st ? statusSummary(e.st, e.name) : "" };
      game.entries.push(h);
      addEntry(h).li.classList.add("is-fresh");
      fresh.push(e);
    });
    if (fresh.length) {
      var lastE = fresh[fresh.length - 1];
      if (lastE.b === "Disaster") { fx("fx-shake", 600); fx("fx-red", 900); banner("NATURAL 1", "is-bad"); }
      else if (lastE.b === "Legendary") { fx("fx-gold", 1100); banner("NATURAL 20!", "is-good"); }
    }
    if (r.artV && r.artV !== P.artV) {
      P.artV = r.artV;
      partyPost(game, "artget", {}).then(function (x) {
        if (x.ok && x.d.src && game && game.party === P) { game.art = { place: (game.journal && game.journal.location) || "", src: x.d.src }; save(); renderScene(); }
      });
    }
    if (r.over && !game.over) {
      game.over = true;
      game.outcome = "won";
      renderEnd();
    }
    var wasMine = P.wasMine;
    P.wasMine = myTurn();
    if (P.wasMine && !wasMine && fresh.length) { banner("YOUR TURN", "is-good"); game.opts = FALLBACK_OPTS; }
    save();
    renderHud();
    renderParty();
    renderGate();
    renderOpts();
  }
  function renderParty() {
    var box = $("qp-party");
    var P = game && game.party;
    box.hidden = !P;
    $("qp-party-code").hidden = !P;
    if (!P) return;
    $("qp-party-code").textContent = "Party " + P.code + " \u00b7 copy invite";
    box.innerHTML = "";
    (P.players || []).forEach(function (p) {
      var li = el("li", "qp-party-row" + (p.pid === P.turnPid ? " is-turn" : "") + (p.pid === P.pid ? " is-me" : ""));
      li.appendChild(el("span", "qp-party-icon", CLASS_ICONS[p.cls] || ""));
      li.appendChild(el("span", "qp-party-name", p.name + (p.pid === P.pid ? " (you)" : "")));
      li.appendChild(el("span", "qp-party-meta", "L" + p.level + " \u00b7 " + p.hp + "/" + p.max));
      var bar = el("span", "qp-party-bar");
      var fill = el("span");
      fill.style.width = Math.round((100 * p.hp) / Math.max(1, p.max)) + "%";
      bar.appendChild(fill);
      li.appendChild(bar);
      box.appendChild(li);
    });
  }
  function renderGate() {
    var P = game && game.party;
    var gate = $("qp-gate");
    if (!P || game.over) {
      gate.hidden = true;
      q.disabled = false;
      q.placeholder = "What do you do?";
      return;
    }
    var mine = myTurn();
    var who = (P.players || []).filter(function (p) { return p.pid === P.turnPid; })[0];
    var text;
    if (P.gone) text = "The party room has closed.";
    else if (!P.started) text = P.host ? "Setting the scene..." : "Waiting for the host to start the quest...";
    else if (mine) text = "Your turn! What does " + game.name + " do?";
    else if (P.busy) text = (who ? who.name : "Someone") + " is taking their turn...";
    else text = "Waiting for " + (who ? who.name : "the next hero") + " to act.";
    gate.hidden = false;
    gate.classList.toggle("is-mine", mine);
    $("qp-gate-text").textContent = text;
    $("qp-skip").hidden = !(P.started && !mine && !P.busy && !P.gone && P.last && Date.now() - P.last > 120000);
    q.disabled = !mine || busy;
    go.disabled = !mine || busy;
    q.placeholder = mine ? "Your turn. What do you do?" : "Waiting for your turn...";
    optsBox.hidden = !mine;
  }
  $("qp-skip").addEventListener("click", function () {
    if (!game || !game.party) return;
    partyPost(game, "skip", {}).then(function () { partyPoll(100); });
  });
  $("qp-party-code").addEventListener("click", function () {
    if (!game || !game.party) return;
    var btn = this, link = location.origin + "/?party=" + game.party.code;
    var label = btn.textContent;
    try { navigator.clipboard.writeText("Join my quest on Solos Gems! Party code " + game.party.code + ": " + link).then(function () { btn.textContent = "Invite copied"; setTimeout(function () { btn.textContent = label; }, 1800); }, function () {}); } catch (e) {}
  });
  function tavernKey() {
    var a = new Uint8Array(20);
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function renderTavern() {
    var on = !!(game && game.tavern && game.tavern.on);
    $("qp-tavern-toggle").textContent = on ? "Tavern: on" : "Tavern: off";
    $("qp-tavern-toggle").title = on ? "Others can watch this quest on the Tavern board" : "Let others watch this quest on the Tavern board";
    $("qp-tavern-toggle").hidden = !!(game && game.party);
    var watch = $("qp-watch");
    watch.hidden = !on || !!(game && game.party);
    if (game) watch.href = "tavern.html?q=" + encodeURIComponent(game.id);
  }
  $("qp-tavern-toggle").addEventListener("click", function () {
    if (!game) return;
    if (!game.tavern) game.tavern = { on: false, key: tavernKey() };
    game.tavern.on = !game.tavern.on;
    save();
    renderTavern();
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
  $("qp-pop").addEventListener("click", hidePop);
  function popsLabel() { $("qp-pops").textContent = popsOn ? "Pop-ups: on" : "Pop-ups: off"; }
  $("qp-pops").addEventListener("click", function () {
    popsOn = !popsOn;
    try { localStorage.setItem("solosgems-quest-pops", popsOn ? "on" : "off"); } catch (e) {}
    popsLabel();
    if (!popsOn) hidePop();
  });
  popsLabel();
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
    if (!game.party) {
      if (!game.entries.length) turn("start");
      else if (game.hp <= 0) turn(game.length === "campaign" ? "knockout" : "fallen");
    }
  } else showSetup();
  renderAccount();
  fetch("/api/account/me").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (d && d.user) { account = d.user; renderAccount(); pullSaves(); }
  }).catch(function () {});
  var lastTab = "quest";
  try { lastTab = localStorage.getItem("solosgems-herald-tab") === "chat" ? "chat" : "quest"; } catch (e) {}
  var invite = (new URLSearchParams(location.search).get("party") || "").toUpperCase().replace(/[^A-Z2-9]/g, "");
  if (invite.length === 6) {
    lastTab = "quest";
    if (game && game.party && game.party.code === invite) {
      // Already in this party: carry on.
    } else {
      if (game) { save(); store.active = null; showSetup(); }
      setup.querySelector('input[value="join"]').checked = true;
      $("qp-code").value = invite;
      modeChanged();
      partyNote("You've been invited to party " + invite + ". Pick your hero, then join.");
    }
  }
  showTab(lastTab);
})();
