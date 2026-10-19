// Ask the Herald (ask.html). Sends the visitor's quest to /api/ask, which
// shortlists tools from the database and has the Council of Oracles (three
// free AI models in character) vote on the best fits.
(function () {
  "use strict";
  var form = document.getElementById("ak-form");
  var q = document.getElementById("ak-q");
  var free = document.getElementById("ak-free");
  var go = document.getElementById("ak-go");
  var count = document.getElementById("ak-count");
  var answer = document.getElementById("ak-answer");
  var reply = document.getElementById("ak-reply");
  var picks = document.getElementById("ak-picks");
  var note = document.getElementById("ak-note");
  var council = document.getElementById("ak-council");
  var verdictH = document.getElementById("ak-verdict-h");
  var busy = false;

  var THINKING = [
    "The Herald summons the Council of Oracles...",
    "The Wizard is looking for his spectacles...",
    "The Bard is tuning up. The Rogue is checking prices...",
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function updateCount() {
    count.textContent = q.value.length + " / 300";
  }

  function render(data) {
    picks.innerHTML = "";
    council.innerHTML = "";
    reply.textContent = data.reply || (data.council && data.council.length ? "The Council of Oracles has spoken." : "");
    (data.council || []).forEach(function (m) {
      var card = el("li", "ak-member ak-" + m.id);
      var head = el("p", "ak-member-head");
      head.appendChild(el("span", "ak-member-icon", m.icon));
      head.appendChild(el("strong", null, m.title));
      head.appendChild(el("span", "ak-member-brain", m.brain));
      card.appendChild(head);
      card.appendChild(el("p", "ak-member-quip", m.quip));
      council.appendChild(card);
    });
    if (data.herald) {
      var hcard = el("li", "ak-member ak-herald");
      var hhead = el("p", "ak-member-head");
      hhead.appendChild(el("span", "ak-member-icon", "\uD83D\uDCDC"));
      hhead.appendChild(el("strong", null, "The Herald's verdict"));
      hhead.appendChild(el("span", "ak-member-brain", "Trained on Solos Gems"));
      hcard.appendChild(hhead);
      hcard.appendChild(el("p", "ak-member-quip", data.herald));
      council.appendChild(hcard);
    }
    council.hidden = !(data.council && data.council.length);
    verdictH.hidden = !(data.picks && data.picks.length);
    (data.picks || []).forEach(function (t, i) {
      var li = el("li", "ak-pick");
      var img = el("img");
      img.src = t.img;
      img.alt = "Comic for " + t.name;
      img.width = 112;
      img.height = 112;
      img.loading = "lazy";
      var body = el("div", "ak-pick-body");
      var h = el("h3", "ak-pick-name", t.name);
      if (data.source === "ai" && i === 0) h.appendChild(el("span", "ak-crown", "Council's choice"));
      body.appendChild(h);
      body.appendChild(
        el(
          "p",
          "ak-pick-meta",
          "#" + t.rank + " of the database · " + t.category + " · " +
            (t.tier === "free" ? "Free plan" : "Paid only") + " · " +
            Number(t.score).toFixed(2) + "/10 · " + (t.basis === "tested" ? "Tested" : "Scouted")
        )
      );
      if (t.votes && t.votes.length) {
        var votes = el("ul", "ak-votes");
        t.votes.forEach(function (v) {
          var vli = el("li");
          vli.appendChild(el("span", "ak-vote-who", v.icon + " " + v.title + ":"));
          vli.appendChild(document.createTextNode(" " + v.why));
          votes.appendChild(vli);
        });
        body.appendChild(votes);
      } else {
        body.appendChild(el("p", "ak-pick-why", t.why));
      }
      body.appendChild(el("p", "ak-pick-desc", t.desc));
      var links = el("p", "ak-pick-links");
      var row = el("a", null, "See it in the database");
      row.href = "/#tool-" + t.slug;
      var site = el("a", null, "Visit " + t.name);
      site.href = t.url;
      site.target = "_blank";
      site.rel = "noopener";
      links.appendChild(row);
      links.appendChild(document.createTextNode("  ·  "));
      links.appendChild(site);
      body.appendChild(links);
      li.appendChild(img);
      li.appendChild(body);
      picks.appendChild(li);
    });
    note.textContent =
      data.source === "ai"
        ? "Each oracle is a different free AI model. Picks come only from the Solos Gems database; check pricing on the tool's site before you commit."
        : data.source === "keyword"
        ? "These are the closest keyword matches from the database."
        : "";
    answer.hidden = false;
  }

  function fail(msg) {
    picks.innerHTML = "";
    council.innerHTML = "";
    council.hidden = true;
    verdictH.hidden = true;
    note.textContent = "";
    reply.textContent = msg;
    answer.hidden = false;
  }

  function ask() {
    var text = q.value.replace(/\s+/g, " ").trim();
    if (busy) return;
    if (text.length < 3) {
      fail("Tell the Herald a little more about your quest first.");
      return;
    }
    busy = true;
    go.disabled = true;
    go.textContent = "Consulting...";
    picks.innerHTML = "";
    council.innerHTML = "";
    council.hidden = true;
    verdictH.hidden = true;
    note.textContent = "";
    reply.textContent = THINKING[Math.floor(Math.random() * THINKING.length)];
    answer.hidden = false;
    fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, free: free.checked }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d && d.error ? d.error : "The Herald could not answer.");
          return d;
        });
      })
      .then(render)
      .catch(function (e) {
        fail(e && e.message ? e.message : "The Herald could not answer. Try again in a moment.");
      })
      .then(function () {
        busy = false;
        go.disabled = false;
        go.textContent = "Ask the Herald";
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ask();
  });
  q.addEventListener("input", updateCount);
  q.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  });
  Array.prototype.forEach.call(document.querySelectorAll(".ak-chip"), function (b) {
    b.addEventListener("click", function () {
      q.value = b.textContent;
      updateCount();
      ask();
    });
  });
  updateCount();
})();
