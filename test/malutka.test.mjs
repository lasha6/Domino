/* მალუტკა, as described: three of one suit turned straight back at a lead. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire("D:/Mobile Games/Domino/test/");
const B = require("../public/js/bura.js");

const S = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
const R = {};
B.RANKS.forEach((n, i) => { R[n] = i; });
const c = (rank, suit) => [suit, R[rank]];

test("three of a suit can be turned back at a card just led", () => {
  const g = B.newGame({ variant: "3" });
  g.trump = S.hearts; g.deck = [];
  g.hands[0] = [c("A", S.spades)];                       // leads one card
  g.hands[1] = [c("J", S.clubs), c("Q", S.clubs), c("K", S.clubs)];   // three clubs
  g.turn = 0;
  assert.ok(B.lead(g, 0, [c("A", S.spades)]));
  assert.equal(g.turn, 1);

  assert.ok(B.canMalutka(g, 1), "three of a suit is a malutka in the three-card game");
  assert.ok(B.malutka(g, 1), "and it can be thrown back");

  assert.equal(g.lead.seat, 1, "the malutka is now what is on the table");
  assert.equal(g.lead.cards.length, 3);
  assert.equal(g.turn, 0, "and the player who led must now beat it");
  assert.deepEqual(g.pot, [c("A", S.spades)], "their card stays on the table");
  assert.equal(g.hands[1].length, 0, "the whole hand went down");
});

test("whoever wins the turned-back trick takes every card on the table", () => {
  const g = B.newGame({ variant: "3" });
  g.trump = S.hearts; g.deck = [];
  g.hands[0] = [c("A", S.spades), c("J", S.hearts), c("Q", S.hearts), c("K", S.hearts)];
  g.hands[1] = [c("J", S.clubs), c("Q", S.clubs), c("K", S.clubs)];
  g.turn = 0;
  B.lead(g, 0, [c("A", S.spades)]);
  B.malutka(g, 1);
  // three trumps beat three clubs
  const took = B.answer(g, 0, [c("J", S.hearts), c("Q", S.hearts), c("K", S.hearts)]);
  assert.equal(took, 0, "the trumps took it");
  assert.equal(g.taken[0].length, 7, "all seven cards on the table went with it");
  assert.equal(B.handPoints(g.taken[0]), 11 + 2 + 3 + 4 + 2 + 3 + 4, "and all of their points");
  assert.equal(g.pot, null, "the table is clear again");
});

test("a malutka cannot be laid on top of your own lead", () => {
  const g = B.newGame({ variant: "3" });
  g.trump = S.hearts;
  g.hands[0] = [c("J", S.clubs), c("Q", S.clubs), c("K", S.clubs)];
  g.turn = 0;
  assert.ok(B.canMalutka(g, 0), "on an empty table it is simply a lead");
  B.lead(g, 0, [c("J", S.clubs)]);
  assert.equal(B.canMalutka(g, 0), false, "and not again on top of it");
});

test("in the five-card game a malutka must be the led suit, or allowed", () => {
  const mk = () => {
    const g = B.newGame({ variant: "5" });
    g.trump = S.hearts; g.deck = [];
    g.hands[0] = [c("A", S.diamonds)];
    g.hands[1] = ["6", "7", "8", "9", "J"].map((r) => c(r, S.clubs));
    g.turn = 0;
    B.lead(g, 0, [c("A", S.diamonds)]);
    return g;
  };
  assert.equal(B.canMalutka(mk(), 1), false, "clubs are neither trumps nor what was led");
  assert.equal(B.canMalutka(mk(), 1, true), true, "unless the table allows any suit");

  const trumps = mk();
  trumps.hands[1] = ["6", "7", "8", "9", "J"].map((r) => c(r, S.hearts));
  assert.equal(B.canMalutka(trumps, 1), false, "five trumps are ბურა, which wins outright");
  assert.equal(B.isBura(trumps, 1), true, "and are offered as that instead");

  const ledSuit = mk();
  ledSuit.hands[1] = ["6", "7", "8", "9", "J"].map((r) => c(r, S.diamonds));
  assert.equal(B.canMalutka(ledSuit, 1), true, "and so does the suit that was led");
});

test("a part of a hand is never a malutka", () => {
  const g = B.newGame({ variant: "3" });
  g.trump = S.hearts;
  g.hands[1] = [c("J", S.clubs), c("Q", S.clubs)];        // only two left
  g.hands[0] = [c("A", S.spades)];
  g.turn = 0;
  B.lead(g, 0, [c("A", S.spades)]);
  assert.equal(B.canMalutka(g, 1), false, "it has to be the whole hand");

  g.hands[1] = [c("J", S.clubs), c("Q", S.clubs), c("K", S.hearts)];
  assert.equal(B.canMalutka(g, 1), false, "and all of one suit");
});

test("a whole hand of trumps is ბურა, and wins the round", () => {
  for (const [variant, size] of [["3", 3], ["5", 5]]) {
    const g = B.newGame({ variant });
    g.trump = S.hearts;
    g.hands[0] = ["J", "Q", "K", "10", "A"].slice(0, size).map((r) => c(r, S.hearts));
    g.turn = 0;
    assert.ok(B.isBura(g, 0), variant + "-card: " + size + " trumps is ბურა");
    assert.equal(B.canMalutka(g, 0), false, "and is claimed rather than laid down as a malutka");
    assert.ok(B.sayBura(g, 0));
    assert.equal(g.phase, "roundOver");
    assert.equal(g.roundWinner, 0, "the round is won outright");
    assert.equal(g.scores[0], 1, "for what the round was worth");
  }
});

test("ბურა is worth whatever the calls made the round", () => {
  const g = B.newGame({ variant: "3" });
  g.trump = S.hearts;
  g.hands[0] = ["J", "Q", "K"].map((r) => c(r, S.hearts));
  g.turn = 0;
  B.call(g, 0); B.acceptCall(g, 1);        // დავი
  g.turn = 0;
  assert.ok(B.sayBura(g, 0));
  assert.equal(g.scores[0], 2, "a doubled round pays two");
});

test("a hand that is not all trumps is not ბურა", () => {
  const g = B.newGame({ variant: "3" });
  g.trump = S.hearts;
  g.hands[0] = [c("J", S.hearts), c("Q", S.hearts), c("K", S.clubs)];
  assert.equal(B.isBura(g, 0), false);
  assert.equal(B.sayBura(g, 0), false, "and claiming it does nothing");
  assert.equal(g.phase, "play", "the round carries on");
});
