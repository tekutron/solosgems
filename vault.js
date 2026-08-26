(function () {
  "use strict";

  // SHA-256 of the vault password. The plaintext is never stored in this
  // file, but note: this is still just a client-side check on a static
  // site. Anyone who opens dev tools can read this hash, brute force it,
  // or simply flip the "unlocked" flag by hand. Use this to keep casual
  // visitors out, not as a real access control.
  var PASSWORD_HASH = "dd9cced523986e64eec57b353d2d8cd3697714ecca0c313a50c8b855b71a915d";
  var SESSION_KEY = "vault_unlocked_v1";

  var els = {};

  function sha256Hex(text) {
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", data).then(function (buf) {
      var bytes = new Uint8Array(buf);
      var hex = "";
      for (var i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, "0");
      }
      return hex;
    });
  }

  function unlock() {
    els.gate.hidden = true;
    els.content.hidden = false;
  }

  function handleSubmit(evt) {
    evt.preventDefault();
    els.error.hidden = true;
    var value = els.password.value || "";
    sha256Hex(value).then(function (hex) {
      if (hex === PASSWORD_HASH) {
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch (e) {
          // sessionStorage unavailable, no big deal, just skip persistence
        }
        unlock();
      } else {
        els.error.hidden = false;
        els.password.value = "";
        els.password.focus();
      }
    });
  }

  function init() {
    els.gate = document.getElementById("vault-gate");
    els.content = document.getElementById("vault-content");
    els.form = document.getElementById("vault-form");
    els.password = document.getElementById("vault-password");
    els.error = document.getElementById("vault-error");

    if (!els.gate || !els.content || !els.form) return;

    els.form.addEventListener("submit", handleSubmit);

    var alreadyUnlocked = false;
    try {
      alreadyUnlocked = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (e) {
      alreadyUnlocked = false;
    }
    if (alreadyUnlocked) unlock();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
