/* =====================================================================
   ჯოკერი, played to death.

   The rules have their own tests; this one plays whole matches and checks the
   things that must be true after EVERY move, not just at the end. Cards that
   go missing or turn up twice, a player asked to move with nothing legal to
   play, a score that does not match the rule it came from — none of those show
   up in a hand or two, and all of them ruin a game quietly.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const J = require("../public/js/joker.js");

const seeded = (seed) => { let n = seed; return () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };
const key = (c) => c.join(",");

/* Every card of the deck is somewhere, exactly once: in a hand, on the table,
   turned for trump, still in the pack, or taken in a trick already played. */
function accountForEveryCard(g, wonAlready) {
  const seen = [];
  g.hands.forEach((h) => h.forEach((c) => seen.push(key(c))));
  g.trick.forEach((p) => seen.push(key(p.card)));
  g.deck.forEach((c) => seen.push(key(c)));
  if (g.turned) seen.push(key(g.turned));
  wonAlready.forEach((c) => seen.push(key(c)));
  const set = new Set(seen);
  assert.equal(set.size, seen.length, "a card is in two places at once");
  assert.equal(seen.length, 36, `36 cards accounted for, not ${seen.length}`);
}

test("a thousand hands: no card is ever lost, doubled, or unplayable", () => {
  let hands = 0, tricks = 0, jokersPlayed = 0, givenAway = 0;

  for (let seed = 1; seed <= 60; seed++) {
    const g = J.newGame({ rnd: seeded(seed * 7717) });
    J.deal(g);
    let guard = 0;

    while (g.phase !== "over" && guard++ < 3000) {
      if (g.phase === "choose") {
        assert.equal(J.spec(g).size, 9, "only the nines are chosen for");
        assert.equal(g.hands[g.turn].length, 3, "and the chooser sees three");
        J.chooseTrump(g, g.turn, seed % 5 === 0 ? J.NOTRUMP : seed % 4);
        continue;
      }
      if (g.phase === "bid") {
        const seat = g.turn;
        const n = J.aiBid(g, seat);
        assert.ok(J.canBid(g, seat, n), `seat ${seat} bid ${n}, which is not allowed`);
        assert.ok(J.bid(g, seat, n));
        continue;
      }
      if (g.phase === "play") {
        const seat = g.turn, size = J.spec(g).size;
        const wonSoFar = [];      // cards already taken this hand
        // whatever has left the hands and is not on the table has been won
        const legal = J.legalPlays(g, seat);
        assert.ok(legal.length > 0, `seat ${seat} has nothing it may play`);
        legal.forEach((c) => assert.ok(g.hands[seat].some((x) => J.sameCard(x, c)),
          "a legal play that is not in the hand"));

        const m = J.aiPlay(g, seat);
        if (J.isJoker(m.card)) {
          jokersPlayed++;
          if (!g.trick.length && m.opts.high === false) givenAway++;
        }
        const before = g.hands[seat].length;
        assert.ok(J.play(g, seat, m.card, m.opts), `seat ${seat} could not play its own choice`);
        assert.equal(g.hands[seat].length, before - 1, "exactly one card left the hand");
        if (!g.trick.length) {
          tricks++;
          assert.equal(g.took.reduce((a, b) => a + b, 0) <= size, true, "more tricks than there are");
        }
        continue;
      }
      if (g.phase === "handOver") {
        hands++;
        const s = J.spec(g), h = g.history[g.history.length - 1];
        assert.equal(g.took.reduce((a, b) => a + b, 0), s.size, "every trick went somewhere");
        assert.equal(g.hands.every((x) => !x.length), true, "and every card was played");
        for (let p = 0; p < 4; p++)
          assert.equal(h.points[p], J.handScore(h.bids[p], h.took[p], s.size, s.set),
            `seat ${p} was scored ${h.points[p]} for ${h.bids[p]}/${h.took[p]}`);
        J.nextHand(g);
        continue;
      }
      break;
    }
    assert.ok(guard < 3000, "the match finished rather than looping");
    assert.equal(g.phase, "over");
    assert.equal(g.history.length, 24, "twenty-four hands");
    assert.ok(g.winner >= 0 && g.winner < 4);
    assert.equal(g.scores[g.winner], Math.max(...g.scores));
  }

  assert.ok(hands >= 24 * 60, `played ${hands} hands`);
  assert.ok(tricks > 3000, `played ${tricks} tricks`);
  assert.ok(jokersPlayed > 50, `the jokers came up ${jokersPlayed} times`);
  assert.ok(givenAway > 0, "and some of them were led to give the trick away");
});

test("the deck is whole at every point of a hand", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const g = J.newGame({ rnd: seeded(seed * 331) });
    J.deal(g);
    if (g.phase === "choose") J.chooseTrump(g, g.turn, 0);
    while (g.phase === "bid") J.bid(g, g.turn, J.aiBid(g, g.turn));

    const won = [];
    let guard = 0;
    while (g.phase === "play" && guard++ < 100) {
      accountForEveryCard(g, won);
      const before = g.trick.slice();
      const m = J.aiPlay(g, g.turn);
      J.play(g, g.turn, m.card, m.opts);
      if (!g.trick.length && g.lastTrick) g.lastTrick.cards.forEach((p) => won.push(p.card));
      else before.forEach(() => {});
    }
    accountForEveryCard(g, won);
  }
});

test("nobody may play out of turn, or a card they do not hold", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const g = J.newGame({ rnd: seeded(seed * 97) });
    g.hand = seed % 8;
    g.phase = "deal";
    J.deal(g);
    while (g.phase === "bid") J.bid(g, g.turn, J.aiBid(g, g.turn));

    const seat = g.turn, other = (seat + 1) % 4;
    assert.equal(J.play(g, other, g.hands[other][0], {}), false, "not out of turn");
    // a card from somebody else's hand
    const notMine = g.hands[other][0];
    if (!g.hands[seat].some((c) => J.sameCard(c, notMine)))
      assert.equal(J.play(g, seat, notMine, {}), false, "and not a card you do not hold");
    // and nothing at all
    assert.equal(J.play(g, seat, [9, 9], {}), false, "nor a card that does not exist");
  }
});

test("a joker led must name a suit, and the suit must be a real one", () => {
  const g = J.newGame({ rnd: seeded(5) });
  g.phase = "play"; g.trump = 0; g.turn = 0; g.trick = []; g.ledSuit = null;
  g.bids = [1, 1, 1, 1]; g.took = [0, 0, 0, 0];
  g.hands[0] = [[J.JOKER, 0]];
  assert.equal(J.play(g, 0, [J.JOKER, 0], {}), false, "no suit named");
  assert.equal(J.play(g, 0, [J.JOKER, 0], { suit: -1 }), false, "not a suit");
  assert.equal(J.play(g, 0, [J.JOKER, 0], { suit: 4 }), false, "nor the jokers themselves");
  assert.equal(J.play(g, 0, [J.JOKER, 0], { suit: 2 }), true, "diamonds will do");
});

test("the bids never add up to the number of tricks", () => {
  /* The dealer is forbidden the number that would make them, and that is the
     whole point of the rule — so it should hold in every hand of every match. */
  for (let seed = 1; seed <= 25; seed++) {
    const g = J.newGame({ rnd: seeded(seed * 1301) });
    J.deal(g);
    let guard = 0;
    while (g.phase !== "over" && guard++ < 3000) {
      if (g.phase === "choose") { J.chooseTrump(g, g.turn, 1); continue; }
      if (g.phase === "bid") { J.bid(g, g.turn, J.aiBid(g, g.turn)); continue; }
      if (g.phase === "play") {
        if (J.bidsIn(g) === 4)
          assert.notEqual(J.bidTotal(g), J.spec(g).size,
            `hand ${g.hand}: the bids add up to ${J.spec(g).size}`);
        const m = J.aiPlay(g, g.turn);
        J.play(g, g.turn, m.card, m.opts);
        continue;
      }
      if (g.phase === "handOver") { J.nextHand(g); continue; }
      break;
    }
  }
});
