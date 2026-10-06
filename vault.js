(function () {
  "use strict";

  // The password is checked by the server (POST /api/vault/unlock), never
  // in this file. A correct password sets an HttpOnly session cookie, and
  // the video only streams from /api/vault/video with that cookie, so
  // reading this script or the page source doesn't reveal the video.
  var VIDEO_URL = "/api/vault/video";
  var els = {};

  function unlock() {
    els.gate.hidden = true;
    els.content.hidden = false;
    if (els.video && !els.video.getAttribute("src")) {
      els.video.setAttribute("src", VIDEO_URL);
      els.video.load();
    }
  }

  function showError(message) {
    els.error.textContent = message;
    els.error.hidden = false;
  }

  function handleSubmit(evt) {
    evt.preventDefault();
    els.error.hidden = true;
    els.button.disabled = true;
    fetch("/api/vault/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password: els.password.value || "" })
    })
      .then(function (res) {
        if (res.ok) return unlock();
        els.password.value = "";
        els.password.focus();
        if (res.status === 429) return showError("Too many wrong guesses. The vault is sulking for 15 minutes.");
        if (res.status === 503) return showError("The vault is being set up. Try again later.");
        showError("Wrong password. Try again.");
      })
      .catch(function () {
        showError("Couldn't reach the vault. Check your connection and try again.");
      })
      .then(function () {
        els.button.disabled = false;
      });
  }

  function init() {
    els.gate = document.getElementById("vault-gate");
    els.content = document.getElementById("vault-content");
    els.form = document.getElementById("vault-form");
    els.password = document.getElementById("vault-password");
    els.error = document.getElementById("vault-error");
    els.video = document.getElementById("vault-video");
    if (!els.gate || !els.content || !els.form) return;
    els.button = els.form.querySelector("button");
    els.form.addEventListener("submit", handleSubmit);

    // Already unlocked in this browser (cookie still valid)? Skip the gate.
    fetch("/api/vault/status", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) { if (data && data.unlocked) unlock(); })
      .catch(function () {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
