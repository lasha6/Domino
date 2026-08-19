/* ბურა, played rather than announced.

   The player was clear about what matters: the other side has to SEE the hand.
   So it goes down on the table like any other whole hand, they answer it, and
   the round is won at the moment the trick is taken — not before, and not if
   they manage to beat it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire("D:/Mobile Games/Domino/test/");
const B = require("../public/js/bura.js");

const S = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
const R = {};
B.RANKS.forEach((n, i) => { R[n] = i; });
const c = (rank, suit) => [suit, R[rank]];

test("a hand of trumps goes down on the table, where it can be seen", () => {
  const g = B.newGame({ variant: "3" });
  g.trump = S.hearts; g.deck = [];
  g.hands[0] = ["J", "Q", "K"].map((r) => c(r, S.hearts));
  g.hands[1] = ["J", "Q", "K"].map((r) => c(r, S.spades));
  g.turn = 0;

  assert.ok(B.isBura(g, 0), "it is ბურა");
  assert.ok(B.canMalutka(g, 0), "and it is put down, not declared");
  assert.ok(B.malutka(g, 0));
  assert.equal(g.lead.cards.length, 3, "all three are on the table");
  assert.equal(g.lead.bura, true, "and the table knows what it is");
  assert.equal(g.turn, 1, "the other player has to answer it");
  assert.equal(g.phase, "play", "nothing is decided yet");
});

test("the round is won at the moment the trick is taken", () => {
  const g = B.newGame({ variant: "3" });
  g.trump = S.hearts; g.deck = [];
  g.hands[0] = ["J", "Q", "K"].map((r) => c(r, S.hearts));
  g.hands[1] = ["J", "Q", "K"].map((r) => c(r, S.spades));
  g.turn = 0;
  B.malutka(g, 0);
  const took = B.answer(g, 1, g.hands[1].slice());
  assert.equal(took, 0, "spades cannot beat trumps");
  assert.equal(g.phase, "roundOver", "and taking it ends the round");
  assert.equal(g.roundWinner, 0);
  assert.equal(g.scores[0], 1, "for what the round was worth");
});

test("nothing the other player holds can take a ბურა from them", () => {
  const g = B.newGame({ variant: "3" });
  g.trump = S.hearts; g.deck = [];
  g.hands[0] = ["J", "Q", "K"].map((r) => c(r, S.hearts));      // the low trumps
  g.hands[1] = ["10", "A"].map((r) => c(r, S.hearts)).concat([c("J", S.spades)]);
  g.turn = 0;
  B.malutka(g, 0);
  // two higher trumps and a spade cannot beat three trumps either
  const took = B.answer(g, 1, g.hands[1].slice());
  assert.equal(took, 0, "the spade beats nothing, so the ბურა holds");
  assert.equal(g.roundWinner, 0);

  // even the two highest trumps in the game cannot cover three
  const h = B.newGame({ variant: "3" });
  h.trump = S.hearts; h.deck = [];
  h.hands[0] = ["J", "Q", "K"].map((r) => c(r, S.hearts));
  h.hands[1] = ["10", "A"].map((r) => c(r, S.hearts));
  h.turn = 0;
  B.malutka(h, 0);
  assert.equal(B.answerSize(h, 1), 2, "they answer with what they hold");
  const beaten = B.answer(h, 1, h.hands[1].slice());
  assert.equal(beaten, 0, "two cards cannot cover three, so it still holds");
  assert.equal(h.roundWinner, 0);
});

test("in the long game taking with trumps wins the trick but not the round", () => {
  const g = B.newGame({ variant: "5" });
  g.trump = S.hearts;
  // leave a stock, or the round would end simply because the cards ran out
  g.deck = ["6", "7", "8", "9", "J", "Q"].map((r) => c(r, S.diamonds));
  g.hands[0] = ["6", "7", "8", "9", "J"].map((r) => c(r, S.hearts));
  g.hands[1] = ["6", "7", "8", "9", "J"].map((r) => c(r, S.spades));
  g.turn = 0;
  assert.ok(B.isBura(g, 0), "five trumps is still ბურა");
  assert.equal(B.buraTakesRound(g), false, "but does not take the round here");
  B.malutka(g, 0);
  const took = B.answer(g, 1, g.hands[1].slice());
  assert.equal(took, 0, "it takes the trick");
  assert.notEqual(g.phase, "roundOver", "and the round carries on");
});

test("a hand that is not all trumps is a malutka rather than ბურა", () => {
  const g = B.newGame({ variant: "3" });
  g.trump = S.hearts;
  g.hands[0] = [c("J", S.hearts), c("Q", S.hearts), c("K", S.clubs)];
  assert.equal(B.isBura(g, 0), false);
  assert.equal(B.canMalutka(g, 0), false, "and mixed suits are neither");
});
