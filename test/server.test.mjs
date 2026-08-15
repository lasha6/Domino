/* =====================================================================
   The server, played against for real.

   Starts the actual server on a spare port and drives it with socket clients,
   the same way a phone does. Covers the two things that matter most: a match
   can be finished, and nothing a client sends can bring the server down — it
   is on the internet, and one crash ends every game in progress.

   Note for anyone extending this: attach every listener BEFORE emitting. The
   reply often arrives in the same tick, and a handler registered after an
   `await` misses it — which looks exactly like a broken server.
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

const PORT = 3971;
const ADDR = `http://127.0.0.1:${PORT}`;
const CWD = fileURLToPath(new URL("..", import.meta.url));

let srv, exited = null, log = "";

before(async () => {
  srv = spawn(process.execPath, ["server.js"], { cwd: CWD, env: { ...process.env, PORT: String(PORT) } });
  srv.stdout.on("data", (d) => { log += d; });
  srv.stderr.on("data", (d) => { log += d; });
  srv.on("exit", (code, sig) => { exited = `code=${code} signal=${sig}`; });
  for (let i = 0; i < 60 && !log.includes("running"); i++) await wait(150);
  assert.equal(exited, null, "the server started");
});

const clients = [];
after(() => { clients.forEach((c) => c.close()); if (srv) srv.kill(); });

function client() {
  const s = io(ADDR, { transports: ["websocket"], forceNew: true });
  s.errors = [];
  s.on("joinError", (m) => s.errors.push(m));
  clients.push(s);
  return s;
}
const until = async (fn, ms = 8000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(100);
  return fn();
};

// plays whatever is legal, exactly like the real screen decides
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

test("two players can play a 1v1 match through to the end", async () => {
  const a = client(), b = client();
  let over = null;
  [a, b].forEach((s) => { autoplay(s); s.on("matchOver", (r) => { over = over || r; }); });
  a.emit("quickJoin", { target: 75, size: 2, name: "ერთი" });
  b.emit("quickJoin", { target: 75, size: 2, name: "ორი" });

  assert.ok(await until(() => over, 90000), "the match finished");
  assert.ok(Math.max(...over.scores) >= 75, `someone reached the target: ${over.scores}`);
  assert.equal(exited, null, "and the server is still up");
});

test("a private table can be joined by its code", async () => {
  const host = client(), guest = client();
  let code = null, phases = [];
  host.on("state", (st) => { if (st.code) code = st.code; phases.push(st.phase); });
  host.emit("createTable", { target: 175, size: 2, name: "მასპინძელი" });

  assert.ok(await until(() => code), `the host was given a code (phases: ${phases})`);
  assert.match(code, /^[A-Z0-9]{4}$/, "and it is short enough to read out");

  guest.emit("joinTable", { code, name: "სტუმარი" });
  const started = await until(() => phases.includes("play") || phases.includes("draw"));
  assert.ok(started, `the table started once both were seated (phases: ${phases}, errors: ${guest.errors})`);
});

test("a wrong code is refused, not silently ignored", async () => {
  const c = client();
  c.emit("joinTable", { code: "ZZZZ" });
  assert.ok(await until(() => c.errors.length), "the player is told the table does not exist");
});

test("nothing a client sends can bring the server down", async () => {
  const junk = [
    undefined, null, 0, NaN, "", "x".repeat(5000), true, [], [1, 2, 3], {},
    { tile: null }, { tile: "abc" }, { tile: [1] }, { tile: [99, 99], side: "left" },
    { side: {} }, { slot: -5 }, { slot: 1e9 }, { idx: 1e9 }, { idx: {} },
    { target: "355", size: 99 }, { code: 12345 }, { token: [] },
    { name: null }, { name: "a".repeat(10000) },
  ];
  const bad = client();
  await until(() => bad.connected);
  for (const ev of ["quickJoin", "createTable", "joinTable", "choosePartner",
                    "stayAlone", "play", "draw", "leaveRoom", "resume"]) {
    for (const j of junk) bad.emit(ev, j);
    bad.emit(ev);                       // and with no payload at all
  }
  await wait(1500);
  assert.equal(exited, null, `the server survived: ${log.slice(-400)}`);

  // and it still deals a fresh table afterwards
  const a = client(), b = client();
  let dealt = false, seen = [];
  a.on("state", (st) => {
    seen.push(`${st.phase}/${st.hand ? st.hand.length : "-"}`);
    // six, not seven: the opening double goes down as the hand is dealt
    if (st.hand && st.hand.length >= 6 && (st.phase === "play" || st.phase === "draw")) dealt = true;
  });
  a.emit("quickJoin", { target: 75, size: 2 });
  b.emit("quickJoin", { target: 75, size: 2 });
  assert.ok(await until(() => dealt),
    `a fresh table was still dealt after the flood (states: ${seen.join(" ")} | errors: ${a.errors})`);
});

test("a name from a stranger comes back safe to display", async () => {
  const host = client(), b = client(), c = client(), d = client();
  let code = null, names = [];
  host.on("state", (st) => {
    if (st.code) code = st.code;
    if (st.lobby) names = st.lobby.map((p) => p.name);
  });
  host.emit("createTable", { target: 175, size: 4, name: "<img src=x onerror=alert(1)>" });

  assert.ok(await until(() => code), "the host was given a code");
  [b, c, d].forEach((s, i) => s.emit("joinTable", { code, name: `<b>${i}</b>` }));
  assert.ok(await until(() => names.length >= 2), `the lobby listed the players (got ${names.length})`);

  for (const n of names) {
    assert.ok(!/[<>]/.test(n), `tag brackets stripped from "${n}"`);
    assert.ok(n.length <= 18, `name kept short: "${n}"`);
  }
});
