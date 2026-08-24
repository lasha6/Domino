/* =====================================================================
   ნარდი and დამკა online.

   Two people at a board, and a server that is the one which decides. The
   things worth pinning are the ones a client could otherwise get away with:
   throwing its own dice until it liked the answer, moving out of turn, moving
   a checker that is not its own, or playing a die it was never given.

   The dice are thrown by the server. That is not a detail — it is the whole
   difference between a game and an honour system.
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
const N = createRequire(import.meta.url)("../public/js/nardi.js");

const CWD = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3989;
const ADDR = `http://127.0.0.1:${PORT}`;
let dir, srv;
const clients = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-board-"));
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
  c.last = null; c.over = null; c.code = null;
  c.on("state", (st) => { c.last = st; if (st.code) c.code = st.code; });
  c.on("matchOver", (m) => { c.over = m; });
  clients.push(c);
  return c;
}
const until = async (fn, ms = 15000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(50);
  return fn();
};

async function boardTable(game, extra = {}) {
  const tag = game + (n++);
  const cs = ["ერთი", "ორი"].map((name, i) => {
    const c = client();
    c.tok = tag + "-t" + i;
    c.emit("quickJoin", Object.assign({ game, size: 2, name, token: c.tok,
      auth: { kind: "guest", id: tag + i } }, extra));
    return c;
  });
  assert.ok(await until(() => cs.every((c) => c.last && c.last.phase === "play")),
    `both were dealt into ${game}`);
  cs.sort((a, b) => a.last.seat - b.last.seat);
  if (game === "nardi") await openingThrow(cs);
  return cs;
}

/* A ნარდი match opens with one die each and the higher one starts, so every
   test below needs that done before there is a turn to take. A tie wipes both
   dice and they throw again, which is why this is a loop: the real screen does
   exactly the same thing when the server hands it back an empty pair. */
async function openingThrow(cs) {
  /* Settled means settled for EVERYONE. Returning as soon as one client has
     seen the match start leaves the other still holding the ceremony, and a
     test that then asks "whose turn is it" reads a stale answer — which is a
     coin flip now that the opener is decided by dice rather than always being
     seat zero. */
  const settled = () => cs.every((c) => c.last && c.last.nphase !== "opening");
  for (let tries = 0; tries < 20; tries++) {
    if (settled()) return true;
    /* Both are asked every time round, with no guard on what this client last
       heard: the server refuses a second die from a seat that already has one,
       so an extra ask costs nothing, while a guard reading a state that has not
       caught up yet can leave a die nobody ever throws.

       A timeout here is not a failure either — it means go round again. Only
       running out of tries is. */
    const tied = cs[0].last.openingTied;
    cs.forEach((c) => c.emit("nOpen"));
    await until(() => settled() || (!tied && cs[0].last.openingTied), 3000);
  }
  assert.fail("the opening throw never settled");
}

/* ---------------- ნარდი ---------------- */

test("two players are seated at a ნარდი board, each in their own chair", async () => {
  const [a, b] = await boardTable("nardi", { variant: "long", target: 3 });
  assert.equal(a.last.seat, 0);
  assert.equal(b.last.seat, 1);
  assert.equal(a.last.game, "nardi");
  assert.equal(a.last.variant, "long");
  // both see the same board, and it is the opening one
  assert.deepEqual(a.last.pts, b.last.pts, "one board, two views of it");
  assert.equal(a.last.pts[23], 15, "white's fifteen on their head");
  assert.equal(a.last.pts[11], -15, "and black's on theirs");
  assert.equal(a.last.oppName, "ორი");
  assert.equal(b.last.oppName, "ერთი");
});

test("the server throws the dice, and only for whoever is on roll", async () => {
  const cs = await boardTable("nardi", { variant: "long", target: 3 });
  const onRoll = cs.find((c) => c.last.side === c.last.seat);
  const other = cs.find((c) => c !== onRoll);
  assert.ok(onRoll, "somebody is on roll");
  assert.equal(onRoll.last.dice, null, "and nothing has been thrown yet");

  // the one who is NOT on roll cannot make dice appear
  other.emit("nRoll");
  await wait(400);
  assert.equal(onRoll.last.dice, null, "a player out of turn threw nothing");

  onRoll.emit("nRoll");
  assert.ok(await until(() => onRoll.last.dice), "the server threw them");
  const d = onRoll.last.dice;
  assert.equal(d.length, 2, "two dice");
  d.forEach((v) => assert.ok(v >= 1 && v <= 6, "a die is a die: " + v));
  assert.deepEqual(other.last.dice, d, "and both players see the same throw");
  assert.equal(onRoll.last.left.length, d[0] === d[1] ? 4 : 2,
    "a double is four moves, not two");
});

test("a move out of turn, or with a die nobody rolled, changes nothing", async () => {
  const cs = await boardTable("nardi", { variant: "long", target: 3 });
  const onRoll = cs.find((c) => c.last.side === c.last.seat);
  const other = cs.find((c) => c !== onRoll);
  onRoll.emit("nRoll");
  assert.ok(await until(() => onRoll.last.dice));
  const before = onRoll.last.pts.slice();

  other.emit("nMove", { from: 0, die: onRoll.last.dice[0] });     // not their turn
  onRoll.emit("nMove", { from: 0, die: 99 });                     // not a die
  onRoll.emit("nMove", { from: 7, die: onRoll.last.dice[0] });    // nothing there
  onRoll.emit("nMove", { from: "x", die: null });                 // nonsense
  await wait(500);
  assert.deepEqual(onRoll.last.pts, before, "the board did not move");
  assert.equal(srv.exited, null, `still up: ${srv.log.slice(-300)}`);
});

test("a legal move moves the board for both of them, and the turn ends when the player says", async () => {
  /* Nothing passes by itself any more. Spending the last die leaves the turn
     open so the player can look at it and take it back; the turn crosses the
     table on მზადაა and not before. */
  const cs = await boardTable("nardi", { variant: "long", target: 3 });
  const me = cs.find((c) => c.last.side === c.last.seat);
  const you = cs.find((c) => c !== me);
  me.emit("nRoll");
  assert.ok(await until(() => me.last.dice));

  // play the turn out, whatever it is: the head is the only place to start from
  let guard = 0;
  while (me.last.left.length && me.last.nphase === "move" && guard++ < 6) {
    const die = me.last.left[0];
    const before = JSON.stringify(me.last.pts);
    me.emit("nMove", { from: 0, die });
    const moved = await until(() => JSON.stringify(me.last.pts) !== before, 3000);
    if (!moved) break;
  }
  assert.ok(guard > 0, "something was played");
  assert.deepEqual(you.last.pts, me.last.pts, "the other player sees it too");

  await wait(600);
  assert.equal(me.last.side, me.last.seat,
    "the dice are spent and the turn is STILL his: it does not pass by itself");

  me.emit("nDone");
  assert.ok(await until(() => me.last.side !== me.last.seat, 4000),
    "and on Done it goes across the table");
});

test("a move can be taken back, right up until the turn is finished", async () => {
  const cs = await boardTable("nardi", { variant: "long", target: 3 });
  const me = cs.find((c) => c.last.side === c.last.seat);
  const you = cs.find((c) => c !== me);
  me.emit("nRoll");
  assert.ok(await until(() => me.last.dice));
  assert.equal(me.last.undo, 0, "nothing to take back before anything is done");

  const opening = JSON.stringify(me.last.pts);
  me.emit("nMove", { from: 0, die: me.last.left[0] });
  assert.ok(await until(() => JSON.stringify(me.last.pts) !== opening), "a checker moved");
  assert.equal(me.last.undo, 1, "and the board before it is kept");

  // the other player cannot reach into somebody else's turn
  you.emit("nUndo");
  await wait(400);
  assert.notEqual(JSON.stringify(me.last.pts), opening, "not his to undo");

  me.emit("nUndo");
  assert.ok(await until(() => JSON.stringify(me.last.pts) === opening),
    "his own comes back");
  assert.equal(me.last.undo, 0, "with nothing left behind it");
  assert.deepEqual(you.last.pts, me.last.pts, "and the other player sees that too");
  assert.equal(srv.exited, null, `still up: ${srv.log.slice(-300)}`);
});

test("a finished turn cannot be reached back into", async () => {
  /* Undo is a rubber, not a time machine. Once Done has been pressed the pile
     of boards is thrown away, or a player could rub out the move that let the
     other one hit him. */
  const cs = await boardTable("nardi", { variant: "long", target: 3 });
  const me = cs.find((c) => c.last.side === c.last.seat);
  me.emit("nRoll");
  assert.ok(await until(() => me.last.dice));
  me.emit("nMove", { from: 0, die: me.last.left[0] });
  assert.ok(await until(() => me.last.undo === 1));

  let guard = 0;
  while (me.last.left.length && me.last.nphase === "move" && guard++ < 6) {
    const before = JSON.stringify(me.last.pts);
    me.emit("nMove", { from: 0, die: me.last.left[0] });
    if (!(await until(() => JSON.stringify(me.last.pts) !== before, 2000))) break;
  }
  me.emit("nDone");
  assert.ok(await until(() => me.last.side !== me.last.seat, 4000), "the turn went across");
  const settled = JSON.stringify(me.last.pts);
  assert.equal(me.last.undo, 0, "and the pile went with it");

  me.emit("nUndo");
  await wait(400);
  assert.equal(JSON.stringify(me.last.pts), settled, "nothing came back");
});

test("a ნარდი table can be made with a code and joined with it", async () => {
  const tag = "nf" + (n++);
  const host = client();
  host.emit("createTable", { game: "nardi", variant: "short", target: 3, size: 2,
    name: "მასპინძელი", token: tag + "-h", auth: { kind: "guest", id: tag + "h" } });
  assert.ok(await until(() => host.code), "a code came back");
  assert.equal(host.code.length >= 4, true, "and it is something you can read out");

  const guest = client();
  guest.emit("joinTable", { code: host.code, name: "სტუმარი", token: tag + "-g",
    auth: { kind: "guest", id: tag + "g" } });
  assert.ok(await until(() => guest.last && guest.last.phase === "play"), "the guest sat down");
  assert.ok(await until(() => host.last && host.last.phase === "play"), "and the game began");
  assert.equal(guest.last.variant, "short", "at the table the host asked for");
  assert.equal(guest.last.pts[0], -2,
    "the backgammon opening, not the long one — two black on their 24-point");
});

test("the two ნარდი are not the same table", async () => {
  /* A quick match must not seat somebody who asked for the long game with
     somebody who asked for the short one. */
  const tag = "nv" + (n++);
  const long = client(), short = client();
  long.emit("quickJoin", { game: "nardi", variant: "long", target: 3, size: 2,
    name: "გრძელი", token: tag + "-l", auth: { kind: "guest", id: tag + "l" } });
  short.emit("quickJoin", { game: "nardi", variant: "short", target: 3, size: 2,
    name: "მოკლე", token: tag + "-s", auth: { kind: "guest", id: tag + "s" } });
  await wait(700);
  assert.notEqual(long.last && long.last.phase, "play", "neither was dealt in");
  assert.notEqual(short.last && short.last.phase, "play");
  /* And they leave. Two players left sitting in a waiting room are picked up
     by the NEXT test that asks for the same table, which is how a test that
     passes on its own fails in company. */
  long.close(); short.close();
  await wait(300);
});

/* ---------------- დამკა ---------------- */

test("two players are seated at a დამკა board", async () => {
  const [a, b] = await boardTable("damka");
  assert.equal(a.last.game, "damka");
  assert.deepEqual(a.last.counts, [12, 12]);
  assert.deepEqual(a.last.cells, b.last.cells, "one board, two views of it");
  assert.equal(a.last.side, 0, "white opens");
  assert.equal(a.last.myTurn, true);
  assert.equal(b.last.myTurn, false);
});

test("a დამკა move is checked before anything changes", async () => {
  const [a, b] = await boardTable("damka");
  const before = a.last.cells.slice();
  b.emit("dMove", { from: 40, to: 33 });        // not their turn
  a.emit("dMove", { from: 0, to: 63 });         // not a move
  a.emit("dMove", { from: null, to: undefined });
  await wait(500);
  assert.deepEqual(a.last.cells, before, "the board did not move");

  // and a legal one does
  a.emit("dMove", { from: 17, to: 24 });
  assert.ok(await until(() => a.last.cells[24] !== 0), "the piece moved");
  assert.equal(a.last.cells[17], 0, "and left where it was");
  assert.deepEqual(b.last.cells, a.last.cells, "both see it");
  assert.ok(await until(() => a.last.side === 1), "and the turn passed");
});

/* ---------------- the chair, and leaving it ---------------- */

test("a player who drops keeps their chair and the board waits", async () => {
  const [a, b] = await boardTable("nardi", { variant: "long", target: 3 });
  const seat = a.last.seat;
  a.close();
  assert.ok(await until(() => b.last.paused, 6000), "the board waits for them");

  const back = client();
  back.emit("resume", { token: a.tok, game: "nardi" });
  assert.ok(await until(() => back.last && back.last.pts), "they are back at the board");
  assert.equal(back.last.seat, seat, "in the same chair");
  assert.ok(await until(() => !b.last.paused, 4000), "and the game goes on");
});

test("a screen that comes to the wrong board is turned away", async () => {
  const [a] = await boardTable("damka");
  a.close();
  await wait(200);
  const wrong = client();
  let failed = false;
  wrong.on("resumeFailed", () => { failed = true; });
  wrong.emit("resume", { token: a.tok, game: "nardi" });
  assert.ok(await until(() => failed), "a ნარდი screen may not take a დამკა chair");
});

test("leaving a board is a loss, and it is written down at once", async () => {
  const tag = "nl" + (n++);
  const a = client(), b = client();
  a.who = tag + "a"; b.who = tag + "b";
  a.emit("quickJoin", { game: "nardi", variant: "long", target: 3, size: 2,
    name: "წამსვლელი", token: tag + "-a", auth: { kind: "guest", id: a.who } });
  b.emit("quickJoin", { game: "nardi", variant: "long", target: 3, size: 2,
    name: "დარჩენილი", token: tag + "-b", auth: { kind: "guest", id: b.who } });
  assert.ok(await until(() => a.last && a.last.pts && b.last && b.last.pts), "both dealt");

  a.emit("leaveRoom");
  assert.ok(await until(() => b.over), "the one who stayed is told");
  assert.equal(b.over.youWon, true, "and won it");

  const ask = (id) => new Promise((res) => {
    const c = client();
    c.once("profile", res);
    c.emit("profile", { auth: { kind: "guest", id } });
  });
  await wait(300);
  const pa = await ask(a.who);
  assert.equal(pa.stats.matches, 1, "the match counted against the one who left");
  assert.equal(pa.stats.matchWins, 0, "and never as a win");
});

test("the server survives being asked for nonsense at a board", async () => {
  const c = client();
  for (const junk of [undefined, null, 0, "", [], {}, { from: {} }, { die: [] },
                      { from: 1e9, die: 1e9 }, { from: -5, to: -5 }]) {
    c.emit("nRoll", junk);
    c.emit("nMove", junk);
    c.emit("dMove", junk);
  }
  await wait(600);
  assert.equal(srv.exited, null, `still up: ${srv.log.slice(-400)}`);
});

/* ---------------- the doubling cube ---------------- */

test("the cube is offered before the roll, and only by whoever may offer it", async () => {
  const cs = await boardTable("nardi", { variant: "long", target: 3 });
  const me = cs.find((c) => c.last.side === c.last.seat);
  const you = cs.find((c) => c !== me);
  assert.equal(me.last.stakeMul, 1, "a match starts at one stake");
  assert.equal(me.last.mayDouble, true, "the cube belongs to nobody, so he may offer");
  assert.equal(you.last.mayDouble, false, "and it is not the other player's turn");

  // the one who is not on roll cannot put the question
  you.emit("nDouble");
  await wait(400);
  assert.equal(me.last.offer, null, "no question was asked");

  me.emit("nDouble");
  assert.ok(await until(() => you.last.offer), "the question reached the other chair");
  assert.equal(you.last.offer.to, you.last.seat, "and it is his to answer");
  assert.equal(you.last.offer.value, 2, "for twice the stake");

  // and nothing moves while it stands
  me.emit("nRoll");
  await wait(400);
  assert.equal(me.last.dice, null, "the dice wait for an answer");
});

test("taking the double doubles the stake and passes the cube", async () => {
  const cs = await boardTable("nardi", { variant: "long", target: 3 });
  const me = cs.find((c) => c.last.side === c.last.seat);
  const you = cs.find((c) => c !== me);
  me.emit("nDouble");
  assert.ok(await until(() => you.last.offer));

  // it is not the offerer's answer to give
  me.emit("nDoubleAnswer", { take: true });
  await wait(300);
  assert.equal(me.last.stakeMul, 1, "he cannot accept his own offer");

  you.emit("nDoubleAnswer", { take: true });
  assert.ok(await until(() => me.last.stakeMul === 2), "the match is worth twice as much");
  assert.equal(you.last.stakeMul, 2, "and both of them are told so");
  assert.equal(me.last.offer, null, "the question is answered");
  assert.ok(await until(() => me.last.mayDouble === false, 2000),
    "the cube has crossed the table: he cannot double again");

  me.emit("nRoll");
  assert.ok(await until(() => me.last.dice), "and play carries on");
});

test("refusing the double gives the match up there and then", async () => {
  const cs = await boardTable("nardi", { variant: "long", target: 3 });
  const me = cs.find((c) => c.last.side === c.last.seat);
  const you = cs.find((c) => c !== me);
  me.emit("nDouble");
  assert.ok(await until(() => you.last.offer));

  you.emit("nDoubleAnswer", { take: false });
  assert.ok(await until(() => me.over && you.over), "the match is over for both of them");
  assert.equal(me.over.youWon, true, "the one who offered wins it");
  assert.equal(you.over.youWon, false, "the one who would not pay loses it");
  assert.equal(srv.exited, null, `still up: ${srv.log.slice(-300)}`);
});

test("dice that cannot be played are thrown away without being asked", async () => {
  /* The player's own words: with 5-1 you must not clear the dice, because
     nobody knows where he means to put the one. With a die the board will not
     take there is nothing to know — and making him press a button to agree
     that he is stuck is asking him to confirm a fact.

     This plays a real match out against a real server and watches for the one
     state that must never appear: his turn, dice still in his hand, and not a
     single legal move for them. */
  const cs = await boardTable("nardi", { variant: "short", target: 3 });
  const view = (st) => ({
    variant: st.variant, pts: st.pts.slice(), bar: st.bar.slice(), off: st.off.slice(),
    side: st.side, left: st.left.slice(), dice: st.dice, phase: st.nphase,
    moved: [], scores: st.scores.slice(), target: st.target, round: st.round,
  });

  let held = 0, plays = 0;
  for (let turn = 0; turn < 60; turn++) {
    const me = cs.find((c) => c.last && c.last.side === c.last.seat &&
                              c.last.phase === "play");
    if (!me) break;
    if (me.last.nphase === "roll") {
      me.emit("nRoll");
      if (!(await until(() => me.last.nphase === "move" || me.last.side !== me.last.seat, 4000))) break;
      continue;
    }
    /* Dice all spent is the ordinary end of a turn and he confirms it; the
       state under test is dice still IN HAND with nothing to do with them. */
    if (!me.last.left.length) {
      me.emit("nDone");
      if (!(await until(() => me.last.side !== me.last.seat, 4000))) break;
      continue;
    }
    const moves = N.legalMoves(view(me.last));
    if (!moves.length) { held++; break; }
    const m = moves[0];
    const before = JSON.stringify(me.last.pts) + "|" + me.last.left.join(",");
    me.emit("nMove", { from: m.from, die: m.die });
    plays++;
    if (!(await until(() => JSON.stringify(me.last.pts) + "|" + me.last.left.join(",") !== before ||
                            me.last.side !== me.last.seat, 4000))) break;

  }

  assert.ok(plays > 6, "a match was actually played: " + plays + " moves");
  assert.equal(held, 0,
    "a player was left holding dice the board would not take");
  assert.equal(srv.exited, null, `still up: ${srv.log.slice(-300)}`);
});
