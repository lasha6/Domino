/* =====================================================================
   The shop.

   Buying is the one place a player could hand themselves something for
   nothing, so every rule here is enforced by the server: the browser knows the
   prices only in order to draw them.
   ===================================================================== */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { io } from "socket.io-client";

const require = createRequire(import.meta.url);
const P = require("../public/js/progress.js");

const CWD = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3977;
const ADDR = `http://127.0.0.1:${PORT}`;
let dir, srv;
const clients = [];

// a player with enough to spend, written straight into the store
const RICH = "guest:rich";
function wealthy() {
  return {
    id: RICH, kind: "guest", name: "მდიდარი", picture: null,
    coins: 9000, gems: 60, owned: {}, equipped: {}, xp: 0, level: 1,
    stats: { matches: 0, matchWins: 0, hands: 0, handWins: 0, points: 0, bestHand: 0, streak: 0, bestStreak: 0 },
    daily: { lastClaim: null, streak: 0 }, achievements: {}, created: Date.now(), seen: Date.now(),
  };
}

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-shop-"));
  await writeFile(path.join(dir, "profiles.json"), JSON.stringify({ [RICH]: wealthy() }));
  srv = spawn(process.execPath, ["server.js"], {
    cwd: CWD, env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, GOOGLE_CLIENT_ID: "" },
  });
  srv.log = ""; srv.exited = null;
  srv.stdout.on("data", (d) => { srv.log += d; });
  srv.stderr.on("data", (d) => { srv.log += d; });
  srv.on("exit", (c, s) => { srv.exited = `code=${c} signal=${s}`; });
  for (let i = 0; i < 80 && !srv.log.includes("running"); i++) await wait(150);
  assert.equal(srv.exited, null, `server started: ${srv.log}`);
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
const rich = { kind: "guest", id: "rich" };
const poor = { kind: "guest", id: "poor" };
const find = (items, id) => items.find((i) => i.id === id);

test("the catalogue offers a look for the table and one for the tiles", () => {
  assert.ok(P.SHOP.length >= 4);
  for (const kind of ["table", "tiles"]) {
    const of = P.SHOP.filter((i) => i.kind === kind);
    assert.ok(of.length >= 2, `${kind} needs a choice`);
    assert.equal(of.filter((i) => i.price === 0).length, 1, `${kind} has exactly one free default`);
  }
  // nothing bought may change how the game plays — only colours
  for (const i of P.SHOP) {
    assert.ok(i.vars && Object.keys(i.vars).length, `${i.id} paints nothing`);
    for (const k of Object.keys(i.vars))
      assert.match(k, /^--/, `${i.id} sets something that is not a colour variable`);
  }
});

test("a new player already owns the free look and wears it", async () => {
  const r = await ask(client(), "shop", { auth: poor, name: "ღარიბი" }, "shop");
  const free = find(r.items, "table-classic");
  assert.equal(free.owned, true);
  assert.equal(free.equipped, true);
  assert.equal(find(r.items, "table-crimson").owned, false, "and nothing else");
});

test("you cannot buy what you cannot afford", async () => {
  const before = await ask(client(), "shop", { auth: poor }, "shop");
  const r = await ask(client(), "buy", { auth: poor, id: "table-crimson" }, "buyResult");
  assert.equal(r.ok, false);
  assert.equal(r.why, "poor");
  assert.equal(r.coins, before.coins, "and nothing was taken");
  const after = await ask(client(), "shop", { auth: poor }, "shop");
  assert.equal(find(after.items, "table-crimson").owned, false);
});

test("buying takes the price, hands it over, and puts it on", async () => {
  const before = await ask(client(), "shop", { auth: rich }, "shop");
  const item = P.shopById["table-crimson"];
  const r = await ask(client(), "buy", { auth: rich, id: "table-crimson" }, "buyResult");
  assert.equal(r.ok, true);
  assert.equal(r.coins, before.coins - item.price, "the price, exactly");
  assert.equal(r.gems, before.gems, "and gems were not touched");
  assert.equal(find(r.items, "table-crimson").owned, true);
  assert.equal(r.equipped.table, "table-crimson", "worn straight away");
});

test("gems and coins are separate purses", async () => {
  const before = await ask(client(), "shop", { auth: rich }, "shop");
  const item = P.shopById["tiles-obsidian"];
  assert.equal(item.currency, "gems");
  const r = await ask(client(), "buy", { auth: rich, id: "tiles-obsidian" }, "buyResult");
  assert.equal(r.ok, true);
  assert.equal(r.gems, before.gems - item.price, "paid in gems");
  assert.equal(r.coins, before.coins, "coins untouched");
});

test("the same thing cannot be bought twice", async () => {
  const before = await ask(client(), "shop", { auth: rich }, "shop");
  const r = await ask(client(), "buy", { auth: rich, id: "table-crimson" }, "buyResult");
  assert.equal(r.ok, false);
  assert.equal(r.why, "owned");
  assert.equal(r.coins, before.coins, "and charged nothing for it");
});

test("you cannot wear what you do not own, or buy what does not exist", async () => {
  const notOwned = await ask(client(), "equip", { auth: poor, id: "table-night" }, "buyResult");
  assert.equal(notOwned.ok, false);
  const nonsense = await ask(client(), "buy", { auth: rich, id: "table-of-gold" }, "buyResult");
  assert.equal(nonsense.ok, false);
  assert.equal(nonsense.why, "no-such-item");
  assert.equal(srv.exited, null, "and neither upset the server");
});

test("a look that is no longer owned quietly falls back to the free one", () => {
  const p = { owned: {}, equipped: { table: "table-night", tiles: "tiles-obsidian" }, xp: 0 };
  const worn = P.equipped(p);
  assert.deepEqual(worn, P.DEFAULT_LOOK, "an unowned choice never sticks");
  const junk = P.equipped({ owned: {}, equipped: { table: "made-up" }, xp: 0 });
  assert.equal(junk.table, P.DEFAULT_LOOK.table, "nor does one that does not exist");
});

test("what was bought is still there after a restart", async () => {
  const before = await ask(client(), "shop", { auth: rich }, "shop");
  srv.kill();
  for (let i = 0; i < 40 && srv.exited === null; i++) await wait(100);
  clients.forEach((c) => c.close());

  srv = spawn(process.execPath, ["server.js"], {
    cwd: CWD, env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, GOOGLE_CLIENT_ID: "" },
  });
  srv.log = ""; srv.exited = null;
  srv.stdout.on("data", (d) => { srv.log += d; });
  srv.on("exit", (c, s) => { srv.exited = `code=${c} signal=${s}`; });
  for (let i = 0; i < 80 && !srv.log.includes("running"); i++) await wait(150);

  const after = await ask(client(), "shop", { auth: rich }, "shop");
  assert.equal(after.coins, before.coins, "the same purse");
  assert.equal(after.gems, before.gems);
  assert.equal(find(after.items, "table-crimson").owned, true, "and still owns what it paid for");
  assert.deepEqual(after.equipped, before.equipped, "still wearing it");
});
