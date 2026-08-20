/* =====================================================================
   ბურა, played to death — both variants, alone and in pairs.

   The rules have their own tests. This one plays whole matches and checks what
   must be true after EVERY move: cards that go missing or turn up twice, a
   player asked to move with nothing to play, points that do not add up to what
   is in the deck. None of it shows in a hand or two.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const B = require("../public/js/bura.js");

const seeded = (seed) => { let n = seed; return () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };
const key = (c) => c.join(",");

// every card is in exactly one place: a hand, the table, the pack, or taken
function accountForEveryCard(g, size) {
  const seen = [];
  g.hands.forEach((h) => h.forEach((c) => seen.push(key(c))));
  g.taken.forEach((h) => h.forEach((c) => seen.push(key(c))));
  g.deck.forEach((c) => seen.push(key(c)));
  if (g.lead) g.lead.cards.forEach((c) => seen.push(key(c)));
  (g.answers || []).forEach((a) => a.cards.forEach((c) => seen.push(key(c))));
  // a card already led and turned back on is on the table, not in a hand
  if (g.answerSoFar && !(g.answers || []).some((a) => a.seat === g.answerBy))
    g.answerSoFar.forEach((c) => seen.push(key(c)));
  const set = new Set(seen);
  assert.equal(set.size, seen.length, "a card is in two places at once");
  assert.equal(seen.length, size, `${size} cards accounted for, not ${seen.length}`);
}

function playAMatch(opts, check) {
  const g = B.newGame(opts);
  const size = opts.players === 4 ? 36 : (opts.variant === "3" ? 20 : 36);
  let guard = 0, rounds = 0;
  while (g.phase !== "over" && guard++ < 8000) {
    if (g.phase === "roundOver") { rounds++; B.nextRound(g); continue; }
    if (g.phase !== "play") break;
    const seat = g.turn;
    if (check) check(g, size);
    if (!g.lead) {
      const cards = B.aiLead(g, seat);
      assert.ok(cards && cards.length, `seat ${seat} had nothing to lead`);
      assert.ok(B.canLead(g, seat, cards), `seat ${seat} led something not allowed`);
      assert.ok(B.lead(g, seat, cards));
    } else {
      const cards = B.aiAnswer(g, seat);
      assert.equal(cards.length, B.answerSize(g, seat), `seat ${seat} answered with the wrong number`);
      assert.notEqual(B.answer(g, seat, cards), null, `seat ${seat} could not answer`);
    }
  }
  assert.ok(guard < 8000, "the match finished rather than looping");
  return { g, rounds };
}

test("the short game, played out again and again", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { g, rounds } = playAMatch({ variant: "3", target: 6, rnd: seeded(seed * 613) },
                                     accountForEveryCard);
    assert.equal(g.phase, "over");
    assert.ok(rounds > 0, "at least one round was played");
    assert.ok(g.matchWinner === 0 || g.matchWinner === 1);
    assert.ok(Math.max(g.scores[0], g.scores[1]) >= g.target, "somebody got there");
  }
});

test("the long game, played out again and again", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { g } = playAMatch({ variant: "5", target: 6, rnd: seeded(seed * 811) },
                             accountForEveryCard);
    assert.equal(g.phase, "over");
    assert.ok(Math.max(g.scores[0], g.scores[1]) >= g.target);
  }
});

test("in pairs, played out again and again", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const { g } = playAMatch({ players: 4, target: 6, rnd: seeded(seed * 1013) },
                             accountForEveryCard);
    assert.equal(g.phase, "over");
    assert.equal(g.players, 4);
    assert.ok(Math.max(g.scores[0], g.scores[1]) >= g.target);
  }
});

test("every round is worth the hundred and twenty points in the deck", () => {
  for (const opts of [{ variant: "3" }, { variant: "5" }, { players: 4 }]) {
    for (let seed = 1; seed <= 25; seed++) {
      const g = B.newGame(Object.assign({ target: 21, rnd: seeded(seed * 457) }, opts));
      let guard = 0;
      while (g.phase === "play" && guard++ < 400) {
        const seat = g.turn;
        if (!g.lead) B.lead(g, seat, B.aiLead(g, seat));
        else B.answer(g, seat, B.aiAnswer(g, seat));
      }
      // a round can also end early on a claim or a ბურა, which is not a full count
      if (g.phase === "roundOver" && g.log === "რაუნდი") {
        const [a, b] = B.roundStanding(g);
        assert.equal(a + b, 120, `${a} + ${b} is not 120 (${JSON.stringify(opts)})`);
      }
    }
  }
});

test("a player is never asked for more cards than they are holding", () => {
  for (const opts of [{ variant: "3" }, { variant: "5" }, { players: 4 }]) {
    for (let seed = 1; seed <= 20; seed++) {
      const g = B.newGame(Object.assign({ target: 11, rnd: seeded(seed * 271) }, opts));
      let guard = 0;
      while (g.phase === "play" && guard++ < 400) {
        const seat = g.turn;
        if (g.lead) {
          const need = B.answerSize(g, seat);
          assert.ok(need > 0, `seat ${seat} was asked for nothing`);
          assert.ok(need <= g.hands[seat].length + B.committed(g, seat).length,
            `seat ${seat} asked for ${need} holding ${g.hands[seat].length}`);
          B.answer(g, seat, B.aiAnswer(g, seat));
        } else {
          B.lead(g, seat, B.aiLead(g, seat));
        }
      }
    }
  }
});

test("nobody may lead or answer out of turn", () => {
  for (const opts of [{ variant: "3" }, { players: 4 }]) {
    const g = B.newGame(Object.assign({ target: 11, rnd: seeded(31) }, opts));
    const seat = g.turn, other = (seat + 1) % g.players;
    assert.equal(B.lead(g, other, [g.hands[other][0]]), false, "not out of turn");
    assert.ok(B.lead(g, seat, B.aiLead(g, seat)));
    const wrong = (g.turn + 1) % g.players;
    assert.equal(B.canAnswer(g, wrong, [g.hands[wrong][0]]), false, "nor answering out of turn");
  }
});

test("a lead must be one suit, and cards the player actually holds", () => {
  const g = B.newGame({ variant: "5", target: 11, rnd: seeded(77) });
  const seat = g.turn, hand = g.hands[seat];
  const suits = new Set(hand.map(B.suitOf));
  if (suits.size > 1) {
    const a = hand.find((c) => B.suitOf(c) === [...suits][0]);
    const b = hand.find((c) => B.suitOf(c) === [...suits][1]);
    assert.equal(B.canLead(g, seat, [a, b]), false, "two suits at once is not a lead");
  }
  const notMine = [B.suitOf(hand[0]), 99];
  assert.equal(B.canLead(g, seat, [notMine]), false, "and not a card that does not exist");
  assert.equal(B.canLead(g, seat, []), false, "nor nothing at all");
});
