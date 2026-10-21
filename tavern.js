// The Tavern board (tavern.html): watch Herald quests that players chose to
// share. The list comes from /api/tavern; ?q=<id> watches one quest from
// /api/tavern/<id>, checking for new scenes every few seconds while the tab
// is visible. Scenes are posted by the worker itself after a safety check.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var LIVE_MS = 10 * 60 * 1000;
  var id = (new URLSearchParams(location.search).get("q") || "").replace(/[^a-z0-9]/g, "");
  var shown = 0, timer = 0;

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
  function paras(box, text) {
    text.split(/\n{2,}/).forEach(function (p) { if (p.trim()) box.appendChild(el("p", null, p.trim())); });
  }
  function later(fn, ms) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (document.hidden) { document.addEventListener("visibilitychange", function once() { document.removeEventListener("visibilitychange", once); fn(); }); return; }
      fn();
    }, ms);
  }

  // ---- The list ---------------------------------------------------------------
  function loadList() {
    fetch("/api/tavern").then(function (r) { return r.json(); }).then(function (d) {
      var list = $("tv-list");
      var quests = (d && d.quests) || [];
      list.innerHTML = "";
      $("tv-status").textContent = quests.length
        ? quests.filter(live).length + " quest" + (quests.filter(live).length === 1 ? "" : "s") + " live right now, " + quests.length + " today."
        : "The tables are empty. Start a quest and switch on the Tavern board to be the first.";
      quests.forEach(function (q) {
        var a = el("a", "tv-card");
        a.href = "tavern.html?q=" + encodeURIComponent(q.id);
        var meta = el("span", "tv-card-meta");
        meta.appendChild(el("span", "tv-dot" + (live(q) ? "" : " is-idle")));
        meta.appendChild(document.createTextNode((live(q) ? "Live" : q.over ? "Finished" : "Resting") + " · " + q.hero + ", level " + q.level + " " + q.cls + " · turn " + q.turn + " · " + ago(q.updated)));
        a.appendChild(meta);
        a.appendChild(el("strong", null, q.title));
        a.appendChild(el("p", null, q.last + (q.last.length >= 160 ? "..." : "")));
        var li = el("li");
        li.appendChild(a);
        list.appendChild(li);
      });
      later(loadList, 20000);
    }).catch(function () {
      $("tv-status").textContent = "The board fell off the wall. Try again in a moment.";
      later(loadList, 30000);
    });
  }

  // ---- Watching one quest ---------------------------------------------------------
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
    paras(hb, e.s);
    h.appendChild(hb);
    log.appendChild(h);
  }
  function loadQuest() {
    fetch("/api/tavern/" + id).then(function (r) { return r.ok ? r.json() : null; }).then(function (q) {
      if (!q) {
        $("tv-title").textContent = "This quest isn't on the board";
        $("tv-meta").textContent = "It may have ended, been taken down, or never existed.";
        $("tv-live").hidden = true;
        return;
      }
      document.title = q.title + ": The Tavern Board";
      $("tv-title").textContent = q.title;
      $("tv-meta").textContent = q.hero + " · level " + q.level + " " + q.cls + " · HP " + q.hp + "/" + q.max + " · turn " + q.turn + " · " + (q.length === "campaign" ? "campaign" : "one-shot");
      var on = live(q);
      $("tv-live").textContent = on ? "Live" : q.over ? "Finished" : "Resting";
      $("tv-live").className = "tv-live" + (on ? "" : " is-idle");
      var log = $("tv-log");
      var atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
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
      $("tv-report-note").textContent = "Thanks. It's off the board.";
      $("tv-log").innerHTML = "";
      clearTimeout(timer);
    });
  });

  if (id) {
    $("tv-list-view").hidden = true;
    $("tv-watch").hidden = false;
    loadQuest();
  } else loadList();
})();
