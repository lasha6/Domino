/* =====================================================================
   დამკა — the rules.

   Four of these decide almost every game and all four are easy to write
   wrongly: taking is compulsory, a man takes backwards as well as forwards, a
   jump that can go on must go on, and nothing is jumped twice in one move.
   The last one is the reason captured pieces stay on the board until the move
   is finished, and it only shows up in a position built on purpose.

   Positions are laid out square by square, so a failure names the rule rather
   than the game it happened in.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const D = createRequire(import.meta.url)("../public/js/damka.js");

const S = (r, c) => D.sq(r, c);
function empty() {
  const g = D.newGame({});
  g.cells = new Array(64).fill(0);
  return g;
}
function put(g, r, c, side, queen) {
  assert.ok(D.dark(r, c), `(${r},${c}) is a light square — nothing is ever there`);
  D.set(g, r, c, (queen ? D.QUEEN : D.MAN) * (side === 0 ? 1 : -1));
}
const has = (g, from, to) => D.legalMoves(g).some((m) => m.from === from && m.to === to);

/* ---------------- the board ---------------- */

test("twelve a side, on the dark squares, three rows each", () => {
  const g = D.newGame({});
  assert.equal(D.count(g, 0), 12);
  assert.equal(D.count(g, 1), 12);
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const v = D.at(g, r, c);
      if (!D.dark(r, c)) { assert.equal(v, 0, `(${r},${c}) is light`); continue; }
      if (r <= 2) assert.equal(v, D.MAN, "white's three rows");
      else if (r >= 5) assert.equal(v, -D.MAN, "black's three rows");
      else assert.equal(v, 0, "the middle two rows are empty");
    }
});

test("the middle rows are the only way in", () => {
  const g = D.newGame({});
  const moves = D.legalMoves(g);
  assert.ok(moves.length, "white has something to play");
  assert.ok(moves.every((m) => D.rowOf(m.to) === 3), "and all of it lands on row four");
  assert.ok(moves.every((m) => m.over === undefined), "nothing is taken on move one");
});

/* ---------------- how a man moves ---------------- */

test("a man walks one square, and only forwards", () => {
  const g = empty();
  put(g, 3, 2, 0);
  g.side = 0;
  const to = D.legalMoves(g).map((m) => m.to).sort();
  assert.deepEqual(to, [S(4, 1), S(4, 3)].sort(), "the two squares in front of it");
});

test("black walks the other way", () => {
  const g = empty();
  put(g, 4, 3, 1);
  g.side = 1;
  const to = D.legalMoves(g).map((m) => m.to).sort();
  assert.deepEqual(to, [S(3, 2), S(3, 4)].sort());
});

/* ---------------- taking ---------------- */

test("if there is a jump, the jump is what you play", () => {
  const g = empty();
  put(g, 2, 1, 0);
  put(g, 3, 2, 1);
  put(g, 0, 5, 0);              // a piece with a quiet move going spare
  g.side = 0;
  const moves = D.legalMoves(g);
  assert.ok(moves.length, "there is a move");
  assert.ok(moves.every((m) => m.over !== undefined), "and every one of them takes");
  assert.deepEqual(moves.map((m) => m.to), [S(4, 3)]);
});

test("a man takes backwards as readily as forwards", () => {
  const g = empty();
  put(g, 4, 3, 0);              // white, facing up the board
  put(g, 3, 2, 1);              // black behind it
  g.side = 0;
  assert.ok(has(g, S(4, 3), S(2, 1)), "it may jump back over it");
});

test("but it may not walk backwards", () => {
  const g = empty();
  put(g, 4, 3, 0);
  g.side = 0;
  const to = D.legalMoves(g).map((m) => m.to);
  assert.ok(!to.includes(S(3, 2)), "no walking back");
  assert.ok(!to.includes(S(3, 4)), "either way");
});

test("a jump that can go on, goes on — and it is one move", () => {
  const g = empty();
  put(g, 2, 1, 0);
  put(g, 3, 2, 1);
  put(g, 3, 4, 1);
  g.side = 0;
  D.move(g, S(2, 1), S(4, 3));
  assert.equal(g.side, 0, "the turn has not changed hands");
  assert.equal(g.mustFrom, S(4, 3), "and that piece has to carry on");
  const moves = D.legalMoves(g);
  assert.ok(moves.every((m) => m.from === S(4, 3)), "nothing else may move");
  D.move(g, S(4, 3), S(2, 5));
  assert.equal(g.side, 1, "now the turn is over");
  assert.equal(D.count(g, 1), 0, "both were taken");
  assert.equal(D.count(g, 0), 1);
});

test("what is taken stays on the board until the move ends", () => {
  /* This is what stops a queen going round in a circle and taking the same
     piece twice, and it is the rule a working engine most often lacks. */
  const g = empty();
  put(g, 2, 1, 0);
  put(g, 3, 2, 1);
  put(g, 3, 4, 1);
  g.side = 0;
  D.move(g, S(2, 1), S(4, 3));
  assert.equal(D.at(g, 3, 2), -D.MAN, "the first one is still standing");
  assert.ok(D.view(g).some((x) => x.sq === S(3, 2) && x.doomed), "but marked as taken");
  assert.ok(!D.legalMoves(g).some((m) => m.over === S(3, 2)), "and cannot be jumped again");
  D.move(g, S(4, 3), S(2, 5));
  assert.equal(D.at(g, 3, 2), 0, "now it is lifted");
  assert.equal(D.at(g, 3, 4), 0, "and so is the other");
});

test("a queen may not take the same piece twice going round", () => {
  const g = empty();
  put(g, 4, 3, 0, true);        // a white queen in the middle
  put(g, 3, 2, 1); put(g, 5, 2, 1); put(g, 5, 4, 1);
  g.side = 0;
  // she starts a circuit
  const first = D.legalMoves(g).find((m) => m.over === S(5, 4));
  assert.ok(first, "there is a jump to start with");
  D.move(g, first.from, first.to);
  let guard = 0;
  while (g.mustFrom != null && guard++ < 8) {
    const nxt = D.legalMoves(g);
    assert.ok(nxt.every((m) => !g.pending.some((p) => p.sq === m.over)),
      "never over something already taken");
    D.move(g, nxt[0].from, nxt[0].to);
  }
  assert.ok(guard < 8, "the sequence ended rather than looping");
  assert.ok(D.count(g, 1) >= 0 && D.count(g, 1) <= 3, "no piece was taken twice");
});

/* ---------------- becoming a queen ---------------- */

test("a man that reaches the far row becomes a დამკა", () => {
  const g = empty();
  put(g, 6, 1, 0);
  g.side = 0;
  D.move(g, S(6, 1), S(7, 2));
  assert.equal(D.at(g, 7, 2), D.QUEEN, "it is a queen now");
});

test("and black's far row is the other one", () => {
  const g = empty();
  put(g, 1, 2, 1);
  g.side = 1;
  D.move(g, S(1, 2), S(0, 1));
  assert.equal(D.at(g, 0, 1), -D.QUEEN);
});

test("promoted in the middle of a jump, it carries on as a queen", () => {
  const g = empty();
  put(g, 5, 2, 0);              // one jump from the far row
  put(g, 6, 3, 1);
  put(g, 5, 6, 1);              // and a second victim only a queen could reach
  g.side = 0;
  D.move(g, S(5, 2), S(7, 4));
  assert.equal(D.at(g, 7, 4), D.QUEEN, "it was crowned on the way");
  assert.equal(g.mustFrom, S(7, 4), "and the move is not over");
  assert.ok(has(g, S(7, 4), S(4, 7)), "it takes at a distance, the way a queen does");
});

/* ---------------- the queen ---------------- */

test("a queen slides as far as she likes", () => {
  const g = empty();
  put(g, 3, 2, 0, true);
  g.side = 0;
  const to = D.legalMoves(g).map((m) => m.to);
  assert.ok(to.includes(S(4, 3)) && to.includes(S(7, 6)), "up the long diagonal");
  assert.ok(to.includes(S(2, 1)) && to.includes(S(0, 5)), "and back down it");
  assert.equal(to.length, new Set(to).size, "each square offered once");
});

test("but not through anything", () => {
  const g = empty();
  put(g, 3, 2, 0, true);
  put(g, 5, 4, 0);              // one of her own in the way
  g.side = 0;
  // her own squares only: the man in the way has moves of its own, and they
  // are not hers
  const to = D.targetsFrom(g, S(3, 2)).map((m) => m.to);
  assert.ok(to.includes(S(4, 3)), "up to it");
  assert.ok(!to.includes(S(5, 4)), "not onto it");
  assert.ok(!to.includes(S(6, 5)), "and not past it");
  assert.ok(!to.includes(S(7, 6)), "nor anywhere beyond");
});

test("a queen takes at a distance, and lands where she pleases beyond", () => {
  const g = empty();
  put(g, 1, 0, 0, true);
  put(g, 4, 3, 1);
  g.side = 0;
  const lands = D.legalMoves(g).filter((m) => m.over === S(4, 3)).map((m) => m.to).sort();
  assert.deepEqual(lands, [S(5, 4), S(6, 5), S(7, 6)].sort(),
    "any empty square on the far side");
});

test("two enemy pieces in a row stop her — she takes one at a time or none", () => {
  const g = empty();
  put(g, 1, 0, 0, true);
  put(g, 3, 2, 1);
  put(g, 4, 3, 1);
  g.side = 0;
  assert.ok(!D.legalMoves(g).some((m) => m.over === S(3, 2)),
    "there is nowhere to land behind the first");
});

/* ---------------- the end ---------------- */

test("no pieces left is a loss", () => {
  const g = empty();
  put(g, 2, 1, 0);
  put(g, 3, 2, 1);
  g.side = 0;
  D.move(g, S(2, 1), S(4, 3));
  assert.equal(g.phase, "over");
  assert.equal(g.winner, 0);
});

test("and so is having nothing to play", () => {
  /* A side that is shut in has lost, even with pieces on the board. */
  const g = empty();
  put(g, 7, 0, 1);              // black in the corner
  put(g, 6, 1, 0);              // white right in front of it
  put(g, 5, 2, 0);              // and backing it up, so there is nothing to jump
  put(g, 0, 1, 0);
  g.side = 1;
  assert.deepEqual(D.legalMoves(g), [], "black cannot move");
  g.side = 0;
  D.move(g, S(0, 1), S(1, 0));  // white plays something harmless
  assert.equal(g.phase, "over", "and black has lost on the spot");
  assert.equal(g.winner, 0);
});

test("a long stretch with nothing taken is a draw", () => {
  const g = empty();
  put(g, 0, 1, 0, true);
  put(g, 7, 6, 1, true);
  g.side = 0;
  g.quiet = 29;
  D.move(g, S(0, 1), S(1, 2));
  assert.equal(g.phase, "over");
  assert.equal(g.winner, null, "nobody won it");
  assert.equal(g.log, "ფრე");
});

/* ---------------- whole games ---------------- */

test("games play themselves out without an illegal move or a lost piece", () => {
  for (let seed = 1; seed <= 8; seed++) {
    const g = D.newGame({ first: seed % 2 });
    let s = seed * 7919;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let plies = 0;
    while (g.phase !== "over" && plies < 800) {
      const moves = D.legalMoves(g);
      assert.ok(moves.length, "a side with no move should already have lost");
      // half the games are played by the computer, half at random, so both the
      // search and the rules get walked over
      const mv = seed % 2 ? D.bestMove(g, 2) : moves[Math.floor(rnd() * moves.length)];
      assert.ok(D.move(g, mv.from, mv.to), `seed ${seed}: refused its own move`);
      assert.ok(D.count(g, 0) <= 12 && D.count(g, 1) <= 12, "nobody gained a piece");
      plies++;
    }
    assert.equal(g.phase, "over", `seed ${seed} finished in ${plies}`);
    assert.ok(g.winner === null || g.winner === 0 || g.winner === 1);
  }
});

test("a move nobody offered is refused", () => {
  const g = D.newGame({});
  assert.equal(D.move(g, S(2, 1), S(5, 4)), false, "a square it cannot reach");
  assert.equal(D.move(g, S(3, 2), S(4, 3)), false, "an empty square to start from");
  assert.equal(D.move(g, S(5, 2), S(4, 1)), false, "the other player's piece");
  assert.equal(D.move(g, -1, 99), false, "somewhere off the board");
  assert.equal(g.side, 0, "and it is still white's turn");
});

test("the computer beats a player who takes every jump on offer", () => {
  /* Not a strong engine, but it has to be worth practising against: a player
     who simply grabs the first capture every time should lose. */
  let lost = 0;
  for (let seed = 1; seed <= 4; seed++) {
    const g = D.newGame({});
    let s = seed * 104729;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let plies = 0;
    while (g.phase !== "over" && plies++ < 600) {
      const moves = D.legalMoves(g);
      const mv = g.side === 0 ? D.bestMove(g, 3) : moves[Math.floor(rnd() * moves.length)];
      D.move(g, mv.from, mv.to);
    }
    if (g.winner === 0) lost++;
  }
  assert.ok(lost >= 3, `the computer won ${lost} of 4`);
});
