/* =====================================================================
   The table of honour.

   One board for all five games, a week at a time. Both of those are decisions
   rather than defaults, and both are here because of how small the crowd is
   at the start:

     · Five boards would divide it by five, and a leaderboard with four names
       on it is worse than no leaderboard. Wins are still recorded per game
       from the first day, so splitting it later is a change to a query and
       not a migration.
     · All-time would seat the first player ever at the top with nobody able
       to catch up. A week is short enough to be worth looking at again and
       long enough to be worth winning.

   What is checked here is mostly what must NOT count: a match against the
   computer, a week that has turned, a player with nothing yet.
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
const PORT = 3997;
const ADDR = `http://127.0.0.1:${PORT}`;

let dir, srv;
const clients = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-board-"));
  srv = spawn(process.execPath, ["server.js"], {
    cwd: CWD, env: { ...process.env, PORT: String(PORT), DATA_DIR: dir,
                     GOOGLE_CLIENT_ID: "", RECONNECT_GRACE: "500" },
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
  c.last = null; c.over = null; c.board = null;
  c.on("state", (st) => { c.last = st; });
  c.on("matchOver", (m) => { c.over = m; });
  c.on("board", (b) => { c.board = b; });
  clients.push(c);
  return c;
}
const until = async (fn, ms = 20000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(40);
  return fn();
};
const askBoard = async (c, id, name) => {
  c.board = null;
  c.emit("board", { auth: { kind: "guest", id }, name });
  assert.ok(await until(() => c.board, 8000), "the board never came back");
  return c.board;
};

/* One real damka match between two guests, played to a finish. */
let n = 0;
async function playMatch(aId, bId) {
  const tag = "bd" + (n++);
  const cs = [[aId, "ა" + n], [bId, "ბ" + n]].map(([id, nm], i) => {
    const c = client();
    c.emit("quickJoin", { game: "damka", size: 2, name: nm, token: tag + "-" + i,
                          auth: { kind: "guest", id } });
    return c;
  });
  assert.ok(await until(() => cs.every((c) => c.last && c.last.phase === "play")),
    "the table never filled");
  const Damka = (await import("../public/js/damka.js")).default
             ?? (await import("../public/js/damka.js"));
  for (let step = 0; step < 500 && !cs.some((c) => c.over); step++) {
    for (const c of cs) {
      const st = c.last;
      if (!st || !st.cells || st.phase !== "play" || st.side !== st.seat) continue;
      const g = Damka.newGame({});
      g.cells = st.cells.slice(); g.side = st.side; g.mustFrom = st.mustFrom;
      g.phase = st.dphase; g.pending = (st.pending || []).map((sq) => ({ sq, was: 0 }));
      const ms = Damka.legalMoves(g);
      if (ms.length) c.emit("dMove", ms[Math.floor(Math.random() * ms.length)]);
      await wait(15);
    }
    await wait(15);
  }
  const done = await until(() => cs.some((c) => c.over), 8000);
  cs.forEach((c) => { try { c.emit("leaveRoom"); } catch (e) {} c.close(); });
  assert.ok(done, "the match never finished");
  return cs;
}

test("a win against a person puts you on the board", async () => {
  await playMatch("bd-a", "bd-b");
  const c = client();
  const b = await askBoard(c, "bd-a", "ა");
  assert.ok(b.top.length >= 1, "nobody is on the board after a real match");
  const total = b.top.reduce((s, r) => s + r.wins, 0);
  assert.equal(total, 1, "one match should put exactly one win on the board");
  assert.ok(b.me, "the asker was not told where they stand");
  assert.equal(b.me.played, 1, "the match was not counted as played");
});

test("a match against the computer counts for nothing", async () => {
  /* A board a player can farm against a bot is a list of who left their phone
     on longest. Practice already pays no coins; it must pay no rank either.

     Two halves, and the first one alone is not enough: sitting at a table
     nobody joined proves only that an unfinished match is not counted, which
     would still be true with the guard deleted. So the guard itself is read
     as well — that is the half that fails when somebody removes it. */
  const c = client();
  c.emit("quickJoin", { game: "damka", size: 2, name: "მარტო", token: "solo-1",
                        auth: { kind: "guest", id: "bd-solo" } });
  assert.ok(await until(() => c.last, 8000), "never got a state");
  const before = await askBoard(c, "bd-solo", "მარტო");
  assert.equal(before.me.played, 0, "a table with no opponent counted as played");
  assert.ok(!before.top.some((r) => r.name === "მარტო"),
    "somebody who has beaten nobody is on the board");

  const src = readFileSync(path.join(CWD, "server.js"), "utf8");
  const at = src.indexOf("function awardMatch(room, p, won)");
  const body = src.slice(at, src.indexOf("\nfunction ", at + 10));
  assert.match(body, /room\.players\.some\(\(o\) => o !== p && !o\.bot\)/,
    "the board no longer asks whether there was a person on the other side");
  assert.match(body, /if \(real\) \{/, "the guard is not applied to anything");
});

test("a player with no wins is not last — they are simply not on it", async () => {
  const c = client();
  const b = await askBoard(c, "bd-nobody", "არავინ");
  assert.ok(!b.top.some((r) => r.name === "არავინ"), "a player with no wins is listed");
  assert.ok(b.me, "they are still told where they stand");
  assert.equal(b.me.wins, 0);
  assert.equal(b.me.rank, null, "a rank was invented for somebody with no wins");
});

/* ---------------- the shape of it, read off the source ---------------- */

const server = readFileSync(path.join(CWD, "server.js"), "utf8");
const store = readFileSync(path.join(CWD, "store.js"), "utf8");

test("the season turns by itself, and the same week for everybody", () => {
  /* A boundary that moves with the reader is a boundary two players disagree
     about. UTC, Monday-based, and a plain number so it sorts. */
  assert.match(server, /function seasonOf\(when\)/, "there is no season");
  assert.match(server, /d\.getUTCDay\(\)/, "the week turns in local time");
  assert.match(server, /function freshBoard\(pr\)/, "the season never rolls over");
  const roll = server.slice(server.indexOf("function freshBoard(pr)"));
  assert.match(roll, /pr\.board\.best = Math\.max/,
    "a player's best week is thrown away when the week turns");
  assert.match(roll, /pr\.board\.wins = 0;/, "last week's wins are carried into this one");
});

test("wins are kept per game, so five boards later is a query", () => {
  assert.match(server, /pr\.wins\[room\.game \|\| "domino"\]/,
    "nothing records WHICH game was won");
  assert.match(store, /wins: \{\},/, "a profile has nowhere to keep them");
});

test("equal wins are broken by fewer matches, not more", () => {
  /* Two wins out of four is a better week than two out of nine, and the other
     way round rewards sitting at a table all day. */
  const at = store.indexOf("function rank(profiles, n, pick)");
  assert.notEqual(at, -1, "there is no one place that decides what a board is");
  const body = store.slice(at, store.indexOf("\n}", at));
  assert.match(body, /\(\(a\.board && a\.board\.played\) \|\| 0\) - \(\(b\.board && b\.board\.played\) \|\| 0\)/,
    "more matches played ranks higher");
  assert.match(body, /get\(p\) > 0/, "players with no wins are listed");
});

test("the board is read from the store, not from who happens to be playing", () => {
  /* The cache holds whoever is at a table this second, which is the one group
     a leaderboard must not be limited to. */
  /* The wrapper's own top(), not one of the three underneath it — there are
     four functions with that name and only this one is allowed to answer from
     memory, which is exactly what it must not do. */
  const w = store.indexOf("function wrap(store)");
  assert.notEqual(w, -1, "there is no wrapper");
  const at = store.indexOf("async top(", w);
  assert.notEqual(at, -1, "the wrapper cannot produce a board at all");
  assert.match(store.slice(at, at + 260), /store\.top\(/,
    "the board is answered out of the cache, which holds only who is playing now");
  assert.doesNotMatch(store.slice(at, at + 260), /cache/,
    "the board is answered out of the cache");
  // ...and every backend can actually produce one, or it is empty on that host
  for (const kind of ["memoryStore", "fileStore", "pgStore"]) {
    const i = store.indexOf("function " + kind);
    assert.notEqual(i, -1, "no " + kind);
    const body = store.slice(i, i + 2200);
    assert.match(body, /async top\(/,
      kind + " cannot produce a board, so it would be empty there");
  }
});

test("every way a match can end tells the player what the rating did", () => {
  /* There are eight places a matchOver goes out — five games, plus the ways a
     match ends early. One of them wrote `settled` and `earned` on separate
     lines and was missed by a sweep that matched them together, so დომინო
     alone said nothing about the rating. Counted rather than eyeballed. */
  const outs = [...server.matchAll(/emit\("matchOver", \{/g)].map((m) => m.index);
  assert.ok(outs.length >= 7, "found only " + outs.length + " ways a match ends");
  const silent = [];
  for (const at of outs) {
    const block = server.slice(at, server.indexOf("});", at));
    if (!/rating:/.test(block)) silent.push(server.slice(at - 60, at + 40));
  }
  assert.deepEqual(silent, [], "these end a match without saying what the rating did");
});

test("the rating moves by the same amount either way", () => {
  /* Symmetric is what makes it a rating rather than a tally. With losses
     costing nothing, twenty wins from forty outranks five from six. */
  const at = server.indexOf("const move = Math.round(RATING_WIN * w)");
  assert.notEqual(at, -1, "the rating never moves");
  assert.match(server.slice(at, at + 120), /\* \(won \? 1 : -1\)/,
    "a loss is worth something other than a win, so volume can still climb");
  assert.match(server, /pr\.rating = Math\.max\(0,/, "a rating can go below zero");
});

test("a wipe can be asked for, and it takes the rating with it", () => {
  /* There is no other way to clear a board on a host whose database we cannot
     reach from here — and a rating carried across a reset is not a reset. */
  assert.match(server, /const BOARD_EPOCH = \d+;/, "there is no way to wipe");
  const at = server.indexOf("if ((pr.board.epoch || 0) !== BOARD_EPOCH)");
  assert.notEqual(at, -1, "the epoch is never checked");
  assert.match(server.slice(at, at + 260), /pr\.rating = 0;/,
    "a wipe leaves the ratings standing");
});
