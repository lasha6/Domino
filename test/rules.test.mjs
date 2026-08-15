/* =====================================================================
   The rules of "ოზი", checked automatically.

   These are the things a person cannot notice by playing a few hands: they
   only show up once in a few hundred deals. Run them after every change with
   `npm test` — if one fails, the rule it names has drifted.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// the engine is CommonJS so the server and the browser can share one copy
const require = createRequire(import.meta.url);
const Ozi = require("../public/js/ozi.js");

const DECK = [];
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) DECK.push([a, b]);

function shuffled() {
  const d = DECK.map((t) => [...t]);
  for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

// Play a whole board out of the bag, choosing legal moves at random.
function randomBoard(stopAfter = Infinity) {
  const bag = shuffled();
  const b = { line: [], top: [], bottom: [], spinnerVal: null };
  Ozi.place(b, bag.pop(), "open");
  let laid = 1;
  while (bag.length && laid < stopAfter) {
    let played = false;
    for (let i = bag.length - 1; i >= 0; i--) {
      const sides = Ozi.matchingSides(b, bag[i]);
      if (!sides.length) continue;
      Ozi.place(b, bag.splice(i, 1)[0], sides[(Math.random() * sides.length) | 0]);
      played = true; laid++; break;
    }
    if (!played) break;
  }
  return b;
}

test("a hand can always be dealt — no deal ever leaves nobody able to open", () => {
  for (let i = 0; i < 3000; i++) {
    const g = Ozi.newGame(175, 2);
    assert.equal(g.hands.length, 2);
    assert.ok(g.hands.every((h) => h.length === 7), "each player gets seven tiles");
    // 2 players x 7 + boneyard = the whole 28
    const all = g.hands.flat().length + g.boneyard.filter(Boolean).length;
    assert.equal(all, 28, "every tile is accounted for");
  }
});

test("2v2 deals all 28 tiles and leaves no boneyard", () => {
  for (let i = 0; i < 500; i++) {
    const g = Ozi.newGame(175, 4);
    assert.equal(g.hands.length, 4);
    assert.ok(g.hands.every((h) => h.length === 7));
    assert.equal(g.boneyard.filter(Boolean).length, 0, "four players use the whole set");
  }
});

test("the last two tiles of the boneyard can never be taken", () => {
  const g = Ozi.newGame(175, 2);
  let taken = 0;
  while (Ozi.canDraw(g)) {
    const slot = g.boneyard.findIndex(Boolean);
    assert.ok(slot >= 0, "canDraw promised a tile");
    assert.ok(Ozi.drawSlot(g, 0, slot), "the promised tile came out");
    taken++;
  }
  assert.equal(g.boneyard.filter(Boolean).length, 2, "exactly two are left behind");
  assert.equal(Ozi.drawSlot(g, 0, g.boneyard.findIndex(Boolean)), null, "and they stay put");
  assert.ok(taken > 0);
});

test("there is one spinner, it is a double on the table, and the arms hang off it", () => {
  // Note the spinner may sit at either END of the chain: the opening double is
  // the spinner from the start, and if every later tile happens to go to the
  // same side it stays on the edge. Its own two open sides are the arms.
  for (let i = 0; i < 2000; i++) {
    const b = randomBoard();
    if (b.spinnerVal == null) {
      assert.equal(b.top.length + b.bottom.length, 0, "no spinner means no arms to hang");
      continue;
    }
    const doubles = b.line.filter((t) => t[0] === t[1] && t[0] === b.spinnerVal);
    assert.equal(doubles.length, 1, "exactly one tile can be the spinner");
    for (const arm of ["top", "bottom"])
      if (b[arm].length)
        assert.equal(b[arm][0][0], b.spinnerVal, `the ${arm} arm grows out of the spinner`);
  }
});

test("every tile on the table matches its neighbour", () => {
  for (let i = 0; i < 2000; i++) {
    const b = randomBoard();
    for (let j = 1; j < b.line.length; j++)
      assert.equal(b.line[j - 1][1], b.line[j][0], `chain break at ${j}: ${b.line}`);
    for (const arm of ["top", "bottom"]) {
      const a = b[arm];
      if (!a.length) continue;
      assert.equal(a[0][0], b.spinnerVal, `${arm} arm must start from the spinner`);
      for (let j = 1; j < a.length; j++)
        assert.equal(a[j - 1][1], a[j][0], `${arm} arm break at ${j}`);
    }
  }
});

test("no tile is ever played twice", () => {
  for (let i = 0; i < 2000; i++) {
    const b = randomBoard();
    const seen = new Set();
    for (const t of [...b.line, ...b.top, ...b.bottom]) {
      const key = [t[0], t[1]].sort().join("-");
      assert.ok(!seen.has(key), `tile ${key} appears twice`);
      seen.add(key);
    }
  }
});

test("points are scored only when the open ends divide by five", () => {
  for (let i = 0; i < 1500; i++) {
    const g = Ozi.newGame(175, 2);
    for (let move = 0; move < 40 && !g.roundOver; move++) {
      const seat = g.turn;
      const tile = (g.hands[seat] || []).find((t) => Ozi.matchingSides(g, t).length);
      if (!tile) break;
      const side = Ozi.matchingSides(g, tile)[0];
      const before = g.scores[Ozi.teamOf(g, seat)];
      const pts = Ozi.applyMove(g, seat, tile, side);
      const after = g.scores[Ozi.teamOf(g, seat)];
      assert.equal(after - before, pts, "the score moved by exactly what the move returned");
      if (pts) {
        assert.equal(pts % 5, 0, "a score is always a multiple of five");
        assert.ok(pts > 0);
      }
      if (g.hands[seat].length === 0) break;
      g.turn = (seat + 1) % g.players;
    }
  }
});

test("a blocked hand is won by the lighter hand, and only that player scores", () => {
  // build a blocked position by hand so the outcome is predictable
  const g = Ozi.newGame(175, 2);
  g.line = [[3, 3]]; g.top = []; g.bottom = []; g.spinnerVal = 3;
  g.hands[0] = [[6, 6]];              // 12 in hand
  g.hands[1] = [[1, 1], [2, 2]];      //  6 in hand — lighter, should win
  const r = Ozi.blockResult(g);
  assert.equal(r.draw, false);
  assert.equal(r.team, 1, "the lighter hand takes the block");
  assert.equal(r.bonus, 15, "and scores the heavier hand: 12 rounded up to 15");
  assert.deepEqual(r.pips, [12, 6], "the raw weights decide, before rounding");
});

test("a tie on weight scores nobody", () => {
  const g = Ozi.newGame(175, 2);
  g.line = [[3, 3]]; g.spinnerVal = 3; g.top = []; g.bottom = [];
  g.hands[0] = [[2, 2]];
  g.hands[1] = [[1, 3]];              // both weigh 4
  const r = Ozi.blockResult(g);
  assert.equal(r.draw, true, "equal weights is a draw");
  assert.equal(r.bonus, 0, "and no points change hands");
});

test('"რიბა": reaching the target on a block does not end the match', () => {
  const g = Ozi.newGame(175, 2);
  g.scores = [180, 40];               // team 0 is past the target
  const r = Ozi.matchResult(g, true); // ...but the hand ended in a block
  assert.equal(r.over, false, "a blocked hand at the target buys the other side one more");
  assert.equal(r.riba, true, "and it is flagged as რიბა so the screen can say so");
  const straight = Ozi.matchResult(g, false);
  assert.equal(straight.over, true, "won cleanly, the match is over");
  assert.equal(straight.champTeam, 0, "by the team that got there");
  assert.equal(straight.riba, false);
});

test("what is left in hand rounds up to five, and a lone 0-0 counts ten", () => {
  const held = (tiles) => {
    const g = Ozi.newGame(175, 2);
    g.hands[0] = tiles; g.hands[1] = [];
    return Ozi.teamHandPoints(g, 0);
  };
  assert.equal(held([[6, 6]]), 15, "12 rounds up to 15");
  assert.equal(held([[5, 5]]), 10, "10 stays 10");
  assert.equal(held([[4, 2], [3, 1]]), 10, "10 stays 10");
  assert.equal(held([[0, 0]]), 10, "the double blank alone is worth ten");
  assert.equal(held([[0, 0], [1, 2]]), 5, "with company it is worth nothing itself");
  assert.equal(held([]), 0, "an empty hand holds nothing");
  for (let i = 0; i < 200; i++) {
    const g = Ozi.newGame(175, 2);
    assert.equal(Ozi.teamHandPoints(g, 0) % 5, 0, "always a multiple of five");
  }
});

test("the match target comes from the room, not from a fixed number", () => {
  for (const target of [75, 175, 255, 355]) {
    const g = Ozi.newGame(target, 2);
    assert.equal(g.target, target);
    g.scores = [target, 0];
    assert.equal(Ozi.matchResult(g, false).over, true, `${target} is enough to win`);
    g.scores = [target - 5, 0];
    assert.equal(Ozi.matchResult(g, false).over, false, `${target - 5} is not`);
  }
});
