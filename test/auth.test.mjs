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

test("a signed-in player whose token went stale is never left with nothing", async () => {
  // Google tokens last about an hour. When one ages out the player must keep
  // playing under this device's own progress — for a while they were left with
  // no profile at all, which is worse than never having signed in.
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
  assert.ok(asStale, "and it is still handed back when the token fails");
  assert.equal(asStale.coins, asGuest.coins, "the same progress, not a blank one");
  assert.equal(asStale.verified, false, "but the name loses its tick");
});

test("a claim to be signed in is worthless without a token", async () => {
  const c = client(WITH_GOOGLE);
  c.emit("createTable", { target: 355, size: 4, name: "ვითომ", auth: { kind: "google" } });
  assert.ok(await until(() => c.last && c.last.lobby && c.last.lobby.length));
  assert.equal(c.last.lobby[0].verified, false, "saying it does not make it so");
});
