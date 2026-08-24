/* =====================================================================
   The versus card.

   One card introduces all five games, which only works because the server
   sends the same two fields on every view. The card itself is drawn in a
   browser and cannot be run here — what can be checked is the contract it
   depends on, and that is exactly the part that would rot silently: a new
   game view added without a roster shows an empty card, and nothing about it
   would fail until somebody sat down at that table.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const server = readFileSync(path.join(ROOT, "server.js"), "utf8");
const versus = readFileSync(path.join(ROOT, "public", "js", "versus.js"), "utf8");
const base = readFileSync(path.join(ROOT, "public", "css", "base.css"), "utf8");

/* the screens that can have another person on the other side of them */
const ONLINE = ["online.html", "buraonline.html", "jokeronline.html",
                "nardi.html", "damka.html"];

test("every view the server sends carries a roster and a stake", () => {
  /* Five games, five view builders. A card cannot introduce players it was
     never told about. */
  /* Counted from the base object every view builds — the domino one is simply
     called `view`, so counting names would miss it and pass while the card
     stayed empty on the game the app is named after. */
  const built = (server.match(/resumeIn: room\.resumeBy/g) || []).length;
  const carries = (server.match(/roster: roster\(room, seat\), stake: matchStake\(room\)/g) || []).length;
  assert.ok(built >= 5, "found " + built + " views");
  assert.equal(carries, built,
    `${built} views but only ${carries} of them send a roster`);
});

test("the roster says which side each player is on, and which one is me", () => {
  const at = server.indexOf("function roster(room, seat)");
  assert.notEqual(at, -1, "there is no roster helper");
  const body = server.slice(at, at + 600);
  for (const field of ["seat", "team", "name", "bot", "pic", "level", "me"])
    assert.match(body, new RegExp("\\b" + field + ":"), "the roster is missing " + field);
});

test("every online screen loads the card and asks for it", () => {
  for (const f of ONLINE) {
    const html = readFileSync(path.join(ROOT, "public", f), "utf8");
    assert.match(html, /src="js\/versus\.js"/, f + " never loads versus.js");
    assert.match(html, /maybeVersus\(st,/, f + " never asks for the card");
  }
});

test("the card is shown once, and never to somebody playing alone", () => {
  /* Against the computer there is nobody to be introduced to, and a card that
     came back every hand would be an interruption rather than an occasion. */
  assert.match(versus, /if \(vsShown\b|showing \|\|/,
    "nothing stops it being shown twice");
  assert.match(versus, /list\.every\(\(p\) => p\.me \|\| p\.bot\)/,
    "a table of bots still gets a card");
  for (const f of ONLINE) {
    const html = readFileSync(path.join(ROOT, "public", f), "utf8");
    assert.match(html, /if \(vsShown \|\| !started \|\| !window\.Versus\) return;/,
      f + " can show the card more than once");
  }
});

test("it draws two sides from the teams, not from the seats", () => {
  /* 2v2 is two against two, and partners are not always the seats next to
     each other — reading seat numbers instead of teams would put a man
     opposite his own partner. */
  assert.match(versus, /p\.team === mine\.team/, "our side is read from the team");
  assert.match(versus, /p\.team !== mine\.team/, "and so is theirs");
});

test("the card has a tip for every game the lobby can start", () => {
  const games = ["domino", "bura", "joker", "nardi", "damka"];
  const block = versus.slice(versus.indexOf("const TIPS"), versus.indexOf("const pick"));
  for (const g of games) {
    const at = block.indexOf(g + ": [");
    assert.notEqual(at, -1, "no tips for " + g);
    const list = block.slice(at, block.indexOf("]", at));
    assert.ok((list.match(/"/g) || []).length >= 2, g + " has no tip written");
  }
});

test("nothing on the card is typed as an emoji", () => {
  /* The same rule the board screens keep: an emoji is somebody else's drawing,
     at somebody else's size, in whatever style the phone happens to ship. */
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
  assert.doesNotMatch(versus, emoji, "versus.js carries an emoji");
});

test("the card is styled where every screen already looks", () => {
  // base.css is loaded by all of them, so the card costs no extra request
  for (const cls of [".vsWrap", ".vsCard", ".vsFace", ".vsMark", ".vsStake", ".vsBar"])
    assert.ok(base.includes(cls), "base.css has no " + cls);
});

/* ---------------- the card that closes a match ---------------- */

test("the end of a match has a card of its own", () => {
  assert.match(versus, /function result\(st, r\)/, "there is no result card");
  assert.match(versus, /global\.Versus = \{ show, result, open \}/,
    "the result card is not handed out");
});

test("the coins are counted rather than stated", () => {
  /* A number that arrives already at its new value tells a player nothing
     about what just happened to it. */
  assert.match(versus, /function count\(el, from, to, ms\)/, "nothing counts");
  assert.match(versus, /requestAnimationFrame\(step\)/, "the count does not animate");
  assert.match(versus, /settled\.after - \(settled\.delta \|\| 0\)/,
    "it must count from where the purse was, not from zero");
});

test("every online screen shows the closing card too", () => {
  for (const f of ONLINE) {
    const html = readFileSync(path.join(ROOT, "public", f), "utf8");
    assert.match(html, /Versus\.result\(/, f + " never closes a match with the card");
  }
});

test("the losing side is stepped back, not hidden", () => {
  /* They were there. A card that erases the other side reads as a scoreboard
     rather than as the end of a game between two people. */
  assert.match(base, /\.vsEnd \.vsSide\.beat\{[^}]*opacity:\.42/,
    "the beaten side is not dimmed");
  assert.doesNotMatch(base, /\.vsEnd \.vsSide\.beat\{[^}]*display:none/,
    "the beaten side must not vanish");
});

/* ---------------- the phone's own answer ---------------- */

test("a buzz never throws, whatever the phone does or does not have", () => {
  const haptic = readFileSync(path.join(ROOT, "public", "js", "haptic.js"), "utf8");
  assert.match(haptic, /typeof nav\.vibrate === "function"/, "it does not check for a motor");
  assert.match(haptic, /catch \(e\) \{ return false; \}/, "a refused buzz would throw");
});

test("silence means silence: the sound switch turns the buzzing off too", () => {
  /* A player who has muted the game has already said what they want. Asking
     twice, in two places, is asking them to find a second switch. */
  const haptic = readFileSync(path.join(ROOT, "public", "js", "haptic.js"), "utf8");
  assert.match(haptic, /global\.Sound\.muted\(\)/, "muting does not reach the motor");
  assert.match(haptic, /if \(!can \|\| muted\(\)\) return false;/);
});

test("the buzz is hung on the sound, so no event can be missed", () => {
  const haptic = readFileSync(path.join(ROOT, "public", "js", "haptic.js"), "utf8");
  assert.match(haptic, /global\.Sound\.play = function/, "Sound.play is not wrapped");
  // and the events that matter most are all mapped
  for (const s of ["place", "diceLand", "turn", "win", "lose"])
    assert.match(haptic, new RegExp("\\b" + s + ': "'), "no buzz for " + s);
});

test("every screen that makes a sound can also buzz", () => {
  const screens = readdirSync(path.join(ROOT, "public")).filter((f) => f.endsWith(".html"));
  for (const f of screens) {
    const html = readFileSync(path.join(ROOT, "public", f), "utf8");
    if (!html.includes('src="js/sound.js"')) continue;
    assert.match(html, /src="js\/haptic\.js"/, f + " has sound but no haptics");
    assert.ok(html.indexOf('js/sound.js') < html.indexOf('js/haptic.js'),
      f + ": haptic.js must load after sound.js, or it has nothing to wrap");
  }
});

/* ---------------- whose turn it is ---------------- */

test("the ring is a CSS animation, not a timer nobody is ticking", () => {
  /* The server sends `moveLeft` when something happens, not once a second, so
     a ring driven off state pushes would jump rather than sweep. */
  const ring = readFileSync(path.join(ROOT, "public", "js", "turnring.js"), "utf8");
  assert.doesNotMatch(ring, /setInterval|setTimeout/, "the ring must not tick in JS");
  assert.match(base, /@keyframes turnDrain/, "there is nothing to drain");
  assert.match(base, /animation:turnDrain var\(--tSec/, "the drain is not run");
});

test("a player who arrives mid-turn joins the ring where the clock is", () => {
  /* A negative delay starts an animation partway through. Without it, opening
     the screen with eight seconds left would show a full ring. */
  const ring = readFileSync(path.join(ROOT, "public", "js", "turnring.js"), "utf8");
  assert.match(ring, /--tFrom", "-" \+ spent \+ "s"/, "there is no negative delay");
  assert.match(base, /animation:turnDrain var\(--tSec, 25s\) linear var\(--tFrom/);
});

test("a state push in the middle of a turn does not send the ring back to full", () => {
  const ring = readFileSync(path.join(ROOT, "public", "js", "turnring.js"), "utf8");
  assert.match(ring, /if \(el\.dataset\.ring === key\) return;/,
    "every push would restart the ring");
  assert.match(ring, /spent < wasSpent/, "a tick and a new turn are not told apart");
});

test("a browser without an animatable custom property still says whose turn", () => {
  /* Without @property the angle cannot be interpolated, so the sweep would
     jump from full to empty in one step. Better a steady lit rim than a ring
     that lies about the time left. */
  assert.match(base, /@supports not \(background:conic-gradient/,
    "there is no fallback for the ring");
  assert.match(base, /@property --tTurn/);
});

test("every screen with a clock draws the ring", () => {
  for (const f of ["nardi.html", "damka.html", "buraonline.html", "jokeronline.html"]) {
    const html = readFileSync(path.join(ROOT, "public", f), "utf8");
    assert.match(html, /src="js\/turnring\.js"/, f + " never loads turnring.js");
    assert.match(html, /TurnRing\.set\(/, f + " never sets the ring");
  }
});
