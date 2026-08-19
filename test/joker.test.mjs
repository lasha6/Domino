/* =====================================================================
   ჯოკერი — the rules, exactly as the player gave them.

   Four players, no teams. The things that are easy to get wrong and hard to
   see on screen live here: the ten sitting below the jack, the dealer being
   forbidden the bid that would make the numbers add up, what a joker does, and
   what a hand is worth.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const J = require("../public/js/joker.js");

const S = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
const R = {};
J.RANKS.forEach((n, i) => { R[n] = i; });
const c = (rank, suit) => [suit, R[rank]];
const JK = (i) => [J.JOKER, i || 0];

// a seeded shuffle, so a failing test fails the same way twice
const seeded = (seed) => { let n = seed; return () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };

test("the deck is 36 cards with the black sixes swapped for two jokers", () => {
  const d = J.makeDeck();
  assert.equal(d.length, 36);
  assert.equal(d.filter(J.isJoker).length, 2, "two jokers");
  const sixes = d.filter((x) => !J.isJoker(x) && J.RANKS[x[1]] === "6");
  assert.equal(sixes.length, 2, "only two sixes are left");
  assert.deepEqual(sixes.map((x) => x[0]).sort(), [S.hearts, S.diamonds],
    "and they are the red ones — the black sixes are the ones the jokers replaced");
  // nothing is in there twice
  const seen = new Set(d.map((x) => x.join(",")));
  assert.equal(seen.size, 36);
});

test("the ten sits BELOW the jack, which is not how ბურა counts", () => {
  const order = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  assert.deepEqual(J.RANKS, order);
  assert.ok(R["10"] < R.J, "ten under jack");
  assert.ok(R.J < R.Q, "jack under queen");
  assert.ok(R.Q < R.K, "queen under king");
  assert.ok(R.K < R.A, "king under ace");
});

test("twenty-four hands in four sets: up to eight, four nines, back down, four nines", () => {
  assert.equal(J.HANDS, 24);
  assert.deepEqual(J.SET_SIZES[0], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(J.SET_SIZES[1], [9, 9, 9, 9]);
  assert.deepEqual(J.SET_SIZES[2], [8, 7, 6, 5, 4, 3, 2, 1]);
  assert.deepEqual(J.SET_SIZES[3], [9, 9, 9, 9]);
  assert.equal(J.SCHEDULE.filter((h) => h.set === 1).length, 8);
  assert.equal(J.SCHEDULE.filter((h) => h.size === 9).length, 8, "eight hands of nine in all");
});

/* ---------------- what a hand is worth ---------------- */

test("an exact bid is fifty a trick and fifty for being right", () => {
  assert.equal(J.handScore(0, 0, 5, 1), 50, "0 of 0 is fifty");
  assert.equal(J.handScore(3, 3, 5, 1), 200, "3 of 3 is two hundred");
  assert.equal(J.handScore(1, 1, 4, 1), 100);
});

test("bidding every trick and taking every trick is a hundred each", () => {
  assert.equal(J.handScore(9, 9, 9, 2), 900);
  assert.equal(J.handScore(8, 8, 8, 1), 800);
  // and only then: taking them all without having said so is still a miss
  assert.equal(J.handScore(5, 9, 9, 2), 90, "nine taken, five called — ten a trick");
  // in a one-card hand the two rules agree, which is a good sign for both
  assert.equal(J.handScore(1, 1, 1, 1), 100);
});

test("a miss is ten a trick", () => {
  assert.equal(J.handScore(2, 4, 6, 1), 40);
  assert.equal(J.handScore(0, 3, 6, 1), 30, "having said nothing and taken three");
});

test("ხიშტი costs 200 in the short sets and 500 in the nines", () => {
  assert.equal(J.handScore(1, 0, 5, 1), -200);
  assert.equal(J.handScore(4, 0, 8, 3), -200);
  assert.equal(J.handScore(1, 0, 9, 2), -500);
  assert.equal(J.handScore(3, 0, 9, 4), -500);
  // saying nothing and taking nothing is not a ხიშტი, it is exactly right
  assert.equal(J.handScore(0, 0, 9, 2), 50);
});

/* ---------------- the trump ---------------- */

test("in the small hands the turned card is the trump, and a turned joker is ბეზი", () => {
  let sawSuit = false, sawJoker = false;
  for (let seed = 1; seed < 300 && !(sawSuit && sawJoker); seed++) {
    const g = J.newGame({ rnd: seeded(seed) });
    J.deal(g);
    assert.equal(g.phase, "bid", "a small hand goes straight to bidding");
    assert.ok(g.turned, "a card was turned");
    if (J.isJoker(g.turned)) { sawJoker = true; assert.equal(g.trump, J.NOTRUMP, "a joker means ბეზი"); }
    else { sawSuit = true; assert.equal(g.trump, J.suitOf(g.turned), "otherwise its suit is the trump"); }
  }
  assert.ok(sawSuit, "some deals turn an ordinary card");
  assert.ok(sawJoker, "and some turn a joker");
});

test("in the nines nobody turns anything — the dealer's left names it from three cards", () => {
  const g = J.newGame({ rnd: seeded(7) });
  g.hand = J.SCHEDULE.findIndex((h) => h.size === 9);
  J.deal(g);
  assert.equal(g.phase, "choose");
  const chooser = J.leftOfDealer(g);
  assert.equal(g.turn, chooser, "the player on the dealer's left chooses");
  assert.equal(g.hands[chooser].length, 3, "and sees three cards to do it");
  assert.deepEqual([0, 1, 2, 3].filter((p) => p !== chooser).map((p) => g.hands[p].length), [0, 0, 0],
    "nobody else has anything yet");
  assert.equal(g.turned, null, "there is nothing to turn: four nines is the whole deck");

  assert.equal(J.chooseTrump(g, (chooser + 1) % 4, S.hearts), false, "and only that player may");
  assert.equal(J.chooseTrump(g, chooser, S.hearts), true);
  assert.equal(g.trump, S.hearts);
  assert.equal(g.phase, "bid");
  g.hands.forEach((h, p) => assert.equal(h.length, 9, `seat ${p} was dealt the rest`));
});

test("the chooser may say ბეზი instead of a suit", () => {
  const g = J.newGame({ rnd: seeded(9) });
  g.hand = J.SCHEDULE.findIndex((h) => h.size === 9);
  J.deal(g);
  assert.equal(J.chooseTrump(g, g.turn, J.NOTRUMP), true);
  assert.equal(g.trump, J.NOTRUMP);
  assert.equal(g.phase, "bid");
});

/* ---------------- bidding ---------------- */

test("the dealer bids last and may not make the numbers add up", () => {
  const g = J.newGame({ rnd: seeded(3) });
  g.hand = 4;                                   // a hand of five
  J.deal(g);
  assert.equal(J.spec(g).size, 5);
  assert.equal(g.turn, J.leftOfDealer(g), "the dealer's left bids first");

  let seat = g.turn;
  const bids = [2, 1, 1];
  for (const n of bids) { assert.equal(J.bid(g, seat, n), true); seat = J.nextSeat(g, seat); }
  assert.equal(seat, g.dealer, "and the dealer is last");

  assert.equal(J.forbiddenBid(g, g.dealer), 1, "one would make it five, which is not allowed");
  assert.equal(J.canBid(g, g.dealer, 1), false);
  assert.equal(J.bid(g, g.dealer, 1), false, "so it is refused");
  assert.equal(J.canBid(g, g.dealer, 0), true, "anything else is fine");
  assert.equal(J.bid(g, g.dealer, 0), true);
  assert.equal(g.phase, "play");
  assert.notEqual(J.bidTotal(g), 5, "somebody has to be wrong");
});

test("only the dealer is restricted, and only on the last bid", () => {
  const g = J.newGame({ rnd: seeded(11) });
  g.hand = 2;                                   // a hand of three
  J.deal(g);
  const first = g.turn;
  assert.equal(J.forbiddenBid(g, first), null, "the first player may bid anything");
  assert.ok(J.bid(g, first, 3), "including all of them");
  assert.equal(J.forbiddenBid(g, g.turn), null);
});

test("a bid must be a whole number of tricks that exist", () => {
  const g = J.newGame({ rnd: seeded(13) });
  g.hand = 1;                                   // a hand of two
  J.deal(g);
  const s = g.turn;
  assert.equal(J.bid(g, s, -1), false);
  assert.equal(J.bid(g, s, 3), false, "there are only two tricks");
  assert.equal(J.bid(g, s, 1.5), false);
  assert.equal(J.bid(g, J.nextSeat(g, s), 1), false, "and not out of turn");
  assert.equal(J.bid(g, s, 2), true);
});

/* ---------------- following ---------------- */

function laid(size, trump) {
  const g = J.newGame({ rnd: seeded(21) });
  g.hand = size - 1;                            // set I counts up from one
  J.deal(g);
  g.trump = trump == null ? S.spades : trump;
  g.phase = "play";
  g.bids = [1, 1, 1, 0];
  g.turn = 0;
  g.trick = []; g.ledSuit = null;
  g.took = [0, 0, 0, 0];
  return g;
}

test("you must follow the suit; without it you must trump; without that, anything", () => {
  const g = laid(3, S.spades);
  g.hands = [
    [c("K", S.hearts)],
    [c("9", S.hearts), c("A", S.diamonds), c("7", S.spades)],   // has hearts
    [c("A", S.diamonds), c("8", S.spades)],                     // no hearts, has a trump
    [c("A", S.diamonds), c("9", S.clubs)],                      // neither
  ];
  J.play(g, 0, c("K", S.hearts));
  assert.deepEqual(J.legalPlays(g, 1).map(J.nameOf), ["9♥"], "the heart, and only the heart");
  assert.deepEqual(J.legalPlays(g, 2).map(J.nameOf), ["8♠"], "no heart, so the trump");
  assert.equal(J.legalPlays(g, 3).length, 2, "neither, so anything");
});

test("a joker may always be played, whatever you are holding", () => {
  const g = laid(3, S.spades);
  g.hands = [
    [c("K", S.hearts)],
    [c("9", S.hearts), JK(0)],                  // holds the suit AND a joker
    [c("8", S.spades), JK(1)],                  // holds a trump AND a joker
    [c("9", S.clubs)],
  ];
  J.play(g, 0, c("K", S.hearts));
  assert.deepEqual(J.legalPlays(g, 1).map(J.nameOf).sort(), ["9♥", "ჯოკერი"]);
  assert.deepEqual(J.legalPlays(g, 2).map(J.nameOf).sort(), ["8♠", "ჯოკერი"]);
});

test("under ბეზი there is nothing to trump with, so a void plays anything", () => {
  const g = laid(3, J.NOTRUMP);
  g.hands = [
    [c("K", S.hearts)],
    [c("A", S.spades), c("9", S.clubs)],
    [c("9", S.hearts)],
    [c("8", S.clubs)],
  ];
  J.play(g, 0, c("K", S.hearts));
  assert.equal(J.legalPlays(g, 1).length, 2, "no hearts and no trump: anything");
});

/* ---------------- the joker ---------------- */

test("leading a joker names a suit and everyone must play their best of it", () => {
  const g = laid(3, S.spades);
  g.hands = [
    [JK(0)],
    [c("9", S.hearts), c("K", S.hearts), c("A", S.clubs)],
    [c("7", S.hearts)],
    [c("A", S.diamonds)],
  ];
  assert.equal(J.play(g, 0, JK(0), {}), false, "a suit has to be named");
  assert.equal(J.play(g, 0, JK(0), { suit: S.hearts }), true);
  assert.equal(g.ledSuit, S.hearts, "hearts is what was asked for");
  assert.equal(g.trick[0].high, true, "and a led joker is always high");

  assert.deepEqual(J.legalPlays(g, 1).map(J.nameOf), ["K♥"],
    "the king, not the nine — the HIGHEST of the suit");
  J.play(g, 1, c("K", S.hearts));
  J.play(g, 2, c("7", S.hearts));
  J.play(g, 3, c("A", S.diamonds));
  assert.equal(g.took[0], 1, "and the joker takes it");
});

test("a joker played onto a trick takes it high and throws it away low", () => {
  const high = laid(2, S.spades);
  high.hands = [[c("K", S.hearts)], [JK(0)], [c("9", S.hearts)], [c("A", S.hearts)]];
  J.play(high, 0, c("K", S.hearts));
  J.play(high, 1, JK(0), { high: true });
  J.play(high, 2, c("9", S.hearts));
  J.play(high, 3, c("A", S.hearts));
  assert.equal(high.took[1], 1, "high, so it beats even the ace");

  const low = laid(2, S.spades);
  low.hands = [[c("K", S.hearts)], [JK(0)], [c("9", S.hearts)], [c("A", S.hearts)]];
  J.play(low, 0, c("K", S.hearts));
  J.play(low, 1, JK(0), { high: false });
  J.play(low, 2, c("9", S.hearts));
  J.play(low, 3, c("A", S.hearts));
  assert.equal(low.took[3], 1, "low, so the ace takes it and the joker was thrown away");
  assert.equal(low.took[1], 0);
});

test("two jokers both high: the one played last takes it", () => {
  const g = laid(2, S.spades);
  g.hands = [[c("K", S.hearts)], [JK(0)], [JK(1)], [c("A", S.hearts)]];
  J.play(g, 0, c("K", S.hearts));
  J.play(g, 1, JK(0), { high: true });
  J.play(g, 2, JK(1), { high: true });
  J.play(g, 3, c("A", S.hearts));
  assert.equal(g.took[2], 1, "the second one");
  assert.equal(g.took[1], 0, "not the first");
});

test("a joker beats a trump, and a trump beats the suit that was led", () => {
  const withTrump = laid(2, S.spades);
  withTrump.hands = [[c("A", S.hearts)], [c("6", S.spades)], [c("K", S.hearts)], [c("9", S.clubs)]];
  J.play(withTrump, 0, c("A", S.hearts));
  J.play(withTrump, 1, c("6", S.spades));
  J.play(withTrump, 2, c("K", S.hearts));
  J.play(withTrump, 3, c("9", S.clubs));
  assert.equal(withTrump.took[1], 1, "the smallest trump beats the biggest heart");

  const offSuit = laid(2, S.spades);
  offSuit.hands = [[c("9", S.hearts)], [c("A", S.clubs)], [c("K", S.hearts)], [c("A", S.diamonds)]];
  J.play(offSuit, 0, c("9", S.hearts));
  J.play(offSuit, 1, c("A", S.clubs));
  J.play(offSuit, 2, c("K", S.hearts));
  J.play(offSuit, 3, c("A", S.diamonds));
  assert.equal(offSuit.took[2], 1, "an ace of another suit wins nothing at all");
});

test("the ten does not beat the jack here", () => {
  const g = laid(2, S.spades);
  g.hands = [[c("10", S.hearts)], [c("J", S.hearts)], [c("9", S.hearts)], [c("8", S.hearts)]];
  J.play(g, 0, c("10", S.hearts));
  J.play(g, 1, c("J", S.hearts));
  J.play(g, 2, c("9", S.hearts));
  J.play(g, 3, c("8", S.hearts));
  assert.equal(g.took[1], 1, "the jack takes it — this is not ბურა");
});

test("the winner of a trick leads the next one", () => {
  const g = laid(2, S.spades);
  g.hands = [
    [c("9", S.hearts), c("8", S.clubs)],
    [c("A", S.hearts), c("7", S.clubs)],
    [c("K", S.hearts), c("9", S.clubs)],
    [c("Q", S.hearts), c("J", S.clubs)],
  ];
  J.play(g, 0, c("9", S.hearts));
  J.play(g, 1, c("A", S.hearts));
  J.play(g, 2, c("K", S.hearts));
  J.play(g, 3, c("Q", S.hearts));
  assert.equal(g.took[1], 1);
  assert.equal(g.turn, 1, "and seat 1 leads");
});

/* ---------------- a whole hand, and a whole set ---------------- */

test("a hand plays out, every trick is taken by somebody, and the points are written down", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = J.newGame({ rnd: seeded(seed * 31) });
    J.deal(g);
    if (g.phase === "choose") J.chooseTrump(g, g.turn, J.NOTRUMP);
    while (g.phase === "bid") J.bid(g, g.turn, J.aiBid(g, g.turn));
    const size = J.spec(g).size;
    let guard = 0;
    while (g.phase === "play" && guard++ < 100) {
      const seat = g.turn;
      const m = J.aiPlay(g, seat);
      assert.ok(J.play(g, seat, m.card, m.opts), `seat ${seat} could not play`);
    }
    assert.equal(g.phase, "handOver", "the hand ended");
    assert.equal(g.took.reduce((a, b) => a + b, 0), size, "every trick went to somebody");
    assert.equal(g.hands.every((h) => !h.length), true, "and every card was played");
    assert.equal(g.history.length, 1, "the hand is on the record");
  }
});

test("the deal moves round the table and the match runs to twenty-four hands", () => {
  const g = J.newGame({ rnd: seeded(5) });
  const firstDealer = g.dealer;
  J.deal(g);
  let played = 0, guard = 0;
  while (g.phase !== "over" && guard++ < 2000) {   // ~700 moves in a full match
    if (g.phase === "choose") { J.chooseTrump(g, g.turn, J.NOTRUMP); continue; }
    if (g.phase === "bid") { J.bid(g, g.turn, J.aiBid(g, g.turn)); continue; }
    if (g.phase === "play") { const m = J.aiPlay(g, g.turn); J.play(g, g.turn, m.card, m.opts); continue; }
    if (g.phase === "handOver") { played++; J.nextHand(g); continue; }
    break;
  }
  assert.equal(g.phase, "over", "the match finished");
  assert.equal(played, 24, "after twenty-four hands");
  assert.equal(g.history.length, 24);
  assert.equal(g.dealer, (firstDealer + 23) % 4, "and the deal went round and round");
  assert.ok(g.winner >= 0 && g.winner < 4);
  assert.equal(g.scores[g.winner], Math.max(...g.scores), "the most points wins");
});

test("getting every bid in a set right is worth the best hand of it again", () => {
  const g = J.newGame({});
  // a whole set I: eight hands, seat 0 exact in every one, seat 1 not
  const sizes = J.SET_SIZES[0];
  g.history = sizes.map((size, i) => ({
    hand: i, set: 1, size,
    bids: [i === 0 ? 0 : 1, 1, 0, 0],
    took: [i === 0 ? 0 : 1, i === 3 ? 0 : 1, 0, 0],
    points: [i === 0 ? 50 : 100, i === 3 ? -200 : 100, 50, 50],
  }));
  g.hand = J.SCHEDULE.findIndex((h) => h.set === 1 && h.last);
  g.bids = g.history[7].bids.slice();
  g.took = g.history[7].took.slice();
  g.history.pop();                                // finishHand pushes the last one
  g.scores = [0, 0, 0, 0];
  J.finishHand(g);

  assert.ok(g.setBonus, "a bonus was worked out");
  assert.ok(g.setBonus[0] > 0, "seat 0 was right every time");
  assert.equal(g.setBonus[1], 0, "seat 1 missed one, so nothing");
  assert.equal(g.setBonus[2], 50, "a bid of nothing counts as well, as long as it was right");
  assert.equal(g.setBonus[3], 50);
});

test("a set is only bonused at its last hand", () => {
  const g = J.newGame({});
  g.hand = 0;                                     // the first hand of set I
  g.bids = [0, 0, 0, 0]; g.took = [0, 0, 0, 0];
  J.finishHand(g);
  assert.equal(g.setBonus, null, "not yet");
  assert.deepEqual(g.scores, [50, 50, 50, 50], "just the hand");
});

test("whatever is turned for trump is in nobody's hand", () => {
  /* The player made the point and said it matters: he counts on it. When the
     turned card is a joker, only ONE joker is still in play, and the table has
     to be able to say so — which is why the screen draws the turned card itself
     rather than a word for it. */
  for (let seed = 1; seed <= 200; seed++) {
    let n = seed * 613;
    const rnd = () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const g = J.newGame({ rnd });
    g.hand = seed % 8;                        // set I: the hands that turn a card
    g.phase = "deal";
    J.deal(g);
    assert.ok(g.turned, "a card is turned");
    const held = [].concat(...g.hands);
    assert.ok(!held.some((c) => J.sameCard(c, g.turned)),
      `the turned ${J.nameOf(g.turned)} was dealt to somebody as well`);
  }
});

test("a turned joker leaves exactly one joker to be played", () => {
  let seen = 0;
  for (let seed = 1; seed <= 800 && seen < 5; seed++) {
    let n = seed * 977;
    const rnd = () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const g = J.newGame({ rnd });
    g.hand = 5; g.phase = "deal";
    J.deal(g);
    if (!J.isJoker(g.turned)) continue;
    seen++;
    assert.equal(g.trump, J.NOTRUMP, "a turned joker means ბეზი");
    const inHands = [].concat(...g.hands).filter(J.isJoker).length;
    assert.ok(inHands <= 1, "and at most one joker can be in a hand");
  }
  assert.ok(seen > 0, "some deal turns a joker");
});
