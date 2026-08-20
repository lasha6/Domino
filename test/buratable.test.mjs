/* =====================================================================
   What the ბურა table shows.

   This has been wrong twice, and both faults needed a particular deal to see
   from the outside — a whole suit in one hand turns up in about seven per cent
   of them, and a test that waits for it passes without proving anything. So the
   rule was lifted out and the cases are built here directly.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as T from "../buratable.js";

const require = createRequire(import.meta.url);
const B = require("../public/js/bura.js");

const S = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
const R = {};
B.RANKS.forEach((n, i) => { R[n] = i; });
const c = (rank, suit) => [suit, R[rank]];
const names = (cards) => cards.map(B.nameOf);

test("a new lead leaves nothing of the trick before it", () => {
  let t = T.startTrick([c("K", S.clubs)], 0, null);
  t = T.addAnswer(t, 1, [c("A", S.clubs)], 0);
  t = T.settle(t, 1, false);
  assert.equal(T.cardsOn(t).length, 2);

  const next = T.startTrick([c("9", S.hearts)], 1, null);
  assert.deepEqual(names(T.cardsOn(next)), ["9♥"], "the table holds the new card and only it");
  assert.equal(next.answers.length, 0);
  assert.equal(next.took, null);
});

test("a card already led survives a hand being turned back on it", () => {
  /* The other player led the king of clubs and had a whole hand put down on
     top of it. Their king stays where it is: it is face up, everyone has seen
     it, and it counts as part of the answer they still owe. */
  const bura = [c("A", S.hearts), c("10", S.hearts), c("Q", S.hearts)];
  const t = T.startTrick(bura, 1, { seat: 0, cards: [c("K", S.clubs)] });
  assert.deepEqual(names(T.cardsOn(t)), ["A♥", "10♥", "Q♥", "K♣"]);
  assert.equal(t.answers.length, 1, "one player has something down");
  assert.equal(t.answers[0].open, 1, "and it is face up");
});

test("finishing that answer does not put the same card down twice", () => {
  /* Reported from a real table: two cards left in hand, played them, and there
     were seven cards on the table instead of six, with the king of clubs on it
     twice. The answer that arrives carries the whole of what that player has
     played — the king included — so it REPLACES what they had down rather than
     being added to it. */
  const bura = [c("A", S.hearts), c("10", S.hearts), c("Q", S.hearts)];
  let t = T.startTrick(bura, 1, { seat: 0, cards: [c("K", S.clubs)] });

  // the full answer: the king already down, plus the two still in hand
  const full = [c("K", S.clubs), c("9", S.spades), c("7", S.diamonds)];
  t = T.addAnswer(t, 0, full, 1);
  t = T.settle(t, 1, false);

  const on = T.cardsOn(t);
  assert.equal(on.length, 6, `six cards on the table, not ${on.length}`);
  assert.equal(t.answers.length, 1, "one entry for the one player who answered");
  const kings = on.filter((x) => B.nameOf(x) === "K♣").length;
  assert.equal(kings, 1, "and the king of clubs is on it once");
  assert.deepEqual(names(on), ["A♥", "10♥", "Q♥", "K♣", "9♠", "7♦"]);
});

test("no card is ever on the table twice, whoever answers in whatever order", () => {
  // four players, one of whom had already led before a hand was turned back
  const lead = [c("A", S.spades), c("K", S.spades)];
  let t = T.startTrick(lead, 2, { seat: 3, cards: [c("6", S.hearts)] });
  t = T.addAnswer(t, 3, [c("6", S.hearts), c("7", S.hearts)], 1);   // finishes theirs
  t = T.addAnswer(t, 0, [c("9", S.clubs), c("10", S.clubs)], 0);
  t = T.addAnswer(t, 1, [c("J", S.diamonds), c("Q", S.diamonds)], 0);
  t = T.settle(t, 2, false);

  const on = T.cardsOn(t);
  const seen = new Set(on.map((x) => x.join(",")));
  assert.equal(seen.size, on.length, "every card on the table is a different card");
  assert.equal(on.length, 8, "two led and three answers of two");
  assert.equal(t.answers.length, 3, "one entry each");
});

test("the two-player screen still finds the one answer where it looks for it", () => {
  // an older screen — one already installed on a phone — reads these three
  let t = T.startTrick([c("K", S.clubs)], 0, null);
  t = T.addAnswer(t, 1, [c("A", S.clubs)], 0);
  t = T.settle(t, 1, true);
  assert.deepEqual(names(t.ans), ["A♣"]);
  assert.equal(t.ansSeat, 1);
  assert.equal(t.open, 0);
  assert.equal(t.hidden, true, "the short game keeps a losing answer face down");
});

test("a trick still going round the table has no winner yet", () => {
  let t = T.startTrick([c("A", S.spades)], 0, null);
  t = T.addAnswer(t, 1, [c("6", S.spades)], 0);
  assert.equal(t.took, null, "nobody has taken it while it is still going round");
  t = T.settle(t, 0, false);
  assert.equal(t.took, 0);
});
