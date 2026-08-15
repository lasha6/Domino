/* =====================================================================
   Achievements.

   A goal is only worth chasing if it is awarded exactly once, at the moment
   it is actually met, and by the server rather than by whoever is asking.
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
const P = require("../public/js/progress.js");

const CWD = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3976;
const ADDR = `http://127.0.0.1:${PORT}`;
let dir, srv;
const clients = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-ach-"));
  srv = spawn(process.execPath, ["server.js"], {
    cwd: CWD, env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, GOOGLE_CLIENT_ID: "" },
  });
  srv.log = ""; srv.exited = null;
  srv.stdout.on("data", (d) => { srv.log += d; });
  srv.stderr.on("data", (d) => { srv.log += d; });
  srv.on("exit", (c, s) => { srv.exited = `code=${c} signal=${s}`; });
  for (let i = 0; i < 80 && !srv.log.includes("running"); i++) await wait(150);
  assert.equal(srv.exited, null, `server started: ${srv.log}`);
});
after(async () => {
  clients.forEach((c) => c.close());
  if (srv) srv.kill();
  await wait(200);
  await rm(dir, { recursive: true, force: true });
});

function client() {
  const c = io(ADDR, { transports: ["websocket"], forceNew: true });
  clients.push(c);
  return c;
}
const ask = (c, send, payload, reply) => new Promise((resolve) => {
  c.once(reply, resolve);
  c.emit(send, payload);
});
const until = async (fn, ms = 90000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(150);
  return fn();
};
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

/* ---------------- the definitions themselves ---------------- */

test("every achievement has a goal you could actually reach", () => {
  const seen = new Set();
  for (const a of P.ACHIEVEMENTS) {
    assert.ok(!seen.has(a.id), `two achievements share the id ${a.id}`);
    seen.add(a.id);
    assert.ok(a.title && a.hint, `${a.id} needs something to read`);
    assert.ok(a.goal > 0, `${a.id} has no goal`);
    assert.ok(a.coins > 0, `${a.id} pays nothing`);
    assert.equal(typeof a.value, "function", `${a.id} cannot measure itself`);
    // a brand new player must be short of every goal — the level ones start at
    // level 1 rather than 0, which is why this is "below", not "zero"
    const start = a.value({ stats: {}, daily: {}, xp: 0 });
    assert.ok(start >= 0 && start < a.goal, `${a.id} is already met at ${start} of ${a.goal}`);
  }
});

test("a fresh player has earned nothing", () => {
  const blank = { stats: {}, daily: {}, xp: 0, achievements: {} };
  const rows = P.achievementProgress(blank);
  assert.equal(rows.length, P.ACHIEVEMENTS.length);
  assert.ok(rows.every((r) => !r.done), "nothing is claimed at the start");
  assert.ok(rows.every((r) => r.percent < 100), "and nothing is full");
  assert.equal(P.newlyEarned(blank).length, 0);
});

test("an achievement is earned the moment its number is reached, and only once", () => {
  const p = { stats: { matchWins: 1 }, daily: {}, xp: 0, achievements: {} };
  const first = P.newlyEarned(p).map((a) => a.id);
  assert.ok(first.includes("first-win"), "one win earns the first one");
  assert.ok(!first.includes("wins-10"), "but not the ten-win one");

  p.achievements["first-win"] = { at: Date.now() };
  assert.ok(!P.newlyEarned(p).some((a) => a.id === "first-win"), "and it is not earned twice");
});

test("progress is shown as a fraction, never past full", () => {
  const p = { stats: { matchWins: 999, bestHand: 999 }, daily: {}, xp: 0, achievements: {} };
  for (const r of P.achievementProgress(p)) {
    assert.ok(r.have <= r.goal, `${r.id} counts past its own goal`);
    assert.ok(r.percent >= 0 && r.percent <= 100, `${r.id} is at ${r.percent}%`);
  }
});

/* ---------------- against the real server ---------------- */

test("the profile carries every achievement with its progress", async () => {
  const p = await ask(client(), "profile", { auth: guest("ach-new"), name: "ახალი" }, "profile");
  assert.equal(p.achievements.length, P.ACHIEVEMENTS.length);
  assert.ok(p.achievements.every((a) => !a.done), "a new player has none of them yet");
});

test("winning a match earns the first one, and it is paid", async () => {
  const a = client(), b = client();
  let mine = null;
  autoplay(a); autoplay(b);
  a.on("matchOver", (r) => { mine = r; });
  b.on("matchOver", () => {});
  a.emit("quickJoin", { target: 75, size: 2, name: "ერთი", auth: guest("ach-a") });
  b.emit("quickJoin", { target: 75, size: 2, name: "ორი", auth: guest("ach-b") });
  assert.ok(await until(() => mine), "the match finished");

  // whoever won should have it; the loser should not
  const winnerId = mine.youWon ? "ach-a" : "ach-b";
  const winner = await ask(client(), "profile", { auth: guest(winnerId) }, "profile");
  const row = winner.achievements.find((x) => x.id === "first-win");
  assert.equal(row.done, true, "the winner earned it");

  // A match can earn more than one — a big hand often lands at the same time —
  // so the balance is checked against everything actually marked done.
  const prizes = winner.achievements.filter((x) => x.done)
    .reduce((sum, x) => sum + P.byId[x.id].coins, 0);
  assert.equal(winner.coins, 1000 + 50 + prizes,
    `1000 start + 50 stake + ${prizes} in prizes for ${winner.achievements.filter(x => x.done).map(x => x.id)}`);
  assert.ok(winner.xp >= P.byId["first-win"].xp, "and the experience with it");
});

test("the same achievement is never paid twice, however many matches follow", async () => {
  const before = await ask(client(), "profile", { auth: guest("ach-a") }, "profile");
  const had = before.achievements.filter((x) => x.done).map((x) => x.id);

  const a = client(), b = client();
  let done = false;
  autoplay(a); autoplay(b);
  a.on("matchOver", (r) => { done = true; });
  a.emit("quickJoin", { target: 75, size: 2, auth: guest("ach-a") });
  b.emit("quickJoin", { target: 75, size: 2, auth: guest("ach-b") });
  assert.ok(await until(() => done), "a second match finished");

  const after = await ask(client(), "profile", { auth: guest("ach-a") }, "profile");
  for (const id of had) {
    const def = P.byId[id];
    const swing = Math.abs(after.coins - before.coins);
    assert.ok(swing <= 50 + 800, `${id} looks like it paid again (${before.coins} -> ${after.coins})`);
    assert.equal(after.achievements.find((x) => x.id === id).done, true, "still held");
  }
});

test("claiming the daily reward reports anything it earned", async () => {
  const c = client();
  const r = await ask(c, "claimDaily", { auth: guest("ach-daily") }, "dailyResult");
  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.earned), "the screen is told what to celebrate");
  assert.ok(r.achievements.length > 0, "and gets the full list back with it");
});

test("nobody can award themselves anything by asking", async () => {
  const c = client();
  // every shape of "please give me the achievements" a client could invent
  for (const junk of [{ achievements: { "wins-50": { at: 1 } } },
                      { coins: 999999 }, { xp: 999999 },
                      { auth: guest("cheat-1"), coins: 5e6, level: 99 }]) {
    c.emit("profile", junk);
  }
  await wait(600);
  const p = await ask(c, "profile", { auth: guest("cheat-1") }, "profile");
  assert.equal(p.coins, 1000, "still the starting coins");
  assert.equal(p.level, 1, "still level one");
  assert.ok(p.achievements.every((x) => !x.done), "and nothing granted");
  assert.equal(srv.exited, null);
});
