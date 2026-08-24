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
