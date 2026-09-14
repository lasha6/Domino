/* =====================================================================
   A friend's code opens the table it belongs to.

   Reported: a დამკა table could not be joined with its code, and behind the
   waiting window a ნარდი board went on playing itself.

   Both were one mistake with two faces. The code is four letters and says
   nothing about which game it is, so the lobby guessed from which friend
   window it had been typed into — and დამკა has no window of its own, it
   lives in ნარდი's. The guest was sent to the ნარდი screen, the server sat
   them at the დამკა table anyway, their screen could not draw it, and the
   host waited for somebody who never arrived. Pressing "new game" on that
   screen then started a game against the COMPUTER underneath it all.

   Played against a real server, for every game, because every game has a
   code and every one of them could be typed into the wrong window.
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
import { createRequire } from "node:module";
import { io } from "socket.io-client";

const CWD = fileURLToPath(new URL("..", import.meta.url));
const PORT = 3979;
const ADDR = `http://127.0.0.1:${PORT}`;
const read = (...p) => readFileSync(path.join(CWD, ...p), "utf8");

let dir, srv;
const clients = [];

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "domino-code-"));
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
  c.got = {};
  for (const ev of ["state", "tableInfo", "wrongTable", "joinError"])
    c.on(ev, (m) => { c.got[ev] = m; });
  clients.push(c);
  return c;
}
const until = async (fn, ms = 8000) => {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await wait(30);
  return fn();
};
const who = () => { n++; return { name: "მ" + n, token: "code-" + n, auth: { kind: "guest", id: "code-" + n } }; };

/* A table for each game, the way each screen asks for one. */
const TABLES = [
  { label: "დომინო",          ask: { size: 2, target: 175 } },
  { label: "დომინო 2v2",      ask: { size: 4, target: 175 } },
  { label: "ბურა",            ask: { game: "bura", variant: "5", size: 2, target: 11 } },
  { label: "ბურა 2v2",        ask: { game: "bura", variant: "5", size: 4, target: 11 } },
  { label: "ჯოკერი",          ask: { game: "joker", variant: "full", size: 4, teams: false } },
  { label: "ჯოკერი წყვილებით", ask: { game: "joker", variant: "nines", size: 4, teams: true } },
  { label: "ნარდი",           ask: { game: "nardi", variant: "short", size: 2, target: 3 } },
  { label: "დამკა",           ask: { game: "damka", size: 2 } },
];

async function hostTable(ask) {
  const host = client();
  host.emit("createTable", { ...who(), ...ask });
  assert.ok(await until(() => host.got.state && host.got.state.code), "no code came back");
  return host.got.state.code;
}

/* ---------------- the table says what it is ---------------- */

for (const t of TABLES) {
  test("a " + t.label + " code says which game it is before anybody moves", async () => {
    const code = await hostTable(t.ask);
    const asker = client();
    asker.emit("peekTable", { code });
    assert.ok(await until(() => asker.got.tableInfo), "nothing answered");
    const info = asker.got.tableInfo;
    assert.equal(info.code, code);
    assert.equal(info.game, t.ask.game || "domino", "the table named the wrong game");
    assert.equal(info.size, t.ask.size, "the table gave the wrong number of seats");
    if (t.ask.game === "joker") assert.equal(info.teams, !!t.ask.teams, "pairs or not, wrong");
    if (t.ask.variant) assert.equal(info.variant, t.ask.variant, "the wrong variant");
  });
}

test("a code that is no table says so, and names the code it was asked about", async () => {
  const asker = client();
  asker.emit("peekTable", { code: "ZZZZ" });
  assert.ok(await until(() => asker.got.tableInfo));
  assert.equal(asker.got.tableInfo.missing, true);
  assert.equal(asker.got.tableInfo.code, "ZZZZ", "the lobby could not tell which question this answers");
});

test("the answer gives nothing away about who is sitting there", async () => {
  const code = await hostTable({ game: "damka", size: 2 });
  const asker = client();
  asker.emit("peekTable", { code });
  assert.ok(await until(() => asker.got.tableInfo));
  const keys = Object.keys(asker.got.tableInfo).sort();
  assert.deepEqual(keys, ["code", "game", "size", "target", "teams", "variant"],
    "the peek says more than which screen to open");
});

/* ---------------- the report itself ---------------- */

test("a დამკა code typed on the ნარდი screen is turned away and pointed at დამკა", async () => {
  const code = await hostTable({ game: "damka", size: 2 });
  const guest = client();
  // exactly what nardi.html sends
  guest.emit("joinTable", { code, ...who(), game: "nardi", variant: "long", target: 3, size: 2 });
  assert.ok(await until(() => guest.got.wrongTable || guest.got.state), "nothing answered");
  assert.ok(!guest.got.state, "the guest was seated at a table their screen cannot draw");
  assert.equal(guest.got.wrongTable.game, "damka", "they were not told where to go");
});

test("and on the დამკა screen the same code seats them and the match starts", async () => {
  const code = await hostTable({ game: "damka", size: 2 });
  const guest = client();
  guest.emit("joinTable", { code, ...who(), game: "damka", size: 2 });
  assert.ok(await until(() => guest.got.state && guest.got.state.cells),
    "the right screen still could not get in");
});

for (const t of TABLES) {
  test("a " + t.label + " code opened on the screen TableLink picks gets in", async () => {
    /* The address the lobby now builds, read back the way that screen reads
       its own address, is what it sends — so this is the whole path. */
    const code = await hostTable(t.ask);
    const asker = client();
    asker.emit("peekTable", { code });
    assert.ok(await until(() => asker.got.tableInfo));
    const url = linkFor(asker.got.tableInfo);
    const say = payloadFrom(url);
    const guest = client();
    guest.emit("joinTable", { code, ...who(), ...say });
    assert.ok(await until(() => guest.got.state || guest.got.wrongTable || guest.got.joinError),
      "nothing answered");
    assert.ok(!guest.got.wrongTable, t.label + ": the screen it was sent to is the wrong one: " + url);
    assert.ok(!guest.got.joinError, t.label + ": " + guest.got.joinError);
    assert.ok(guest.got.state, t.label + ": not seated");
  });
}

test("an older app that says nothing about its game is seated as it always was", async () => {
  const code = await hostTable({ size: 2, target: 175 });
  const guest = client();
  guest.emit("joinTable", { code, ...who() });
  assert.ok(await until(() => guest.got.state), "an app from before this was locked out");
  assert.ok(!guest.got.wrongTable);
});

/* ---------------- the address, built the way the lobby builds it ---------------- */

function linkFor(info) {
  const g = { location: { search: "" } };
  new Function("window", read("public", "js", "tablelink.js")).call(g, g);
  return g.TableLink.screenFor(info);
}

/* What each screen puts in its join, from its own address — copied from the
   screens rather than imagined, so a screen changing what it reads shows up. */
function payloadFrom(url) {
  const [page, query] = url.split("?");
  const qs = new URLSearchParams(query);
  if (page === "online.html") return { game: "domino", size: qs.get("size") === "4" ? 4 : 2 };
  if (page === "buraonline.html") {
    const size = +qs.get("size") === 4 ? 4 : 2;
    return { game: "bura", size, variant: (size === 4 || qs.get("variant") !== "3") ? "5" : "3" };
  }
  if (page === "jokeronline.html")
    return { game: "joker", size: 4, variant: qs.get("v") === "nines" ? "nines" : "full",
             teams: qs.get("teams") === "1" };
  if (page === "nardi.html")
    return { game: "nardi", size: 2, variant: qs.get("v") === "short" ? "short" : "long" };
  if (page === "damka.html") return { game: "damka", size: 2 };
  throw new Error("no screen for " + url);
}

test("the payloads above are the ones the screens really send", () => {
  /* If a screen stops sending its game, the server can no longer tell it is
     at the wrong table and this whole file is testing a fiction. */
  assert.match(read("public", "online.html"), /joinTable",\s*\{ \.\.\.who, code: CODE, game: "domino", size: SIZE \}/);
  assert.match(read("public", "buraonline.html"), /game: "bura",\s*\n?\s*variant: VARIANT, size: SIZE/);
  assert.match(read("public", "jokeronline.html"), /game: "joker", size: 4,\s*\n?\s*variant: VARIANT, teams: TEAMS/);
  assert.match(read("public", "nardi.html"), /game: "nardi", variant: VARIANT, target: TARGET, size: 2/);
  assert.match(read("public", "damka.html"), /game: "damka", size: 2/);
});

/* ---------------- the screens ---------------- */

test("the lobby asks the server which game a code is, instead of guessing", () => {
  const lobby = read("public", "index.html");
  const at = lobby.indexOf("function doJoin()");
  assert.notEqual(at, -1);
  const body = lobby.slice(at, lobby.indexOf("\n    }", at));
  assert.match(body, /emit\("peekTable"/, "the lobby still guesses from the window it was typed in");
  assert.match(lobby, /socket\.on\("tableInfo"/, "nobody listens for the answer");
  assert.match(lobby, /TableLink\.screenFor\(t\)/, "the answer is not turned into an address");
});

test("every online screen follows the table when it guessed wrong", () => {
  for (const f of ["online.html", "buraonline.html", "jokeronline.html", "nardi.html", "damka.html"]) {
    const src = read("public", f);
    assert.match(src, /js\/tablelink\.js/, f + " cannot build the right address");
    assert.match(src, /socket\.on\("wrongTable"/, f + " sits at the wrong table's door for ever");
  }
});

test("a screen is sent to the right table once, never back and forth", () => {
  const g = { location: { search: "?mode=join&code=ABCD&moved=1", replace() { g.went = true; } } };
  new Function("window", read("public", "js", "tablelink.js")).call(g, g);
  assert.equal(g.TableLink.redirectOnce({ code: "ABCD", game: "damka", size: 2 }), false,
    "a screen that has already been moved once was moved again");
  assert.ok(!g.went);
});

test("a board screen that is online never starts a game against the computer", () => {
  /* "New game" used to call the offline start on this very screen, and the
     board played itself behind the waiting window. */
  for (const [f, fn] of [["nardi.html", "startMatch"], ["damka.html", "startGame"]]) {
    const src = read("public", f);
    const at = src.indexOf("async function " + fn + "()");
    assert.notEqual(at, -1, f + " has no " + fn);
    const head = src.slice(at, at + 2500);
    assert.match(head, /if \(ONLINE\) \{/, f + ": a new game online still plays the computer");
    /* Both looked for first: indexOf is -1 for something absent, and -1 is
       less than any real position — an ordering check alone passes loudest
       exactly when the thing it orders has gone. */
    const guard = head.indexOf("if (ONLINE)"), deal = head.indexOf("newGame(");
    assert.notEqual(deal, -1, f + ": " + fn + " no longer deals a game at all");
    assert.ok(guard < deal,
      f + ": the game against the computer is dealt before anything asks if this is online");
    const cpu = src.indexOf("function cpuTurn()");
    assert.match(src.slice(cpu, cpu + 120), /if \(ONLINE\) return;/,
      f + ": the computer can still take a turn at a table with a person at it");
  }
});
