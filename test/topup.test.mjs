/* =====================================================================
   The rescue top-up.

   A player with nothing left cannot sit at any table, so there has to be a way
   back. It must not become an income, though: only when they are actually
   short, and not again for an hour.
   ===================================================================== */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { io } from "socket.io-client";

const CWD = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3987;
const ADDR = `http://127.0.0.1:${PORT}`;
let dir, srv;
const clients = [];

const profile = (id, over) => ({
  id, kind: "guest", name: "ტესტი", picture: null,
  coins: 1000, gems: 0, owned: {}, equipped: {}, redeemed: {}, xp: 0, level: 1,
  stats: { matches: 0, matchWins: 0, hands: 0, handWins: 0, points: 0, bestHand: 0, streak: 0, bestStreak: 0 },
  daily: { lastClaim: null, streak: 0 }, achievements: {}, created: Date.now(), seen: Date.now(),
  ...over,
});

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-topup-"));
  await writeFile(path.join(dir, "profiles.json"), JSON.stringify({
    "guest:broke": profile("guest:broke", { coins: 10 }),
    "guest:flush": profile("guest:flush", { coins: 5000 }),
    "guest:justasked": profile("guest:justasked", { coins: 0, lastTopup: Date.now() - 5 * 60000 }),
  }));
  srv = spawn(process.execPath, ["server.js"], {
    cwd: CWD, env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, GOOGLE_CLIENT_ID: "" },
  });
  srv.log = ""; srv.exited = null;
  srv.stdout.on("data", (d) => { srv.log += d; });
  srv.stderr.on("data", (d) => { srv.log += d; });
  srv.on("exit", (c, s) => { srv.exited = `code=${c} signal=${s}`; });
  for (let i = 0; i < 80 && !srv.log.includes("running"); i++) await wait(150);
  assert.equal(srv.exited, null, `started: ${srv.log}`);
});
after(async () => {
  clients.forEach((c) => c.close());
  if (srv) srv.kill();
  await wait(200);
  await rm(dir, { recursive: true, force: true });
});

function client() {
  const c = io(ADDR, { transports: ["websocket"], forceNew: true });
  clients.push(c);
  return c;
}
const ask = (c, send, payload, reply) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`no ${reply}`)), 15000);
  c.once(reply, (r) => { clearTimeout(t); resolve(r); });
  c.emit(send, payload);
});
const guest = (id) => ({ kind: "guest", id });

test("a player with nothing left is put back in the game", async () => {
  const r = await ask(client(), "topup", { auth: guest("broke") }, "topupResult");
  assert.equal(r.ok, true);
  assert.equal(r.coins, 500, "enough to sit at the smallest table");
  assert.equal(r.added, 490, "topped up to the mark, not added on top of it");
});

test("a player who can still afford a table is not given more", async () => {
  const before = await ask(client(), "profile", { auth: guest("flush") }, "profile");
  const r = await ask(client(), "topup", { auth: guest("flush") }, "topupResult");
  assert.equal(r.ok, false);
  assert.equal(r.why, "not-broke");
  const after = await ask(client(), "profile", { auth: guest("flush") }, "profile");
  assert.equal(after.coins, before.coins, "nothing was added");
});

test("it cannot be taken again straight away", async () => {
  const again = await ask(client(), "topup", { auth: guest("broke") }, "topupResult");
  assert.equal(again.ok, false);
  assert.equal(again.why, "not-broke", "they are no longer short, so there is nothing to rescue");

  // someone who is short but asked minutes ago is told to wait
  const soon = await ask(client(), "topup", { auth: guest("justasked") }, "topupResult");
  assert.equal(soon.ok, false);
  assert.equal(soon.why, "wait");
  assert.ok(soon.minutes > 0 && soon.minutes <= 60, `told how long: ${soon.minutes}`);
  assert.equal(soon.coins, 0, "and still has nothing");
});

test("asking over and over cannot mint coins", async () => {
  const before = await ask(client(), "profile", { auth: guest("justasked") }, "profile");
  for (let i = 0; i < 10; i++) await ask(client(), "topup", { auth: guest("justasked") }, "topupResult");
  const after = await ask(client(), "profile", { auth: guest("justasked") }, "profile");
  assert.equal(after.coins, before.coins, "the balance did not move");
  assert.equal(srv.exited, null);
});

test("the rescue is remembered across a restart", async () => {
  srv.kill();
  for (let i = 0; i < 40 && srv.exited === null; i++) await wait(100);
  srv = spawn(process.execPath, ["server.js"], {
    cwd: CWD, env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, GOOGLE_CLIENT_ID: "" },
  });
  srv.log = ""; srv.exited = null;
  srv.stdout.on("data", (d) => { srv.log += d; });
  srv.on("exit", (c, s) => { srv.exited = `code=${c} signal=${s}`; });
  for (let i = 0; i < 80 && !srv.log.includes("running"); i++) await wait(150);

  const r = await ask(client(), "topup", { auth: guest("justasked") }, "topupResult");
  assert.equal(r.why, "wait", "restarting the server is not a way to ask again");
});
