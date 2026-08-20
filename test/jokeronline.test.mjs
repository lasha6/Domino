/* =====================================================================
   ჯოკერი online.

   Four real clients against the real server, the way four phones would be. The
   rules are the engine's and have their own tests; what matters here is that
   the SERVER is the one enforcing them and that nobody is ever sent a card
   they should not see.
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
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const J = require("../public/js/joker.js");

const CWD = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3993;
const ADDR = `http://127.0.0.1:${PORT}`;
let dir, srv;
const clients = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-jokeronline-"));
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
const until = async (fn, ms = 20000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(70);
  return fn();
};

async function table() {
  const tag = "jk" + (n++);
  const names = ["ერთი", "ორი", "სამი", "ოთხი"];
  const cs = names.map((name, i) => {
    const c = client();
    c.emit("quickJoin", { game: "joker", name, auth: { kind: "guest", id: tag + i } });
    return c;
  });
  assert.ok(await until(() => cs.every((c) => c.last && c.last.hand)), "all four were dealt");
  cs.sort((x, y) => x.last.seat - y.last.seat);
  return cs;
}

/* Play whatever the game is waiting for, from whichever client owes it, until
   the condition is met. The engine picks the move; the point is the round trip
   through the server, not the cleverness. */
async function drive(cs, done, limit = 400) {
  for (let i = 0; i < limit && !done(); i++) {
    const who = cs.find((c) => c.last && c.last.myTurn);
    if (!who) { await wait(70); continue; }
    const st = who.last;
    if (st.stage === "choose") who.emit("jChoose", { trump: 1 });
    else if (st.stage === "bid") {
      // any bid that is allowed
      for (let b = 0; b <= st.cards; b++) if (b !== st.forbidden) { who.emit("jBid", { n: b }); break; }
    } else if (st.stage === "play") {
      const card = st.legal[0];
      const opts = J.isJoker(card) ? (st.trick.length ? { high: true } : { suit: 0, high: true }) : {};
      who.emit("jPlay", Object.assign({ card }, opts));
    }
    await until(() => !who.last.myTurn || done(), 3000);
  }
  return done();
}

test("four are seated and the first hand is one card each", async () => {
  const cs = await table();
  assert.deepEqual(cs.map((c) => c.last.seat), [0, 1, 2, 3]);
  cs.forEach((c) => assert.equal(c.last.hand.length, 1, "the first hand is one card"));
  assert.equal(cs[0].last.handNo, 1);
  assert.equal(cs[0].last.handsInMatch, 24);
  assert.equal(cs[0].last.set, 1);
  assert.ok(cs[0].last.turned, "a card was turned for trump");
  assert.equal(cs.filter((c) => c.last.myTurn).length, 1, "one player is asked to bid");
  assert.equal(cs[0].last.stage, "bid");
});

test("everyone is told who sits where, and nobody is sent another hand", async () => {
  const cs = await table();
  const me = cs[1];
  const t = me.last.table;
  assert.deepEqual(t.map((x) => x.rel), ["me", "left", "across", "right"]);
  assert.deepEqual(t.map((x) => x.seat), [1, 2, 3, 0]);
  t.forEach((x) => assert.equal(x.cards, 1, "everyone holds one"));
  for (const c of cs) {
    const body = JSON.stringify(c.last);
    assert.ok(!("hands" in c.last), "no hands array");
    assert.ok(!/"deck"/.test(body), "and no pack to read");
    assert.equal(c.last.hand.length, 1, "only their own card");
  }
});

test("the dealer is refused the bid that would make the numbers add up", async () => {
  const cs = await table();
  // three of them bid; the fourth is the dealer and is told what is forbidden
  let bidders = 0;
  while (bidders < 3) {
    const who = cs.find((c) => c.last.myTurn && c.last.stage === "bid");
    assert.ok(who, "somebody is on bid");
    who.emit("jBid", { n: 0 });
    assert.ok(await until(() => !who.last.myTurn), "the bid was taken");
    bidders++;
  }
  const dealer = cs.find((c) => c.last.myTurn && c.last.stage === "bid");
  assert.ok(dealer, "the dealer bids last");
  assert.equal(dealer.last.forbidden, 1, "three noughts, so one is forbidden");
  dealer.emit("jBid", { n: 1 });
  await wait(500);
  assert.equal(dealer.last.stage, "bid", "and refused");
  dealer.emit("jBid", { n: 0 });
  assert.ok(await until(() => dealer.last.stage === "play"), "anything else is taken");
});

test("the server refuses a move from the wrong chair, and a card nobody holds", async () => {
  const cs = await table();
  const notYet = cs.find((c) => !c.last.myTurn);
  notYet.emit("jBid", { n: 0 });
  await wait(400);
  assert.ok(notYet.last.bids[notYet.last.seat] == null, "bidding out of turn changed nothing");

  // get to play
  assert.ok(await drive(cs, () => cs[0].last.stage === "play"), "bidding finished");
  const player = cs.find((c) => c.last.myTurn);
  const bystander = cs.find((c) => !c.last.myTurn);
  bystander.emit("jPlay", { card: bystander.last.hand[0] });
  await wait(400);
  assert.equal(player.last.trick.length, 0, "playing out of turn changed nothing");
  player.emit("jPlay", { card: [9, 9] });
  await wait(400);
  assert.equal(player.last.trick.length, 0, "and neither did a card that does not exist");
});

test("a whole hand is played, the trick goes round, and everyone is scored", async () => {
  const cs = await table();
  assert.ok(await drive(cs, () => !!cs[0].last.reveal), "the hand finished");
  const r = cs[0].last.reveal;
  assert.equal(r.took.reduce((a, b) => a + b, 0), 1, "one trick in a hand of one");
  for (let p = 0; p < 4; p++)
    assert.equal(r.points[p], J.handScore(r.bids[p], r.took[p], r.size, r.set),
      `seat ${p} was scored by the rule`);
  assert.ok(await until(() => cs[0].last.handNo === 2, 8000), "and the next hand is dealt");
  cs.forEach((c) => assert.equal(c.last.hand.length, 2, "two cards this time"));
});

test("a friend table is made with a code and filled by three more", async () => {
  const tag = "jkf" + (n++);
  const host = client();
  let code = null;
  host.on("state", (st) => { if (st.code) code = st.code; });
  host.emit("createTable", { game: "joker", name: "მასპინძელი",
                             auth: { kind: "guest", id: tag + "h" } });
  assert.ok(await until(() => code), "the host was given a code");

  const guests = ["ორი", "სამი", "ოთხი"].map((name, i) => {
    const c = client();
    c.emit("joinTable", { code, name, auth: { kind: "guest", id: tag + i } });
    return c;
  });
  const all = [host, ...guests];
  assert.ok(await until(() => all.every((c) => c.last && c.last.hand)), "all four were dealt");
  all.forEach((c) => {
    assert.equal(c.last.size, 4, "a joker table is always four");
    assert.equal(c.last.game, "joker");
    assert.equal(c.last.hand.length, 1);
  });
  assert.deepEqual(all.map((c) => c.last.seat).sort(), [0, 1, 2, 3], "one to a chair");
});

test("a ჯოკერი table and a ბურა table are never the same table", async () => {
  const tag = "jkm" + (n++);
  const a = client(), b = client();
  a.emit("quickJoin", { game: "joker", name: "ჯოკერი", auth: { kind: "guest", id: tag + "a" } });
  b.emit("quickJoin", { game: "bura", variant: "5", target: 11, name: "ბურა",
                        auth: { kind: "guest", id: tag + "b" } });
  await wait(900);
  assert.notEqual(a.last.roomId, b.last.roomId, "different games, different tables");
  assert.equal(a.last.game, "joker");
  assert.equal(b.last.game, "bura");
  // neither of them filled a table; left open they would be paired with the
  // next test's players instead of with its own
  a.close(); b.close();
  await wait(200);
});

test("nonsense at the ჯოკერი handlers cannot bring the server down", async () => {
  const cs = await table();
  const JUNK = [undefined, null, 0, "", "x", [], {}, { n: -1 }, { n: 99 }, { n: 1.5 },
                { card: null }, { card: "x" }, { card: [99, 99] }, { card: [[0, 0]] },
                { card: [4, 0] }, { card: [4, 0], suit: 9 }, { trump: 9 }, { trump: "bez" },
                { card: [0, 0], high: "yes", suit: -1 }];
  for (const junk of JUNK)
    for (const ev of ["jChoose", "jBid", "jPlay"])
      cs.forEach((c) => c.emit(ev, junk));
  await wait(1200);
  assert.equal(srv.exited, null, `the server is still up: ${srv.log.slice(-400)}`);
  cs.forEach((c) => {
    assert.ok(Array.isArray(c.last.hand));
    assert.ok(c.last.hand.length <= 1, "nobody was handed extra cards");
    assert.ok(["play", "roundEnd", "over"].includes(c.last.phase), c.last.phase);
  });
});
