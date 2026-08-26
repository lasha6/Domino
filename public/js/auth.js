/* =====================================================================
   Who is playing.

   Two ways in, and the game works fully either way:

   · GUEST  — type a name and play. Nothing leaves the device, nothing to
              remember. This is the default and always available.
   · GOOGLE — sign in and the name is verified, so nobody can sit down
              wearing someone else's.

   The Google client id is not kept in this file. The server hands it over at
   /auth/config, so it lives in one place (an environment variable on the host)
   and the installed app never needs rebuilding to change it. If the server has
   no id configured, the Google option simply does not appear and guests carry
   on as before.

   Google's script is only fetched when the player actually reaches for it, so
   a normal launch stays offline-fast and asks nothing of anyone else.
   ===================================================================== */
(function (global) {
  "use strict";

  const KEY = "dominoAuth";
  const OLD_NAME = "dominoName";     // what the game used before accounts
  const GSI = "https://accounts.google.com/gsi/client";

  const base = () => (global.SERVER_URL || "");

  /* ---------------- what we know about the player ---------------- */
  function load() {
    let me = null;
    try { me = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { me = null; }
    if (me && me.kind) return me;
    // first run after the update: keep the name they already chose
    const old = (localStorage.getItem(OLD_NAME) || "").trim();
    return old ? guest(old) : null;
  }
  function save(me) {
    localStorage.setItem(KEY, JSON.stringify(me));
    // keep the old key in step: other screens still read it
    if (me && me.name) localStorage.setItem(OLD_NAME, me.name);
    listeners.forEach((fn) => { try { fn(me); } catch (e) {} });
    return me;
  }
  function guest(name) {
    return { kind: "guest", id: deviceId(), name: String(name || "").trim().slice(0, 14) };
  }

  const listeners = [];

  /* ---------------- what the server needs to be told ---------------- */
  // Sent with every join. The server checks a Google token itself; a guest is
  // taken at their word, which is why a guest name is never shown as verified.
  function credentials() {
    const me = load();
    // The device id always goes along, even when signed in. A Google token
    // only lasts about an hour, and without something to fall back on a
    // signed-in player whose token went stale was left with no profile at all
    // — worse off than a guest. Now the server can always seat them.
    const id = deviceId();
    if (!me) return { name: "სტუმარი", auth: { kind: "guest", id } };
    if (me.kind === "google" && me.idToken)
      return { name: me.name, auth: { kind: "google", idToken: me.idToken, id } };
    return { name: me.name, auth: { kind: "guest", id: me.id || id } };
  }

  // one lasting id per device, made once and kept
  function deviceId() {
    let id = localStorage.getItem("dominoGuestId");
    if (!id) {
      id = "g" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("dominoGuestId", id);
    }
    return id;
  }

  /* ---------------- is Google set up on this server? ---------------- */
  let configPromise = null;
  function config() {
    if (!configPromise) {
      configPromise = fetch(base() + "/auth/config", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { google: false, unreachable: true }))
        // Offline, an older server, or a reply the app is not allowed to read.
        // Marked apart from a plain "off" so the screen can say which it was —
        // silently hiding the button made a broken setup look deliberate.
        .catch(() => ({ google: false, unreachable: true }));
    }
    return configPromise;
  }

  /* ---------------- Google ---------------- */
  let gsiPromise = null;
  function loadGsi() {
    if (gsiPromise) return gsiPromise;
    gsiPromise = new Promise((resolve, reject) => {
      if (global.google && global.google.accounts && global.google.accounts.id) return resolve();
      const s = document.createElement("script");
      s.src = GSI; s.async = true; s.defer = true;
      s.onload = () => (global.google && global.google.accounts && global.google.accounts.id)
        ? resolve() : reject(new Error("gsi loaded but empty"));
      s.onerror = () => reject(new Error("gsi unreachable"));
      document.head.appendChild(s);
    });
    return gsiPromise;
  }

  /* A page launched from a home-screen ICON runs in its own window, and
     `window.open` there hands the job to the browser instead. Google's popup
     flow then delivers the credential to a completely different context —
     one with its own storage, which this app cannot read — so the player is
     thrown out to Google and never comes back signed in.

     The redirect flow is an ordinary top-level form submission, which stays in
     whatever window it started in. It costs a page load, so it is used only
     where the popup cannot work. */
  const standalone = () => !!(global.navigator && global.navigator.standalone) ||
    !!(global.matchMedia && (global.matchMedia("(display-mode: standalone)").matches ||
                             global.matchMedia("(display-mode: fullscreen)").matches));

  /* Coming back from that redirect: the address carries a one-time code, and
     the token is fetched with it rather than being put in the URL — a token in
     a URL is a token in the history, in the address bar and in every referrer.

     Run on load, before anything asks who the player is. */
  function collect() {
    const m = /[#&]gauth=([^&]+)/.exec(global.location.hash || "");
    if (!m) return Promise.resolve(null);
    const code = decodeURIComponent(m[1]);
    // the address is cleaned either way, so a reload cannot repeat any of this
    try {
      const clean = global.location.href.replace(/[#&]gauth=[^&]*/, "");
      global.history.replaceState(null, "", clean || global.location.pathname);
    } catch (e) {}
    if (code === "csrf" || code === "bad") return Promise.resolve(null);
    return fetch(base() + "/auth/claim?code=" + encodeURIComponent(code))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.ok ? save(fromIdToken(j.credential)) : null))
      .catch(() => null);
  }
  const collected = collect();

  // Google requires their own button, so we hand them an element to draw into.
  function mountGoogleButton(el, onDone, onFail) {
    config().then((cfg) => {
      if (!cfg.google || !cfg.clientId) throw new Error("not configured");
      return loadGsi().then(() => cfg);
    }).then((cfg) => {
      const viaRedirect = standalone();
      global.google.accounts.id.initialize({
        client_id: cfg.clientId,
        ux_mode: viaRedirect ? "redirect" : "popup",
        login_uri: viaRedirect ? base() + "/auth/google" : undefined,
        callback: (res) => {
          const me = fromIdToken(res && res.credential);
          if (me) { save(me); onDone && onDone(me); }
          else onFail && onFail(new Error("no credential"));
        },
      });
      el.innerHTML = "";
      global.google.accounts.id.renderButton(el, {
        theme: "filled_black", size: "large", shape: "pill",
        text: "signin_with", locale: "ka", width: 240,
      });
    }).catch((err) => { onFail && onFail(err); });
  }

  // Read the name out of the token for display. The server does the real
  // check — nothing here is trusted for anything that matters.
  function fromIdToken(jwt) {
    if (!jwt || jwt.split(".").length !== 3) return null;
    try {
      const b = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const p = JSON.parse(decodeURIComponent(escape(atob(b + "===".slice((b.length + 3) % 4)))));
      return {
        kind: "google", id: p.sub, idToken: jwt,
        name: String(p.given_name || p.name || "მოთამაშე").trim().slice(0, 14),
        picture: p.picture || null,
        expires: (p.exp || 0) * 1000,
      };
    } catch (e) { return null; }
  }

  function signOut() {
    const me = load();
    if (me && me.kind === "google" && global.google && global.google.accounts && global.google.accounts.id) {
      try { global.google.accounts.id.disableAutoSelect(); } catch (e) {}
    }
    localStorage.removeItem(KEY);
    listeners.forEach((fn) => { try { fn(null); } catch (e) {} });
  }

  // A Google token lasts about an hour. Past that the server can no longer
  // vouch for the name, so ask Google again quietly — and if that fails, the
  // player simply carries on as a guest under the same name.
  function refreshIfStale() {
    const me = load();
    if (!me || me.kind !== "google") return Promise.resolve(me);
    if (me.expires && me.expires - Date.now() > 5 * 60 * 1000) return Promise.resolve(me);
    return config().then((cfg) => {
      if (!cfg.google || !cfg.clientId) return me;
      return loadGsi().then(() => new Promise((resolve) => {
        global.google.accounts.id.initialize({
          client_id: cfg.clientId, auto_select: true,
          callback: (res) => {
            const fresh = fromIdToken(res && res.credential);
            resolve(fresh ? save(fresh) : me);
          },
        });
        global.google.accounts.id.prompt(() => resolve(me));   // dismissed / not shown
        setTimeout(() => resolve(me), 4000);                   // never hang the lobby
      }));
    }).catch(() => me);
  }

  global.Auth = {
    load, save, guest, credentials, config, signOut, refreshIfStale,
    mountGoogleButton, fromIdToken, deviceId,
    name: () => { const m = load(); return (m && m.name) || ""; },
    isGoogle: () => { const m = load(); return !!(m && m.kind === "google"); },
    onChange: (fn) => listeners.push(fn),
    /* Resolves once a sign-in that came back by redirect has been collected —
       or straight away when there was none. A screen that needs to know who
       the player is before it does anything can wait on it. */
    ready: () => collected,
  };
})(window);
