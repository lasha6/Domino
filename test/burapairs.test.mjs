/* =====================================================================
   ბურა in pairs — four players, one on each side of the table.

   The rules here came from the player and not from anywhere else:
     · pairs are ხუთკარტა only
     · partners sit opposite each other and play goes clockwise, so the
       seats run 0, 1, 2, 3 round the table and the sides are 0+2 and 1+3
     · there is no ვარ in the long game, so a round is decided on cards
     · the deck holds 120 points, so 60+ takes the round and 60 apiece is a
       draw with nothing written down
     · nobody is obliged to beat, or to let through, a partner's card — that
       is each player's own business
     · a raise (დავი, სე, ჩარი …) stands only when BOTH of the other pair
       have taken it
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const B = require("../public/js/bura.js");

const S = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
const R = {};
B.RANKS.forEach((n, i) => { R[n] = i; });
const c = (rank, suit) => [suit, R[rank]];

const four = (o) => B.newGame(Object.assign({ players: 4, target: 11 }, o));

test("four players sit as two pairs and are dealt five each", () => {
  const g = four();
  assert.equal(g.players, 4);
  assert.equal(g.variant, "5", "pairs are the long game only");
  assert.equal(g.hands.length, 4);
  g.hands.forEach((h, i) => assert.equal(h.length, 5, `seat ${i} holds five`));
  assert.equal(g.deck.length, 36 - 20, "sixteen are left to draw");
  assert.deepEqual([0, 1, 2, 3].map((s) => B.teamOf(g, s)), [0, 1, 0, 1],
    "partners sit across: 0+2 against 1+3");
  assert.deepEqual(B.teamSeats(g, 0), [0, 2]);
  assert.deepEqual(B.teamSeats(g, 1), [1, 3]);
});

test("play goes clockwise, so the next seat is the one to the left", () => {
  const g = four();
  assert.deepEqual([0, 1, 2, 3].map((s) => B.nextSeat(g, s)), [1, 2, 3, 0]);
  // and a partner is always two seats away, whichever way you count
  for (const s of [0, 1, 2, 3])
    assert.equal(B.teamOf(g, B.nextSeat(g, B.nextSeat(g, s))), B.teamOf(g, s),
      "two seats round the table is your partner");
});

test("the short game is never dealt to four", () => {
  const g = four({ variant: "3" });
  assert.equal(g.variant, "5", "asking for the short game with four still deals five");
});

test("the trick goes round all four and the best cards take it", () => {
  const g = four();
  g.trump = S.hearts; g.deck = [];
  g.hands = [
    [c("A", S.spades)],      // leads
    [c("6", S.spades)],      // cannot beat it
    [c("K", S.spades)],      // nor can a partner's king
    [c("6", S.hearts)],      // but a trump takes it off them all
  ];
  g.taken = [[], [], [], []];
  g.turn = 0;

  assert.equal(B.lead(g, 0, [c("A", S.spades)]), true);
  assert.equal(g.turn, 1, "the player on the left answers first");
  assert.equal(B.answer(g, 1, [c("6", S.spades)]), -1, "the trick is still going round");
  assert.equal(g.turn, 2);
  assert.equal(B.answer(g, 2, [c("K", S.spades)]), -1);
  assert.equal(g.turn, 3);
  const took = B.answer(g, 3, [c("6", S.hearts)]);
  assert.equal(took, 3, "the trump takes it, last though it was");
  assert.equal(g.taken[3].length, 4, "and all four cards go with it");
  assert.equal(g.turn, 3, "the winner leads next");
});

test("each player beats what is winning, not what was led", () => {
  const g = four();
  g.trump = S.clubs; g.deck = [];
  g.hands = [
    [c("J", S.spades)],
    [c("K", S.spades)],      // takes it off the leader
    [c("Q", S.spades)],      // a queen no longer beats the king
    [c("A", S.spades)],      // the ace does
  ];
  g.taken = [[], [], [], []];
  g.turn = 0;
  B.lead(g, 0, [c("J", S.spades)]);
  B.answer(g, 1, [c("K", S.spades)]);
  assert.equal(B.standing(g).holder, 1, "the king is winning");
  B.answer(g, 2, [c("Q", S.spades)]);
  assert.equal(B.standing(g).holder, 1, "a lower card takes nothing off it");
  const took = B.answer(g, 3, [c("A", S.spades)]);
  assert.equal(took, 3, "and the ace takes it from the king");
});

test("a side is scored on what its two players took between them", () => {
  const g = four();
  g.taken = [
    [c("A", S.spades)],                      // 11 to seat 0
    [c("10", S.hearts)],                     // 10 to seat 1
    [c("K", S.clubs), c("Q", S.clubs)],      // 7 to seat 2, same side as 0
    [c("J", S.diamonds)],                    // 2 to seat 3
  ];
  assert.deepEqual(B.roundStanding(g), [18, 12], "18 against 12, pooled by side");
});

test("60 apiece is a draw and nobody writes anything down", () => {
  const g = four();
  const deck = B.makeDeck("5");
  const of = (rank) => deck.filter((x) => B.RANKS[x[1]] === rank);
  const scoring = deck.filter((x) => B.pointsOf(x) > 0);
  assert.equal(scoring.length, 20, "twenty cards carry all 120 points");

  // split the scoring cards evenly: two of each rank to each side
  const side = (i) => ["A", "10", "K", "Q", "J"].flatMap((r) => [of(r)[i], of(r)[i + 1]]);
  g.taken = [side(0), side(2), [], []];
  assert.deepEqual(B.roundStanding(g), [60, 60], "half the deck each");

  g.hands = [[], [], [], []];
  B.finishRound(g);
  assert.equal(g.roundWinner, null, "level, so no winner");
  assert.deepEqual(g.scores, [0, 0], "and no match points either way");
  assert.equal(g.log, "ყაიმი");
});

test("a raise stands only once both of the other pair have taken it", () => {
  const g = four();
  g.turn = 0;
  assert.equal(B.call(g, 0), true, "seat 0 calls დავი");
  assert.equal(g.bid.pending.by, 0, "the call belongs to the side, not the chair");

  assert.equal(B.canAnswerCall(g, 2), false, "a partner cannot answer their own side's call");
  assert.equal(B.acceptCall(g, 1), true, "one opponent takes it...");
  assert.ok(g.bid.pending, "...and it is still not settled");
  assert.equal(g.bid.level, 0, "the price has not moved yet");

  assert.equal(B.acceptCall(g, 1), false, "the same player cannot take it twice");
  assert.equal(B.acceptCall(g, 3), true, "the partner takes it too");
  assert.equal(g.bid.pending, null, "now it stands");
  assert.equal(g.bid.level, 1);
  assert.equal(g.bid.team, 0);
});

test("either of the pair giving it up ends the round there", () => {
  const g = four();
  g.turn = 0;
  B.call(g, 0);
  B.acceptCall(g, 1);                       // one says yes
  assert.equal(B.concede(g, 3), true, "the partner gives it up instead");
  assert.equal(g.phase, "roundOver");
  assert.equal(g.roundWinner, 0, "the side that called takes it");
  assert.equal(g.scores[0], 1, "for what it was worth before the raise");
});

test("a whole round plays out to a result", () => {
  for (let seed = 0; seed < 60; seed++) {
    let n = seed * 7919 + 13;
    const rnd = () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const g = four({ rnd });
    let guard = 0;
    while (g.phase === "play" && guard++ < 400) {
      const seat = g.turn;
      if (!g.lead) {
        const cards = B.aiLead(g, seat);
        assert.ok(B.lead(g, seat, cards), `seat ${seat} could not lead`);
      } else {
        const cards = B.aiAnswer(g, seat);
        assert.notEqual(B.answer(g, seat, cards), null, `seat ${seat} could not answer`);
      }
    }
    assert.ok(guard < 400, "the round finished rather than looping");
    assert.equal(g.phase, "roundOver", "a round of four ends");
    const [a, b] = B.roundStanding(g);
    assert.equal(a + b, 120, `all 120 points were taken (${a} + ${b})`);
    assert.equal(g.hands.every((h) => !h.length), true, "and every hand is empty");
    if (a !== b) assert.equal(g.roundWinner, a > b ? 0 : 1, "the side with more took it");
  }
});

test("nobody is forced to beat a partner, and taking it off them is allowed", () => {
  const g = four();
  g.trump = S.clubs; g.deck = [];
  g.hands = [
    [c("K", S.spades)],
    [c("6", S.spades)],
    [c("A", S.spades)],      // seat 0's partner, holding a better card
    [c("7", S.spades)],
  ];
  g.taken = [[], [], [], []];
  g.turn = 0;
  B.lead(g, 0, [c("K", S.spades)]);
  B.answer(g, 1, [c("6", S.spades)]);
  // the engine allows it either way — here the partner does take it over
  assert.equal(B.answer(g, 2, [c("A", S.spades)]), -1);
  assert.equal(B.standing(g).holder, 2, "a partner may take it, if they want to");
  B.answer(g, 3, [c("7", S.spades)]);
  assert.equal(B.teamOf(g, 2), B.teamOf(g, 0), "either way it stays on the same side");
});
