/* =====================================================================
   Choosing who you play WITH.

   Every table that seats four asks the same question before it deals, and
   for a long time only one of them let you answer it. დომინო had a waiting
   room where you picked a partner; ბურა and ჯოკერი showed four names, dealt
   the moment the fourth person arrived, and made partners of whoever had
   joined in step with each other. Nobody chose that — it was the order of
   arrival, wearing the clothes of a decision.

   So what is checked here is mostly that the three tables now answer
   identically, and that the one table which has no partners to give
   (ჯოკერი played every player for themselves) does not pretend to.
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
const PORT = 3998;
const ADDR = `http://127.0.0.1:${PORT}`;
const GRACE = 2500;                 // the real one is fifteen seconds

let dir, srv;
const clients = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-pair-"));
  srv = spawn(process.execPath, ["server.js"], {
    cwd: CWD, env: { ...process.env, PORT: String(PORT), DATA_DIR: dir,
                     GOOGLE_CLIENT_ID: "", PAIR_GRACE: String(GRACE) },
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
  c.last = null;
  c.on("state", (st) => { c.last = st; });
  clients.push(c);
  return c;
}
const until = async (fn, ms = 15000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(40);
  return fn();
};

/* Four people sitting down at one table, however that table is described. */
let n = 0;
async function fourJoin(join) {
  const tag = "pr" + (n++);
  const cs = [0, 1, 2, 3].map((i) => {
    const c = client();
    c.emit("quickJoin", { ...join, name: "მ" + i, token: tag + "-" + i,
                          auth: { kind: "guest", id: tag + "-" + i } });
    return c;
  });
  /* A table with nothing to settle deals the instant the fourth arrives, so
     it may never be seen with four in the waiting room at all — which is the
     behaviour, not a failure to observe it. */
  assert.ok(await until(() => cs.every((c) => c.last &&
      ((c.last.lobby && c.last.lobby.length === 4) || c.last.hand))),
    "the table never filled");
  return cs;
}
const myIdx = (c) => c.last.lobby.find((p) => p.me).idx;
const seatOf = (c) => c.last.seat;

const BURA  = { game: "bura", size: 4, variant: "5", target: 6 };
const JOKER = { game: "joker", size: 4, variant: "nines", teams: 1 };
const SOLO  = { game: "joker", size: 4, variant: "nines" };

/* ---------------- the waiting room exists at all ---------------- */

test("a ბურა table offers partners, the same as a domino one", async () => {
  const cs = await fourJoin(BURA);
  const st = cs[0].last;
  assert.equal(st.pairs, true, "a ბურა table at four says it has no partners");
  assert.equal(st.lobby.length, 4);
  assert.ok(st.lobby.some((p) => p.pairable),
    "four names and nobody you may pair with is not a waiting room");
  assert.ok(st.lobby.every((p) => "team" in p), "the lobby does not say who is paired");
  cs.forEach((c) => c.emit("leaveRoom"));
});

test("a ჯოკერი table in pairs offers them too", async () => {
  const cs = await fourJoin(JOKER);
  const st = cs[0].last;
  assert.equal(st.pairs, true);
  assert.ok(st.lobby.some((p) => p.pairable), "ჯოკერი 2v2 offers no partner");
  cs.forEach((c) => c.emit("leaveRoom"));
});

test("ჯოკერი played alone offers none, and does not wait for any", async () => {
  /* The one table of four with nothing to settle. Offering a partner there
     would be offering something the game does not have — and waiting for an
     answer would hold up a match nobody needs to agree about.

     Read with THREE seated rather than four, because the point of the table
     is that it deals the moment the fourth arrives: at four there is no
     waiting room left to look at. */
  const tag = "solo" + (n++);
  const cs = [0, 1, 2].map((i) => {
    const c = client();
    c.emit("quickJoin", { ...SOLO, name: "ს" + i, token: tag + "-" + i,
                          auth: { kind: "guest", id: tag + "-" + i } });
    return c;
  });
  assert.ok(await until(() => cs.every((c) => c.last && c.last.lobby &&
                                        c.last.lobby.length === 3)),
    "three never gathered");
  assert.equal(cs[0].last.pairs, false, "solo ჯოკერი claims to have pairs");
  assert.ok(!cs[0].last.lobby.some((p) => p.pairable), "solo ჯოკერი offers a partner");
  assert.equal(cs[0].last.canStayAlone, false);

  const last = client();
  last.emit("quickJoin", { ...SOLO, name: "ს3", token: tag + "-3",
                           auth: { kind: "guest", id: tag + "-3" } });
  assert.ok(await until(() => cs.every((c) => c.last && c.last.hand), 4000),
    "a table with nothing to decide still sat waiting for it");
  cs.concat([last]).forEach((c) => c.emit("leaveRoom"));
  await wait(150);
});

/* ---------------- and the choice is honoured ---------------- */

async function pairsAreKept(join, label) {
  const cs = await fourJoin(join);
  cs[0].emit("choosePartner", { idx: myIdx(cs[1]) });
  assert.ok(await until(() => cs[0].last.lobby.find((p) => p.me).team != null),
    label + ": the choice was not recorded");
  cs[2].emit("choosePartner", { idx: myIdx(cs[3]) });
  assert.ok(await until(() => cs.every((c) => c.last && c.last.hand)),
    label + ": the table never dealt once everybody had chosen");

  /* Partners sit opposite each other, so two seats apart is the whole of
     "we are on the same side" at a table of four. */
  const apart = (a, b) => Math.abs(seatOf(a) - seatOf(b)) === 2;
  assert.ok(apart(cs[0], cs[1]), label + ": the two who paired are not sitting together");
  assert.ok(apart(cs[2], cs[3]), label + ": the other pair is not sitting together");
  cs.forEach((c) => c.emit("leaveRoom"));
  await wait(150);
}

test("in ბურა you sit with the person you chose", () => pairsAreKept(BURA, "ბურა"));
test("in ჯოკერი you sit with the person you chose", () => pairsAreKept(JOKER, "ჯოკერი"));

test("choosing takes precedence over the order people arrived in", async () => {
  /* The bug this whole file is about: seats used to be handed out by arrival,
     so the first and third to join were partners whether they liked it or
     not. Pairing the first with the SECOND is the case that told them apart —
     under the old rule those two were opponents. */
  const cs = await fourJoin(BURA);
  cs[0].emit("choosePartner", { idx: myIdx(cs[1]) });
  assert.ok(await until(() => cs.every((c) => c.last && c.last.hand)),
    "the table never dealt");
  assert.equal(Math.abs(seatOf(cs[0]) - seatOf(cs[1])), 2,
    "the first two to join were seated as opponents — that is the arrival order, not the choice");
  cs.forEach((c) => c.emit("leaveRoom"));
});

/* ---------------- but nobody is held up for ever ---------------- */

test("a table where nobody chooses is seated anyway", async () => {
  /* The waiting room must not be a way to stop a match happening. Four
     people who say nothing get partners made for them once the grace is up. */
  const cs = await fourJoin(BURA);
  assert.ok(!cs[0].last.hand, "the table dealt before anybody could choose");
  assert.ok(cs[0].last.autoStartIn != null, "the table never says how long there is");
  assert.ok(await until(() => cs.every((c) => c.last && c.last.hand), GRACE + 6000),
    "a table where nobody chose never started");
  cs.forEach((c) => c.emit("leaveRoom"));
});

test("staying unpaired is a thing you may say, and it holds the table", async () => {
  const cs = await fourJoin(BURA);
  cs[0].emit("choosePartner", { idx: myIdx(cs[1]) });
  assert.ok(await until(() => cs[0].last.canStayAlone === true),
    "having paired, there is no way back out of it");
  cs[0].emit("stayAlone");
  assert.ok(await until(() => cs[0].last.lobby.find((p) => p.me).team === null),
    "saying you will wait for your own partner did nothing");
  cs.forEach((c) => c.emit("leaveRoom"));
});

/* ---------------- one waiting room, not three ---------------- */

const server = readFileSync(path.join(CWD, "server.js"), "utf8");

test("every game builds its waiting room from the same place", () => {
  /* Three copies of this were what let two of them fall behind without
     anybody noticing. If a fourth game ever seats four, it gets the waiting
     room by using this function and in no other way. */
  assert.match(server, /function lobbyView\(room, me, base\)/, "there is no shared waiting room");
  const uses = (server.match(/return lobbyView\(room, me, base\)/g) || []).length;
  assert.ok(uses >= 3, `only ${uses} views build a waiting room the shared way`);
  assert.doesNotMatch(server.slice(server.indexOf("function buraView")),
    /base\.lobby = /, "ბურა builds its own waiting room again");
});

test("whether a table has partners is decided in one place", () => {
  assert.match(server, /const hasPairs = \(room\) =>/, "nothing says what a pairs table is");
  // the two questions it answers: what the screen is told, and whether to wait
  assert.match(server, /base\.pairs = hasPairs\(room\)/,
    "the screen is not told whether this table has partners");
  assert.match(server, /if \(!hasPairs\(room\)\) \{ clearAuto\(room\); go\(room\); return true; \}/,
    "the decision to wait for partners is made some other way");
  assert.match(server, /room\.game !== "joker" \|\| !!room\.teams/,
    "ჯოკერი played alone is counted as a pairs table");
});

test("seats follow the choice in every game, never the arrival order", () => {
  /* `p.seat = i` is the arrival order written down. It is right for a table
     with no partners and wrong for every other one, so where it survives is
     worth reading rather than assuming. */
  for (const fn of ["function startBura(room)", "function startJoker(room)"]) {
    const at = server.indexOf(fn);
    assert.notEqual(at, -1, "no " + fn);
    const body = server.slice(at, server.indexOf("\n}", at));
    assert.match(body, /assignSeats\(room\)/, fn + " seats people without honouring the pairs");
  }
  const jk = server.indexOf("function startJoker(room)");
  assert.match(server.slice(jk, server.indexOf("\n}", jk)), /if \(room\.teams\)/,
    "ჯოკერი played alone is being given partners it does not have");
});
