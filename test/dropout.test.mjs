/* =====================================================================
   What happens when a player disappears.

   Two features that are easy to break and hard to notice: coming back after a
   dropped connection continues the same hand, and in 2v2 one player leaving
   does not end the match — the computer takes their tiles until their whole
   team is gone.
   ===================================================================== */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";

const require = createRequire(import.meta.url);
const Ozi = require("../public/js/ozi.js");

const PORT = 3972;
const ADDR = `http://127.0.0.1:${PORT}`;
const CWD = fileURLToPath(new URL("..", import.meta.url));

let srv, exited = null, log = "";
const clients = [];

before(async () => {
  srv = spawn(process.execPath, ["server.js"], { cwd: CWD, env: { ...process.env, PORT: String(PORT) } });
  srv.stdout.on("data", (d) => { log += d; });
  srv.stderr.on("data", (d) => { log += d; });
  srv.on("exit", (c, s) => { exited = `code=${c} signal=${s}`; });
  for (let i = 0; i < 60 && !log.includes("running"); i++) await wait(150);
  assert.equal(exited, null, "the server started");
});
after(() => { clients.forEach((c) => c.close()); if (srv) srv.kill(); });

function client() {
  const s = io(ADDR, { transports: ["websocket"], forceNew: true });
  s.last = null;
  s.on("state", (st) => { s.last = st; });
  clients.push(s);
  return s;
}
const until = async (fn, ms = 10000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(100);
  return fn();
};

test("a dropped player comes back to the same hand", async () => {
  const a = client(), b = client();
  const TOKEN = "test-token-a";
  a.emit("quickJoin", { target: 355, size: 2, name: "დამრტყმელი", token: TOKEN });
  b.emit("quickJoin", { target: 355, size: 2, name: "მეორე" });

  assert.ok(await until(() => a.last && a.last.hand), "the hand was dealt");
  const before = { round: a.last.round, hand: JSON.stringify(a.last.hand), line: a.last.line.length };

  a.close();                                   // the phone loses its connection
  assert.ok(await until(() => b.last && b.last.paused), "the other player is told the game is on hold");

  const back = client();                       // ...and comes back on a new socket
  back.emit("resume", { token: TOKEN });
  assert.ok(await until(() => back.last && back.last.hand), "the seat was still there");

  assert.equal(back.last.round, before.round, "same hand, not a fresh one");
  assert.equal(JSON.stringify(back.last.hand), before.hand, "with the same tiles");
  assert.equal(back.last.line.length, before.line, "and the same table");
  assert.ok(await until(() => b.last && !b.last.paused), "and play resumes for everyone");
});

test("an unknown token cannot claim a seat", async () => {
  const c = client();
  let failed = false;
  c.on("resumeFailed", () => { failed = true; });
  c.emit("resume", { token: "not-a-real-token" });
  assert.ok(await until(() => failed), "the server refuses rather than seating a stranger");
});

test("in 2v2 one player leaving does not end the match", async () => {
  const p = [client(), client(), client(), client()];
  let code = null, over = null;
  p[0].on("state", (st) => { if (st.code) code = st.code; });
  p.forEach((s) => {
    s.on("matchOver", (r) => { over = over || r; });
    s.on("opponentLeft", (r) => { over = over || r; });
  });

  p[0].emit("createTable", { target: 355, size: 4, name: "ერთი" });
  assert.ok(await until(() => code), "the table was created");
  p.slice(1).forEach((s, i) => s.emit("joinTable", { code, name: `მოთამაშე ${i + 2}` }));
  assert.ok(await until(() => p[3].last && p[3].last.lobby), "all four are in the waiting room");

  // pair them up explicitly rather than waiting out the grace period
  p[0].emit("choosePartner", { idx: 2 });
  p[1].emit("choosePartner", { idx: 3 });
  assert.ok(await until(() => p[0].last && p[0].last.hand), "the match started");

  const seatsBefore = p[0].last.seats.length;
  p[3].emit("leaveRoom");                       // one player walks away

  await wait(1500);
  assert.equal(over, null, "the match did not end — their partner is still playing");
  assert.ok(await until(() => p[0].last.seats.some((s) => s.bot)),
    "the computer took the empty seat over");
  assert.equal(p[0].last.seats.length, seatsBefore, "the table still has four seats");
  assert.equal(exited, null, "and the server is still up");
});

test("the whole team leaving does end the match", async () => {
  const p = [client(), client(), client(), client()];
  let code = null, over = null;
  p[0].on("state", (st) => { if (st.code) code = st.code; });
  // a walkout is announced as `opponentLeft`; a match played out is `matchOver`
  p.forEach((s) => {
    s.on("matchOver", (r) => { over = over || { how: "played out", r }; });
    s.on("opponentLeft", (r) => { over = over || { how: "walkout", r }; });
  });

  p[0].emit("createTable", { target: 355, size: 4, name: "ერთი" });
  assert.ok(await until(() => code));
  p.slice(1).forEach((s, i) => s.emit("joinTable", { code, name: `მოთამაშე ${i + 2}` }));
  assert.ok(await until(() => p[3].last && p[3].last.lobby));
  p[0].emit("choosePartner", { idx: 2 });
  p[1].emit("choosePartner", { idx: 3 });
  assert.ok(await until(() => p[0].last && p[0].last.hand), "the match started");

  p[1].emit("leaveRoom");
  p[3].emit("leaveRoom");                       // both of one team walk away
  assert.ok(await until(() => over), "the remaining pair is told the match is over");
  assert.equal(over.how, "walkout");
  assert.ok(await until(() => p[0].last && p[0].last.phase === "over"), "and the table closes");
});

test("the engine and the server agree on what a legal move is", async () => {
  // the client only offers moves the shared engine allows; the server must
  // reject anything else, and never take a tile the player does not hold
  const a = client(), b = client();
  a.emit("quickJoin", { target: 355, size: 2, name: "ა" });
  b.emit("quickJoin", { target: 355, size: 2, name: "ბ" });
  assert.ok(await until(() => a.last && a.last.hand && a.last.line));

  const mover = a.last.myTurn ? a : b;
  const before = mover.last.line.length;
  mover.emit("play", { tile: [9, 9], side: "left" });     // not a real tile
  mover.emit("play", { tile: mover.last.hand[0], side: "nowhere" });
  await wait(600);
  assert.equal(mover.last.line.length, before, "neither attempt reached the table");
  assert.equal(exited, null);
});
