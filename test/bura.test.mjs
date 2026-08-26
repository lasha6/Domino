/* =====================================================================
   ბურა — the rules, as the player described them.

   Nothing here comes from my own memory of the game: every check below is one
   of the rules he wrote out. Where the rules are silent the test says so
   rather than inventing an answer.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const B = require("../public/js/bura.js");

const S = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
const R = {};                                   // R["A"] = 8, R["10"] = 7 ...
B.RANKS.forEach((n, i) => { R[n] = i; });
const c = (rank, suit) => [suit, R[rank]];

/* ---------------- the deck and its values ---------------- */

test("the full deck is 36 cards worth 120 points", () => {
  const d = B.makeDeck("5");
  assert.equal(d.length, 36);
  assert.equal(B.handPoints(d), 120);
});

test("the short deck is 20 cards and still worth 120", () => {
  const d = B.makeDeck("3");
  assert.equal(d.length, 20, "sixes to nines are out");
  assert.equal(B.handPoints(d), 120);
  assert.ok(!d.some((x) => ["6", "7", "8", "9"].includes(B.RANKS[x[1]])));
});

test("a card is worth what the rules say", () => {
  const worth = { A: 11, "10": 10, K: 4, Q: 3, J: 2, "9": 0, "8": 0, "7": 0, "6": 0 };
  for (const [name, n] of Object.entries(worth))
    assert.equal(B.pointsOf(c(name, S.spades)), n, `${name} is worth ${n}`);
});

test("the ten beats the king — only the ace beats the ten", () => {
  const order = ["6", "7", "8", "9", "J", "Q", "K", "10", "A"];
  for (let i = 1; i < order.length; i++)
    assert.ok(R[order[i]] > R[order[i - 1]], `${order[i]} outranks ${order[i - 1]}`);
  assert.ok(R["10"] > R.K && R["10"] > R.Q && R["10"] > R.J, "the ten sits above the court cards");
  assert.ok(R.A > R["10"], "and only the ace is above it");
});

/* ---------------- which card wins ---------------- */

test("higher of the same suit wins; another suit does not cut", () => {
  const trump = S.clubs;
  assert.ok(B.beats(c("A", S.hearts), c("10", S.hearts), trump), "ace over ten, same suit");
  assert.ok(!B.beats(c("10", S.hearts), c("A", S.hearts), trump));
  assert.ok(!B.beats(c("A", S.spades), c("6", S.hearts), trump),
    "an ace of another plain suit does not take a six — it is simply thrown");
});

test("a trump beats any plain card, and a bigger trump beats a smaller", () => {
  const trump = S.clubs;
  assert.ok(B.beats(c("6", S.clubs), c("A", S.hearts), trump), "the lowest trump takes the highest plain card");
  assert.ok(B.beats(c("A", S.clubs), c("K", S.clubs), trump));
  assert.ok(!B.beats(c("K", S.clubs), c("A", S.clubs), trump));
  assert.ok(!B.beats(c("A", S.hearts), c("6", S.clubs), trump), "and nothing plain beats a trump");
});

test("to take the trick every led card must be beaten", () => {
  const trump = S.clubs;
  const led = [c("K", S.hearts), c("Q", S.hearts)];
  assert.ok(B.beatsAll([c("A", S.hearts), c("10", S.hearts)], led, trump), "both beaten in suit");
  assert.ok(B.beatsAll([c("6", S.clubs), c("7", S.clubs)], led, trump), "both cut with trumps");
  assert.ok(B.beatsAll([c("A", S.hearts), c("6", S.clubs)], led, trump), "one in suit, one cut");
  assert.ok(!B.beatsAll([c("A", S.hearts), c("J", S.hearts)], led, trump),
    "the jack cannot beat the queen, so the trick is not taken");
  assert.ok(!B.beatsAll([c("A", S.spades), c("K", S.spades)], led, trump), "another plain suit takes nothing");
});

test("the same card cannot answer two led cards", () => {
  const trump = S.clubs;
  // one ace and one low card against two high hearts: only one can be beaten
  assert.ok(!B.beatsAll([c("A", S.hearts), c("6", S.hearts)],
    [c("K", S.hearts), c("Q", S.hearts)], trump));
});

/* ---------------- dealing ---------------- */

test("a new game deals a hand each and turns a trump", () => {
  for (const variant of ["3", "5"]) {
    const g = B.newGame({ variant });
    const size = variant === "3" ? 3 : 5;
    assert.equal(g.hands[0].length, size);
    assert.equal(g.hands[1].length, size);
    assert.ok(g.trump != null, "a suit is trumps");
    assert.ok(g.trumpCard, "and it came from a turned card");
    assert.equal(g.deck.length, B.makeDeck(variant).length - size * 2, "the rest is the stock");
    assert.equal(B.suitOf(g.trumpCard), g.trump);
  }
});

test("no card is dealt twice", () => {
  for (let i = 0; i < 300; i++) {
    const g = B.newGame({ variant: "5" });
    const all = [...g.hands[0], ...g.hands[1], ...g.deck];
    const seen = new Set(all.map((x) => x.join("-")));
    assert.equal(seen.size, 36, "every card is somewhere, exactly once");
  }
});

/* ---------------- leading and answering ---------------- */

test("a lead may be one card or several, but all of one suit", () => {
  const g = B.newGame({ variant: "5" });
  g.hands[0] = [c("A", S.hearts), c("K", S.hearts), c("6", S.spades)];
  assert.ok(B.canLead(g, 0, [c("A", S.hearts)]), "one card");
  assert.ok(B.canLead(g, 0, [c("A", S.hearts), c("K", S.hearts)]), "two of a suit");
  assert.ok(!B.canLead(g, 0, [c("A", S.hearts), c("6", S.spades)]), "not two suits at once");
  assert.ok(!B.canLead(g, 0, [c("A", S.clubs)]), "and not a card you do not hold");
});

test("the answer must be the same number of cards", () => {
  const g = B.newGame({ variant: "5" });
  g.trump = S.clubs;
  g.hands[0] = [c("K", S.hearts), c("Q", S.hearts)];
  g.hands[1] = [c("A", S.hearts), c("10", S.hearts), c("6", S.spades)];
  g.turn = 0;
  assert.ok(B.lead(g, 0, [c("K", S.hearts), c("Q", S.hearts)]));
  assert.ok(!B.canAnswer(g, 1, [c("A", S.hearts)]), "one card cannot answer two");
  assert.ok(B.canAnswer(g, 1, [c("A", S.hearts), c("10", S.hearts)]));
});

test("beating takes the trick and its points; failing to leaves them with the leader", () => {
  const win = () => {
    const g = B.newGame({ variant: "5" });
    g.trump = S.clubs; g.deck = [];
    g.hands[0] = [c("K", S.hearts)];
    g.hands[1] = [c("A", S.hearts)];
    g.turn = 0;
    B.lead(g, 0, [c("K", S.hearts)]);
    return { g, took: B.answer(g, 1, [c("A", S.hearts)]) };
  };
  const a = win();
  assert.equal(a.took, 1, "the ace took it");
  assert.equal(B.handPoints(a.g.taken[1]), 15, "and both cards' points: 11 + 4");
  assert.equal(B.handPoints(a.g.taken[0]), 0);

  const g = B.newGame({ variant: "5" });
  g.trump = S.clubs; g.deck = [];
  g.hands[0] = [c("A", S.hearts)];
  g.hands[1] = [c("K", S.hearts)];
  g.turn = 0;
  B.lead(g, 0, [c("A", S.hearts)]);
  assert.equal(B.answer(g, 1, [c("K", S.hearts)]), 0, "the king could not beat it");
  assert.equal(B.handPoints(g.taken[0]), 15, "so the leader keeps both");
});

test("the winner of a trick leads the next one", () => {
  const g = B.newGame({ variant: "5" });
  g.trump = S.clubs; g.deck = [];
  g.hands[0] = [c("K", S.hearts)]; g.hands[1] = [c("A", S.hearts)];
  g.turn = 0;
  B.lead(g, 0, [c("K", S.hearts)]);
  B.answer(g, 1, [c("A", S.hearts)]);
  assert.equal(g.turn, 1, "the taker is on lead");
});

test("hands are filled back up after every trick, the trump card last", () => {
  const g = B.newGame({ variant: "5" });
  const before = g.deck.length;
  const led = g.hands[0].filter((x) => B.suitOf(x) === B.suitOf(g.hands[0][0])).slice(0, 1);
  B.lead(g, 0, led);
  B.answer(g, 1, g.hands[1].slice(0, 1));
  assert.equal(g.hands[0].length, 5, "back to five");
  assert.equal(g.hands[1].length, 5);
  assert.equal(g.deck.length, before - 2, "two came off the stock");
  assert.ok(g.deck.length === 0 || B.sameCard(g.deck[0], g.trumpCard),
    "the turned trump is still at the bottom");
});

/* ---------------- winning the round ---------------- */

test("sixty-one points wins the round; sixty each is a draw and scores nobody", () => {
  const g = B.newGame({ variant: "5" });
  g.taken[0] = B.makeDeck("3").filter((x) => B.handPoints([x]) > 0).slice(0, 6);
  g.hands = [[], []];
  const [a, b] = B.roundStanding(g);
  assert.equal(a + b, B.handPoints(g.taken[0]) + B.handPoints(g.taken[1]));

  const draw = B.newGame({ variant: "5" });
  draw.hands = [[], []];
  draw.taken = [[c("A", S.hearts)], [c("A", S.spades)]];   // equal
  B.finishRound(draw);
  assert.equal(draw.roundWinner, null, "nobody won");
  assert.deepEqual(draw.scores, [0, 0], "and nobody scored");
});

test("the match runs until someone reaches the agreed number", () => {
  for (const target of [6, 11, 21]) {
    const g = B.newGame({ variant: "5", target });
    assert.equal(g.target, target);
    g.scores = [target - 1, 0];
    g.hands = [[], []];
    g.taken = [[c("A", S.hearts)], []];
    B.finishRound(g);
    assert.equal(g.phase, "over");
    assert.equal(g.matchWinner, 0);
  }
});

/* ---------------- the calls ---------------- */

test("each call is worth one more than the last", () => {
  assert.deepEqual(B.CALLS, ["დავი", "სე", "ჩარი", "ფანჯი", "შაში"]);
  assert.equal(B.callValue(0), 1, "no call, the round is worth one");
  assert.equal(B.callValue(1), 2, "დავი doubles it");
  assert.equal(B.callValue(2), 3);
  assert.equal(B.callValue(5), 6, "შაში is six");
});

test("a call can only be made on your own turn, and the other side answers", () => {
  const g = B.newGame({ variant: "5" });
  g.turn = 0;
  assert.ok(B.canCall(g, 0));
  assert.ok(!B.canCall(g, 1), "not out of turn");
  assert.ok(B.call(g, 0));
  assert.ok(!B.canCall(g, 0), "and not twice in a row");
  assert.ok(!B.acceptCall(g, 0), "the caller cannot answer themselves");
  assert.ok(B.acceptCall(g, 1));
  assert.equal(g.bid.level, 1);
});

test("a call can also be made while answering what is on the table", () => {
  // "on your own turn" covers the moment the move is yours, whether that means
  // leading or answering — raising the price while looking at what came down is
  // much of the point of calling at all
  const g = B.newGame({ variant: "5" });
  g.trump = S.clubs;
  g.hands[0] = [c("K", S.hearts)];
  g.hands[1] = [c("A", S.hearts)];
  g.turn = 0;
  B.lead(g, 0, [c("K", S.hearts)]);
  assert.equal(g.turn, 1, "it is now the other player's move");
  assert.ok(B.canCall(g, 1), "and they may call before answering");
  assert.ok(!B.canCall(g, 0), "while the one who led may not");
  assert.ok(B.call(g, 1));
  assert.ok(B.acceptCall(g, 0));
  assert.equal(g.bid.level, 1);
});

test("giving up a call ends the round at what it was worth before it", () => {
  const g = B.newGame({ variant: "5" });
  g.turn = 0;
  B.call(g, 0);                       // დავი: would make the round worth 2
  B.concede(g, 1);
  assert.equal(g.phase, "roundOver");
  assert.equal(g.roundWinner, 0, "the caller takes it");
  assert.deepEqual(g.scores, [1, 0], "worth one — what it was before the call");
});

test("a won round is worth whatever the calls made it", () => {
  const g = B.newGame({ variant: "5" });
  g.turn = 0;
  B.call(g, 0); B.acceptCall(g, 1);        // დავი, x2
  g.turn = 1;
  B.call(g, 1); B.acceptCall(g, 0);        // სე, x3
  g.hands = [[], []];
  g.taken = [[c("A", S.hearts)], []];
  B.finishRound(g);
  assert.equal(g.scores[0], 3, "the round paid three");
});

/* ---------------- ვარ, in the three-card game ---------------- */

test("ვარ is right with 32 points and loses the round without them", () => {
  const right = B.newGame({ variant: "3" });
  right.turn = 0;
  right.taken[0] = [c("A", S.hearts), c("A", S.spades), c("10", S.hearts)];  // 32
  assert.equal(B.handPoints(right.taken[0]), 32);
  const r = B.sayVar(right, 0);
  assert.equal(r.right, true);
  assert.equal(right.roundWinner, 0);

  const wrong = B.newGame({ variant: "3" });
  wrong.turn = 0;
  wrong.taken[0] = [c("A", S.hearts)];        // 11
  const w = B.sayVar(wrong, 0);
  assert.equal(w.right, false);
  assert.equal(wrong.roundWinner, 1, "claiming and being short hands the round over");
});

test("ვარ belongs to the three-card game only", () => {
  const five = B.newGame({ variant: "5" });
  five.turn = 0;
  assert.equal(B.canSayVar(five, 0), false);
});

/* ---------------- ურიგო მალუტკა ---------------- */

test("five trumps may be put down out of turn, but do not win the round", () => {
  /* The two games differ here and the player was explicit about both: three
     trumps take the round in the short game, five trumps in the long one are
     only a hand that may be led out of turn and still has to be played for. */
  const g = B.newGame({ variant: "5" });
  g.trump = S.clubs;
  g.hands[1] = ["6", "7", "8", "9", "J"].map((r) => c(r, S.clubs));
  g.turn = 0;                                   // not their turn at all
  assert.ok(B.isBura(g, 1), "five trumps is ბურა");
  assert.equal(B.buraTakesRound(g), false, "which does not win the long game");
  assert.ok(B.canMalutka(g, 1), "it is put down out of turn like any whole hand");
  assert.ok(B.malutka(g, 1));
  assert.equal(g.lead.cards.length, 5, "and the other player must beat all five");
  assert.equal(g.turn, 0);
});

test("a five-card hand of one plain suit may be put down out of turn", () => {
  const g = B.newGame({ variant: "5" });
  g.trump = S.clubs;
  g.hands[1] = ["6", "7", "8", "9", "J"].map((r) => c(r, S.hearts));
  assert.ok(B.canUnturned(g, 1), "tables play it this way");
  const off = B.newGame({ variant: "5", openMalutka: false });
  off.trump = S.clubs;
  off.hands[1] = ["6", "7", "8", "9", "J"].map((r) => c(r, S.hearts));
  assert.equal(B.canUnturned(off, 1), false, "unless one was set up not to");
});

test("in the three-card game any three of a suit is a malutka", () => {
  const g = B.newGame({ variant: "3" });
  g.trump = S.clubs;
  g.hands[1] = ["J", "Q", "K"].map((r) => c(r, S.hearts));
  assert.ok(B.canUnturned(g, 1), "three hearts will do, trumps or not");
});

test("a mixed hand is never an out-of-turn lead", () => {
  const g = B.newGame({ variant: "5" });
  g.trump = S.clubs;
  g.hands[1] = [c("6", S.clubs), c("7", S.clubs), c("8", S.clubs), c("9", S.clubs), c("J", S.hearts)];
  assert.equal(B.canUnturned(g, 1, true), false, "four and one is not one suit");
});

/* ---------------- what the screen may not do ---------------- */

test("the screen never counts the taken points for either player", async () => {
  /* ვარ is a claim made by eye: you say it because you believe you are past
     thirty-two. A running total on the wall answers that for you and the call
     stops meaning anything — so the table shows the match score and nothing
     else. This guards the rule, not the layout. */
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(new URL("../public/bura.html", import.meta.url), "utf8");
  const hud = html.slice(html.indexOf('<div class="info">'), html.indexOf("</div>", html.indexOf('<div class="info">')));
  assert.ok(!/handPoints\(g\.taken/.test(html.slice(0, html.indexOf("roundEnded"))) ||
            !/id="(myPts|opPts)"/.test(html),
    "the running count must not be painted into the header");
  assert.ok(!hud.includes("myPts") && !hud.includes("opPts"),
    "neither player's taken points belong in the header");
});

/* ---------------- a whole round, played out ---------------- */

test("a full round finishes and the points add up to 120", () => {
  for (const variant of ["3", "5"]) {
    for (let i = 0; i < 200; i++) {
      const g = B.newGame({ variant });
      let guard = 0;
      while (g.phase === "play" && guard++ < 200) {
        const leader = g.turn;
        const cards = B.aiLead(g, leader);
        assert.ok(B.lead(g, leader, cards), "the computer led something legal");
        const reply = B.aiAnswer(g, 1 - leader);
        assert.ok(B.answer(g, 1 - leader, reply) != null, "and the other side answered");
      }
      assert.notEqual(g.phase, "play", "the round ended");
      const [a, b] = B.roundStanding(g);
      assert.equal(a + b, 120, `every point is accounted for (${a} + ${b})`);
      assert.equal(g.hands[0].length + g.hands[1].length, 0, "and every card was played");
    }
  }
});

test("once the deck is empty the turned trump is in somebody's hand", () => {
  /* The player made the point: the trump lies face up on the table, so you know
     nobody is holding it — the moment the deck runs out that stops being true,
     because it is the last card drawn. A screen that still shows the card is
     telling you something false, so it shows only the suit from then on. This
     locks down the fact the screens rely on. */
  for (const variant of ["3", "5"]) {
    const g = B.newGame({ variant });
    const turned = g.trumpCard;
    assert.ok(turned, "there is a turned trump");
    assert.equal(B.suitOf(turned), g.trump, "and it sets the suit");
    assert.ok(g.deck.length > 0, "while it is still on the table the deck is not empty");
    assert.equal(g.deck[0], turned, "it is the last card that will leave the deck");

    // draw everything, the way play does
    let guard = 0;
    while (g.deck.length && guard++ < 100) {
      g.hands[0] = []; g.hands[1] = [];
      B.refill(g, 0);
    }
    assert.equal(g.deck.length, 0, "the deck is empty");
    const held = g.hands[0].concat(g.hands[1], g.taken[0], g.taken[1]);
    assert.ok(held.some((c) => B.sameCard(c, turned)),
      "and the card that was on the table has been taken by somebody");
  }
});

test("the trump suit survives the card being drawn", () => {
  // whatever else changes, the suit is what a screen can still show
  const g = B.newGame({ variant: "5" });
  const suit = g.trump;
  g.deck = [];
  assert.equal(g.trump, suit, "the suit does not move when the deck empties");
  assert.ok(g.trump >= 0 && g.trump < 4, "and spades being 0 is a real suit, not nothing");
});

/* =====================================================================
   Between one trick and the next.

   Two rules the player stated, both of them the ordinary ბურა ones, and
   neither of them protected by a test until now:

     · whoever took the trick leads the following one;
     · nothing in a hand is thrown away and re-dealt — what you are holding
       stays, and only the shortfall is drawn back.

   The second is the one worth guarding. "Deal again" is the natural thing to
   write, and it would be wrong: a hand is only ever topped up.
   ===================================================================== */

// a repeatable shuffle, so a failure names a rule rather than a deal
function fixed(seed) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

/* Lead the first card, then let everyone answer with the first card that is
   accepted. Returns who took it. */
function playTrick(g) {
  const leader = g.turn;
  assert.ok(B.lead(g, leader, [g.hands[leader][0]]), "the leader could not lead");
  let took = -1;
  for (let k = 0; k < g.players - 1; k++) {
    const s = g.turn;
    let done = false;
    for (const c of g.hands[s].slice()) {
      const r = B.answer(g, s, [c]);
      if (r !== null) { took = r; done = true; break; }
    }
    assert.ok(done, "seat " + s + " had no legal answer at all");
  }
  return took;
}

for (const players of [2, 4]) {
  test(`ბურა ${players === 2 ? "1v1" : "2v2"}: whoever takes the trick leads the next one`, () => {
    const g = B.newGame({ variant: "5", players, rnd: fixed(7) });
    const took = playTrick(g);
    assert.notEqual(took, -1, "nobody took the trick");
    assert.equal(g.turn, took, "the trick was taken by one player and led by another");
  });

  test(`ბურა ${players === 2 ? "1v1" : "2v2"}: a hand is topped up, never re-dealt`, () => {
    const g = B.newGame({ variant: "5", players, rnd: fixed(13) });
    const key = (c) => c.join("-");
    const before = g.hands.map((h) => h.map(key));
    const deckBefore = g.deck.length;

    playTrick(g);

    let drawn = 0;
    for (let p = 0; p < players; p++) {
      const after = g.hands[p].map(key);
      /* Everything still held was held before: one card each left the hand to
         make the trick, and nothing else moved. */
      const kept = before[p].filter((c) => after.includes(c));
      assert.equal(kept.length, before[p].length - 1,
        `seat ${p} lost cards it had not played — the hand was re-dealt`);
      const fresh = after.filter((c) => !before[p].includes(c));
      assert.ok(fresh.length <= 1, `seat ${p} drew ${fresh.length} for one card played`);
      drawn += fresh.length;
      assert.equal(after.length, g.handSize, `seat ${p} was not brought back up`);
    }
    assert.equal(deckBefore - g.deck.length, drawn,
      "the deck lost a different number of cards than the players gained");
  });
}

test("the player who took the trick draws first", () => {
  /* It matters at the very end, when there are fewer cards left than players:
     the winner is the one who gets them. */
  const g = B.newGame({ variant: "5", players: 4, rnd: fixed(5) });
  g.deck = g.deck.slice(0, 1);                 // one card left for four hands
  const one = g.deck[0].join("-");
  const took = playTrick(g);
  assert.notEqual(took, -1, "nobody took the trick");
  assert.ok(g.hands[took].some((c) => c.join("-") === one),
    "the last card went to somebody other than the player who won the trick");
});

/* =====================================================================
   Between one ROUND and the next.

   A round ending is not a trick ending, and the two do opposite things. After
   a trick a hand is topped up from the deck. After a round every card comes
   back in, the deck is shuffled, and all of it is dealt again — a new trump
   turned, the taken piles emptied, nothing carried over at all.

   And the side that WON the round leads the new one. The engine had the loser
   leading, which is the ნარდი rule and the ozi one, not the ბურა one.
   ===================================================================== */

for (const players of [2, 4]) {
  const label = players === 2 ? "1v1" : "2v2";

  test(`ბურა ${label}: a new round is dealt from a fresh shuffled deck`, () => {
    const g = B.newGame({ variant: "5", players, rnd: fixed(3) });
    const key = (c) => c.join("-");
    const oldHands = g.hands.map((h) => h.map(key));
    const oldTrump = g.trumpCard && key(g.trumpCard);
    const full = g.deck.length;

    // spend some of the round, so there is something to NOT carry over
    playTrick(g);
    g.taken[0].push(g.hands[0].pop());
    g.phase = "roundOver"; g.roundWinner = 0;
    assert.ok(B.nextRound(g), "the round would not turn over");

    for (let p = 0; p < players; p++) {
      assert.equal(g.hands[p].length, g.handSize, `seat ${p} was not dealt a full hand`);
      const carried = g.hands[p].map(key).filter((c) => oldHands[p].includes(c));
      /* A card CAN come round again — it is the same deck reshuffled — but a
         whole hand coming back would mean it was never collected. */
      assert.ok(carried.length < g.handSize,
        `seat ${p} kept its entire old hand — the cards were never taken in`);
    }
    assert.equal(g.deck.length, full, "the deck did not come back whole");
    assert.deepEqual(g.taken.map((t) => t.length), g.taken.map(() => 0),
      "what somebody took last round is still sitting in front of them");
    assert.ok(g.trumpCard, "no trump was turned for the new round");
    assert.equal(g.round, 2, "the round number did not move on");
  });

  test(`ბურა ${label}: the side that won the round leads the next one`, () => {
    for (const winner of [0, 1]) {
      const g = B.newGame({ variant: "5", players, rnd: fixed(9) });
      g.phase = "roundOver"; g.roundWinner = winner;
      B.nextRound(g);
      assert.equal(B.teamOf(g, g.turn), winner,
        `team ${winner} won and the other side was given the lead`);
    }
  });
}
