/* =====================================================================
   Getting in: as a guest, or with Google.

   The rule these protect: a name is only ever marked verified when Google
   itself vouched for it. A guest is taken at their word, and a forged or
   expired Google token must quietly fall back to guest — never be believed,
   and never bring the server down.
   ===================================================================== */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";

const CWD = fileURLToPath(new URL("..", import.meta.url));
const servers = [], clients = [];

function startServer(port, env) {
  const s = spawn(process.execPath, ["server.js"], {
    cwd: CWD, env: { ...process.env, PORT: String(port), ...env },
  });
  s.log = ""; s.exited = null;
  s.stdout.on("data", (d) => { s.log += d; });
  s.stderr.on("data", (d) => { s.log += d; });
  s.on("exit", (c, sig) => { s.exited = `code=${c} signal=${sig}`; });
  servers.push(s);
  return s;
}
const ready = async (s) => {
  for (let i = 0; i < 60 && !s.log.includes("running"); i++) await wait(150);
  assert.equal(s.exited, null, `server started: ${s.log}`);
};
function client(port) {
  const c = io(`http://127.0.0.1:${port}`, { transports: ["websocket"], forceNew: true });
  c.last = null;
  c.on("state", (st) => { c.last = st; });
  clients.push(c);
  return c;
}
const until = async (fn, ms = 8000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(100);
  return fn();
};
// the shape of a real Google token, with nothing real inside it
const FORGED = ["eyJhbGciOiJSUzI1NiJ9",
  Buffer.from(JSON.stringify({ sub: "1", name: "ვითომ", aud: "fake", exp: 2e9 })).toString("base64url"),
  "not-a-signature"].join(".");

const PLAIN = 3973, WITH_GOOGLE = 3974;
let plain, withGoogle;

before(async () => {
  plain = startServer(PLAIN, { GOOGLE_CLIENT_ID: "" });
  withGoogle = startServer(WITH_GOOGLE, { GOOGLE_CLIENT_ID: "1234-test.apps.googleusercontent.com" });
  await ready(plain);
  await ready(withGoogle);
});
after(() => { clients.forEach((c) => c.close()); servers.forEach((s) => s.kill()); });

const config = async (port) =>
  (await fetch(`http://127.0.0.1:${port}/auth/config`)).json();

test("with no client id configured, Google is simply not offered", async () => {
  const cfg = await config(PLAIN);
  assert.equal(cfg.google, false, "the screen will hide the Google button");
  assert.equal(cfg.clientId, null);
  assert.match(plain.log, /guests only/, "and the server says so on startup");
});

test("with a client id configured, the client is told what it is", async () => {
  const cfg = await config(WITH_GOOGLE);
  assert.equal(cfg.google, true);
  assert.equal(cfg.clientId, "1234-test.apps.googleusercontent.com",
    "handed over by the server, so it is set in one place only");
});

test("a guest keeps their name and is never marked verified", async () => {
  const c = client(PLAIN);
  c.emit("createTable", { target: 175, size: 4, name: "სტუმარი ლაშა", auth: { kind: "guest", id: "g1" } });
  assert.ok(await until(() => c.last && c.last.lobby && c.last.lobby.length));
  const me = c.last.lobby[0];
  assert.equal(me.name, "სტუმარი ლაშა", "their name, kept as typed");
  assert.equal(me.verified, false, "nobody vouched for it");

  // and an absurd one is cut down rather than shown in full
  const long = client(PLAIN);
  long.emit("createTable", { target: 175, size: 4, name: "ა".repeat(200) });
  assert.ok(await until(() => long.last && long.last.lobby && long.last.lobby.length));
  assert.ok(long.last.lobby[0].name.length <= 14, "trimmed to the name limit");
});

test("a forged Google token is refused, and the player carries on as a guest", async () => {
  const c = client(WITH_GOOGLE);
  c.emit("createTable", { target: 175, size: 4, name: "თაღლითი", auth: { kind: "google", idToken: FORGED } });
  assert.ok(await until(() => c.last && c.last.lobby && c.last.lobby.length), "still seated");
  assert.equal(c.last.lobby[0].verified, false, "but not believed");
  assert.equal(c.last.lobby[0].name, "თაღლითი", "and left under their own name");
  assert.equal(withGoogle.exited, null, "the server shrugged it off");
});

test("nonsense where a token should be does not upset the server", async () => {
  const c = client(WITH_GOOGLE);
  for (const bad of [null, 0, {}, [], true, "x", "a.b", "a.b.c", "x".repeat(9000),
                     { toString(){ throw new Error("boom"); } }]) {
    c.emit("quickJoin", { target: 75, size: 2, name: "ვინმე", auth: { kind: "google", idToken: bad } });
  }
  await wait(1200);
  assert.equal(withGoogle.exited, null, `still up: ${withGoogle.log.slice(-300)}`);

  const fresh = client(WITH_GOOGLE);
  fresh.emit("createTable", { target: 175, size: 4, name: "შემდეგი" });
  assert.ok(await until(() => fresh.last && fresh.last.lobby), "and still seating players");
});

test("the app can read the sign-in settings from its own origin", async () => {
  // The Android app's pages come from inside the APK, so its requests arrive
  // from https://localhost. Without permission the browser hides the reply and
  // the app decides Google sign-in is off — which is what happened.
  for (const p of ["/auth/config", "/status"]) {
    const r = await fetch(`http://127.0.0.1:${WITH_GOOGLE}${p}`, {
      headers: { Origin: "https://localhost" },
    });
    assert.equal(r.status, 200, `${p} answered`);
    assert.equal(r.headers.get("access-control-allow-origin"), "*",
      `${p} must let the app read it`);
  }
  const cfg = await (await fetch(`http://127.0.0.1:${WITH_GOOGLE}/auth/config`,
    { headers: { Origin: "https://localhost" } })).json();
  assert.equal(cfg.google, true, "and the app sees that Google is available");
});

test("a stale token can still SIT DOWN — nobody is turned away from a game", async () => {
  /* Google tokens last about an hour. When one ages out mid-evening the
     player must still be able to play, under this device's own progress and
     without the tick by their name. That half of the fallback is the half
     worth keeping. */
  const c = client(WITH_GOOGLE);
  c.emit("createTable", { target: 175, size: 2, name: "ლაშა",
                          auth: { kind: "google", idToken: FORGED, id: "stale-device" } });
  assert.ok(await until(() => c.last && c.last.lobby && c.last.lobby.length),
    "an expired token could not sit down at all");
  assert.equal(c.last.lobby[0].verified, false, "but the name loses its tick");
});

test("a stale token is NOT told the guest's progress is theirs", async () => {
  /* This is the other half, and it used to be wrong. Reading a profile with a
     token that did not check out handed back the DEVICE's guest progress —
     silently, with no way to tell. A signed-in player was shown the coins of
     the guest they used to be, and only sometimes: whenever Google's
     certificates were already cached the real answer came, and whenever they
     had to be fetched and the fetch was slow or refused, the wrong one did.

     Null is the right answer. The browser knows what to do with it — renew
     the token once and ask again — and a moment of "loading" beats a number
     that is confidently wrong. */
  const c = client(WITH_GOOGLE);
  const asGuest = await new Promise((r) => {
    c.once("profile", r);
    c.emit("profile", { auth: { kind: "guest", id: "stale-device" }, name: "ლაშა" });
  });
  assert.ok(asGuest, "the device has progress of its own");

  const asStale = await new Promise((r) => {
    c.once("profile", r);
    // exactly what the browser sends: an expired token, plus the device id
    c.emit("profile", { auth: { kind: "google", idToken: FORGED, id: "stale-device" }, name: "ლაშა" });
  });
  assert.equal(asStale, null, "the guest's progress was handed back as the account's");

  // and the shop follows the same rule: the wrong shelf is worse than no shelf
  const shop = await new Promise((r) => {
    c.once("shop", r);
    c.emit("shop", { auth: { kind: "google", idToken: FORGED, id: "stale-device" }, name: "ლაშა" });
  });
  assert.equal(shop, null, "the guest's shop was handed back as the account's");
});

test("a claim to be signed in is worthless without a token", async () => {
  const c = client(WITH_GOOGLE);
  c.emit("createTable", { target: 355, size: 4, name: "ვითომ", auth: { kind: "google" } });
  assert.ok(await until(() => c.last && c.last.lobby && c.last.lobby.length));
  assert.equal(c.last.lobby[0].verified, false, "saying it does not make it so");
});

/* ---------------- the lobby, and when it asks ---------------- */

test("signing in asks the server again", async () => {
  /* The bug a player reported: coins and the table they had bought arrived
     late, or not at all, after signing in with Google. Everything on the front
     page belongs to an ACCOUNT — coins, level, streak, the skin they bought —
     and none of it was asked for a second time when the account changed. The
     page went on showing the progress of the guest they had been a moment
     before, until something else happened to ask: opening the profile pane,
     or a reconnect. Sometimes that was seconds, sometimes it never came. */
  const { readFileSync } = await import("node:fs");
  const path = (await import("node:path")).default;
  const html = readFileSync(path.join(CWD, "public", "index.html"), "utf8");
  assert.match(html, /Auth\.onChange\(\(\) => \{/,
    "nothing notices that the player is now somebody else");
  const at = html.indexOf("Auth.onChange(() => {");
  const body = html.slice(at, html.indexOf("});", at));
  assert.match(body, /askProfile\(\);/, "the profile is not asked for again");
  assert.match(body, /emit\("shop"/, "the shop is left showing another account's shelf");
  assert.match(body, /retried = false;/,
    "a new identity inherits the old one's spent retry");
});

test("asking does not wait for the socket to be up", async () => {
  /* socket.io holds an emit and sends it the moment it connects, so refusing
     to ask while disconnected saves nothing — it turns "in a second" into
     "never". On the hosted server, which sleeps and takes up to a minute to
     wake, that was most of the time somebody first opened the page. */
  const { readFileSync } = await import("node:fs");
  const path = (await import("node:path")).default;
  const html = readFileSync(path.join(CWD, "public", "index.html"), "utf8");
  const at = html.indexOf("function askProfile()");
  assert.notEqual(at, -1, "there is no askProfile");
  assert.doesNotMatch(html.slice(at, html.indexOf("}", at)), /socket\.connected/,
    "the request is dropped instead of being held");
  const t = html.indexOf("function askTable()");
  assert.doesNotMatch(html.slice(t, html.indexOf("}", t)), /socket\.connected/,
    "the held-chair question is dropped instead of being held");
});

test("Auth tells anyone who asks when the player changes", async () => {
  /* Both ways: signing in and signing out. A player who signs out and is still
     shown the account's coins is the same bug with the sign reversed. */
  const { readFileSync } = await import("node:fs");
  const path = (await import("node:path")).default;
  const auth = readFileSync(path.join(CWD, "public", "js", "auth.js"), "utf8");
  for (const fn of ["function save(me)", "function signOut()"]) {
    const at = auth.indexOf(fn);
    assert.notEqual(at, -1, "no " + fn);
    assert.match(auth.slice(at, auth.indexOf("\n  }", at)), /listeners\.forEach/,
      fn + " changes who the player is and tells nobody");
  }
  assert.match(auth, /onChange: \(fn\) => listeners\.push\(fn\)/,
    "there is no way to be told");
});

test("a game wears the skin the ACCOUNT bought, not the one this device has", async () => {
  /* The look is kept on the device so a table is the right colour before the
     server has answered — but the copy is written by the LOBBY. On a phone
     that had not been back to the front page since signing in, a game opened
     in the default colours, or in the ones the guest on that device had
     bought, and stayed that way. */
  const { readFileSync } = await import("node:fs");
  const path = (await import("node:path")).default;
  const src = readFileSync(path.join(CWD, "server.js"), "utf8");
  assert.match(src, /function lookOf\(room, seat\)/, "the server never says what to wear");
  assert.equal((src.match(/myLook: lookOf\(room, seat\)/g) || []).length, 5,
    "not every game sends it");
  for (const f of ["online.html", "buraonline.html", "jokeronline.html",
                   "nardi.html", "damka.html"]) {
    const html = readFileSync(path.join(CWD, "public", f), "utf8");
    assert.match(html, /if \(st\.myLook && window\.Look\) Look\.remember\(st\.myLook\);/,
      f + " never puts on what the account is wearing");
    assert.match(html, /src="js\/theme\.js"/, f + " has no way to wear anything");
  }
});

test("no screen calls an Auth function that does not exist", async () => {
  /* ნარდი and დამკა called `Auth.me()`, guarded as `Auth && Auth.me ? ... :
     null`. The guard read as caution and WAS the bug: `me` has never been
     exported, so the null branch was taken every single time and both games
     joined with no identity at all. The server had nothing to look the player
     up by, so those two had no profile behind them — no level on the plate,
     no purse, no coins won or lost, and none of the table they had bought.

     Nothing failed, nothing threw, and the optional-chaining shape made it
     look deliberate. That is why this is checked by name. */
  const { readFileSync, readdirSync } = await import("node:fs");
  const path = (await import("node:path")).default;
  const PUB = path.join(CWD, "public");
  const auth = readFileSync(path.join(PUB, "js", "auth.js"), "utf8");

  const block = auth.slice(auth.indexOf("global.Auth = {"), auth.indexOf("})(window)"));
  const exported = new Set();
  for (const m of block.matchAll(/(?:^|[\s,{])([A-Za-z_$][\w$]*)\s*(?:,|:)/g)) exported.add(m[1]);
  assert.ok(exported.has("credentials") && exported.has("name"),
    "the export list was not read properly: " + [...exported].join(","));

  /* Comments stripped first — the note explaining this very bug names the
     thing it is about, and a checker that reads prose finds problems in it. */
  const code = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const bad = [];
  for (const f of readdirSync(PUB).filter((x) => x.endsWith(".html"))) {
    const html = code(readFileSync(path.join(PUB, f), "utf8"));
    for (const m of html.matchAll(/\bAuth\.([A-Za-z_$][\w$]*)/g))
      if (!exported.has(m[1])) bad.push(f + " → Auth." + m[1]);
  }
  assert.deepEqual([...new Set(bad)], [], "these do not exist and quietly do nothing");
});

test("every online screen sends who it is when it sits down", async () => {
  const { readFileSync } = await import("node:fs");
  const path = (await import("node:path")).default;
  for (const f of ["online.html", "buraonline.html", "jokeronline.html",
                   "nardi.html", "damka.html"]) {
    const html = readFileSync(path.join(CWD, "public", f), "utf8");
    assert.match(html, /Auth\.credentials\(\)/, f + " never asks who the player is");
    assert.match(html, /auth: WHO\.auth/, f + " sits down without an identity");
  }
});

/* =====================================================================
   Signing in from an icon.

   Google's button opens a POPUP and hands the credential back to the page that
   opened it. That works in a browser tab and nowhere else: a page launched from
   a home-screen icon runs in its own window, `window.open` there hands the job
   to the browser, and the credential arrives in a different context with its
   own storage that the app cannot read. The player is thrown out to Google and
   never comes back signed in — which is what was reported.

   The redirect flow is a plain top-level form POST, so it stays in the window
   it started in. What can be checked here is every way that POST is refused;
   the accepted path needs a credential Google actually signed, which no test
   can mint, so the properties of the one-time code are read off the source
   instead.
   ===================================================================== */

const AUTH_PORT = 3902;

test("a forged sign-in POST is refused, however it is shaped", async () => {
  /* Google sends the same random value twice — in the body and in a cookie it
     set itself. Only a form Google actually rendered has both. */
  const s = startServer(AUTH_PORT, { GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com" });
  await ready(s);
  const post = async (body, cookie) => {
    const r = await fetch(`http://127.0.0.1:${AUTH_PORT}/auth/google`, {
      method: "POST", redirect: "manual",
      headers: Object.assign({ "content-type": "application/x-www-form-urlencoded" },
                             cookie ? { cookie } : {}),
      body,
    });
    return r.headers.get("location") || "";
  };

  assert.match(await post("credential=x"), /#gauth=csrf$/,
    "a POST with no token at all was let through");
  assert.match(await post("g_csrf_token=BBB&credential=x", "g_csrf_token=AAA"), /#gauth=csrf$/,
    "a POST whose cookie and body disagree was let through");
  assert.match(await post("g_csrf_token=AAA&credential=x", "g_csrf_token=AAA"), /#gauth=bad$/,
    "a credential Google never signed was accepted");
});

test("a code that was never issued buys nothing", async () => {
  const r = await fetch(`http://127.0.0.1:${AUTH_PORT}/auth/claim?code=nope`);
  assert.equal(r.status, 404);
  assert.equal((await r.json()).ok, false);
});

test("the token never travels in the address bar, and the code works once", async () => {
  /* A token in a URL is a token in the history, in the address bar and in
     every referrer that leaks. What goes in the address is a code that is
     worth nothing a minute later and nothing at all a second time. */
  const { readFileSync } = await import("node:fs");
  const path = (await import("node:path")).default;
  const src = readFileSync(path.join(CWD, "server.js"), "utf8");

  const at = src.indexOf('app.post("/auth/google"');
  assert.notEqual(at, -1, "there is no redirect endpoint, so an icon cannot sign in");
  const post = src.slice(at, src.indexOf("\n});", at));
  assert.doesNotMatch(post, /#gauth=" \+ req\.body\.credential/,
    "the credential itself is put in the address");
  assert.match(post, /newClaim\(req\.body\.credential\)/, "no one-time code is minted");

  const claim = src.slice(src.indexOf('app.get("/auth/claim"'));
  assert.ok(claim.indexOf("claims.delete(code)") < claim.indexOf("if (!found"),
    "the code is only spent after it is checked, so a failed claim leaves it usable");
  assert.match(src, /const CLAIM_TTL = \d+;/, "a code never expires");
});

test("the popup is only replaced where it cannot come back", async () => {
  /* The redirect costs a page load, so a browser tab keeps the popup. */
  const { readFileSync } = await import("node:fs");
  const path = (await import("node:path")).default;
  const auth = readFileSync(path.join(CWD, "public", "js", "auth.js"), "utf8");
  assert.match(auth, /ux_mode: viaRedirect \? "redirect" : "popup"/,
    "every browser is sent through the redirect, or none is");
  assert.match(auth, /navigator && global\.navigator\.standalone/,
    "an iOS home-screen launch is not recognised");
  assert.match(auth, /display-mode: standalone/, "nobody else's standalone is recognised");
  assert.match(auth, /login_uri: viaRedirect \? base\(\) \+ "\/auth\/google" : undefined/,
    "Google is not told where to post the credential");
  // and the address is cleaned whatever happened, so a reload cannot repeat it
  assert.match(auth, /history\.replaceState\(null, "", clean/,
    "the code is left in the address after it has been spent");
});
