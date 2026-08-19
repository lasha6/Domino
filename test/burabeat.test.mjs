/* =====================================================================
   Can ბურა ever be beaten?

   The player worked it out at the table: in the short game a suit holds only
   five cards, so three trumps leave two, and two cannot cover three. Rather
   than take that on trust, this tries every hand the other player could
   possibly be holding.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const B = require("../public/js/bura.js");

const TRUMP = 1;                                  // hearts, throughout

// every way to choose n cards from a list
function choose(arr, n) {
  const out = [];
  (function walk(start, picked) {
    if (picked.length === n) { out.push(picked.slice()); return; }
    for (let i = start; i < arr.length; i++) { picked.push(arr[i]); walk(i + 1, picked); picked.pop(); }
  })(0, []);
  return out;
}

function tryEveryAnswer(variant) {
  const deck = B.makeDeck(variant);
  const size = variant === "3" ? 3 : 5;
  const trumps = deck.filter((c) => B.suitOf(c) === TRUMP);
  const rest = deck.filter((c) => B.suitOf(c) !== TRUMP);

  let hands = 0, beaten = 0, worst = null;
  // every hand of trumps that could be held...
  for (const bura of choose(trumps, size)) {
    const left = deck.filter((c) => !bura.some((b) => B.sameCard(b, c)));
    // ...against every hand the other player could answer it with
    for (const reply of choose(left, size)) {
      hands++;
      if (B.beatsAll(reply, bura, TRUMP)) {
        beaten++;
        if (!worst) worst = { bura: bura.map(B.nameOf), reply: reply.map(B.nameOf) };
      }
    }
  }
  return { hands, beaten, worst, trumpsInASuit: trumps.length, rest: rest.length };
}

test("in the short game a hand of trumps cannot be beaten by anything", () => {
  const r = tryEveryAnswer("3");
  assert.equal(r.trumpsInASuit, 5, "a suit holds five cards in the twenty-card deck");
  assert.ok(r.hands > 1000, `enough hands were tried: ${r.hands}`);
  assert.equal(r.beaten, 0,
    `no hand beats it — the closest was ${JSON.stringify(r.worst)}`);
});

test("nor in the long game, for the same reason", () => {
  /* The same argument, checked structurally rather than by trying 378,000
     hands: only a trump beats a trump, five are held, and four are left. A few
     hundred real answers are tried on top of that as a sanity check. */
  const deck = B.makeDeck("5");
  const trumps = deck.filter((c) => B.suitOf(c) === TRUMP);
  assert.equal(trumps.length, 9, "a suit holds nine cards in the full deck");
  assert.ok(trumps.length - 5 < 5, "five trumps leave four, and four cannot cover five");

  const bura = trumps.slice(0, 5);
  const left = deck.filter((c) => !bura.some((x) => B.sameCard(x, c)));
  for (let i = 0; i < 400; i++) {
    const pool = left.slice().sort(() => Math.random() - 0.5).slice(0, 5);
    assert.equal(B.beatsAll(pool, bura, TRUMP), false, "no answer covers it");
  }
});

test("so playing it in the short game always takes the round", () => {
  /* Which is what the player said in the first place. It is worth having the
     engine agree by playing it out rather than by being told. */
  const ranks = ["J", "Q", "K", "10", "A"];
  const R = {};
  B.RANKS.forEach((n, i) => { R[n] = i; });

  for (const bura of choose(ranks, 3)) {
    const g = B.newGame({ variant: "3" });
    g.trump = TRUMP;
    g.deck = [];
    g.hands[0] = bura.map((r) => [TRUMP, R[r]]);
    // whatever is left, the other player holds the strongest of it
    const left = B.makeDeck("3").filter((c) => !g.hands[0].some((x) => B.sameCard(x, c)));
    g.hands[1] = left.sort((a, b) => B.strength(b, TRUMP) - B.strength(a, TRUMP)).slice(0, 3);
    g.turn = 0;

    assert.ok(B.isBura(g, 0), bura + " is ბურა");
    assert.ok(B.malutka(g, 0), "and goes down on the table");
    const took = B.answer(g, 1, g.hands[1].slice(0, B.answerSize(g, 1)));
    assert.equal(took, 0, `${bura} was taken from`);
    assert.equal(g.phase, "roundOver", "so the round is over");
    assert.equal(g.roundWinner, 0, "and it is theirs");
  }
});
