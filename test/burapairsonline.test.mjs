/* =====================================================================
   ბურა in pairs, online.

   Four real clients against the real server, the way four phones would be.
   The rules are covered by the engine's own tests; what matters here is that
   the SERVER seats them correctly, walks the trick round the table, and never
   sends anyone a card they should not see.
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
const PORT = 3991;
const ADDR = `http://127.0.0.1:${PORT}`;
let dir, srv;
const clients = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-burapairs-"));
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
  while (!fn() && Date.now() - t0 < ms) await wait(80);
  return fn();
};

// four players who all asked for the same table
async function table(target = 11) {
  const tag = "bp" + (n++);
  const names = ["ერთი", "ორი", "სამი", "ოთხი"];
  const cs = names.map((name, i) => {
    const c = client();
    c.emit("quickJoin", { game: "bura", size: 4, variant: "5", target, name,
                          auth: { kind: "guest", id: tag + i } });
    return c;
  });
  assert.ok(await until(() => cs.every((c) => c.last && c.last.hand)), "all four were dealt");
  // in seat order, so the tests can talk about the table rather than about who
  // happened to connect first
  cs.sort((x, y) => x.last.seat - y.last.seat);
  return cs;
}
const onLead = (cs) => cs.find((c) => c.last.myTurn);

test("four are seated as two pairs and dealt five each", async () => {
  const cs = await table();
  assert.deepEqual(cs.map((c) => c.last.seat), [0, 1, 2, 3]);
  cs.forEach((c) => assert.equal(c.last.hand.length, 5, `seat ${c.last.seat} holds five`));
  assert.equal(cs[0].last.deck, 36 - 20, "sixteen left to draw");
  assert.deepEqual(cs.map((c) => c.last.myTeam), [0, 1, 0, 1], "partners sit across");
  assert.equal(cs.filter((c) => c.last.myTurn).length, 1, "exactly one is on lead");
});

test("each player is told who sits where, and holding how many", async () => {
  const cs = await table();
  const me = cs[1];                       // seat 1, so the table reads 1,2,3,0
  const t = me.last.table;
  assert.equal(t.length, 4);
  assert.deepEqual(t.map((x) => x.rel), ["me", "left", "across", "right"]);
  assert.deepEqual(t.map((x) => x.seat), [1, 2, 3, 0]);
  assert.equal(t[2].name, "ოთხი", "the player across is the partner");
  assert.equal(t[2].partner, true);
  assert.equal(t[1].partner, false, "the ones beside are not");
  assert.equal(t[3].partner, false);
  t.forEach((x) => assert.equal(x.cards, 5, "everyone is holding five"));
});

test("nobody is sent another hand, nor a count of what has been taken", async () => {
  const cs = await table();
  for (const c of cs) {
    const body = JSON.stringify(c.last);
    assert.ok(!("hands" in c.last), "no hands array");
    assert.ok(!/"taken"/.test(body), "nothing about what has been taken");
    assert.equal(c.last.hand.length, 5, "only their own five");
  }
});

test("the trick goes round the table and only the winner leads next", async () => {
  const cs = await table();
  const lead = onLead(cs);
  const seat = lead.last.seat;
  lead.emit("bLead", { cards: [lead.last.hand[0]] });
  assert.ok(await until(() => cs.every((c) => c.last.lead)), "everyone sees the lead");

  // the three others answer in clockwise order, one at a time
  for (let i = 1; i <= 3; i++) {
    const who = cs[(seat + i) % 4];
    assert.ok(await until(() => who.last.myTurn), `seat ${who.last.seat} is asked to answer`);
    // and nobody else may move while it is theirs
    cs.filter((c) => c !== who).forEach((c) =>
      assert.equal(c.last.myTurn, false, "only one player at a time"));
    who.emit("bAnswer", { cards: [who.last.hand[0]] });
    if (i < 3) assert.ok(await until(() => !who.last.myTurn), "the turn moves on");
  }

  assert.ok(await until(() => cs.every((c) => !c.last.lead)), "the trick is settled");
  const winners = cs.filter((c) => c.last.myTurn);
  assert.equal(winners.length, 1, "one player took it and leads next");
  const t = cs[0].last.lastTrick;
  assert.equal(t.answers.length, 3, "and the table kept all three answers");
  assert.equal(t.took, winners[0].last.seat, "credited to the player who took it");
  cs.forEach((c) => assert.equal(c.last.hand.length, 5, "everyone drew back up to five"));
});

test("a raise waits for BOTH of the other pair", async () => {
  const cs = await table();
  const lead = onLead(cs);
  const mine = lead.last.myTeam;
  lead.emit("bCall", {});
  assert.ok(await until(() => cs[0].last.bid && cs[0].last.bid.pending), "the call is on the table");
  assert.equal(cs[0].last.bid.pending.by, mine, "and it belongs to the side that made it");

  const others = cs.filter((c) => c.last.myTeam !== mine);
  assert.equal(others.length, 2);
  others[0].emit("bAccept", {});
  await wait(600);
  assert.ok(cs[0].last.bid.pending, "one yes is not enough");
  assert.equal(cs[0].last.bid.level, 0, "the price has not moved");

  others[1].emit("bAccept", {});
  assert.ok(await until(() => !cs[0].last.bid.pending), "both said yes, so it stands");
  assert.equal(cs[0].last.bid.level, 1);
  assert.equal(cs[0].last.worth, 2, "and the round is worth double");
});

test("either of the pair giving it up ends the round", async () => {
  const cs = await table();
  const lead = onLead(cs);
  const mine = lead.last.myTeam;
  lead.emit("bCall", {});
  assert.ok(await until(() => cs[0].last.bid && cs[0].last.bid.pending));
  const others = cs.filter((c) => c.last.myTeam !== mine);
  others[0].emit("bAccept", {});
  await wait(400);
  others[1].emit("bConcede", {});
  assert.ok(await until(() => cs[0].last.reveal), "the round ended there");
  assert.equal(cs[0].last.reveal.winner, mine, "for the side that called");
});

test("the server refuses a move from the wrong chair", async () => {
  const cs = await table();
  const lead = onLead(cs);
  const notYet = cs.find((c) => !c.last.myTurn);
  notYet.emit("bLead", { cards: [notYet.last.hand[0]] });
  await wait(600);
  assert.equal(cs[0].last.lead, null, "leading out of turn changed nothing");

  lead.emit("bLead", { cards: [lead.last.hand[0]] });
  assert.ok(await until(() => cs[0].last.lead), "the right player can");

  // the seat two round is the partner and must wait its turn
  const skipAhead = cs[(lead.last.seat + 2) % 4];
  skipAhead.emit("bAnswer", { cards: [skipAhead.last.hand[0]] });
  await wait(600);
  assert.equal(cs[0].last.lastTrick.answers.length, 0, "answering out of order changed nothing");
});

test("a whole round is played out and one side is credited", async () => {
  const cs = await table();
  let guard = 0;
  while (guard++ < 200) {
    const who = cs.find((c) => c.last.myTurn);
    if (!who) break;                                   // round over, or waiting
    if (!who.last.lead) who.emit("bLead", { cards: [who.last.hand[0]] });
    else who.emit("bAnswer", { cards: who.last.hand.slice(0, who.last.answerSize) });
    await until(() => !who.last.myTurn || who.last.reveal, 4000);
    if (cs[0].last.reveal) break;
  }
  assert.ok(await until(() => cs[0].last.reveal), "the round finished");
  const r = cs[0].last.reveal;
  assert.equal(r.points[0] + r.points[1], 120, `all 120 points went somewhere (${r.points})`);
  if (r.points[0] !== r.points[1])
    assert.equal(r.winner, r.points[0] > r.points[1] ? 0 : 1, "to the side that took more");
  else
    assert.equal(r.winner, null, "60 apiece is a draw");
  assert.equal(srv.exited, null, `the server is still up: ${srv.log.slice(-400)}`);
});

test("a 2v2 ბურა table is made with a code and filled by three friends", async () => {
  /* The lobby had only half of this: you could make a table and be given a
     code, but ბურა had nowhere to type a friend's code in. The screen sends
     nothing but the code — what is being played, for how many and to what score
     all belong to the table that was made — so this checks the server really
     does take them from the room rather than from whoever is joining. */
  const tag = "bpf" + (n++);
  const host = client();
  let code = null;
  host.on("state", (st) => { if (st.code) code = st.code; });
  host.emit("createTable", { game: "bura", size: 4, variant: "5", target: 21, name: "მასპინძელი",
                             auth: { kind: "guest", id: tag + "h" } });
  assert.ok(await until(() => code), "the host was given a code");
  assert.equal(code.length, 4, "four characters, as the box expects");

  const guests = ["ორი", "სამი", "ოთხი"].map((name, i) => {
    const c = client();
    // exactly what the code box sends: the code, and nothing about the table
    c.emit("joinTable", { code, name, auth: { kind: "guest", id: tag + i } });
    return c;
  });
  const all = [host, ...guests];
  assert.ok(await until(() => all.every((c) => c.last && c.last.hand)), "all four were dealt");

  all.forEach((c) => {
    assert.equal(c.last.size, 4, "the table the host made is the table they got");
    assert.equal(c.last.target, 21, "including how far it is played");
    assert.equal(c.last.hand.length, 5, "ხუთკარტა, which is the only pairs game");
    assert.equal(c.last.table.length, 4);
  });
  assert.deepEqual(all.map((c) => c.last.seat).sort(), [0, 1, 2, 3], "one to a chair");
  assert.equal(all.filter((c) => c.last.myTurn).length, 1, "and one of them is on lead");
});

test("a code that belongs to nobody is refused", async () => {
  const c = client();
  let err = null;
  c.on("joinError", (m) => { err = m; });
  c.emit("joinTable", { code: "ZZZZ", name: "მაწანწალა", auth: { kind: "guest", id: "bp-nobody" } });
  assert.ok(await until(() => err), "the server said so");
  assert.match(err, /ვერ მოიძებნა/);
});

test("a player who walks out of a 2v2 ბურა leaves their seat to the computer", async () => {
  /* Their partner keeps playing: the match is only over when a whole side has
     gone. The room already knew that rule — it was calling domino's turn-taker
     to carry on with it, which a ბურა table cannot use. */
  const tag = "bpq" + (n++);
  const cs = ["ერთი", "ორი", "სამი", "ოთხი"].map((name, i) => {
    const c = client();
    c.emit("quickJoin", { game: "bura", size: 4, variant: "5", target: 11, name,
                          auth: { kind: "guest", id: tag + i } });
    return c;
  });
  assert.ok(await until(() => cs.every((c) => c.last && c.last.hand)), "all four dealt");
  cs.sort((x, y) => x.last.seat - y.last.seat);

  // somebody presses back and means it
  const goner = cs[1];
  const gonerSeat = goner.last.seat;
  goner.emit("leaveRoom");
  const rest = cs.filter((c) => c !== goner);

  assert.ok(await until(() => rest.every((c) =>
    (c.last.table.find((x) => x.seat === gonerSeat) || {}).bot)), "the computer took the chair");
  rest.forEach((c) => assert.equal(c.last.paused, false, "and nobody is left waiting"));

  // and the hand goes on — whoever is on lead can still lead
  const lead = rest.find((c) => c.last.myTurn);
  if (lead) {
    lead.emit("bLead", { cards: [lead.last.hand[0]] });
    assert.ok(await until(() => rest.some((c) => c.last.lead)), "the lead lands");
  }
  assert.ok(await until(() => rest.some((c) => c.last.lastTrick || c.last.lead || c.last.reveal), 8000),
    "the table is playing rather than stuck");
  assert.equal(srv.exited, null, `the server is still up: ${srv.log.slice(-300)}`);
});
