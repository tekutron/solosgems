// Ask the Herald (ask.html): a chat with the Solos Gems Herald. Posts the
// conversation to /api/chat and streams the reply (server-sent events from
// Workers AI). The conversation lives only in this page's memory.
(function () {
  "use strict";
  var log = document.getElementById("ak-log");
  var form = document.getElementById("ak-form");
  var q = document.getElementById("ak-q");
  var go = document.getElementById("ak-go");
  var count = document.getElementById("ak-count");
  var reset = document.getElementById("ak-new");
  var examples = document.getElementById("ak-examples");
  var greeting = log.innerHTML;
  var history = [];
  var busy = false;
  var MAX_TURNS = 12;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Minimal, safe formatting: ``` code blocks, `inline code`, **bold**,
  // paragraphs and line breaks. Everything is inserted as text nodes.
  function inline(parent, text) {
    var parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/);
    parts.forEach(function (part) {
      if (/^`[^`]+`$/.test(part)) parent.appendChild(el("code", null, part.slice(1, -1)));
      else if (/^\*\*[^*]+\*\*$/.test(part)) parent.appendChild(el("strong", null, part.slice(2, -2)));
      else if (part) parent.appendChild(document.createTextNode(part));
    });
  }

  function render(body, text) {
    body.innerHTML = "";
    var chunks = text.split(/```/);
    chunks.forEach(function (chunk, i) {
      if (i % 2 === 1) {
        var code = chunk.replace(/^[a-zA-Z0-9+#-]*\n/, "");
        var pre = el("pre");
        pre.appendChild(el("code", null, code.replace(/\n$/, "")));
        body.appendChild(pre);
        return;
      }
      chunk.split(/\n{2,}/).forEach(function (para) {
        if (!para.trim()) return;
        var lines = para.split("\n");
        var isList = lines.every(function (l) { return /^\s*([-*]|\d+[.)])\s+/.test(l) || !l.trim(); });
        if (isList) {
          var ordered = /^\s*\d/.test(lines[0]);
          var list = el(ordered ? "ol" : "ul");
          lines.forEach(function (l) {
            if (!l.trim()) return;
            var li = el("li");
            inline(li, l.replace(/^\s*([-*]|\d+[.)])\s+/, ""));
            list.appendChild(li);
          });
          body.appendChild(list);
          return;
        }
        var p = el("p");
        lines.forEach(function (l, j) {
          if (j) p.appendChild(el("br"));
          inline(p, l);
        });
        body.appendChild(p);
      });
    });
  }

  function addMessage(role, text) {
    var li = el("li", "ak-msg " + (role === "user" ? "ak-user-msg" : "ak-herald-msg"));
    li.appendChild(el("p", "ak-who", role === "user" ? "You" : "The Herald"));
    var body = el("div", "ak-body");
    render(body, text);
    li.appendChild(body);
    log.appendChild(li);
    li.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return body;
  }

  function setBusy(on) {
    busy = on;
    go.disabled = on;
    go.textContent = on ? "The Herald is writing..." : "Ask";
  }

  function readStream(res, body, done) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var text = "";
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return done(text);
        buffer += decoder.decode(r.value, { stream: true });
        var lines = buffer.split("\n");
        buffer = lines.pop();
        lines.forEach(function (line) {
          if (line.indexOf("data:") !== 0) return;
          var data = line.slice(5).trim();
          if (!data || data === "[DONE]") return;
          try {
            var j = JSON.parse(data);
            var piece = j.response != null ? j.response : (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || "";
            if (piece) {
              text += piece;
              render(body, text.replace(/<\|eot_id\|>[\s\S]*$/, ""));
            }
          } catch (e) { /* partial line; ignore */ }
        });
        return pump();
      });
    }
    return pump();
  }

  function ask(text) {
    text = text.trim();
    if (!text || busy) return;
    examples.hidden = true;
    addMessage("user", text);
    history.push({ role: "user", content: text });
    history = history.slice(-MAX_TURNS);
    q.value = "";
    updateCount();
    setBusy(true);
    var body = addMessage("assistant", "...");
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    })
      .then(function (res) {
        if (!res.ok || !res.body) {
          return res.json().catch(function () { return {}; }).then(function (d) {
            throw new Error(d.error || "The Herald could not answer. Try again in a moment.");
          });
        }
        return readStream(res, body, function (full) {
          full = full.replace(/<\|eot_id\|>[\s\S]*$/, "").trim();
          if (!full) throw new Error("The Herald went quiet. Try asking again.");
          render(body, full);
          history.push({ role: "assistant", content: full });
        });
      })
      .catch(function (e) {
        body.parentNode.classList.add("ak-error");
        render(body, e && e.message ? e.message : "The Herald could not answer. Try again in a moment.");
        history.pop();
      })
      .then(function () {
        setBusy(false);
        q.focus();
      });
  }

  function updateCount() {
    count.textContent = q.value.length + " / 2000";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ask(q.value);
  });
  q.addEventListener("input", updateCount);
  q.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(q.value);
    }
  });
  reset.addEventListener("click", function () {
    if (busy) return;
    history = [];
    log.innerHTML = greeting;
    examples.hidden = false;
    q.focus();
  });
  Array.prototype.forEach.call(document.querySelectorAll(".ak-chip"), function (b) {
    b.addEventListener("click", function () {
      ask(b.textContent);
    });
  });
  updateCount();
})();
