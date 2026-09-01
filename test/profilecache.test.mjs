/* =====================================================================
   The numbers this account had last time.

   Coins, level and streak live on the server, and asking takes a round trip
   — several seconds on a host that has been asleep. Until the answer came,
   the lobby showed 🪙 0 and no level, then filled itself in; leave a table
   and it happened again. Nothing was broken and it looked exactly like
   something was.

   So the last answer is kept and drawn at once. Almost everything worth
   checking here is about the ways that could go wrong rather than the way
   it goes right: showing one player another player's coins, or showing
   numbers from a version of the app whose profiles had different fields.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (...p) => readFileSync(path.join(ROOT, ...p), "utf8");
const SRC = read("public", "js", "profilecache.js");

/* A browser, near enough: a store that behaves like localStorage and an
   Auth that can be told who is holding the phone. */
function browser(who) {
  const store = new Map();
  const g = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
    },
    Auth: {
      load: () => g.__who,
      deviceId: () => "this-device",
    },
    __who: who || null,
  };
  /* Only `window` is handed in — anything the module needs it must reach
     through that, which is the point. */
  new Function("window", SRC).call(g, g);
  g.be = (me) => { g.__who = me; };
  return g;
}

const GUEST = { kind: "guest", id: "g-1", name: "ლაშა" };
const OTHER = { kind: "guest", id: "g-2", name: "ნინო" };
const GOOGLE = { kind: "google", id: "sub-777", name: "ლაშა", idToken: "aaa" };

const profile = (over) => Object.assign({
  level: 4, coins: 2500, gems: 3, into: 20, need: 100,
  stats: { matches: 9, matchWins: 5 },
  daily: { canClaim: false, streak: 3 },
}, over || {});

/* ---------------- whose numbers are these ---------------- */

test("a guest and a signed-in player do not share a shelf", () => {
  /* The one that matters most: signing in must never show the coins of the
     guest who was here a moment ago, and signing out must not show a
     stranger the account's balance. */
  const w = browser(GUEST);
  w.ProfileCache.save(profile({ coins: 100 }));
  w.be(GOOGLE);
  assert.equal(w.ProfileCache.load(), null, "signing in inherited the guest's numbers");
  w.ProfileCache.save(profile({ coins: 9999 }));
  w.be(GUEST);
  assert.equal(w.ProfileCache.load().coins, 100, "the guest was shown the account's coins");
});

test("two guests on one phone keep their own", () => {
  const w = browser(GUEST);
  w.ProfileCache.save(profile({ coins: 100 }));
  w.be(OTHER);
  assert.equal(w.ProfileCache.load(), null);
  w.ProfileCache.save(profile({ coins: 700 }));
  w.be(GUEST);
  assert.equal(w.ProfileCache.load().coins, 100);
});

test("the key for a signed-in player is the account, not the token", () => {
  /* A Google token is renewed roughly hourly and is a different string every
     time. Keyed on that, the numbers would be lost once an hour — which is
     the same as not keeping them at all. */
  const w = browser(GOOGLE);
  const first = w.ProfileCache.keyFor();
  w.ProfileCache.save(profile({ coins: 4242 }));
  w.be({ ...GOOGLE, idToken: "a completely different token" });
  assert.equal(w.ProfileCache.keyFor(), first, "a renewed token changed the shelf");
  assert.equal(w.ProfileCache.load().coins, 4242, "a renewed token lost the numbers");
});

test("with nobody signed in at all, the device is the account", () => {
  const w = browser(null);
  assert.equal(w.ProfileCache.keyFor(), "guest:this-device");
  w.ProfileCache.save(profile({ coins: 55 }));
  assert.equal(w.ProfileCache.load().coins, 55);
});

/* ---------------- what is worth keeping ---------------- */

test("half a profile is treated as no profile", () => {
  /* The screen reaches into `stats.matches` and `daily.canClaim` without
     asking first. A profile saved by an older version of the app that had
     no such fields would throw in the middle of drawing the lobby, so it is
     refused on the way in and on the way out. */
  const w = browser(GUEST);
  for (const bad of [
    null, "nonsense", {}, { level: 1 },
    { level: 1, coins: 5, stats: {} },                  // no daily
    { level: 1, coins: 5, daily: {} },                  // no stats
    { coins: 5, stats: {}, daily: {} },                 // no level
  ]) {
    assert.equal(w.ProfileCache.save(bad), null, "saved something unusable");
    assert.equal(w.ProfileCache.load(), null, "served something unusable");
  }
  assert.ok(w.ProfileCache.save(profile()), "a whole profile was refused");
});

test("a whole profile survives the round trip unchanged", () => {
  const w = browser(GUEST);
  const p = profile({ equipped: { table: "wood" }, name: "ლაშა" });
  w.ProfileCache.save(p);
  assert.deepEqual(w.ProfileCache.load(), p);
});

test("signing out takes the numbers with it, and only this account's", () => {
  const w = browser(GUEST);
  w.ProfileCache.save(profile({ coins: 100 }));
  w.be(GOOGLE);
  w.ProfileCache.save(profile({ coins: 800 }));
  w.ProfileCache.forget();
  assert.equal(w.ProfileCache.load(), null, "the account's numbers were left behind");
  w.be(GUEST);
  assert.equal(w.ProfileCache.load().coins, 100, "somebody else's numbers were thrown away too");
});

test("a shared phone does not collect accounts for ever", () => {
  const w = browser(GUEST);
  for (let i = 0; i < 12; i++) {
    w.be({ kind: "guest", id: "p" + i });
    w.ProfileCache.save(profile({ coins: i }));
  }
  const box = JSON.parse(w.localStorage.getItem("dominoProfileCache"));
  assert.ok(Object.keys(box).length <= 6, `${Object.keys(box).length} accounts kept`);
  assert.ok(w.ProfileCache.load(), "the account being used right now was thrown away");
});

test("a store somebody has scribbled in is not a crash", () => {
  const w = browser(GUEST);
  w.localStorage.setItem("dominoProfileCache", "{{ not json");
  assert.equal(w.ProfileCache.load(), null);
  assert.ok(w.ProfileCache.save(profile()), "could not recover from a broken store");
});

/* ---------------- and the lobby actually uses it ---------------- */

const lobby = read("public", "index.html");

test("the lobby draws what it knew before it asks anything", () => {
  assert.match(lobby, /<script src="js\/profilecache\.js"><\/script>/,
    "the lobby does not load it");
  assert.match(lobby, /ME = ProfileCache\.load\(\);\s*\n\s*if \(ME\) paintProfile\(\);/,
    "the lobby waits for the server before it draws anything");
  const at = lobby.indexOf("ME = ProfileCache.load()");
  assert.ok(at > 0 && at < lobby.indexOf('socket.on("profile"'),
    "the remembered numbers are drawn after the asking rather than before");
});

test("every answer from the server is kept for next time", () => {
  assert.match(lobby, /ME = ProfileCache\.save\(p\) \|\| p;/,
    "the server's answer is shown and then forgotten");
});

test("changing who is playing changes the numbers on the screen", () => {
  /* Without this the previous player's coins and level simply stay up until
     the server answers — which is the same bug the cache exists to fix, only
     now showing somebody else's figures instead of zeros. */
  const at = lobby.indexOf("Auth.onChange(() => {");
  assert.notEqual(at, -1, "nothing reacts to the player changing");
  const body = lobby.slice(at, at + 900);
  assert.match(body, /ME = ProfileCache\.load\(\);/,
    "a new identity does not reload its own numbers");
  assert.match(body, /if \(ME\) paintProfile\(\); else blankProfile\(\);/,
    "an account we have never seen keeps the last one's numbers on screen");
});

test("signing out clears the shelf before the identity goes", () => {
  /* forget() files under whoever is signed in NOW, so after signOut it would
     clear the wrong shelf — or nothing at all. */
  const at = lobby.indexOf("function signOutNow()");
  assert.notEqual(at, -1);
  const body = lobby.slice(at, lobby.indexOf("\n    }", at));
  /* Asked in two steps on purpose. `indexOf` returns -1 for something that is
     not there at all, and -1 is less than every real position — so an ordering
     check on its own passes most loudly in exactly the case where the call has
     been deleted. It did, and this is what it cost to notice. */
  const clears = body.indexOf("ProfileCache.forget()");
  const goes = body.indexOf("Auth.signOut()");
  assert.notEqual(clears, -1, "signing out does not clear the account's numbers at all");
  assert.notEqual(goes, -1, "signOutNow no longer signs anybody out");
  assert.ok(clears < goes, "the numbers are cleared after the account has already gone");
});

test("being unable to reach the server keeps the numbers, and says so", () => {
  /* Blanking the screen turns "we could not ask" into "your progress is
     gone", which is the more alarming of the two and the less true. */
  const at = lobby.indexOf("function profileUnavailable()");
  assert.notEqual(at, -1);
  const body = lobby.slice(at, lobby.indexOf("\n    }", at));
  assert.match(body, /if \(ME\) \{/, "the last known numbers are wiped regardless");
  assert.match(body, /ბოლოს ნანახი/, "nothing tells the player the figures are not fresh");
});

test("the wording for stale numbers is in both languages", () => {
  /* A new Georgian line that nobody translates stays Georgian on an English
     screen and nothing anywhere reports it. */
  const dict = read("public", "js", "i18n.js");
  assert.match(dict, /"ბოლოს ნანახი მონაცემები — სერვერს ვერ დავუკავშირდი"/,
    "the stale-numbers line has no English");
});
