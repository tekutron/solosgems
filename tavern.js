// The Tavern (tavern.html): a wall of TVs behind the bar, each showing a
// Herald quest that its player chose to share, with the latest scene
// picture and the story scrolling past like an old CRT. A ticker on the bar
// runs the newest lines from every quest. ?q=<id> watches one quest on the
// big screen. Data: /api/tavern (the list), /api/tavern/<id> (scenes) and
// /api/tavern/<id>/art (the newest picture). The worker posts the scenes
// itself after a safety check; this page only reads them.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var LIVE_MS = 10 * 60 * 1000;
  var SCREENS = 6;
  var id = (new URLSearchParams(location.search).get("q") || "").replace(/[^a-z0-9]/g, "");
  var calm = false;
  try { calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var OFF_AIR = [
    "Off air: the bard is re-recording the theme song.",
    "Please stand by. The dragon chewed the cable.",
    "This channel is reserved for your quest. Go make one.",
    "Technical difficulties: the wizard sneezed.",
    "Now showing: a test pattern drawn by a goblin.",
    "Off air until someone does something heroic.",
  ];
  var timer = 0, shown = 0;
  var screens = {}; // quest id -> { el, last }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function ago(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60);
    return h < 24 ? h + " h ago" : Math.round(h / 24) + " d ago";
  }
  function live(q) { return !q.over && Date.now() - q.updated < LIVE_MS; }
  function later(fn, ms) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (document.hidden) {
        document.addEventListener("visibilitychange", function once() { document.removeEventListener("visibilitychange", once); fn(); });
        return;
      }
      fn();
    }, ms);
  }
  function getJSON(url) { return fetch(url).then(function (r) { return r.ok ? r.json() : null; }); }

  // ---- The wall --------------------------------------------------------------
  function scroller(box, text) {
    // Roll the story upward like closing credits, at a readable pace.
    if (calm) return;
    var h = text.scrollHeight, screen = box.clientHeight;
    var travel = h - screen * 0.55;
    if (travel <= 0) return;
    var secs = Math.max(12, travel / 14);
    text.animate([
      { transform: "translateY(" + Math.round(screen * 0.3) + "px)", offset: 0 },
      { transform: "translateY(" + Math.round(screen * 0.3) + "px)", offset: 0.08 },
      { transform: "translateY(" + -Math.round(travel) + "px)", offset: 0.95 },
      { transform: "translateY(" + -Math.round(travel) + "px)", offset: 1 },
    ], { duration: secs * 1000, iterations: Infinity });
  }
  function fillScreen(tv, q, detail) {
    var screen = tv.querySelector(".tv-screen");
    var old = screen.querySelector(".tv-scroll");
    if (old) old.remove();
    var box = el("div", "tv-scroll");
    var text = el("div", "tv-text");
    (detail && detail.entries ? detail.entries.slice(-4) : []).forEach(function (e) {
      if (e.a) text.appendChild(el("p", "tv-act", "> " + q.hero + ": " + e.a + (e.r ? "  [d20: " + e.r + "]" : "")));
      text.appendChild(el("p", null, e.s));
    });
    if (!text.childNodes.length) text.appendChild(el("p", null, q.last));
    box.appendChild(text);
    screen.appendChild(box);
    requestAnimationFrame(function () { scroller(box, text); });
  }
  function makeTV(q, n) {
    var a = el("a", "tv");
    a.href = "tavern.html?q=" + encodeURIComponent(q.id);
    a.setAttribute("aria-label", "Watch " + q.title + ", " + q.hero + "'s quest");
    var screen = el("div", "tv-screen");
    var art = el("img", "tv-art");
    art.alt = "";
    art.onerror = function () { art.hidden = true; };
    art.src = "/api/tavern/" + encodeURIComponent(q.id) + "/art?t=" + q.updated;
    screen.appendChild(art);
    screen.appendChild(el("span", "tv-ch", "CH " + (n + 1)));
    screen.appendChild(el("span", "tv-onair" + (live(q) ? "" : " is-idle"), live(q) ? "Live" : q.over ? "Ended" : "Rerun"));
    a.appendChild(screen);
    var label = el("div", "tv-label");
    label.appendChild(el("strong", null, q.title));
    label.appendChild(document.createTextNode(q.hero + ", level " + q.level + " " + q.cls + " · turn " + q.turn + " · " + ago(q.updated)));
    a.appendChild(label);
    return a;
  }
  function offAir(n) {
    var a = el("a", "tv");
    a.href = "/";
    a.setAttribute("aria-label", "Start your own quest");
    var screen = el("div", "tv-screen");
    screen.appendChild(el("div", "tv-static"));
    screen.appendChild(el("span", "tv-ch", "CH " + (n + 1)));
    screen.appendChild(el("p", "tv-offair", OFF_AIR[n % OFF_AIR.length]));
    a.appendChild(screen);
    var label = el("div", "tv-label");
    label.appendChild(el("strong", null, "Your channel here"));
    label.appendChild(document.createTextNode("Start a quest and switch on the Tavern board"));
    a.appendChild(label);
    return a;
  }
  function loadWall() {
    getJSON("/api/tavern").then(function (d) {
      var quests = ((d && d.quests) || []).slice().sort(function (a, b) { return (live(b) - live(a)) || b.updated - a.updated; }).slice(0, SCREENS);
      var wall = $("tv-wall");
      var liveCount = quests.filter(live).length;
      $("tv-status").textContent = quests.length
        ? liveCount + " quest" + (liveCount === 1 ? "" : "s") + " live right now. Click a screen to watch."
        : "Every screen is off air. Start a quest and switch on the Tavern board to be the first channel.";
      // Rebuild a screen only when its quest has new scenes.
      var keep = {};
      wall.innerHTML = "";
      quests.forEach(function (q, n) {
        var s = screens[q.id];
        var tv = s && s.last === q.updated ? s.el : makeTV(q, n);
        tv.querySelector(".tv-ch").textContent = "CH " + (n + 1);
        wall.appendChild(tv);
        keep[q.id] = { el: tv, last: q.updated };
        if (!s || s.last !== q.updated) getJSON("/api/tavern/" + q.id).then(function (detail) { fillScreen(tv, q, detail); }).catch(function () { fillScreen(tv, q, null); });
      });
      for (var n = quests.length; n < SCREENS; n++) wall.appendChild(offAir(n));
      screens = keep;
      var lines = quests.map(function (q) { return q.hero + " (" + q.title + "): " + q.last.replace(/\s+/g, " ").slice(0, 120); });
      var tick = lines.length ? lines.join("   ✦   ") : "Last call for heroes. The Herald is bored and the dice are warm.";
      $("tv-ticker").textContent = tick + "   ✦   " + tick + "   ✦   ";
      later(loadWall, 20000);
    }).catch(function () {
      $("tv-status").textContent = "The screens flickered out. Trying again in a moment.";
      later(loadWall, 30000);
    });
  }

  // ---- Watching one quest on the big screen ------------------------------------
  function addScene(e, hero) {
    var log = $("tv-log");
    if (e.a) {
      var u = el("li", "ak-msg ak-user-msg");
      var ub = el("div", "ak-body");
      ub.appendChild(el("p", null, hero + ": " + e.a));
      u.appendChild(ub);
      if (e.r) {
        var chip = el("span", "qp-roll qp-roll-" + String(e.b).toLowerCase());
        chip.appendChild(el("span", "qp-die", "d20"));
        chip.appendChild(document.createTextNode(" " + e.r + " · " + e.b));
        u.appendChild(chip);
      }
      log.appendChild(u);
    }
    var h = el("li", "ak-msg ak-herald-msg");
    var hb = el("div", "ak-body");
    e.s.split(/\n{2,}/).forEach(function (p) { if (p.trim()) hb.appendChild(el("p", null, p.trim())); });
    h.appendChild(hb);
    log.appendChild(h);
  }
  function loadQuest() {
    getJSON("/api/tavern/" + id).then(function (q) {
      if (!q) {
        $("tv-title").textContent = "This channel is off the air";
        $("tv-meta").textContent = "The quest ended, was taken down, or never existed.";
        $("tv-live").hidden = true;
        return;
      }
      document.title = q.title + ": The Tavern";
      $("tv-title").textContent = q.title;
      $("tv-meta").textContent = q.hero + " · level " + q.level + " " + q.cls + " · HP " + q.hp + "/" + q.max + " · turn " + q.turn + " · " + (q.length === "campaign" ? "campaign" : "one-shot");
      var on = live(q);
      $("tv-live").textContent = on ? "Live" : q.over ? "Ended" : "Resting";
      $("tv-live").className = "tv-live" + (on ? "" : " is-idle");
      var art = $("tv-art");
      art.onerror = function () { art.hidden = true; };
      art.onload = function () { art.hidden = false; };
      var src = "/api/tavern/" + id + "/art?t=" + q.updated;
      if (art.getAttribute("src") !== src) art.src = src;
      var log = $("tv-log");
      var atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 120;
      var first = q.entries.length ? q.entries[0].t : 0;
      if (log.dataset.first && Number(log.dataset.first) !== first) { log.innerHTML = ""; shown = 0; }
      log.dataset.first = first;
      q.entries.slice(shown).forEach(function (e) { addScene(e, q.hero); });
      if (q.entries.length > shown && shown && atBottom) window.scrollTo(0, document.body.scrollHeight);
      shown = q.entries.length;
      if (!q.over) later(loadQuest, on ? 6000 : 30000);
    }).catch(function () { later(loadQuest, 15000); });
  }
  $("tv-report").addEventListener("click", function () {
    var b = this;
    if (!b.dataset.sure) {
      b.dataset.sure = "1";
      b.textContent = "Report it? Click again";
      return;
    }
    b.disabled = true;
    fetch("/api/tavern/" + id + "/report", { method: "POST" }).then(function () {
      $("tv-report-note").textContent = "Thanks. It's off the air.";
      $("tv-log").innerHTML = "";
      $("tv-art").hidden = true;
      clearTimeout(timer);
    });
  });

  if (id) {
    $("tv-list-view").hidden = true;
    $("tv-watch").hidden = false;
    loadQuest();
  } else loadWall();
})();
