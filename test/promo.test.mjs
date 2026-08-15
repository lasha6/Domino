/* =====================================================================
   Promo codes.

   A code pays once per account and is recorded on the profile, so it cannot be
   farmed even if it gets out. With no code set in the environment, the feature
   does not exist at all.
   ===================================================================== */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { io } from "socket.io-client";

const CWD = fileURLToPath(new URL("..", import.meta.url));
const OFF = 3985, ON = 3986;
const CODE = "TEST-CODE";
let dir, off, on;
const clients = [];

function start(port, env) {
  const s = spawn(process.execPath, ["server.js"], {
    cwd: CWD, env: { ...process.env, PORT: String(port), GOOGLE_CLIENT_ID: "", ...env },
  });
  s.log = ""; s.exited = null;
  s.stdout.on("data", (d) => { s.log += d; });
  s.stderr.on("data", (d) => { s.log += d; });
  s.on("exit", (c, sig) => { s.exited = `code=${c} signal=${sig}`; });
  return s;
}
const ready = async (s) => {
  for (let i = 0; i < 80 && !s.log.includes("running"); i++) await wait(150);
  assert.equal(s.exited, null, `started: ${s.log}`);
};

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-promo-"));
  off = start(OFF, { DATA_DIR: path.join(dir, "off") });
  on = start(ON, { DATA_DIR: path.join(dir, "on"), GRANT_CODE: CODE, GRANT_COINS: "5000", GRANT_GEMS: "40" });
  await ready(off); await ready(on);
});
after(async () => {
  clients.forEach((c) => c.close());
  [off, on].forEach((s) => s && s.kill());
  await wait(200);
  await rm(dir, { recursive: true, force: true });
});

function client(port) {
  const c = io(`http://127.0.0.1:${port}`, { transports: ["websocket"], forceNew: true });
  clients.push(c);
  return c;
}
const ask = (c, send, payload, reply) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`no ${reply}`)), 15000);
  c.once(reply, (r) => { clearTimeout(t); resolve(r); });
  c.emit(send, payload);
});
const guest = (id) => ({ kind: "guest", id });

test("with no code set, the feature is not advertised and pays nothing", async () => {
  const cfg = await (await fetch(`http://127.0.0.1:${OFF}/auth/config`)).json();
  assert.equal(cfg.promo, false, "the screen is told there is nothing to enter");
  const r = await ask(client(OFF), "redeem", { auth: guest("a"), code: CODE }, "redeemResult");
  assert.equal(r.ok, false);
  assert.equal(r.why, "none");
});

test("with a code set, the right one pays exactly what it says", async () => {
  const cfg = await (await fetch(`http://127.0.0.1:${ON}/auth/config`)).json();
  assert.equal(cfg.promo, true);
  assert.ok(!JSON.stringify(cfg).includes(CODE), "but the code itself is never sent out");

  const before = await ask(client(ON), "profile", { auth: guest("p1"), name: "ტესტი" }, "profile");
  const r = await ask(client(ON), "redeem", { auth: guest("p1"), code: CODE }, "redeemResult");
  assert.equal(r.ok, true);
  assert.equal(r.coins, before.coins + 5000);
  assert.equal(r.gems, before.gems + 40);
});

test("the same account cannot use it twice", async () => {
  const first = await ask(client(ON), "profile", { auth: guest("p1") }, "profile");
  const again = await ask(client(ON), "redeem", { auth: guest("p1"), code: CODE }, "redeemResult");
  assert.equal(again.ok, false);
  assert.equal(again.why, "used");
  const after = await ask(client(ON), "profile", { auth: guest("p1") }, "profile");
  assert.equal(after.coins, first.coins, "and nothing more was paid");
});

test("a wrong code pays nothing, however it is written", async () => {
  const before = await ask(client(ON), "profile", { auth: guest("p2") }, "profile");
  for (const bad of ["", "  ", "NOPE", CODE + "X", null, 12345, { a: 1 }, ["x"]]) {
    const r = await ask(client(ON), "redeem", { auth: guest("p2"), code: bad }, "redeemResult");
    assert.equal(r.ok, false, `"${JSON.stringify(bad)}" must not pay`);
  }
  const after = await ask(client(ON), "profile", { auth: guest("p2") }, "profile");
  assert.equal(after.coins, before.coins);
  assert.equal(on.exited, null, "and none of it upset the server");
});

test("the code is not case sensitive, so it can be typed on a phone", async () => {
  const r = await ask(client(ON), "redeem", { auth: guest("p3"), code: CODE.toLowerCase() }, "redeemResult");
  assert.equal(r.ok, true);
});

test("what a code paid is still there after a restart", async () => {
  const before = await ask(client(ON), "profile", { auth: guest("p1") }, "profile");
  on.kill();
  for (let i = 0; i < 40 && on.exited === null; i++) await wait(100);
  on = start(ON, { DATA_DIR: path.join(dir, "on"), GRANT_CODE: CODE, GRANT_COINS: "5000", GRANT_GEMS: "40" });
  await ready(on);

  const after = await ask(client(ON), "profile", { auth: guest("p1") }, "profile");
  assert.equal(after.coins, before.coins, "the coins survived");
  const twice = await ask(client(ON), "redeem", { auth: guest("p1"), code: CODE }, "redeemResult");
  assert.equal(twice.why, "used", "and so did the record of having used it");
});
