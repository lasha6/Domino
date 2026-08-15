/* =====================================================================
   Progress that outlives the session.

   The point of a level is that it is still there tomorrow, and that a player
   cannot type it in themselves. These check both: a real match moves the
   numbers, the numbers survive a restart, and the daily reward can only be
   taken once however many times it is asked for.
   ===================================================================== */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { io } from "socket.io-client";

const require = createRequire(import.meta.url);
const Ozi = require("../public/js/ozi.js");
const Progress = require("../public/js/progress.js");

const CWD = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3975;
const ADDR = `http://127.0.0.1:${PORT}`;

let dir, srv, clients = [];

async function boot() {
  const s = spawn(process.execPath, ["server.js"], {
    cwd: CWD, env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, GOOGLE_CLIENT_ID: "" },
  });
  s.log = ""; s.exited = null;
  s.stdout.on("data", (d) => { s.log += d; });
  s.stderr.on("data", (d) => { s.log += d; });
  s.on("exit", (c, sig) => { s.exited = `code=${c} signal=${sig}`; });
  for (let i = 0; i < 80 && !s.log.includes("running"); i++) await wait(150);
  assert.equal(s.exited, null, `server started: ${s.log}`);
  return s;
}

before(async () => { dir = await mkdtemp(path.join(tmpdir(), "domino-profile-")); srv = await boot(); });
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
const until = async (fn, ms = 20000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(100);
  return fn();
};
const ask = (c, send, payload, reply) => new Promise((resolve) => {
  c.once(reply, resolve);
  c.emit(send, payload);
});
const guest = (id) => ({ kind: "guest", id });

function autoplay(sock) {
  sock.on("state", (st) => setTimeout(() => {
    if (!st || !st.myTurn) return;
    if (st.phase === "draw") {
      const slot = (st.boneSlots || []).findIndex(Boolean);
      if (slot >= 0) sock.emit("draw", { slot });
      return;
    }
    if (st.phase !== "play") return;
    const board = { line: st.line, top: st.top, bottom: st.bottom, spinnerVal: st.spinnerVal };
    for (const tile of st.hand || []) {
      const sides = Ozi.matchingSides(board, tile);
      if (sides.length) { sock.emit("play", { tile, side: sides[0] }); return; }
    }
  }, 5));
}

test("a new player starts with coins, level one and nothing played", async () => {
  const c = client();
  const p = await ask(c, "profile", { auth: guest("new-1"), name: "ახალი" }, "profile");
  assert.equal(p.level, 1);
  assert.equal(p.xp, 0);
  assert.equal(p.coins, 1000, "enough to sit at any table");
  assert.equal(p.stats.matches, 0);
  assert.equal(p.into, 0);
  assert.ok(p.need > 0, "and a bar to fill");
});

test("a player with no id at all is simply not tracked", async () => {
  const c = client();
  const p = await ask(c, "profile", { name: "უცნობი" }, "profile");
  assert.equal(p, null, "nothing to look up, and nothing invented");
});

test("playing a real match moves the numbers", async () => {
  const a = client(), b = client();
  let over = null;
  [a, b].forEach((s) => { autoplay(s); s.on("matchOver", (r) => { over = over || r; }); });
  a.emit("quickJoin", { target: 75, size: 2, name: "ერთი", auth: guest("player-a") });
  b.emit("quickJoin", { target: 75, size: 2, name: "ორი", auth: guest("player-b") });
  assert.ok(await until(() => over, 90000), "the match finished");

  const after = await ask(client(), "profile", { auth: guest("player-a"), name: "ერთი" }, "profile");
  assert.equal(after.stats.matches, 1, "the match was counted");
  assert.ok(after.stats.hands >= 1, "and the hands in it");
  assert.ok(after.xp > 0, "experience was earned");
  assert.equal(after.level, Progress.levelFromXp(after.xp).level, "the level matches the xp exactly");
  assert.notEqual(after.coins, 1000, "the stake was settled either way");
  assert.equal(after.stats.matchWins + 0, after.stats.matchWins, "wins are a number");
});

test("the winner gains the stake and the loser pays it", async () => {
  const a = await ask(client(), "profile", { auth: guest("player-a") }, "profile");
  const b = await ask(client(), "profile", { auth: guest("player-b") }, "profile");
  const stake = 50;                                   // the 75-point table
  const winner = a.stats.matchWins ? a : b, loser = a.stats.matchWins ? b : a;
  // achievements pay prizes of their own, so those are counted out first and
  // what is left has to be exactly the stake moving from one to the other
  const prizes = (p) => p.achievements.filter((x) => x.done)
    .reduce((sum, x) => sum + Progress.byId[x.id].coins, 0);
  assert.equal(winner.coins - prizes(winner), 1000 + stake, "the winner takes the stake");
  assert.equal(loser.coins - prizes(loser), 1000 - stake, "the loser pays it");
  assert.equal((winner.coins - prizes(winner)) + (loser.coins - prizes(loser)), 2000,
    "and the stake itself creates nothing out of nothing");
});

test("the daily reward can only be taken once, however often it is asked for", async () => {
  const c = client();
  const before = await ask(c, "profile", { auth: guest("daily-1"), name: "დღიური" }, "profile");
  assert.equal(before.daily.canClaim, true, "a new player can claim today");

  const first = await ask(c, "claimDaily", { auth: guest("daily-1") }, "dailyResult");
  assert.equal(first.ok, true);
  assert.equal(first.reward, Progress.DAILY[0], "the first day of the run");
  assert.equal(first.streak, 1);
  assert.equal(first.coins, before.coins + first.reward, "the coins actually arrived");

  // ask five more times, the way an impatient tap would
  for (let i = 0; i < 5; i++) {
    const again = await ask(c, "claimDaily", { auth: guest("daily-1") }, "dailyResult");
    assert.equal(again.ok, false, "refused");
    assert.equal(again.reason, "claimed");
  }
  const after = await ask(c, "profile", { auth: guest("daily-1") }, "profile");
  assert.equal(after.coins, first.coins, "and the balance did not budge");
  assert.equal(after.daily.canClaim, false);
});

test("a wrong database address does not take the game down", async () => {
  // One mistyped character in a connection string must not stop anyone playing:
  // the server says why and carries on keeping progress in a file.
  const spare = await mkdtemp(path.join(tmpdir(), "domino-badurl-"));
  const bad = spawn(process.execPath, ["server.js"], {
    cwd: CWD,
    env: { ...process.env, PORT: "3979", DATA_DIR: spare, GOOGLE_CLIENT_ID: "",
           DATABASE_URL: "postgresql://nobody:nothing@127.0.0.1:59999/nope" },
  });
  let log = "", exited = null;
  bad.stdout.on("data", (d) => { log += d; });
  bad.stderr.on("data", (d) => { log += d; });
  bad.on("exit", (c, s) => { exited = `code=${c} signal=${s}`; });
  for (let i = 0; i < 80 && !log.includes("running"); i++) await wait(150);

  assert.equal(exited, null, `it stayed up: ${log}`);
  assert.match(log, /Postgres unavailable/, "and said what was wrong");
  assert.match(log, /progress: file/, "then kept progress somewhere that works");

  const c = io("http://127.0.0.1:3979", { transports: ["websocket"], forceNew: true });
  const p = await new Promise((resolve) => {
    c.once("profile", resolve);
    c.emit("profile", { auth: { kind: "guest", id: "badurl-1" }, name: "ვინმე" });
  });
  assert.equal(p.level, 1, "and players could still be served");
  c.close(); bad.kill();
  await wait(200);
  await rm(spare, { recursive: true, force: true });
});

test("progress is still there after the server restarts", async () => {
  const before = await ask(client(), "profile", { auth: guest("player-a") }, "profile");
  assert.ok(before.xp > 0, "there is something to lose");

  srv.kill();
  await until(() => srv.exited !== null, 5000);
  clients.forEach((c) => c.close());
  clients = [];
  srv = await boot();

  const after = await ask(client(), "profile", { auth: guest("player-a") }, "profile");
  assert.equal(after.xp, before.xp, "the same experience");
  assert.equal(after.coins, before.coins, "the same coins");
  assert.equal(after.stats.matches, before.stats.matches, "the same record");
});
