/* =====================================================================
   The first match.

   Every one of these games is one somebody's grandfather taught them, and the
   app has no grandfather. What it has is three sentences per game, shown once
   each, at the moment they are about to matter.

   Three is a budget rather than a target, and the tests treat it as one: a
   fourth hint would turn the first match into a tutorial, and a hint that can
   come back is a hint that will come back at the worst moment.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (...p) => readFileSync(path.join(ROOT, ...p), "utf8");
const hints = read("public", "js", "hints.js");
const base = read("public", "css", "base.css");

const SCREENS = {
  "online.html": "domino", "buraonline.html": "bura", "jokeronline.html": "joker",
  "nardi.html": "nardi", "damka.html": "damka",
};

/* The steps a screen actually declares. */
function stepsOf(html) {
  const at = html.indexOf("Hints.attach(");
  if (at < 0) return null;
  const block = html.slice(at, html.indexOf("] });", at));
  return {
    game: (block.match(/game: "([a-z]+)"/) || [])[1],
    keys: [...block.matchAll(/\{ key: "([a-z]+)"/g)].map((m) => m[1]),
    texts: [...block.matchAll(/text: "([^"]+)"/g)].map((m) => m[1]),
    whens: (block.match(/when:/g) || []).length,
    ats: (block.match(/at: \(\) =>/g) || []).length,
  };
}

test("every online screen offers three hints and no more", () => {
  for (const f of Object.keys(SCREENS)) {
    const s = stepsOf(read("public", f));
    assert.ok(s, f + " has no hints at all");
    assert.equal(s.keys.length, 3, f + " has " + s.keys.length + " hints, not three");
    assert.equal(s.texts.length, 3, f + ": a hint with no sentence in it");
  }
});

test("the module refuses a fourth even if a screen asks for one", () => {
  /* The budget has to be enforced somewhere that a screen cannot argue with,
     or it is not a budget. */
  assert.match(hints, /steps = \(\(o && o\.steps\) \|\| \[\]\)\.slice\(0, 3\)/,
    "a screen could declare as many hints as it liked");
});

test("each hint waits for the moment it is about", () => {
  /* All three at once, before the first move, is a wall of text — which is
     where instructions go to be skipped. */
  for (const f of Object.keys(SCREENS)) {
    const s = stepsOf(read("public", f));
    assert.equal(s.whens, 3, f + ": a hint that fires whenever");
    assert.equal(s.ats, 3, f + ": a hint with nothing to point at");
  }
  assert.match(hints, /if \(showing \|\| !steps\.length\) return;/,
    "two hints could be on screen at once");
});

test("each game keeps its own, so no two games share a hint", () => {
  const games = new Set();
  for (const [f, game] of Object.entries(SCREENS)) {
    const s = stepsOf(read("public", f));
    assert.equal(s.game, game, f + " files its hints under " + s.game);
    games.add(s.game);
  }
  assert.equal(games.size, 5, "two screens share one game's hints");
  assert.match(hints, /const id = game \+ ":" \+ step\.key;/,
    "hints are not filed by game");
});

test("shown is shown, even if the player ignores it", () => {
  /* Marking it only when it is dismissed means a hint that was scrolled past,
     or covered by a modal, comes back next match — and a hint that comes back
     is one the player has learned to dismiss without reading. */
  const at = hints.indexOf("mark(id);");
  assert.notEqual(at, -1, "a hint is never written down as seen");
  assert.ok(at < hints.indexOf("put(step);"),
    "it is only marked after being shown, so a failure to draw would repeat it");
});

test("nothing brings them back on its own", () => {
  assert.match(hints, /function reset\(which\)/, "there is no way to offer them again");
  // ...but nothing calls it: a settings screen may, one day, on purpose
  for (const f of Object.keys(SCREENS))
    assert.doesNotMatch(read("public", f), /Hints\.reset\(/,
      f + " puts the hints back by itself");
});

test("a hint that cannot be worked out is skipped, not thrown", () => {
  /* `when` reads a live state and an anchor reads the DOM; either can be
     missing for a hundred ordinary reasons, and none of them is a reason for
     a game to stop. */
  assert.match(hints, /try \{ ready = !step\.when \|\| !!step\.when\(st\); \}/,
    "a condition that throws would take the screen with it");
  assert.match(hints, /catch \(e\) \{ ready = false; \}/);
  assert.match(hints, /catch \(e\) \{ return \{\}; \}/,
    "unreadable storage would throw before the first hint");
});

test("a hint is not a dialog", () => {
  /* A dialog stops the game and gets dismissed without being read. These are
     worth reading exactly once, which is the only chance they get. */
  assert.match(base, /\.hintLayer\{ position:fixed; inset:0; z-index:70; pointer-events:none; \}/,
    "the hint layer would block the whole board");
  assert.match(base, /\.hintBubble\{[^}]*pointer-events:auto/,
    "the bubble itself cannot be tapped away");
  assert.doesNotMatch(hints, /alert\(|confirm\(/, "a hint stops the game");
});

test("no hint tells a player about a button that is not there", () => {
  /* The anchors are read off the live DOM, so an id that has been renamed
     leaves the hint floating in the middle of the screen — readable, but
     pointing at nothing. */
  for (const f of Object.keys(SCREENS)) {
    const html = read("public", f);
    const at = html.indexOf("Hints.attach(");
    const block = html.slice(at, html.indexOf("] });", at));
    for (const m of block.matchAll(/getElementById\("([^"]+)"\)/g))
      assert.ok(html.includes('id="' + m[1] + '"'),
        f + ': a hint points at #' + m[1] + ', which the screen does not have');
  }
});

test("a hint is never left hanging off the edge of the screen", () => {
  /* A landscape phone is 390 pixels tall and the board fills it. Asking only
     whether the thing is far enough DOWN the screen put the first ნარდი hint
     below a board whose bottom edge was already at the bottom of the phone. */
  assert.match(hints, /const roomAbove = r\.top - 10, roomBelow = innerHeight - r\.bottom - 10;/,
    "it never asks whether there is room");
  assert.match(hints, /y = Math\.max\(6, Math\.min\(y, innerHeight - h - 6\)\);/,
    "nothing keeps it inside the screen");
  assert.match(hints, /x = Math\.max\(8, Math\.min\(x, innerWidth - w - 8\)\);/,
    "nothing keeps it inside the screen sideways");
});

test("nothing in a hint is an emoji", () => {
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
  assert.doesNotMatch(hints, emoji, "hints.js carries an emoji");
});

test("every screen loads it and asks it on every state", () => {
  for (const f of Object.keys(SCREENS)) {
    const html = read("public", f);
    assert.match(html, /src="js\/hints\.js"/, f + " never loads hints.js");
    /* And asks it LAST, once the screen has been redrawn: a hint measures
       the thing it points at, and before the redraw that thing is where it
       was a state ago — or not on screen at all. The first version of this
       pointed the ×2 hint at a button that had not been shown yet, and it
       came out floating in the middle of the board. */
    assert.match(html, /if \(hints\) hints\.check\((st|S)\);/, f + " never asks for one");
  }
});
