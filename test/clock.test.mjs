/* =====================================================================
   The clock, in all five games.

   A player put it plainly: you might wait a month for the other one to play.
   The answer is two clocks — a short one per turn, and a bank behind it that
   has to last the whole match — and the point of these tests is that it is
   the SAME answer everywhere. Four of the five used to have a single
   countdown with the computer stepping in forever, which meant a player who
   walked away was never actually out and the table went on being theirs.

   One table per game, watched from the deal to the end. Three separate tables
   per game was the first way this was written, and it was both slower and
   worse: a dozen abandoned tables all timing out on the one server made later
   tests miss windows they would otherwise have caught with seconds to spare,
   and it looked exactly like a broken clock.
   ===================================================================== */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { io } from "socket.io-client";

const CWD = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3996;
const ADDR = `http://127.0.0.1:${PORT}`;

/* Small enough to sit through, and no smaller. Two things set the floor: the
   bank is reported in whole SECONDS, so a one-second bank cannot be seen going
   down — half of it left still rounds to one; and ჯოკერი has four players, so
   a seat only burns its bank on every fourth turn. */
const MOVE = 250, BANK = 2000, PENALTY = 1000;

let dir, srv;
const clients = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-clock-"));
  srv = spawn(process.execPath, ["server.js"], {
    cwd: CWD,
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, GOOGLE_CLIENT_ID: "",
           MOVE_TIME: String(MOVE), RESERVE_START: String(BANK),
           TIMEOUT_PENALTY: String(PENALTY),
           // a table left behind is gone in half a second, not in a minute and a half
           RECONNECT_GRACE: "500" },
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
  c.last = null; c.over = null; c.sawOvertime = false; c.lowBank = null;
  c.on("state", (st) => {
    c.last = st;
    /* Whether overtime was EVER seen, not whether it is showing right now:
       the window opens and closes on its own and a poll steps over it. */
    if (st.overtimeLeft != null) c.sawOvertime = true;
    const me = (st.roster || []).find((p) => p.me);
    if (me && me.bank != null)
      c.lowBank = Math.min(c.lowBank == null ? me.bank : c.lowBank, me.bank);
  });
  c.on("matchOver", (m) => { c.over = m; });
  clients.push(c);
  return c;
}
const until = async (fn, ms = 25000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(40);
  return fn();
};

/* A table of players who all do absolutely nothing, cleared away afterwards. */
async function idleTable(t, game, size, extra = {}) {
  const tag = game + "-" + (n++);
  const cs = [];
  for (let i = 0; i < size; i++) {
    const c = client();
    c.emit("quickJoin", Object.assign(
      { game, size, name: "მ" + i, token: tag + "-t" + i,
        auth: { kind: "guest", id: tag + "-" + i } }, extra));
    cs.push(c);
  }
  assert.ok(await until(() => cs.every((c) => c.last && c.last.phase !== "wait")),
    `${game}: the table never filled`);
  t.after(() => cs.forEach((c) => { try { c.emit("leaveRoom"); } catch (e) {} c.close(); }));
  return cs;
}

const GAMES = [
  { game: "domino", size: 2, ends: true },
  { game: "bura", size: 2, ends: true },
  { game: "nardi", size: 2, ends: true, extra: { variant: "long" } },
  { game: "damka", size: 2, ends: true },
  /* ჯოკერი has no sides. One player running out is one player out — the other
     three are still a table, and their match must not be ended for them. */
  { game: "joker", size: 4, ends: false, extra: { variant: "classic" } },
];

for (const { game, size, ends, extra } of GAMES) {
  test(`${game}: nobody can hold the table by not playing`, async (t) => {
    const cs = await idleTable(t, game, size, extra);

    /* 1. the turn clock runs out and the bank starts going */
    assert.ok(await until(() => cs.some((c) => c.sawOvertime)),
      `${game}: the turn clock ran out and nothing began draining`);

    /* 2. the bank is reported, and it goes down */
    const bankOf = (c) => {
      const me = (c.last.roster || []).find((p) => p.me);
      return me ? me.bank : null;
    };
    assert.ok(cs.every((c) => bankOf(c) != null), `${game}: no bank in the roster`);
    assert.ok(await until(() => cs.some((c) => c.lowBank != null && c.lowBank < BANK / 1000)),
      `${game}: nobody's bank ever went down`);

    /* 3. and an empty bank has a consequence */
    if (ends) {
      assert.ok(await until(() => cs.every((c) => c.over)),
        `${game}: nobody ever ran out — the table would wait forever`);
      const over = cs.find((c) => c.over).over;
      assert.equal(over.reason, "time", `${game}: it ended for some other reason`);
      assert.ok(over.who, `${game}: nobody is named as having run out`);
      assert.equal(cs.filter((c) => c.over.youWon).length, 1,
        `${game}: the win did not go to exactly one side`);
    } else {
      /* The computer takes the seat and the hand goes on: for three of them
         the match is not over, and they must not be told that it is. */
      assert.ok(await until(
        () => cs.some((c) => (c.last.roster || []).some((p) => p.bot)), 40000),
        `${game}: no seat was ever taken over`);
      await wait(500);
      assert.ok(cs.every((c) => !c.over),
        `${game}: one player running out ended everybody's match`);
    }
  });
}

test("the loss is written down the second the bank empties", async (t) => {
  /* Not whenever the others get round to finishing. A match that is decided
     and not yet recorded is a match that can be lost by closing a tab. */
  const cs = await idleTable(t, "nardi", 2, { variant: "long" });
  assert.ok(await until(() => cs.every((c) => c.over)), "the match never ended");
  const loser = cs.find((c) => !c.over.youWon);
  assert.ok(loser.over.settled, "the loser's coins were never settled");
  assert.ok(loser.over.settled.delta < 0, "running out of time cost nothing");
  const winner = cs.find((c) => c.over.youWon);
  assert.ok(winner.over.settled && winner.over.settled.delta > 0, "the win paid nothing");
});

/* ---------------- the shape of it, read off the source ---------------- */

const src = readFileSync(path.join(CWD, "server.js"), "utf8");

test("a player who does move is charged only for the seconds they used", () => {
  /* The difference between a clock and a fine. The window is handed out whole
     and billed by the second. */
  const at = src.indexOf("function spendOvertime(room)");
  assert.notEqual(at, -1, "there is no such charge");
  assert.match(src.slice(at, src.indexOf("\n}", at)), /Date\.now\(\) - room\.overtimeStart/,
    "the bank is charged for the window rather than for the time taken");
  // ...and every handler that IS a turn pays it
  for (const h of ["nMove", "dMove", "nRoll", "bLead", "bAnswer", "jPlay", "jBid"]) {
    const i = src.indexOf(`on("${h}"`);
    assert.notEqual(i, -1, "no handler for " + h);
    assert.match(src.slice(i, i + 300), /acted\(roomOf\(socket\)\)/,
      h + " never pays for the overtime it used");
  }
});

test("one clock serves all five games, with its own thinking time for each", () => {
  /* The bank is shared because patience is. How long a MOVE is stays per game,
     because that was never about waiting — a board move is a slower thought
     than a card. */
  const at = src.indexOf("const CLOCK = {");
  assert.notEqual(at, -1, "there is no shared clock");
  const block = src.slice(at, src.indexOf("\n};", at));
  for (const g of ["domino", "bura", "joker", "nardi", "damka"])
    assert.match(block, new RegExp(g + ":\\s*\\{"), g + " has no clock");
  assert.match(block, /nardi:\s*\{ time: 40000/, "a board move lost its longer think");
  assert.match(block, /domino:\s*\{ time: 25000/, "domino's own time changed");
  assert.doesNotMatch(src, /BURA_MOVE_TIME|JOKER_MOVE_TIME|BOARD_MOVE_TIME/,
    "a game still keeps a clock of its own");
});

test("the player who ran out is told why, and not after their socket is gone", () => {
  /* abandonSeat empties the chair, and the socket with it. Asking whether the
     match was dead only AFTER doing that left the one person it happened to
     with no message at all — which reads as the app breaking. */
  const at = src.indexOf("function outOfTime(room, p)");
  assert.notEqual(at, -1, "there is no such path");
  const body = src.slice(at, src.indexOf("\n}", at));
  assert.ok(body.indexOf("wouldDie(room, p)") < body.indexOf("abandonSeat(room, p)"),
    "the chair is emptied before anyone asks whether the match is over");
  assert.match(src, /function wouldDie\(room, p\)/, "there is no way to ask without doing it");
});

test("the ნარდი opening cannot stall a table before the match starts", () => {
  /* The turn clock does not fit the opening — it belongs to both players at
     once, so there is no single seat whose time is running — and without
     something in its place two people who both wait leave the table stuck
     before the first move. Throwing an opening die for somebody costs them
     nothing: there is no decision in it. */
  const at = src.indexOf("function nardiMaybeOpen(room)");
  const body = src.slice(at, src.indexOf("\n}", at));
  assert.doesNotMatch(body, /if \(!p\.bot[^\n]*return;/,
    "only the computer's opening die is thrown for it");
  assert.match(body, /p\.bot \? BOARD_BOT_PAUSE : moveTimeOf\(room\)/,
    "a player who never throws is waited on forever");
});

test("every screen shows the bank, and 1v1 is not left out", () => {
  /* The seat boxes carry one each, but in 1v1 there are no seat boxes — and
     1v1 is exactly where being left waiting hurts most. The pill is on every
     screen and always describes whoever is on the clock, so that is where it
     goes when there is nowhere else. */
  const seen = (f) => readFileSync(path.join(CWD, "public", f), "utf8");
  for (const f of ["nardi.html", "damka.html"]) {
    const html = seen(f);
    assert.match(html, /id="meBank"/, f + " never shows my own bank");
    assert.match(html, /id="themBank"/, f + " never shows theirs");
    assert.match(html, /paintBank\(/, f + " never paints one");
  }
  for (const f of ["buraonline.html", "jokeronline.html"]) {
    const html = seen(f);
    assert.match(html, /function clockWords\(who\)/, f + " has no clock words");
    assert.match(html, /pill\.textContent = clockWords\(/,
      f + ": the pill never reads the bank, so 1v1 shows nothing");
    assert.match(html, /r\.bank != null && r\.bank < full/,
      f + ": the seat boxes never show a bank");
  }
  // domino had both of these from the start; it is where they came from
  assert.match(seen("online.html"), /id="myBank"/, "domino lost its own bank");
});

test("a full bank is not shown at all", () => {
  /* A number sitting at its starting value the whole match is furniture. It
     appears the first time somebody's thinking time is actually being spent,
     which is the moment it starts answering a question. */
  for (const f of ["nardi.html", "damka.html", "buraonline.html", "jokeronline.html"]) {
    const html = readFileSync(path.join(CWD, "public", f), "utf8");
    assert.ok(/b < full/.test(html) || /r\.bank < full/.test(html),
      f + " shows a full bank as if it meant something");
  }
  assert.match(src, /bankFull: Math\.round\(RESERVE_START \/ 1000\)/,
    "a screen has to guess what full looks like");
});

test("the ring goes red once it is the match being spent, not the move", () => {
  /* A ring that kept sweeping would say "you have until it closes". From here
     on what they have is until the BANK closes, which is a different thing. */
  const ring = readFileSync(path.join(CWD, "public", "js", "turnring.js"), "utf8");
  assert.match(ring, /function set\(el, active, left, total, spending\)/,
    "the ring cannot be told the bank is going");
  const base = readFileSync(path.join(CWD, "public", "css", "base.css"), "utf8");
  assert.match(base, /\.onTurn\.spending::after\{/, "there is no red ring");
  assert.doesNotMatch(base.slice(base.indexOf(".onTurn.spending::after{"),
                                base.indexOf("@keyframes spendPulse")),
    /animation:turnDrain/, "the red ring still sweeps, which promises time it has not got");
});
