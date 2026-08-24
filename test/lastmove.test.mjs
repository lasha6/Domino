/* =====================================================================
   What they just did.

   Against the computer the move happens while you are looking. Online it
   happens while you are not, and the board is simply DIFFERENT when you look
   back — one checker or three, a jump over four squares, no way to tell. The
   rules about when a mark appears and when it goes away are what make it
   useful rather than noise, so they are what is checked here.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const { LastMove } = (() => {
  const g = {};
  const src = readFileSync(path.join(ROOT, "public", "js", "lastmove.js"), "utf8");
  new Function("window", src + "\n;window.__x = this;").call(g, g);
  return g;
})();

const read = (...p) => readFileSync(path.join(ROOT, ...p), "utf8");
const board = read("public", "css", "board.css");

/* Every tracker needs a board to have changed FROM, so the first one is a
   baseline rather than a move. */
const opened = (board) => LastMove.track().note(board, board, false);

test("the first board a screen ever sees is not a move", () => {
  /* Somebody coming back to a match in progress would otherwise be shown the
     whole board as "what just happened" — both wrong, and the least useful
     moment to be shown it. */
  const t = LastMove.track();
  t.note([0, 0, 0], [1, 2, 3], false);
  assert.equal(t.size, 0, "the opening position was marked as a move");
  t.note([1, 2, 3], [1, 2, 0], false);
  assert.equal(t.size, 1, "and then nothing was marked at all");
});

test("it marks exactly the squares that changed", () => {
  const t = opened([2, 0, 0, 5, 0]);
  //          0  1  2  3  4
  t.note([2, 0, 0, 5, 0], [1, 0, 1, 5, 0], false);
  assert.deepEqual(t.list().sort(), ["0", "2"]);
  assert.ok(t.has(0) && t.has(2));
  assert.ok(!t.has(1) && !t.has(3) && !t.has(4));
});

test("a square is a square whether it is asked for as a number or a string", () => {
  /* The screens read it off a dataset attribute, which is always a string,
     and diff it against an array, which is always numbers. */
  const t = opened([0, 0]);
  t.note([0, 0], [0, 1], false);
  assert.ok(t.has(1), "a number is not found");
  assert.ok(t.has("1"), "a string is not found");
});

test("a player's own move is never marked", () => {
  /* They watched themselves make it. Marking it would say "look at this"
     about the one thing on the board they already know. */
  const t = opened([0, 0]);
  t.note([0, 0], [0, 1], true);
  assert.equal(t.size, 0, "a player's own move was marked");
});

test("making a move clears what was there to read", () => {
  const t = opened([0, 0, 0]);
  t.note([0, 0, 0], [0, 1, 0], false);
  assert.equal(t.size, 1);
  t.clear();
  assert.equal(t.size, 0);
  // ...and a move of their own does the same, since it means the player acted
  t.note([0, 0, 0], [0, 1, 0], false);
  t.note([0, 1, 0], [0, 0, 1], true);
  assert.equal(t.size, 0);
});

test("something that is not a move does not wipe a mark still unread", () => {
  /* A roll of the dice, a scoreline, a pause: states arrive for all sorts of
     reasons, and every one of them would otherwise clear the board of the one
     thing the player had not looked at yet. */
  const t = opened([0, 0, 3]);
  t.note([0, 0, 3], [0, 1, 3], false);
  assert.equal(t.size, 1);
  t.note([0, 1, 3], [0, 1, 3], false);   // nothing moved
  assert.equal(t.size, 1, "a state push with no move cleared the mark");
  assert.ok(t.has(1));
});

test("a board that grew or shrank does not throw", () => {
  const t = opened([1]);
  assert.doesNotThrow(() => t.note([1], [1, 2, 3], false));
  assert.doesNotThrow(() => t.note(null, [1], false));
  assert.doesNotThrow(() => t.note([1], null, false));
});

/* ---------------- how it is drawn, and where ---------------- */

test("the mark is not the same as a point you may play into", () => {
  /* `can` and `from` light the INLAY. Those are things to act on; this is
     something to read, and a player who cannot tell them apart will try to
     play into the square the other man just left. */
  assert.match(board, /\.npt\.lastMove::before\{/, "ნარდი has no mark");
  assert.match(board, /\.dsq\.lastMove::before\{/, "დამკა has no mark");
  const npt = board.slice(board.indexOf(".npt.lastMove::before"), board.indexOf(".dsq.lastMove"));
  assert.doesNotMatch(npt, /--ptFill/, "the last move lights the inlay, like a playable point");
});

test("the mark never swallows a tap, and never covers a piece", () => {
  for (const sel of [".npt.lastMove::before", ".npt.lastMove::after", ".dsq.lastMove::before"]) {
    const at = board.indexOf(sel);
    assert.notEqual(at, -1, "no rule for " + sel);
    const rule = board.slice(at, board.indexOf("}", at));
    assert.match(rule, /pointer-events:none/, sel + " would swallow taps meant for the board");
  }
  assert.match(board, /\.npt\.lastMove \.tri, \.npt\.lastMove \.chk\{ position:relative; z-index:1; \}/,
    "the checkers would be painted under the mark");
  assert.match(board, /\.dsq\.lastMove \.pc\{ z-index:1; \}/,
    "the draughtsmen would be painted under the mark");
});

test("the mark does not pulse forever", () => {
  /* Something that never stops moving on a board stops being read and starts
     being ignored — and it is still there to be read after it settles. */
  const m = board.match(/animation:lastPulse [^;]*;/);
  assert.ok(m, "the mark does not pulse at all");
  assert.doesNotMatch(m[0], /infinite/, "the mark pulses forever");
});

test("both board games keep the mark, and paint it where the board is drawn", () => {
  /* draw() rebuilds every class on every square, so a mark applied anywhere
     else would survive exactly until the next state arrived. */
  for (const f of ["nardi.html", "damka.html"]) {
    const html = read("public", f);
    assert.match(html, /src="js\/lastmove\.js"/, f + " never loads lastmove.js");
    assert.match(html, /theirs\.note\(/, f + " never notes what changed");
    assert.match(html, /theirs\.has\(/, f + " never paints it");
    assert.match(html, /theirs\.clear\(\)/, f + " never lets go of it");
    // noted BEFORE the board is overwritten, or there is nothing to diff
    const noteAt = html.indexOf("theirs.note(");
    const writeAt = f === "nardi.html"
      ? html.indexOf("g.pts = st.pts.slice()")
      : html.indexOf("g.cells = st.cells.slice()");
    assert.ok(noteAt > 0 && noteAt < writeAt,
      f + ": the board is overwritten before the change is noted");
  }
});

test("who moved is read from the turn BEFORE the state, not the one in it", () => {
  /* This is the whole thing, and it is easy to get backwards. In დამკა the
     turn flips with the move, so the state carrying somebody's move already
     says it is the other player's turn — reading the incoming side would
     credit every move to the wrong player and throw the mark away the moment
     it was made. ნარდი holds a turn across several moves, which is why it
     seemed to work there and did not here. */
  for (const f of ["nardi.html", "damka.html"]) {
    const html = read("public", f);
    assert.match(html, /theirs\.note\([^)]*, g\.side === ME\)/,
      f + ": the mover is read from the arriving state rather than the one before it");
    assert.doesNotMatch(html, /theirs\.note\([^)]*, st\.side === ME\)/,
      f + ": the mover is read from the arriving state");
  }
});

test("the card tables mark the card that just landed", () => {
  /* Their boards are not arrays, so the diff does not apply — but the same
     question does, and at four hands it is asked harder: the pile grows while
     you are looking at your own cards. */
  const cards = read("public", "css", "cards.css");
  assert.match(cards, /\.trickRow\.justPlayed \.card\{/, "there is no mark for it");
  for (const f of ["buraonline.html", "jokeronline.html"]) {
    const html = read("public", f);
    assert.match(html, /classList\.add\("justPlayed"\)/, f + " never marks it");
    // never your own card: you watched yourself play it
    assert.ok(/!mine\(lastSeat\)/.test(html) || /p\.seat !== S\.seat/.test(html),
      f + ": a player's own card is marked back at them");
  }
});

test("the card that took the trick outranks the card that was just played", () => {
  /* Both are brass, and once the trick is over only one of them is worth
     reading. A card wearing both marks must show the one that says who won. */
  const cards = read("public", "css", "cards.css");
  const at = cards.indexOf(".trickRow.justPlayed.took .card{");
  assert.notEqual(at, -1, "the two marks are never told apart");
  assert.ok(at > cards.indexOf(".trickRow.justPlayed .card{"),
    "the weaker mark is written last and would win");
});

test("a screen without the module still works", () => {
  /* lastmove.js is one more file that can fail to load, and a board that
     throws is worse than a board with no marks on it. */
  for (const f of ["nardi.html", "damka.html"]) {
    const html = read("public", f);
    assert.match(html, /window\.LastMove \? LastMove\.track\(\)/,
      f + " assumes lastmove.js loaded");
  }
});
