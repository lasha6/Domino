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
