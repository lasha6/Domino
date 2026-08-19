/* =====================================================================
   ბურა online.

   Two real clients against the real server, the way two phones would be. The
   rules themselves are already covered by the engine's own tests; what matters
   here is that the SERVER is the one enforcing them, and that a player is
   never sent anything they should not see.
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
const PORT = 3988;
const ADDR = `http://127.0.0.1:${PORT}`;
let dir, srv;
const clients = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-buraonline-"));
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

let n = 0;
function client() {
  const c = io(ADDR, { transports: ["websocket"], forceNew: true });
  c.last = null;
  c.on("state", (st) => { c.last = st; });
  clients.push(c);
  return c;
}
const until = async (fn, ms = 15000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(80);
  return fn();
};

async function table(variant, target) {
  const tag = "bo" + (n++);
  const a = client(), b = client();
  a.emit("quickJoin", { game: "bura", variant, target, name: "ერთი", auth: { kind: "guest", id: tag + "a" } });
  b.emit("quickJoin", { game: "bura", variant, target, name: "ორი", auth: { kind: "guest", id: tag + "b" } });
  assert.ok(await until(() => a.last && a.last.hand && b.last && b.last.hand), "both were dealt");
  return { a, b };
}

test("two players are seated, dealt, and told the trump", async () => {
  const { a, b } = await table("5", 11);
  assert.equal(a.last.game, "bura");
  assert.equal(a.last.hand.length, 5);
  assert.equal(b.last.hand.length, 5);
  assert.equal(a.last.oppCount, 5, "and how many the other is holding");
  assert.ok(a.last.trump != null && a.last.trumpCard, "the turned trump is shown");
  assert.equal(a.last.deck, 26);
  assert.equal(a.last.myTurn !== b.last.myTurn, true, "exactly one of them is on lead");
});

test("the three-card game deals three from the short deck", async () => {
  const { a } = await table("3", 11);
  assert.equal(a.last.hand.length, 3);
  assert.equal(a.last.deck, 20 - 6);
  assert.ok(a.last.hand.every((c) => c[1] >= 4), "no sixes to nines in it");
});

test("a player is never sent the other hand, nor a count of taken points", async () => {
  const { a } = await table("5", 11);
  const body = JSON.stringify(a.last);
  assert.ok(!("hands" in a.last), "no hands array");
  assert.ok(!/"taken"/.test(body), "nothing about what has been taken");
  assert.ok(!/"points"/.test(body), "and no running count, which is the whole of the claim");
  assert.equal(typeof a.last.oppCount, "number", "only how many they hold");
});

test("the server refuses a lead out of turn, and cards nobody holds", async () => {
  const { a, b } = await table("5", 11);
  const waiter = a.last.myTurn ? b : a;
  waiter.emit("bLead", { cards: [waiter.last.hand[0]] });
  await wait(600);
  assert.equal(waiter.last.lead, null, "out of turn changed nothing");

  const leader = a.last.myTurn ? a : b;
  leader.emit("bLead", { cards: [[0, 0], [1, 1]] });
  await wait(600);
  assert.equal(leader.last.lead, null, "and neither did cards that are not theirs");
});

test("a lead and an answer settle the trick for both players", async () => {
  const { a, b } = await table("5", 11);
  const leader = a.last.myTurn ? a : b, other = leader === a ? b : a;
  const card = leader.last.hand[0];
  leader.emit("bLead", { cards: [card] });
  assert.ok(await until(() => other.last.lead && other.last.lead.cards.length === 1),
    "the other player sees what came down");
  assert.deepEqual(other.last.lead.cards[0], card, "and which card it was");

  other.emit("bAnswer", { cards: [other.last.hand[0]] });
  assert.ok(await until(() => a.last.lastTrick && b.last.lastTrick), "both are shown the finished trick");
  assert.equal(a.last.lastTrick.took, b.last.lastTrick.took, "and agree on who took it");
  assert.ok(await until(() => a.last.hand.length === 5 && b.last.hand.length === 5), "hands filled back up");
});

test("a call must be answered, and giving it up ends the round", async () => {
  const { a, b } = await table("5", 11);
  const leader = a.last.myTurn ? a : b, other = leader === a ? b : a;
  assert.ok(leader.last.canCall, "the player on lead may call");
  assert.equal(other.last.canCall, null, "the other may not");

  leader.emit("bCall");
  assert.ok(await until(() => other.last.bid && other.last.bid.pending), "the other side is asked");
  other.emit("bConcede");
  assert.ok(await until(() => a.last.phase === "roundEnd" || a.last.phase === "over"),
    "conceding ends the round at once");
  assert.ok(await until(() => a.last.scores[0] + a.last.scores[1] === 1),
    "and pays one, which is what it was worth before the call");
});

test("the claim is offered in the three-card game and not in the five", async () => {
  const five = await table("5", 11);
  const onLead5 = five.a.last.myTurn ? five.a : five.b;
  assert.equal(onLead5.last.canVar, false);

  const three = await table("3", 11);
  const onLead3 = three.a.last.myTurn ? three.a : three.b;
  assert.equal(onLead3.last.canVar, true);
});

test("a friend table is joined by its code", async () => {
  const host = client(), guest = client();
  let code = null;
  host.on("state", (st) => { if (st.code) code = st.code; });
  host.emit("createTable", { game: "bura", variant: "3", target: 6, name: "მასპინძელი",
                             auth: { kind: "guest", id: "bo-host" } });
  assert.ok(await until(() => code), "the host got a code");
  guest.emit("joinTable", { code, name: "სტუმარი", auth: { kind: "guest", id: "bo-guest" } });
  assert.ok(await until(() => host.last && host.last.hand && host.last.hand.length === 3),
    "and the three-card table started");
  assert.equal(host.last.target, 6, "at the length the host asked for");
});

test("domino tables and card tables never mix", async () => {
  const d = client(), bu = client();
  d.emit("quickJoin", { target: 175, size: 2, name: "დომინო", auth: { kind: "guest", id: "bo-d" } });
  bu.emit("quickJoin", { game: "bura", variant: "5", target: 11, name: "ბურა", auth: { kind: "guest", id: "bo-bu" } });
  await wait(1500);
  assert.ok(!d.last || !d.last.hand, "the domino player waits for a domino player");
  assert.ok(!bu.last || !bu.last.hand, "and the card player for a card player");
  assert.equal(srv.exited, null);
  // both are still sitting in their queues; leave them there and the next test
  // pairs with them instead of with each other
  d.close(); bu.close();
  await wait(400);
});

test("nonsense at the card handlers cannot bring the server down", async () => {
  const { a } = await table("5", 11);
  const junk = [undefined, null, 0, "", [], {}, { cards: null }, { cards: "x" },
                { cards: [[9, 9]] }, { cards: new Array(50).fill([0, 0]) }, { unturned: true }];
  for (const ev of ["bLead", "bAnswer", "bCall", "bAccept", "bConcede", "bVar"]) {
    for (const j of junk) a.emit(ev, j);
    a.emit(ev);
  }
  await wait(1500);
  assert.equal(srv.exited, null, `still up: ${srv.log.slice(-300)}`);
  assert.ok(a.last.hand.length > 0, "and the table is still there");
});
