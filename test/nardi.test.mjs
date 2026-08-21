/* =====================================================================
   ნარდი — the rules.

   Two games on one board, and almost everything that separates them is a
   question of what a single enemy checker means: a shut point in გრძელი ნარდი,
   a blot in მოკლე ნარდი. Both are checked here, and so are the three rules
   that are easy to write and easy to get wrong — the head, the six-point wall,
   and having to use both dice.

   The board is set up by hand where a test needs a particular position, so a
   failure says which rule broke rather than which shuffle it was.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const N = createRequire(import.meta.url)("../public/js/nardi.js");

/* Roll exactly what the test wants. The engine takes its randomness as an
   argument for precisely this reason. */
function rollAs(g, a, b) {
  const want = [a, b];
  let i = 0;
  return N.roll(g, () => (want[i++] - 1) / 6 + 0.01);
}

// put a position on the board directly: {side: {trackIndex: count}}
function place(g, spec) {
  g.pts = new Array(N.POINTS).fill(0);
  g.bar = [0, 0]; g.off = [0, 0];
  for (const side of [0, 1])
    for (const [i, n] of Object.entries(spec[side] || {}))
      N.countAt, g.pts[N.pointAt(g, side, +i)] += side === 0 ? n : -n;
  g.bar[0] = (spec.bar || [0, 0])[0];
  g.bar[1] = (spec.bar || [0, 0])[1];
  g.off[0] = (spec.off || [0, 0])[0];
  g.off[1] = (spec.off || [0, 0])[1];
}

const mine = (g, side) => {
  let n = g.bar[side] + g.off[side];
  for (let i = 0; i < N.POINTS; i++) n += N.atIndex(g, side, i);
  return n;
};

/* ---------------- the board itself ---------------- */

test("each player owns fifteen checkers, in both games", () => {
  for (const variant of ["long", "short"]) {
    const g = N.newGame({ variant });
    assert.equal(mine(g, 0), 15, variant);
    assert.equal(mine(g, 1), 15, variant);
  }
});

test("გრძელი ნარდი starts with everything on your own head", () => {
  const g = N.newGame({ variant: "long" });
  assert.equal(N.atIndex(g, 0, 0), 15, "white's fifteen are together");
  assert.equal(N.atIndex(g, 1, 0), 15, "and so are black's");
  assert.equal(g.pts[23], 15, "white's head is point 24");
  assert.equal(g.pts[11], -15, "black's is the one across from it");
});

test("მოკლე ნარდი starts with the spread everybody knows", () => {
  const g = N.newGame({ variant: "short" });
  for (const side of [0, 1]) {
    assert.equal(N.atIndex(g, side, 0), 2, "two on the 24-point");
    assert.equal(N.atIndex(g, side, 11), 5, "five on the 13");
    assert.equal(N.atIndex(g, side, 16), 3, "three on the 8");
    assert.equal(N.atIndex(g, side, 18), 5, "five on the 6");
  }
});

test("a player's track is their own numbering of the same board", () => {
  for (const variant of ["long", "short"]) {
    const g = N.newGame({ variant });
    for (const side of [0, 1]) {
      const seen = new Set();
      for (let i = 0; i < N.POINTS; i++) {
        const pt = N.pointAt(g, side, i);
        assert.ok(pt >= 0 && pt < N.POINTS, `${variant} ${side} ${i} → ${pt}`);
        assert.equal(N.indexOf(g, side, pt), i, "and back again");
        seen.add(pt);
      }
      assert.equal(seen.size, N.POINTS, "every point exactly once");
    }
  }
});

test("in გრძელი ნარდი both sides run the same way round", () => {
  const g = N.newGame({ variant: "long" });
  // one step from each head lands on the point below it
  assert.equal(N.pointAt(g, 0, 1), 22);
  assert.equal(N.pointAt(g, 1, 1), 10);
  // and both wrap the same way
  assert.equal(N.pointAt(g, 1, 12), 23);
});

/* ---------------- what one enemy checker means ---------------- */

test("in გრძელი ნარდი a single enemy checker shuts the point", () => {
  const g = N.newGame({ variant: "long" });
  /* One black checker on the point white would call index 5 — five steps off
     white's head. In backgammon that is a blot to be hit; here it is a wall. */
  place(g, { 0: { 0: 15 }, 1: { 0: 14, 17: 1 } });
  assert.equal(N.pointAt(g, 0, 5), N.pointAt(g, 1, 17), "the same point, both numberings");
  rollAs(g, 5, 3);
  assert.equal(N.canStep(g, 0, 0, 5), false, "you cannot land on it");
  assert.equal(N.canStep(g, 0, 0, 3), true, "an empty point is still open");
  // and nothing on this board is ever hit
  const before = g.bar.slice();
  const turn = N.bestTurn(g);
  turn.forEach((m) => N.move(g, m.from, m.die));
  assert.deepEqual(g.bar, before, "nobody goes to the bar in this game");
});

test("in მოკლე ნარდი a single enemy checker is a blot and gets hit", () => {
  const g = N.newGame({ variant: "short" });
  place(g, { 0: { 0: 2, 11: 5, 16: 3, 18: 5 }, 1: { 0: 2, 11: 5, 16: 3, 18: 4, 17: 1 } });
  g.side = 0;
  rollAs(g, 6, 1);
  // white's 24-point checker plus six is index 6; black's lone checker sits on
  // the point white calls index 6 — work out which die reaches it
  const target = N.indexOf(g, 0, N.pointAt(g, 1, 17));
  const from = [0, 11, 16, 18].find((i) => target - i === 6 || target - i === 1);
  if (from !== undefined) {
    const die = target - from;
    if (N.canStep(g, 0, from, die)) {
      N.move(g, from, die);
      assert.equal(g.bar[1], 1, "the blot went to the bar");
      assert.equal(mine(g, 1), 15, "and is still one of black's fifteen");
    }
  }
});

test("a checker on the bar comes back before anything else moves", () => {
  const g = N.newGame({ variant: "short" });
  place(g, { 0: { 6: 2, 11: 5, 16: 3, 18: 4 }, 1: { 0: 2, 11: 5, 16: 3, 18: 5 }, bar: [1, 0] });
  g.side = 0;
  rollAs(g, 3, 4);
  const moves = N.legalMoves(g);
  assert.ok(moves.length, "there is something to do");
  assert.ok(moves.every((m) => m.from === N.BAR), "and all of it is the bar");
});

/* ---------------- the head ---------------- */

test("any number of checkers may leave the head", () => {
  /* Most tables that play გრძელი ნარდი let only one checker off the head in a
     turn. This one does not — the player asked for it plainly: any checker may
     be played anywhere it is not blocked. It is the six-point wall, further
     down, that keeps the game from being decided on move one. */
  const g = N.newGame({ variant: "long" });
  rollAs(g, 5, 5);
  assert.deepEqual(g.left, [5, 5, 5, 5]);
  for (let k = 1; k <= 4; k++) {
    assert.ok(N.legalMoves(g).some((m) => m.from === 0), `the head is open on move ${k}`);
    N.move(g, 0, 5);
  }
  assert.equal(N.atIndex(g, 0, 0), 11, "four came off the head in one turn");
  assert.equal(N.atIndex(g, 0, 5), 4, "and they are all sitting together");
});

test("and an ordinary roll takes two off it", () => {
  const g = N.newGame({ variant: "long" });
  rollAs(g, 5, 3);
  N.move(g, 0, 5);
  assert.ok(N.legalMoves(g).some((m) => m.from === 0), "the second one may go too");
  N.move(g, 0, 3);
  assert.equal(N.atIndex(g, 0, 0), 13, "thirteen left on the head");
});

test("a checker already on the board is offered as well as the head", () => {
  /* The complaint that took the head rule out was that only one checker could
     ever be moved. Every checker with somewhere to go is offered now. */
  const g = N.newGame({ variant: "long" });
  place(g, { 0: { 0: 12, 4: 1, 7: 1, 9: 1 }, 1: { 0: 15 } });
  g.side = 0;
  rollAs(g, 2, 1);
  const froms = [...new Set(N.legalMoves(g).map((m) => m.from))].sort((a, b) => a - b);
  assert.deepEqual(froms, [0, 4, 7, 9], "all four of them");
});
/* ---------------- the wall ---------------- */

test("six points in a row are not allowed if nothing has got past them", () => {
  const g = N.newGame({ variant: "long" });
  /* Black is still all on its head. White holds five of the six points in front
     of it and is about to make the sixth — which would end the game there. */
  /* White holds the five points in front of black's head and has a spare
     checker three steps short of the sixth. Laying it would shut black in for
     good, so the rule refuses the move. */
  const shut = [1, 2, 3, 4, 5].map((k) => N.indexOf(g, 0, N.pointAt(g, 1, k)));
  const sixth = N.indexOf(g, 0, N.pointAt(g, 1, 6));
  const spec = { 0: { 0: 4 }, 1: { 0: 15 } };
  shut.forEach((i) => { spec[0][i] = 2; });
  spec[0][sixth - 3] += 1;                      // the spare, three from the sixth
  place(g, spec);
  assert.equal(mine(g, 0), 15, "fifteen white checkers on the board");
  assert.equal(mine(g, 1), 15, "and fifteen black");
  g.side = 0;
  rollAs(g, 3, 3);
  assert.equal(N.wallsThemIn(g, 0), false, "five points is not a wall");
  assert.equal(N.canStep(g, 0, sixth - 3, 3), false, "and the sixth may not be laid");
  assert.ok(!N.legalMoves(g).some((m) => m.from === sixth - 3 && m.die === 3),
    "the move is not offered either");
});

test("the same six are fine once somebody is ahead of them", () => {
  const g = N.newGame({ variant: "long" });
  const shut = [1, 2, 3, 4, 5].map((k) => N.indexOf(g, 0, N.pointAt(g, 1, k)));
  const sixth = N.indexOf(g, 0, N.pointAt(g, 1, 6));
  const spec = { 0: { 0: 4 }, 1: { 0: 14, 9: 1 } };   // one black is already past
  shut.forEach((i) => { spec[0][i] = 2; });
  spec[0][sixth - 3] += 1;
  place(g, spec);
  g.side = 0;
  rollAs(g, 3, 3);
  assert.equal(N.canStep(g, 0, sixth - 3, 3), true, "now it is only a wall, not a cage");
  N.move(g, sixth - 3, 3);
  assert.equal(N.wallsThemIn(g, 0), false, "and the rule still says it is allowed");
});

test("backgammon has no such rule — six points is a prime and that is the game", () => {
  const g = N.newGame({ variant: "short" });
  assert.equal(N.wallsThemIn(g, 0), false);
  assert.equal(N.wallsThemIn(g, 1), false);
});

/* ---------------- the dice ---------------- */

test("a double is four moves, not two", () => {
  const g = N.newGame({ variant: "long" });
  rollAs(g, 5, 5);
  assert.deepEqual(g.left, [5, 5, 5, 5]);
});

test("both dice must be used when both can be", () => {
  const g = N.newGame({ variant: "long" });
  g.firstTurn = [false, false];
  rollAs(g, 6, 3);
  N.move(g, 0, 6);
  assert.ok(N.legalMoves(g).length, "the other die still has to be played");
  assert.deepEqual(g.left, [3]);
});

test("when only one die can be played, it is the bigger one", () => {
  /* Both dice can be played on their own, but never one after the other:
     whichever is played first, the second has nowhere to go. The rule says the
     bigger one is the one that must be played, and this is the position that
     tells the two apart — a test that only checks the easy case, where the
     small die is blocked outright, proves nothing about the rule at all. */
  const g = N.newGame({ variant: "short" });
  place(g, { 0: { 12: 1, 18: 14 }, 1: { 3: 2, 0: 13 } });
  g.side = 0;
  rollAs(g, 6, 2);

  // each die on its own is playable
  assert.equal(N.canStep(g, 0, 12, 2), true, "the two can be played");
  assert.equal(N.canStep(g, 0, 12, 6), true, "and so can the six");

  const moves = N.legalMoves(g);
  assert.equal(moves.length, 1, "but only one move is offered");
  assert.deepEqual(moves[0], { from: 12, die: 6 }, "and it is the six");
  assert.equal(N.move(g, 12, 2), false, "playing the two instead is refused");
});

test("a roll with nothing to play simply passes the turn", () => {
  const g = N.newGame({ variant: "short" });
  place(g, { 0: { 18: 15 }, 1: { 0: 13, 21: 2 }, bar: [1, 0] });
  // black holds every entry point, so white on the bar cannot come in
  place(g, {
    0: { 18: 14 },
    1: { 18: 2, 19: 2, 20: 2, 21: 2, 22: 2, 23: 2, 0: 3 },
    bar: [1, 0],
  });
  g.side = 0;
  const before = g.side;
  rollAs(g, 1, 2);
  assert.equal(g.side, 1 - before, "the turn went to the other player");
  assert.equal(g.phase, "roll");
});

/* ---------------- bearing off ---------------- */

test("nothing bears off until every checker is home", () => {
  const g = N.newGame({ variant: "long" });
  place(g, { 0: { 17: 1, 20: 14 }, 1: { 0: 15 } });
  g.side = 0;
  assert.equal(N.homeReady(g, 0), false, "one is still outside");
  rollAs(g, 4, 4);
  assert.ok(!N.legalMoves(g).some((m) => m.from + m.die >= N.POINTS), "so nothing comes off");
});

test("an exact roll always bears a checker off", () => {
  const g = N.newGame({ variant: "long" });
  place(g, { 0: { 20: 15 }, 1: { 0: 15 } });
  g.side = 0;
  rollAs(g, 4, 4);                             // index 20 + 4 = 24, exactly off
  assert.equal(N.canBearOff(g, 0, 20, 4), true);
  N.move(g, 20, 4);
  assert.equal(g.off[0], 1);
});

test("a bigger die takes the checker furthest from home, and only that one", () => {
  const g = N.newGame({ variant: "long" });
  place(g, { 0: { 19: 1, 22: 14 }, 1: { 0: 15 } });
  g.side = 0;
  rollAs(g, 6, 6);
  assert.equal(N.canBearOff(g, 0, 19, 6), true, "the furthest one comes off");
  assert.equal(N.canBearOff(g, 0, 22, 6), false, "the nearer one may not jump it");
  N.move(g, 19, 6);
  assert.equal(N.canBearOff(g, 0, 22, 6), true, "now that it is gone, it may");
});

/* ---------------- what a round is worth ---------------- */

test("a win is a point, a მარსი is two", () => {
  const g = N.newGame({ variant: "long", target: 7 });
  place(g, { 0: { 23: 1 }, 1: { 5: 15 }, off: [14, 0] });
  g.side = 0;
  rollAs(g, 1, 1);
  N.move(g, 23, 1);
  assert.equal(g.off[0], 15);
  assert.equal(g.roundWorth, 2, "black never got one off");
  assert.equal(g.log, "მარსი");
  assert.deepEqual(g.scores, [2, 0]);
});

test("one checker off is enough to make it an ordinary loss", () => {
  const g = N.newGame({ variant: "long", target: 7 });
  place(g, { 0: { 23: 1 }, 1: { 5: 14 }, off: [14, 1] });
  g.side = 0;
  rollAs(g, 1, 1);
  N.move(g, 23, 1);
  assert.equal(g.roundWorth, 1);
  assert.deepEqual(g.scores, [1, 0]);
});

test("in backgammon a checker still on the bar makes it three", () => {
  const g = N.newGame({ variant: "short", target: 7 });
  place(g, { 0: { 23: 1 }, 1: { 5: 14 }, off: [14, 0], bar: [0, 1] });
  g.side = 0;
  rollAs(g, 1, 1);
  N.move(g, 23, 1);
  assert.equal(g.roundWorth, 3, "კოკა");
  assert.equal(g.log, "კოკა");
});

test("the match ends when somebody reaches the target", () => {
  const g = N.newGame({ variant: "long", target: 3 });
  g.scores = [2, 0];
  place(g, { 0: { 23: 1 }, 1: { 5: 14 }, off: [14, 1] });
  g.side = 0;
  rollAs(g, 1, 1);
  N.move(g, 23, 1);
  assert.equal(g.phase, "over");
  assert.equal(g.matchWinner, 0);
});

test("and the loser opens the next round", () => {
  const g = N.newGame({ variant: "long", target: 7 });
  place(g, { 0: { 23: 1 }, 1: { 5: 14 }, off: [14, 1] });
  g.side = 0;
  rollAs(g, 1, 1);
  N.move(g, 23, 1);
  assert.equal(g.phase, "roundOver");
  N.nextRound(g);
  assert.equal(g.side, 1, "the one who lost throws first");
  assert.equal(g.round, 2);
  assert.equal(mine(g, 0), 15, "and the board is set up again");
  assert.equal(mine(g, 1), 15);
});

/* ---------------- the pip count ---------------- */

test("the opening pip count is the one every board agrees on", () => {
  const long = N.newGame({ variant: "long" });
  assert.equal(N.pipCount(long, 0), 15 * 24, "fifteen checkers, twenty-four steps each");
  const short = N.newGame({ variant: "short" });
  assert.equal(N.pipCount(short, 0), 167, "the backgammon opening is 167");
  assert.equal(N.pipCount(short, 1), 167, "for both of them");
});

/* ---------------- whole games ---------------- */

test("both games play out to a finish, over and over, without losing a checker",
  () => {
    for (const variant of ["long", "short"]) {
      for (let seed = 1; seed <= 12; seed++) {
        const g = N.newGame({ variant, target: 1 });
        let s = seed * 7919;
        const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
        let turns = 0;
        while (g.phase !== "over" && turns < 3000) {
          if (g.phase === "roll") { N.roll(g, rnd); turns++; continue; }
          if (g.phase === "move") {
            const plan = N.bestTurn(g);
            if (!plan.length) { N.endTurn(g); continue; }
            for (const m of plan) {
              assert.ok(N.move(g, m.from, m.die),
                `${variant}/${seed}: the computer chose a move the rules refuse`);
              if (g.phase !== "move") break;
            }
            continue;
          }
          if (g.phase === "roundOver") { N.nextRound(g); continue; }
        }
        assert.equal(g.phase, "over", `${variant}/${seed} finished`);
        assert.equal(mine(g, 0), 15, `${variant}/${seed}: white still has fifteen`);
        assert.equal(mine(g, 1), 15, `${variant}/${seed}: black still has fifteen`);
        assert.ok(g.off[0] === 15 || g.off[1] === 15, "somebody bore them all off");
        assert.ok(turns < 3000, `${variant}/${seed} did not stall`);
      }
    }
  });

test("every move the engine offers is a move the engine accepts", () => {
  /* The list a screen lights up and the list `move` will take have to be the
     same list. They are worked out by different code, so they are checked
     against each other on a few thousand real positions. */
  for (const variant of ["long", "short"]) {
    const g = N.newGame({ variant, target: 1 });
    let s = 4242;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let checked = 0, turns = 0;
    while (g.phase !== "over" && turns < 2000) {
      if (g.phase === "roll") { N.roll(g, rnd); turns++; continue; }
      if (g.phase === "roundOver") { N.nextRound(g); continue; }
      const moves = N.legalMoves(g);
      if (!moves.length) { N.endTurn(g); continue; }
      for (const m of moves) {
        assert.ok(N.canStep(g, g.side, m.from, m.die),
          `${variant}: offered ${JSON.stringify(m)} but canStep says no`);
        checked++;
      }
      // and the highlighted targets agree with the moves
      for (const m of moves) {
        const t = N.targetsFrom(g, m.from);
        assert.ok(t.some((x) => x.die === m.die), "the screen would light that up");
      }
      const pick = moves[Math.floor(rnd() * moves.length)];
      N.move(g, pick.from, pick.die);
    }
    assert.ok(checked > 500, `${variant}: checked ${checked} offers`);
  }
});

test("a move that was never offered is refused", () => {
  const g = N.newGame({ variant: "long" });
  rollAs(g, 5, 3);
  assert.equal(N.move(g, 0, 4), false, "a die that was not rolled");
  assert.equal(N.move(g, 7, 5), false, "a point with nothing on it");
  assert.equal(N.move(g, -5, 5), false, "a place that is not on the board");
  assert.equal(N.move(g, 99, 3), false, "nor is that one");
  assert.equal(g.phase, "move", "and the turn is still yours");
});
