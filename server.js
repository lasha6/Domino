// Domino Online — server.
// Runs the SAME Ozi engine the browser uses (public/js/ozi.js) but keeps the
// authoritative game state here, so the two clients always agree and nobody can
// see the opponent's hand or fake a move.

import express from "express";
import http from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

import { openStore } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const Ozi = require("./public/js/ozi.js");
// levels and the daily streak — the browser draws from this same file, so the
// bar a player watches and the number recorded here cannot drift apart
const Progress = require("./public/js/progress.js");

const store = await openStore();

const app = express();
const server = http.createServer(app);
// The Android app serves its pages from inside the APK, so its socket comes
// from a different origin (capacitor://localhost) than the browser's.
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
app.use(express.static(path.join(__dirname, "public")));

const TARGETS = [75, 175, 255, 355];   // the standard Ozi targets

/* ------------------------------------------------------------------ *
 * who is playing
 *
 * Guests are the default and need nothing. Signing in with Google is
 * optional and only does one thing so far: it proves the name, so nobody can
 * sit down wearing someone else's. Balances still live on the device — that
 * needs somewhere to store them, which is a separate step.
 *
 * The client id is read from the environment (GOOGLE_CLIENT_ID) and handed to
 * clients at /auth/config, so it is configured in one place and the installed
 * app never needs rebuilding for it. With no id set, Google sign-in is simply
 * switched off everywhere and guests are unaffected.
 * ------------------------------------------------------------------ */
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
let googleClient = null;
if (GOOGLE_CLIENT_ID) {
  const { OAuth2Client } = require("google-auth-library");
  googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  console.log("🔐 Google sign-in is on");
} else {
  console.log("👤 guests only — set GOOGLE_CLIENT_ID to offer Google sign-in");
}

app.get("/auth/config", (_req, res) => {
  res.json({ google: !!googleClient, clientId: GOOGLE_CLIENT_ID || null });
});

/* A plain answer to "is this set up properly?" — the startup log says all this,
   but reading a host's log means finding the dashboard first. Nothing secret
   goes in here: no connection string, no keys, only what is switched on. */
app.get("/status", (_req, res) => {
  const keeps = store.kind === "postgres";
  res.json({
    ok: true,
    progress: {
      where: store.kind,                       // postgres | file | memory
      survivesRedeploy: keeps,
      note: keeps
        ? "პროგრესი ბაზაშია — განახლებისას არ იკარგება"
        : store.kind === "file"
          ? "პროგრესი ფაილშია — ჰოსტინგი მას განახლებისას შლის. დააყენე DATABASE_URL"
          : "პროგრესი მეხსიერებაშია — გადატვირთვისას იკარგება. დააყენე DATABASE_URL",
    },
    googleSignIn: !!googleClient,
    upSince: new Date(startedAt).toISOString(),
  });
});
const startedAt = Date.now();

// Returns a verified identity, or null for anyone we cannot vouch for. Never
// throws: a bad token just means "play as a guest".
async function verifyGoogle(idToken) {
  if (!googleClient || typeof idToken !== "string" || idToken.length > 4096) return null;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p || !p.sub) return null;
    return { account: "google:" + p.sub, name: p.given_name || p.name || "", verified: true };
  } catch (err) {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * rooms
 * ------------------------------------------------------------------ */
const rooms = new Map();   // roomId -> room
const waiting = new Map(); // target  -> roomId waiting for an opponent

function makeCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no lookalikes
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(""); }
  while ([...rooms.values()].some((r) => r.code === c));
  return c;
}

function createRoom(target, isPrivate, size) {
  const id = "r" + Math.random().toString(36).slice(2, 9);
  const room = {
    id, target, size: size === 4 ? 4 : 2, private: !!isPrivate,
    code: isPrivate ? makeCode() : null,
    players: [],           // [{id, name, seat}]
    g: null, phase: "wait", // wait | play | draw | roundEnd | over
    lastWinner: 0, log: "",
  };
  rooms.set(id, room);
  return room;
}
const waitKey = (target, size) => target + ":" + size;

function roomOf(socket) {
  const id = socket.data.roomId;
  return id ? rooms.get(id) : null;
}
// Seats are handed out when the match starts (partners must sit opposite), so
// they are NOT the arrival order — always look a player up, never index by hand.
const seatOf = (room, socket) => {
  const p = room.players.find((x) => x.id === socket.id);
  return p ? p.seat : -1;
};
const at = (room, seat) => room.players.find((p) => p.seat === seat);

// Everyone still unpaired when the table fills up goes wherever there is room.
function resolveTeams(room) {
  const count = (t) => room.players.filter((p) => p.team === t).length;
  room.players.forEach((p) => { if (p.team !== 0 && p.team !== 1) p.team = count(0) < 2 ? 0 : 1; });
}
// Partners face each other: team 0 takes seats 0 and 2, team 1 takes 1 and 3.
function assignSeats(room) {
  if (room.size === 2) { room.players.forEach((p, i) => { p.seat = i; p.team = i; }); return; }
  resolveTeams(room);
  const t0 = room.players.filter((p) => p.team === 0);
  const t1 = room.players.filter((p) => p.team === 1);
  t0.forEach((p, i) => { p.seat = i * 2; });        // 0, 2
  t1.forEach((p, i) => { p.seat = i * 2 + 1; });    // 1, 3
}

/* ------------------------------------------------------------------ *
 * per-player view (never leaks the opponent's hand)
 * ------------------------------------------------------------------ */
function viewFor(room, seat) {
  const g = room.g;
  const me = room.players.find((p) => p.seat === seat);
  const base = {
    roomId: room.id, code: room.code, target: room.target, size: room.size,
    phase: room.phase, seat, log: room.log,
    players: room.players.map((p) => ({ name: p.name, seat: p.seat })),
    // somebody dropped: everyone sees who, and how long they have to come back
    paused: !!room.paused,
    waitingFor: room.paused ? room.players.filter((p) => p.online === false).map((p) => p.name) : [],
    resumeIn: room.resumeBy ? Math.max(0, Math.round((room.resumeBy - Date.now()) / 1000)) : null,
  };
  if (!g) {
    // waiting room: who is here, who is paired with whom, what I may do
    // team sizes as they'd look without me, since joining is what I'm deciding
    const cnt = (t) => room.players.filter((p) => p.team === t && (!me || p.idx !== me.idx)).length;
    base.lobby = room.players.map((p) => ({
      idx: p.idx, name: p.name, team: p.team, me: !!me && p.idx === me.idx,
      verified: !!p.verified,          // signed in, so the name is really theirs
      // I can pair with them unless we're already partners, and either they
      // have a free seat beside them, or we're both free and a team is empty
      pairable: !!me && p.idx !== me.idx
        && !(me.team !== null && p.team === me.team)
        && ((p.team === 0 || p.team === 1) ? cnt(p.team) < 2 : (cnt(0) === 0 || cnt(1) === 0)),
    }));
    base.myTeam = me ? me.team : null;
    base.canStayAlone = !!me && me.team !== null;
    base.autoStartIn = room.autoStartAt ? Math.max(0, Math.round((room.autoStartAt - Date.now()) / 1000)) : null;
    return base;
  }
  // everyone at the table, described relative to the viewer:
  //   0 = me, 1 = next to play (left), 2 = across (partner in 2v2), 3 = right
  const seats = room.players.map((p) => ({
    seat: p.seat, name: p.name, verified: !!p.verified,
    count: g.hands[p.seat].length,
    rel: (p.seat - seat + room.size) % room.size,
    team: Ozi.teamOf(g, p.seat),
    turn: g.turn === p.seat,
    bot: !!p.bot,                       // the computer took this seat over
    away: !p.bot && p.online === false, // dropped, might still come back
    reserve: liveReserve(room, p),      // seconds banked, ticking if in overtime
  }));
  return {
    ...base,
    line: g.line, top: g.top, bottom: g.bottom, spinnerVal: g.spinnerVal,
    hand: g.hands[seat],
    seats,
    myTeam: Ozi.teamOf(g, seat),
    oppCount: room.size === 2 ? g.hands[1 - seat].length : undefined,
    boneSlots: g.boneyard.map((t) => !!t),   // which slots still hold a tile
    boneDrawable: Ozi.drawableCount(g),
    scores: g.scores, round: g.round, turn: g.turn,
    myTurn: g.turn === seat && (room.phase === "play" || room.phase === "draw"),
    moveLeft: room.moveDeadline ? Math.max(0, Math.ceil((room.moveDeadline - Date.now()) / 1000)) : null,
    overtimeLeft: room.overtimeUntil ? Math.max(0, Math.ceil((room.overtimeUntil - Date.now()) / 1000)) : null,
    moveTime: Math.round(MOVE_TIME / 1000),
  };
}
function pushState(room) {
  room.players.forEach((p) => {
    const s = io.sockets.sockets.get(p.id);
    if (s) s.emit("state", viewFor(room, p.seat));
  });
}
function say(room, text) { room.log = text; }

/* ------------------------------------------------------------------ *
 * game flow
 * ------------------------------------------------------------------ */
const PAIR_GRACE = 15000;      // ms the full 2v2 table gets to finish choosing partners
const RECONNECT_GRACE = 90000; // ms a dropped player's seat is held open

/* The clock. Nobody should be able to freeze the table by putting the phone
   down — so every turn has a short countdown, and running it out costs you
   from a bank that lasts the whole match. Empty the bank and you lose. */
const MOVE_TIME = 25000;        // per turn, restarts every time
const RESERVE_START = 150000;   // the bank each player starts the match with
const TIMEOUT_PENALTY = 30000;  // taken from the bank each time a turn times out

function closeRoom(room) {
  clearTimeout(room.dropTimer); clearTimeout(room.botTimer);
  clearTimeout(room.moveTimer); clearAuto(room);
  rooms.delete(room.id);
}

// The table only waits for players who might still come back — a seat the
// computer has taken over is never waited for.
function refreshPause(room) {
  const missing = room.players.filter((p) => !p.bot && p.online === false);
  room.paused = missing.length > 0;
  if (!room.paused) {
    room.resumeBy = null;
    clearTimeout(room.dropTimer); room.dropTimer = null;
  }
}

// A player is gone for good. In 2v2 their partner keeps playing and the
// computer takes over the empty seat — the match only ends when a whole side
// has walked away (in 1v1 that is just the one player).
function abandonSeat(room, p) {
  p.bot = true; p.online = false; p.id = null;
  const deadTeam = [0, 1].find((t) => {
    const side = room.players.filter((x) => x.team === t);
    return side.length > 0 && side.every((x) => x.bot);
  });
  if (deadTeam != null) return { dead: true };
  say(room, `${p.name} გავიდა — მის ქვებს კომპიუტერი აგრძელებს`);
  refreshPause(room);
  return { dead: false };
}

// Play a turn for a seat the computer has taken over — or, with `force`, for a
// player whose turn clock ran out.
function botMove(room, force) {
  if (!rooms.has(room.id) || room.paused || !room.g) return;
  const g = room.g;
  const p = at(room, g.turn);
  if (!p || (!p.bot && !force)) return;
  if (room.phase === "draw") {
    const i = Ozi.randomBoneSlot(g);
    if (i >= 0 && Ozi.drawSlot(g, g.turn, i)) say(room, `${p.name} აიღო ბაზრიდან`);
    return advance(room);
  }
  const m = Ozi.aiChoose(g, g.turn);
  if (!m) return advance(room);
  const pts = Ozi.applyMove(g, g.turn, m.tile, m.side);
  g.passes = 0;
  say(room, `${p.name}: [${m.tile[0]}–${m.tile[1]}]` + (pts ? ` — +${pts} ქულა!` : ""));
  if (g.hands[g.turn].length === 0) return endRound(room, g.turn);
  g.turn = nextSeat(room, g.turn);
  advance(room);
}
function botMaybe(room) {
  const p = at(room, room.g.turn);
  if (!p || !p.bot) { armClock(room); return; }
  clearClock(room);
  clearTimeout(room.botTimer);
  room.botTimer = setTimeout(() => botMove(room), 900);   // a beat, so it reads
}

/* ---------------- the turn clock ----------------
   Two clocks, both visible to the players. The turn clock runs first; when it
   runs out the player's bank starts draining in real time, and they are only
   charged for the seconds they actually use. The computer steps in once the
   overtime window is spent, and an empty bank loses the match. */
function clearClock(room) {
  if (room.moveTimer) { clearTimeout(room.moveTimer); room.moveTimer = null; }
  room.moveDeadline = null; room.overtimeStart = null; room.overtimeUntil = null;
}
function armClock(room) {
  clearClock(room);
  if (room.paused || !room.g) return;
  if (room.phase !== "play" && room.phase !== "draw") return;
  const p = at(room, room.g.turn);
  if (!p || p.bot) return;                       // the computer needs no clock
  room.moveDeadline = Date.now() + MOVE_TIME;
  room.moveTimer = setTimeout(() => startOvertime(room), MOVE_TIME);
}
// turn clock spent — start eating the bank, but the player may still move
function startOvertime(room) {
  if (!rooms.has(room.id) || room.paused || !room.g) return;
  const p = at(room, room.g.turn);
  if (!p || p.bot) return;
  const window = Math.min(TIMEOUT_PENALTY, p.reserve);
  room.moveDeadline = null;
  room.overtimeStart = Date.now();
  room.overtimeUntil = Date.now() + window;
  say(room, `${p.name} — სვლის დრო გავიდა, მარაგი იხარჯება`);
  pushState(room);
  room.moveTimer = setTimeout(() => onOvertimeEnd(room), window);
}
// charge the bank for the overtime actually used (called when they finally move)
function spendOvertime(room) {
  if (!room.overtimeStart || !room.g) return;
  const p = at(room, room.g.turn);
  if (p && !p.bot) p.reserve = Math.max(0, p.reserve - (Date.now() - room.overtimeStart));
  room.overtimeStart = null; room.overtimeUntil = null;
}
function onOvertimeEnd(room) {
  if (!rooms.has(room.id) || room.paused || !room.g) return;
  const p = at(room, room.g.turn);
  if (!p || p.bot) return;
  spendOvertime(room);
  if (p.reserve <= 0) {                          // bank empty — the match is lost
    say(room, `${p.name} — დრო ამოიწურა`);
    return endMatchByTimeout(room, p);
  }
  say(room, `${p.name} — დრო გავიდა, კომპიუტერმა დადო`);
  botMove(room, true);
}
// what a player's bank reads right now, including any overtime ticking away
function liveReserve(room, p) {
  let r = p.reserve || 0;
  if (room.overtimeStart && room.g && at(room, room.g.turn) === p) {
    r = Math.max(0, r - (Date.now() - room.overtimeStart));
  }
  return Math.max(0, Math.round(r / 1000));
}
function endMatchByTimeout(room, loser) {
  clearClock(room); clearTimeout(room.botTimer); clearTimeout(room.dropTimer);
  room.phase = "over"; room.paused = false;
  const g = room.g;
  room.players.forEach((o) => {
    const s = io.sockets.sockets.get(o.id);
    if (s) s.emit("matchOver", {
      youWon: o.team !== loser.team,
      scores: g.scores, myTeam: o.team, target: room.target, size: room.size,
      reason: "time", who: loser.name });
  });
  pushState(room);
}

function clearAuto(room) {
  if (room.autoTimer) { clearTimeout(room.autoTimer); room.autoTimer = null; }
  room.autoStartAt = null;
}

// Start once the table is full. In 2v2 we wait for both pairs to be settled,
// but only for a short grace period so an undecided player can't stall everyone.
function maybeStart(room) {
  if (room.players.length < room.size) { clearAuto(room); return false; }
  if (room.size === 2) { startMatch(room); return true; }
  const c0 = room.players.filter((p) => p.team === 0).length;
  const c1 = room.players.filter((p) => p.team === 1).length;
  if (c0 === 2 && c1 === 2) { clearAuto(room); startMatch(room); return true; }
  if (!room.autoTimer) {
    room.autoStartAt = Date.now() + PAIR_GRACE;
    room.autoTimer = setTimeout(() => {
      room.autoTimer = null;
      if (rooms.has(room.id) && room.phase === "wait" && room.players.length === room.size) startMatch(room);
    }, PAIR_GRACE);
  }
  return false;
}

function startMatch(room) {
  clearAuto(room);
  assignSeats(room);                 // partners opposite; fills in anyone unpaired
  room.g = Ozi.newGame(room.target, room.size);
  room.lastWinner = 0;
  room.players.forEach((p) => { p.reserve = RESERVE_START; });
  startRound(room, true);
}
const nextSeat = (room, s) => (s + 1) % room.size;

function startRound(room, firstHand) {
  const g = room.g;
  if (!firstHand) Ozi.dealOpeningHand(g);   // fresh tiles for the new hand
  g.passes = 0;
  if (firstHand) {
    let hd = Ozi.highestDouble(g.hands);
    if (!hd) {                               // safety net; newGame guarantees one
      let bp = 0, bt = g.hands[0][0];
      for (let p = 0; p < 2; p++) for (const t of g.hands[p])
        if (t[0] + t[1] > bt[0] + bt[1]) { bt = t; bp = p; }
      hd = { player: bp, tile: bt };
    }
    Ozi.applyMove(g, hd.player, hd.tile, "open");
    g.turn = nextSeat(room, hd.player);
    say(room, `${at(room, hd.player).name} გახსნა [${hd.tile[0]}–${hd.tile[1]}]`);
  } else {
    g.turn = room.lastWinner;
    say(room, `ახალი ხელი — იწყებს ${at(room, g.turn).name}`);
  }
  room.phase = "play";
  advance(room);
}

// Make sure the player to move actually can move; otherwise draw or pass.
function advance(room) {
  const g = room.g;
  refreshPause(room);
  clearClock(room);                               // the clock is re-armed below
  if (room.paused) { pushState(room); return; }   // somebody dropped — hold everything
  for (let guard = 0; guard < 20; guard++) {
    // arm the clock BEFORE pushing, or the state goes out with no deadline in it
    if (Ozi.hasMove(g, g.hands[g.turn])) { room.phase = "play"; botMaybe(room); pushState(room); return; }
    if (Ozi.canDraw(g)) { room.phase = "draw"; botMaybe(room); pushState(room); return; }  // player picks a slot
    // stuck and nothing to draw -> pass
    g.passes++;
    say(room, `${at(room, g.turn).name}: პასი`);
    if (g.passes >= room.size) { endRound(room, null); return; }   // everyone stuck = blocked
    g.turn = nextSeat(room, g.turn);
  }
  pushState(room);
}

/* ------------------------------------------------------------------ *
 * progress
 *
 * Only the server hands out experience, coins or streaks. The browser draws
 * the same picture from public/js/progress.js, but nothing it says is taken
 * as fact — otherwise a level is just a number a player can type.
 * ------------------------------------------------------------------ */
// The shape the screens read. Levels are worked out from total xp, never
// stored, so an old record can never disagree with the current curve.
function summarise(p) {
  const lv = Progress.levelFromXp(p.xp);
  return {
    name: p.name, coins: p.coins,
    xp: p.xp, level: lv.level, into: lv.into, need: lv.need,
    stats: p.stats,
    daily: Progress.dailyState(p.daily),
    achievements: Progress.achievementProgress(p),
  };
}

/* Hand out anything just earned, and return what it was so the screen can
   celebrate. Awards can cascade — the coins and xp from one achievement can
   carry a player over a level, which earns another — so this keeps going until
   nothing new lands, with a stop in case a future goal ever feeds itself. */
function collect(pr) {
  const won = [];
  for (let pass = 0; pass < 5; pass++) {
    const fresh = Progress.newlyEarned(pr);
    if (!fresh.length) break;
    fresh.forEach((a) => {
      pr.achievements[a.id] = { at: Date.now() };
      pr.coins += a.coins;
      pr.xp += a.xp;
      won.push({ id: a.id, title: a.title, coins: a.coins, xp: a.xp });
    });
  }
  return won;
}

function touch(room, p, fn) {
  if (!p || !p.profile) return [];   // a bot, or a player with no id yet
  fn(p.profile);
  const won = collect(p.profile);
  store.save(p.profile);
  if (won.length) p.lastEarned = (p.lastEarned || []).concat(won);
  return won;
}

// Everyone at the table gets credit for the hand; the winning side gets more.
function awardHand(room, winnerSeat) {
  const g = room.g;
  const winTeam = winnerSeat == null ? null : Ozi.teamOf(g, winnerSeat);
  room.players.forEach((p) => {
    const team = Ozi.teamOf(g, p.seat);
    const won = winTeam != null && team === winTeam;
    const scored = g.scores[team] - (p.scoreAtHandStart || 0);
    touch(room, p, (pr) => {
      pr.stats.hands++;
      if (won) pr.stats.handWins++;
      pr.stats.points += Math.max(0, scored);
      pr.stats.bestHand = Math.max(pr.stats.bestHand, Math.max(0, scored));
      pr.xp += Progress.handXp(won, scored);
    });
    p.scoreAtHandStart = g.scores[team];
  });
}

// The stake per room, and the only place it is settled. It used to be done in
// the browser, where a player could simply hand themselves the winnings.
const STAKES = { 75: 50, 175: 100, 255: 250, 355: 500 };
const stakeFor = (target) => STAKES[target] || STAKES[175];

function awardMatch(room, p, won) {
  touch(room, p, (pr) => {
    pr.stats.matches++;
    if (won) {
      pr.stats.matchWins++;
      pr.stats.streak++;
      pr.stats.bestStreak = Math.max(pr.stats.bestStreak, pr.stats.streak);
    } else {
      pr.stats.streak = 0;
    }
    pr.xp += Progress.matchXp(won);

    const stake = stakeFor(room.target);
    pr.coins = Math.max(0, pr.coins + (won ? stake : -stake));
    p.lastSettle = { stake, delta: won ? stake : -stake, after: pr.coins };
  });
}

function endRound(room, winnerSeat) {
  const g = room.g;
  clearClock(room);
  const wasBlocked = winnerSeat === null;     // decided before winnerSeat is reassigned
  const teamName = (t) => room.players.filter((p) => Ozi.teamOf(g, p.seat) === t)
    .map((p) => p.name).join(" + ");
  let text;
  if (winnerSeat === null) {
    // blocked: only the side with fewer pips scores (see Ozi.blockResult)
    const r = Ozi.blockResult(g);
    if (r.draw) { text = "ბლოკი — ფრე (თანაბარი ქულა)"; room.lastWinner = g.turn; }
    else {
      g.scores[r.team] += r.bonus;
      text = `ბლოკი! ${teamName(r.team)} — +${r.bonus} ქულა`;
      room.lastWinner = Ozi.seatsOfTeam(g, r.team)[0];
    }
  } else {
    const team = Ozi.teamOf(g, winnerSeat);
    const bonus = Ozi.teamHandPoints(g, 1 - team);
    g.scores[team] += bonus;
    text = `${at(room, winnerSeat).name} დაასრულა ხელი — +${bonus} ქულა`;
    room.lastWinner = winnerSeat;
  }
  g.round++;
  const mr = Ozi.matchResult(g, wasBlocked);   // handles the "რიბა" rule
  say(room, `${text} | ანგარიში ${g.scores[0]} : ${g.scores[1]}`
    + (mr.riba ? " — რიბა! დამატებითი ხელი" : ""));

  // credit the hand before anything else — a match that ends here still counts
  // the hand that ended it
  awardHand(room, wasBlocked ? null : room.lastWinner);

  if (mr.over) {
    room.phase = "over";
    const champTeam = mr.champTeam;
    room.players.forEach((p) => {
      const s = io.sockets.sockets.get(p.id);
      const won = Ozi.teamOf(g, p.seat) === champTeam;
      awardMatch(room, p, won);
      if (s) s.emit("matchOver", {
        youWon: won,
        scores: g.scores, myTeam: Ozi.teamOf(g, p.seat), target: g.target, size: room.size,
        progress: p.profile ? summarise(p.profile) : null,
        settled: p.lastSettle || null,
        earned: p.lastEarned || [] });
      p.lastEarned = [];
    });
    pushState(room);
  } else {
    room.phase = "roundEnd";
    pushState(room);
    setTimeout(() => {
      if (!rooms.has(room.id) || room.phase !== "roundEnd") return;
      if (room.paused) { room.pendingNextRound = true; return; }  // wait for the drop
      startRound(room, false);
    }, 3500);
  }
}

/* ------------------------------------------------------------------ *
 * sockets
 * ------------------------------------------------------------------ */
io.on("connection", (socket) => {
  /* Anyone on the internet can send us anything at all, including nothing.
     A missing payload used to throw straight out of the handler while
     destructuring, and an uncaught throw here takes the whole process down —
     with every live game on it. So no handler is registered directly: they all
     go through here, which guarantees an object and swallows the fall. */
  const on = (event, fn) => socket.on(event, (payload) => {
    const oops = (err) => console.error(`[${event}] ignored:`, (err && err.message) || err);
    try {
      const r = fn(payload && typeof payload === "object" ? payload : {});
      if (r && typeof r.then === "function") r.catch(oops);   // handlers may be async
    } catch (err) { oops(err); }
  });

  // A name is typed by a stranger and shown to everyone else: keep it short,
  // one line, and free of the characters that turn text into markup.
  const clean = (n) => String(n == null ? "" : n)
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")   // control chars and tag brackets
    .trim().slice(0, 14).trim() || "სტუმარი";

  // Work out who this is before seating them. A Google token is checked with
  // Google; anything else is a guest, taken at their word — which is exactly
  // why only a signed-in name is ever marked verified.
  async function identify(auth, name) {
    if (auth && auth.kind === "google" && auth.idToken) {
      const ok = await verifyGoogle(auth.idToken);
      if (ok) return { name: ok.name || name, account: ok.account, verified: true };
      // The token did not check out — usually just old, since Google's last
      // about an hour. They keep playing under the device's own progress
      // rather than being left with nothing, and the name loses its tick.
    }
    // A guest still gets progress, kept against the id their device made. It
    // stays with the device rather than the person — signing in is what
    // carries a level to a new phone.
    const id = auth && typeof auth.id === "string" && auth.id.length <= 64 ? auth.id : null;
    return { name, account: id ? "guest:" + id : null, verified: false };
  }

  // identify(), then fetch what we already know about them
  async function whoIs(auth, name) {
    const who = await identify(auth, name);
    if (who.account) who.profile = await store.load(who.account, who.verified ? "google" : "guest", who.name);
    return who;
  }

  function seat(room, who, token) {
    let nm = clean(who && who.name);
    // two players may pick the same name — keep them tellable apart
    if (room.players.some((p) => p.name === nm)) nm = nm + " (2)";
    const idx = room.players.length;
    // team stays null until the player picks a partner (or the table fills up);
    // token is how we recognise them if their connection drops
    room.players.push({ id: socket.id, name: nm, idx, seat: idx, team: null,
      account: (who && who.account) || null, verified: !!(who && who.verified),
      profile: (who && who.profile) || null,
      token: token || ("t" + Math.random().toString(36).slice(2)), online: true });
    socket.data.roomId = room.id;
    socket.join(room.id);
    return idx;
  }

  // --- quick match: pair with anyone waiting on the same target AND table size ---
  on("quickJoin", async ({ target, name, size, token, auth }) => {
    const t = TARGETS.includes(target) ? target : 175;
    const sz = size === 4 ? 4 : 2;
    const who = await whoIs(auth, name);
    const key = waitKey(t, sz);
    let room = waiting.has(key) ? rooms.get(waiting.get(key)) : null;
    if (room && room.players.length < room.size) {
      seat(room, who, token);
      if (room.players.length >= room.size) waiting.delete(key);
      say(room, room.players.length >= room.size
        ? (sz === 4 ? "მაგიდა შედგა — აირჩიეთ წყვილები" : "მოწინააღმდეგე მოიძებნა!")
        : `ველოდებით — ${room.players.length}/${room.size}`);
      if (!maybeStart(room)) pushState(room);
    } else {
      room = createRoom(t, false, sz);
      seat(room, who, token);
      waiting.set(key, room.id);
      say(room, `ველოდებით — 1/${sz}`);
      pushState(room);
    }
  });

  // --- private table: create / join by code ---
  on("createTable", async ({ target, name, size, token, auth }) => {
    const t = TARGETS.includes(target) ? target : 175;
    const who = await whoIs(auth, name);
    const room = createRoom(t, true, size === 4 ? 4 : 2);
    seat(room, who, token);
    say(room, "გაუზიარე კოდი მეგობრებს");
    pushState(room);
  });

  on("joinTable", async ({ code, name, token, auth }) => {
    const room = [...rooms.values()].find((r) => r.code === String(code || "").toUpperCase());
    if (!room) return socket.emit("joinError", "ასეთი მაგიდა ვერ მოიძებნა");
    if (room.players.length >= room.size) return socket.emit("joinError", "მაგიდა უკვე სავსეა");
    const who = await whoIs(auth, name);
    if (room.players.length >= room.size) return socket.emit("joinError", "მაგიდა უკვე სავსეა");
    seat(room, who, token);
    say(room, room.players.length >= room.size
      ? (room.size === 4 ? "მაგიდა შედგა — აირჩიეთ წყვილები" : "მეგობარი შემოვიდა!")
      : `ველოდებით — ${room.players.length}/${room.size}`);
    if (!maybeStart(room)) pushState(room);
  });

  // --- 2v2 waiting room: pick who you play with ---
  on("choosePartner", ({ idx }) => {
    const room = roomOf(socket); if (!room || room.phase !== "wait" || room.size !== 4) return;
    const me = room.players.find((p) => p.id === socket.id);
    const other = room.players.find((p) => p.idx === idx);
    if (!me || !other || other.idx === me.idx) return;
    const count = (t) => room.players.filter((p) => p.team === t && p.idx !== me.idx).length;

    if (other.team === 0 || other.team === 1) {
      if (count(other.team) >= 2) return socket.emit("joinError", "ეს წყვილი უკვე შედგა");
      me.team = other.team;
    } else {
      const free = count(0) === 0 ? 0 : count(1) === 0 ? 1 : null;   // need a whole empty team
      if (free === null) return socket.emit("joinError", "ადგილი აღარ არის");
      me.team = free; other.team = free;
    }
    say(room, `${me.name} + ${other.name} — წყვილი`);
    if (!maybeStart(room)) pushState(room);
  });

  on("stayAlone", () => {
    const room = roomOf(socket); if (!room || room.phase !== "wait" || room.size !== 4) return;
    const me = room.players.find((p) => p.id === socket.id);
    if (!me) return;
    me.team = null;
    say(room, `${me.name} ელოდება თავის წყვილს`);
    pushState(room);
  });

  // --- moves ---
  on("play", ({ tile, side }) => {
    const room = roomOf(socket); if (!room || room.phase !== "play" || room.paused) return;
    const s = seatOf(room, socket); const g = room.g;
    if (s < 0 || g.turn !== s) return;
    if (!Array.isArray(tile) || tile.length !== 2) return;
    if (!g.hands[s].some((t) => Ozi.sameTile(t, tile))) return;          // not your tile
    if (!Ozi.matchingSides(g, tile).includes(side)) return;              // illegal side

    spendOvertime(room);          // pay for the thinking time actually used
    const pts = Ozi.applyMove(g, s, tile, side);
    g.passes = 0;
    say(room, `${at(room, s).name}: [${tile[0]}–${tile[1]}]` + (pts ? ` — +${pts} ქულა!` : ""));
    if (g.hands[s].length === 0) return endRound(room, s);
    g.turn = nextSeat(room, s);
    advance(room);
  });

  on("draw", ({ slot }) => {
    const room = roomOf(socket); if (!room || room.phase !== "draw" || room.paused) return;
    const s = seatOf(room, socket); const g = room.g;
    if (s < 0 || g.turn !== s) return;
    spendOvertime(room);          // pay for the thinking time actually used
    const t = Ozi.drawSlot(g, s, slot);
    if (!t) return;
    say(room, `${at(room, s).name} აიღო ბაზრიდან`);
    advance(room);   // may need to draw again, or can now play
  });

  /* ---------------- profile: level, coins, streaks ---------------- */
  on("profile", async ({ auth, name }) => {
    const who = await whoIs(auth, clean(name));
    if (!who.profile) return socket.emit("profile", null);
    if (who.name && who.profile.name !== who.name) {
      who.profile.name = clean(who.name);
      store.save(who.profile);
    }
    socket.emit("profile", { ...summarise(who.profile), verified: who.verified });
  });

  // The daily reward is worked out and granted here, never asked for. A second
  // request on the same day simply gets the same "already claimed" answer.
  on("claimDaily", async ({ auth, name }) => {
    const who = await whoIs(auth, clean(name));
    if (!who.profile) return socket.emit("dailyResult", { ok: false, reason: "unknown" });
    const pr = who.profile;
    const state = Progress.dailyState(pr.daily);
    if (!state.canClaim) return socket.emit("dailyResult", { ok: false, reason: "claimed", ...summarise(pr) });

    pr.coins += state.reward;
    pr.xp += Progress.XP.dailyClaim;
    pr.daily = { lastClaim: Date.now(), streak: state.streak };
    const earned = collect(pr);            // a week's streak is an achievement
    await store.save(pr);
    socket.emit("dailyResult", { ok: true, reward: state.reward, streak: state.streak, day: state.day,
      earned, ...summarise(pr) });
  });

  on("leaveRoom", () => leave(socket, true));   // deliberate exit
  on("disconnect", () => leave(socket, false)); // dropped — hold the seat

  // Coming back after a drop: the browser remembers a token, we match it to the
  // held seat and carry on from exactly where the hand was.
  on("resume", ({ token }) => {
    if (!token) return socket.emit("resumeFailed");
    const room = [...rooms.values()].find((r) => r.players.some((p) => p.token === token));
    if (!room || room.phase === "over") return socket.emit("resumeFailed");
    const p = room.players.find((x) => x.token === token);
    p.id = socket.id; p.online = true;
    socket.data.roomId = room.id;
    socket.join(room.id);
    if (room.players.every((x) => x.online !== false)) {
      clearTimeout(room.dropTimer); room.dropTimer = null;
      room.paused = false; room.resumeBy = null;
      say(room, `${p.name} დაბრუნდა`);
      if (room.pendingNextRound) { room.pendingNextRound = false; startRound(room, false); return; }
      if (room.phase === "play" || room.phase === "draw") { advance(room); return; }
    }
    pushState(room);
  });

  // `quit` = the player pressed back and meant it; a plain disconnect is
  // treated as a drop, and the seat is held open for them.
  function leave(sock, quit) {
    const room = roomOf(sock);
    if (!room) return;
    const p = room.players.find((x) => x.id === sock.id);
    sock.data.roomId = null;
    if (!p) return;

    // before the match starts (or after it ends) a leaver is simply removed
    if (room.phase === "wait" || room.phase === "over") {
      room.players = room.players.filter((x) => x.id !== sock.id);
      for (const [k, id] of waiting) if (id === room.id) waiting.delete(k);
      clearAuto(room);
      if (room.players.length === 0) { closeRoom(room); return; }
      if (room.phase === "wait") {
        say(room, `${p.name} გავიდა — ${room.players.length}/${room.size}`);
        pushState(room);
      }
      return;
    }

    // walked out mid-match: hand the seat to the computer, unless that empties
    // a whole side — then the match really is over
    if (quit) {
      if (abandonSeat(room, p).dead) { endMatchEarly(room, p.name); return; }
      advance(room);
      return;
    }

    // mid-match drop: hold the seat and pause everything
    p.online = false;
    p.id = null;
    room.paused = true;
    room.resumeBy = Date.now() + RECONNECT_GRACE;
    say(room, `${p.name} — კავშირი გაწყდა, ველოდებით…`);
    pushState(room);
    clearTimeout(room.dropTimer);
    room.dropTimer = setTimeout(() => {
      if (!rooms.has(room.id) || p.online) return;
      // never came back — same rule as walking out
      if (abandonSeat(room, p).dead) { endMatchEarly(room, p.name); return; }
      advance(room);
    }, RECONNECT_GRACE);
  }

  function endMatchEarly(room, name) {
    room.phase = "over"; room.paused = false;
    clearTimeout(room.dropTimer); room.dropTimer = null;
    room.players.forEach((o) => {
      const s2 = io.sockets.sockets.get(o.id);
      if (s2) s2.emit("opponentLeft", { name });
    });
    pushState(room);
  }
});

// Hosting providers hand the port over in an env var; 3000 is the local default.
const PORT = process.env.PORT || 3000;
// 0.0.0.0 so other devices reach it — your phone on the same Wi-Fi, or the
// host's router once this is deployed.
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Domino server running on port ${PORT}`);
});

// A host restarting us sends SIGTERM; finish writing before going quiet, or
// somebody loses the match they just won.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    try { await store.close(); } catch (err) {}
    process.exit(0);
  });
}
