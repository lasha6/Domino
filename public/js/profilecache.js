/* =====================================================================
   The numbers this account had last time we were told.

   Coins, level, streak and the rest live on the server, which is right —
   but asking takes a round trip, and on a host that has been asleep it
   takes several seconds. Until the answer came the lobby showed 🪙 0, no
   level and no bar, then filled itself in. Leave a table and it all
   happened again. Nothing was wrong, and it looked exactly like something
   was: it reads as progress that has been lost and then found.

   So the last answer is kept and painted straight away, and the server's
   reply replaces it the moment it lands. Same shape as the bought table
   (see theme.js): draw what we knew, correct it when told.

   Three things this is NOT:

   · not authority. Nothing is spent, unlocked or allowed on the strength
     of a number from here — the server settles every match and every
     purchase, and the lobby only greys rooms out. A player who edits this
     in localStorage lies to their own screen and to nothing else.
   · not shared. The key is the account, so a guest never wears the numbers
     of the Google account that used this phone before them, and the wrong
     way round is worse: signing in must never show somebody else's coins.
   · not a guess. An empty cache paints nothing at all. A blank is honest;
     an invented level is not.
   ===================================================================== */
(function (global) {
  "use strict";

  const KEY = "dominoProfileCache";

  /* Everything this module touches comes through `global`, never through a
     bare name. A bare `Auth` or `localStorage` happens to work in a browser
     and is a ReferenceError anywhere else — and a module that can only be
     run inside a page is a module that can only be checked inside one. */
  const auth = () => global.Auth || null;
  const store = () => global.localStorage || null;

  /* Which account these numbers belong to. A Google token is renewed about
     once an hour and is a different string every time, so it cannot be the
     key — `sub` is the account itself and does not move. A guest is their
     device. */
  function keyFor() {
    const A = auth();
    let me = null;
    try { me = A && A.load(); } catch (e) { me = null; }
    let dev = "device";
    try { if (A && A.deviceId) dev = A.deviceId() || dev; } catch (e) {}
    if (me && me.kind === "google" && me.id) return "google:" + me.id;
    return "guest:" + ((me && me.id) || dev);
  }

  function all() {
    const s = store();
    if (!s) return {};
    try { return JSON.parse(s.getItem(KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function put(box) {
    const s = store();
    if (!s) return;
    try { s.setItem(KEY, JSON.stringify(box)); } catch (e) {}
  }

  /* A profile from an older version of the app can be missing fields the
     screen reaches into without asking (`stats.matches`, `daily.canClaim`).
     Rather than sprinkle guards through the painting code, anything that
     does not look like a whole profile is treated as no cache at all. */
  function whole(p) {
    return !!p && typeof p === "object"
      && typeof p.level === "number" && typeof p.coins === "number"
      && !!p.stats && typeof p.stats === "object"
      && !!p.daily && typeof p.daily === "object";
  }

  function load() {
    const p = all()[keyFor()];
    return whole(p) ? p : null;
  }

  function save(p) {
    if (!whole(p)) return null;
    const box = all();
    box[keyFor()] = p;
    /* One account per key and only a handful of keys ever — but a shared
       phone could collect them, so the oldest go rather than growing for
       ever. Written last-seen-first, so "oldest" is simply the tail. */
    const keys = Object.keys(box);
    if (keys.length > 6) {
      const mine = keyFor();
      keys.filter((k) => k !== mine).slice(0, keys.length - 6)
          .forEach((k) => { delete box[k]; });
    }
    put(box);
    return p;
  }

  // Signing out of an account should not leave its numbers on the device.
  function forget() {
    const box = all();
    delete box[keyFor()];
    put(box);
  }

  global.ProfileCache = { load, save, forget, keyFor };
})(typeof window !== "undefined" ? window : this);
