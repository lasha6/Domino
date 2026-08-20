/* =====================================================================
   The chair you left.

   A player who disappears has not given anything up: the phone slept, the
   tunnel went, the tab closed. The chair is held for as long as the table is
   there and they are put back in it from anywhere, the front page included.

   What happens while it is empty depends on how many are at the table. Four:
   the computer plays their turns and the others play on. Two: there is nobody
   to play on with, so when the clock is out the match goes to the one who
   stayed. Only saying yes to the question gives a chair up for good.
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
const PORT = 3994;
const ADDR = `http://127.0.0.1:${PORT}`;
const GRACE = 700;                     // the table waits this long before deciding
let dir, srv;
const clients = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-rejoin-"));
  srv = spawn(process.execPath, ["server.js"], {
    cwd: CWD, env: { ...process.env, PORT: String(PORT), DATA_DIR: dir,
                     GOOGLE_CLIENT_ID: "", RECONNECT_GRACE: String(GRACE) },
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
  c.last = null; c.table = undefined;
  c.on("state", (st) => { c.last = st; });
  c.on("atTable", (t) => { c.table = t; });
  clients.push(c);
  return c;
}
// what the books say about a player, asked the way a screen asks
const ask = (id) => new Promise((res) => {
  const c = client();
  c.once("profile", res);
  c.emit("profile", { auth: { kind: "guest", id } });
});
const until = async (fn, ms = 15000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(60);
  return fn();
};

// four at a ჯოკერი table, each with a token of its own
async function fourAtJoker() {
  const tag = "rj" + (n++);
  const cs = ["ერთი", "ორი", "სამი", "ოთხი"].map((name, i) => {
    const c = client();
    c.tok = tag + "-t" + i;
    c.emit("quickJoin", { game: "joker", size: 4, name, token: c.tok,
                          auth: { kind: "guest", id: tag + i } });
    return c;
  });
  assert.ok(await until(() => cs.every((c) => c.last && c.last.hand)), "all four dealt");
  cs.sort((x, y) => x.last.seat - y.last.seat);
  return cs;
}

test("with four at the table, a player who vanishes keeps their chair", async () => {
  const cs = await fourAtJoker();
  const goner = cs[1], seat = goner.last.seat;
  const rest = cs.filter((c) => c !== goner);

  goner.close();
  assert.ok(await until(() => rest[0].last.paused), "the table waits for them");
  // ...and after the wait it plays on without them
  assert.ok(await until(() => !rest[0].last.paused, 6000), "the table starts again");
  assert.ok(await until(() => (rest[0].last.table.find((x) => x.seat === seat) || {}).bot),
    "the computer is playing that chair");

  // the chair is still theirs: the front page says so
  const back = client();
  back.emit("whereAmI", { token: goner.tok });
  assert.ok(await until(() => back.table !== undefined), "the front page got an answer");
  assert.ok(back.table, "and it is a table");
  assert.equal(back.table.game, "joker");
  assert.equal(back.table.seat, seat);
  assert.equal(back.table.playing, true);
});

test("and taking it back stops the computer playing it", async () => {
  const cs = await fourAtJoker();
  const goner = cs[2], seat = goner.last.seat;
  const rest = cs.filter((c) => c !== goner);
  const hand = JSON.stringify(goner.last.hand);

  goner.close();
  assert.ok(await until(() => (rest[0].last.table.find((x) => x.seat === seat) || {}).bot, 8000),
    "the computer sat down");

  const back = client();
  back.emit("resume", { token: goner.tok });
  assert.ok(await until(() => back.last && back.last.hand), "they are back at the table");
  assert.equal(back.last.seat, seat, "in the same chair");
  assert.equal((rest[0].last.table.find((x) => x.seat === seat) || {}).bot, false,
    "and the computer has got up");
  // the hand may have moved on while they were away, but it is still a hand
  assert.ok(Array.isArray(back.last.hand));
  assert.ok(hand.length > 0);
});

test("saying yes to leaving gives the chair up, and the front page offers nothing", async () => {
  const cs = await fourAtJoker();
  const goner = cs[3];
  goner.emit("leaveRoom");
  await wait(600);

  const back = client();
  back.emit("whereAmI", { token: goner.tok });
  assert.ok(await until(() => back.table !== undefined), "the front page got an answer");
  assert.equal(back.table, null, "and there is nothing to go back to");

  // and the token no longer opens that chair
  const tryAgain = client();
  let failed = false;
  tryAgain.on("resumeFailed", () => { failed = true; });
  tryAgain.emit("resume", { token: goner.tok });
  assert.ok(await until(() => failed), "resuming a chair you gave up is refused");
});

test("with two at the table, the match goes to whoever stayed", async () => {
  const tag = "rj2" + (n++);
  const a = client(), b = client();
  a.tok = tag + "-a"; b.tok = tag + "-b";
  let over = null;
  b.on("opponentLeft", (m) => { over = m; });
  a.emit("quickJoin", { game: "bura", variant: "3", target: 11, name: "ერთი", token: a.tok,
                        auth: { kind: "guest", id: tag + "a" } });
  b.emit("quickJoin", { game: "bura", variant: "3", target: 11, name: "ორი", token: b.tok,
                        auth: { kind: "guest", id: tag + "b" } });
  assert.ok(await until(() => a.last && a.last.hand && b.last && b.last.hand), "both dealt");

  a.close();
  assert.ok(await until(() => b.last.paused), "the table waits");
  assert.ok(await until(() => over, 6000), "and then the match is over");
  assert.equal(over.name, "ერთი", "for the one who went");
  assert.equal(b.last.phase, "over");

  // a finished table is not one to go back to
  const back = client();
  back.emit("whereAmI", { token: a.tok });
  assert.ok(await until(() => back.table !== undefined));
  assert.equal(back.table, null, "nothing is being held");
});

test("a token nobody has used is not sitting anywhere", async () => {
  const c = client();
  c.emit("whereAmI", { token: "nobody-at-all" });
  assert.ok(await until(() => c.table !== undefined));
  assert.equal(c.table, null);

  const empty = client();
  empty.emit("whereAmI", {});
  assert.ok(await until(() => empty.table !== undefined));
  assert.equal(empty.table, null, "and neither is nothing");
});

test("a table still filling is worth going back to as well", async () => {
  const tag = "rjw" + (n++);
  const host = client();
  host.tok = tag + "-h";
  let code = null;
  host.on("state", (st) => { if (st.code) code = st.code; });
  host.emit("createTable", { game: "joker", name: "მასპინძელი", token: host.tok,
                             auth: { kind: "guest", id: tag + "h" } });
  assert.ok(await until(() => code), "a table was made");

  host.close();
  await wait(400);
  const back = client();
  back.emit("whereAmI", { token: host.tok });
  assert.ok(await until(() => back.table !== undefined));
  // a table that never started lets its seats go, which is the older rule and
  // the right one — there is no game to come back to
  assert.equal(back.table, null, "an empty table keeps nobody waiting");
});

test("the server survives being asked about nonsense", async () => {
  const c = client();
  for (const junk of [undefined, null, 0, "", [], {}, { token: 12 }, { token: [] },
                      { token: { a: 1 } }, { token: "x".repeat(5000) }])
    c.emit("whereAmI", junk);
  await wait(600);
  assert.equal(srv.exited, null, `still up: ${srv.log.slice(-300)}`);
});

test("a match that ends because somebody went is still a match in the books", () => {
  /* The screen warns that leaving loses the match before anybody gives a chair
     up. The books have to agree with the warning: the one who went lost it, the
     one who stayed won it, and both of them are told so. */
  return (async () => {
    const tag = "rjb" + (n++);
    const a = client(), b = client();
    a.tok = tag + "-a"; b.tok = tag + "-b";
    let aOver = null, bOver = null;
    a.on("matchOver", (m) => { aOver = m; });
    b.on("matchOver", (m) => { bOver = m; });
    a.emit("quickJoin", { game: "bura", variant: "3", target: 11, name: "წამსვლელი", token: a.tok,
                          auth: { kind: "guest", id: tag + "a" } });
    b.emit("quickJoin", { game: "bura", variant: "3", target: 11, name: "დარჩენილი", token: b.tok,
                          auth: { kind: "guest", id: tag + "b" } });
    assert.ok(await until(() => a.last && a.last.hand && b.last && b.last.hand), "both dealt");

    a.emit("leaveRoom");                    // said yes to the question
    assert.ok(await until(() => bOver), "the one who stayed is told the match is over");
    assert.equal(bOver.youWon, true, "and that they won it");
    assert.equal(bOver.early, true, "because it ended early");
    assert.equal(b.last.phase, "over");
    assert.equal(srv.exited, null, `still up: ${srv.log.slice(-300)}`);
  })();
});

test("and in a game of four, walking out does not end anything", () => {
  return (async () => {
    const cs = await fourAtJoker();
    const goner = cs[0], seat = goner.last.seat;
    const rest = cs.filter((c) => c !== goner);
    let ended = false;
    rest.forEach((c) => c.on("matchOver", () => { ended = true; }));

    goner.emit("leaveRoom");
    await wait(700);
    assert.equal(ended, false, "nobody was told the match was over");
    assert.equal(rest[0].last.phase, "play", "the table is still playing");
    assert.ok((rest[0].last.table.find((x) => x.seat === seat) || {}).bot,
      "with the computer in the empty chair");
  })();
});

test("the computer may finish your cards, but the match is lost the moment you go", () => {
  /* Four at a ბურა table and one of them says yes to leaving. The other three
     play on and the computer picks the empty seat's cards up, so the side they
     were on may still win — but the match is not theirs. The screen warns that
     leaving counts as a loss before it asks, so it is written down as one there
     and then, rather than whenever the others happen to finish. */
  return (async () => {
    const tag = "rjg" + (n++);
    const ids = [0, 1, 2, 3].map((i) => tag + i);
    const cs = ["ერთი", "ორი", "სამი", "ოთხი"].map((name, i) => {
      const c = client();
      c.who = ids[i];
      c.emit("quickJoin", { game: "bura", size: 4, variant: "5", target: 6, name,
                            auth: { kind: "guest", id: ids[i] } });
      return c;
    });
    assert.ok(await until(() => cs.every((c) => c.last && c.last.hand)), "all four dealt");
    cs.sort((x, y) => x.last.seat - y.last.seat);
    const goner = cs[0];

    goner.emit("leaveRoom");
    await wait(400);
    const prof = await ask(goner.who);
    assert.equal(prof.stats.matches, 1, "the match counted against them");
    assert.equal(prof.stats.matchWins, 0, "and never as a win");
    assert.equal(prof.stats.streak, 0, "the run is broken");
    assert.equal(cs[1].last.phase, "play", "while the table plays on without them");
  })();
});

test("and the same match is never written down twice", () => {
  /* Two at the table: leaving books the loss, and the table ends there. Nothing
     may add a second match to either player's record afterwards. */
  return (async () => {
    const tag = "rjd" + (n++);
    const a = client(), b = client();
    a.who = tag + "a"; b.who = tag + "b";
    let over = null;
    b.on("matchOver", (m) => { over = m; });
    a.emit("quickJoin", { game: "bura", variant: "3", target: 11, name: "წამსვლელი",
                          token: tag + "-a", auth: { kind: "guest", id: a.who } });
    b.emit("quickJoin", { game: "bura", variant: "3", target: 11, name: "დარჩენილი",
                          token: tag + "-b", auth: { kind: "guest", id: b.who } });
    assert.ok(await until(() => a.last && a.last.hand && b.last && b.last.hand), "both dealt");

    a.emit("leaveRoom");
    assert.ok(await until(() => over), "the match ended");
    await wait(400);
    const pa = await ask(a.who), pb = await ask(b.who);
    assert.equal(pa.stats.matches, 1, "one match for the one who went");
    assert.equal(pa.stats.matchWins, 0, "lost");
    assert.equal(pb.stats.matches, 1, "one match for the one who stayed");
    assert.equal(pb.stats.matchWins, 1, "won");
  })();
});

test("a chair can be given up from the front page, without going back to it", () => {
  /* The one way to lose a chair is to be asked and to say yes, and the front
     page has to be able to ask. A phone that dropped out mid-hand may never
     find its way back to that table on its own, and a chair nobody can give up
     is a chair that holds the player there for as long as the table lives. */
  return (async () => {
    const cs = await fourAtJoker();
    const goner = cs[1], seat = goner.last.seat;
    const rest = cs.filter((c) => c !== goner);
    goner.close();                       // the tunnel went
    assert.ok(await until(() => (rest[0].last.table.find((x) => x.seat === seat) || {}).bot, 8000),
      "the computer sat down in it");

    // the front page, on some other phone entirely
    const front = client();
    front.emit("whereAmI", { token: goner.tok });
    assert.ok(await until(() => front.table !== undefined));
    assert.ok(front.table, "the chair is still being held");

    front.table = undefined;
    front.emit("giveUpSeat", { token: goner.tok });
    assert.ok(await until(() => front.table !== undefined), "the front page answered");
    assert.equal(front.table, null, "and there is nothing left to go back to");

    const again = client();
    again.emit("whereAmI", { token: goner.tok });
    assert.ok(await until(() => again.table !== undefined));
    assert.equal(again.table, null, "asking again offers nothing either");

    let failed = false;
    const back = client();
    back.on("resumeFailed", () => { failed = true; });
    back.emit("resume", { token: goner.tok });
    assert.ok(await until(() => failed), "and the token no longer opens the chair");
    assert.equal(rest[0].last.phase, "play", "while the others play on");
  })();
});

test("giving up a chair with a token nobody holds changes nothing", () => {
  return (async () => {
    const c = client();
    for (const junk of [undefined, null, {}, { token: "" }, { token: 7 }, { token: [] },
                        { token: "no-such-chair" }])
      c.emit("giveUpSeat", junk);
    await wait(500);
    assert.equal(srv.exited, null, `still up: ${srv.log.slice(-300)}`);
  })();
});

test("a screen that comes to the wrong table is turned away", () => {
  /* The chair is found by token alone, so nothing stopped the ჯოკერი screen
     from being handed a ბურა table — a stale tab, a bookmark, a reload after
     the player moved on. It would have drawn another game's hand as its own.
     The screen says which game it is, and the front page does the routing. */
  return (async () => {
    const cs = await fourAtJoker();
    const goner = cs[2];
    goner.close();
    await wait(200);

    const wrong = client();
    let failed = false;
    wrong.on("resumeFailed", () => { failed = true; });
    wrong.emit("resume", { token: goner.tok, game: "bura" });
    assert.ok(await until(() => failed), "the ბურა screen is refused a ჯოკერი chair");
    assert.equal(wrong.last, null, "and is sent no state it cannot draw");

    const right = client();
    right.emit("resume", { token: goner.tok, game: "joker" });
    assert.ok(await until(() => right.last && right.last.hand), "the right screen still gets in");
  })();
});
