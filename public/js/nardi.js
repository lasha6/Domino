/* =====================================================================
   ნარდი — the engine.

   Written the same way as the domino, ბურა and ჯოკერი engines: one file, used
   by the server and the browser alike, so both sides count by identical rules
   and the server can check every move.

   Two games share this board:

     "long"  — გრძელი ნარდი. Fifteen checkers stacked on your own head, both
               sides running the same way round, nothing is ever hit, and a
               point with a single enemy checker on it is simply shut.
     "short" — მოკლე ნარდი (backgammon). The familiar opening spread, a lone
               checker is a blot and gets sent to the bar, and a point needs
               two of yours before it is yours.

   ---------------------------------------------------------------------
   The one idea that keeps this file short: TRACK INDICES.

   Every player is given their own numbering of the board, 0 where they start
   and 23 where they finish, so a move is always "from index i, forward by the
   die". Direction, which way each colour runs, and where the two games differ
   all collapse into one function, `pointAt`. Home is indices 18..23 for
   everybody, bearing off is stepping past 23, and the bar is index −1.

   Get that mapping right once and every rule after it reads the same for both
   games and both colours.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Nardi = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const POINTS = 24;
  const CHECKERS = 15;
  const HOME_FROM = 18;               // track indices 18..23 are the home board
  const BAR = -1;                     // where a checker sits after being hit

  /* In გრძელი ნარდი both sides run anticlockwise around the same board, each
     starting from their own head: white from point 23, black from point 11. */
  const HEAD = [23, 11];

  /* ---------------- the board ----------------
     `pts[p]` is positive for white's checkers and negative for black's. The two
     never share a point in either game, so one number a point is enough. */
  const countAt = (g, side, pt) =>
    pt < 0 || pt >= POINTS ? 0 : (side === 0 ? Math.max(0, g.pts[pt]) : Math.max(0, -g.pts[pt]));
  const put = (g, side, pt, n) => { g.pts[pt] += side === 0 ? n : -n; };
  const other = (side) => 1 - side;

  /* A player's index into their own track, and back again. */
  function pointAt(g, side, i) {
    if (i < 0 || i >= POINTS) return -1;
    if (g.variant === "long") return (HEAD[side] - i + POINTS) % POINTS;
    return side === 0 ? 23 - i : i;
  }
  function indexOf(g, side, pt) {
    if (g.variant === "long") return (HEAD[side] - pt + POINTS) % POINTS;
    return side === 0 ? 23 - pt : pt;
  }
  const atIndex = (g, side, i) => countAt(g, side, pointAt(g, side, i));

  /* ---------------- a new game ---------------- */
  function newGame(o) {
    o = o || {};
    const variant = o.variant === "short" ? "short" : "long";
    const target = [1, 3, 5, 7].includes(o.target) ? o.target : 3;
    const g = {
      variant, target,
      scores: [0, 0],
      pts: new Array(POINTS).fill(0),
      bar: [0, 0],
      off: [0, 0],
      side: o.first === 1 ? 1 : 0,
      dice: null,               // what was rolled, kept for the screen
      left: [],                 // the dice still to be used this turn
      moved: [],                // what has been played this turn, for undo
      phase: "roll",
      round: 1,
      roundWinner: null,
      roundWorth: 0,
      matchWinner: null,
      log: "",
    };
    setUp(g);
    return g;
  }

  function setUp(g) {
    g.pts = new Array(POINTS).fill(0);
    g.bar = [0, 0];
    g.off = [0, 0];
    for (const side of [0, 1]) {
      if (g.variant === "long") {
        put(g, side, pointAt(g, side, 0), CHECKERS);        // all fifteen on the head
      } else {
        // the ordinary opening: 2 on the 24-point, 5 on the 13, 3 on the 8, 5 on the 6
        [[0, 2], [11, 5], [16, 3], [18, 5]].forEach(([i, n]) => put(g, side, pointAt(g, side, i), n));
      }
    }
  }

  /* ---------------- dice ---------------- */
  function roll(g, rnd) {
    if (g.phase !== "roll") return null;
    const r = rnd || Math.random;
    const a = 1 + Math.floor(r() * 6), b = 1 + Math.floor(r() * 6);
    g.dice = [a, b];
    g.left = a === b ? [a, a, a, a] : [a, b];
    g.moved = [];
    g.phase = "move";
    g.log = "";
    // a roll with nothing to play is still a roll: the turn simply passes.
    // What was rolled is handed back either way — the screen has to show it,
    // and `endTurn` has already cleared it off the board.
    const rolled = [a, b];
    if (!legalMoves(g).length) { g.log = "სვლა არ არის"; endTurn(g); }
    return rolled;
  }

  /* ---------------- can a checker land there? ----------------
     This is the whole difference between the two games. In გრძელი ნარდი one
     enemy checker shuts a point; in backgammon it is a blot and gets hit. */
  function landable(g, side, to) {
    if (to < 0 || to >= POINTS) return false;
    const opp = countAt(g, other(side), pointAt(g, side, to));
    return g.variant === "long" ? opp === 0 : opp <= 1;
  }

  const homeReady = (g, side) => {
    if (g.bar[side] > 0) return false;
    for (let i = 0; i < HOME_FROM; i++) if (atIndex(g, side, i) > 0) return false;
    return true;
  };

  /* Bearing off: an exact roll always, and a bigger die only from the checker
     furthest from home — never over the top of one that is further back. */
  function canBearOff(g, side, from, die) {
    if (!homeReady(g, side)) return false;
    const to = from + die;
    if (to === POINTS) return true;
    if (to < POINTS) return false;
    for (let i = HOME_FROM; i < from; i++) if (atIndex(g, side, i) > 0) return false;
    return true;
  }

  /* There is no head rule here. Most tables that play გრძელი ნარდი let only
     one checker leave the head in a turn; this one does not, and the player was
     explicit about it: any checker may be played, anywhere it is not blocked.
     What keeps the game from being over on move one is the six-point wall
     below — without that rule, and without this one, a player could shut the
     other in before they had moved. */

  /* ---------------- the six-prime rule (გრძელი ნარდი) ----------------
     Six of your points in a row is a wall nothing can pass. It is allowed only
     while at least one enemy checker is already ahead of it — otherwise the
     game is dead and the rule says you may not build it. */
  function wallsThemIn(g, side) {
    if (g.variant !== "long") return false;
    const foe = other(side);
    const mine = (i) => countAt(g, side, pointAt(g, foe, i)) > 0;   // on THEIR track
    for (let s = 0; s + 5 < POINTS; s++) {
      let solid = true;
      for (let k = 0; k < 6 && solid; k++) solid = mine(s + k);
      if (!solid) continue;
      // is anybody past it? borne-off checkers are past everything
      let ahead = g.off[foe] > 0;
      for (let i = s + 6; i < POINTS && !ahead; i++) if (atIndex(g, foe, i) > 0) ahead = true;
      if (!ahead) return true;
    }
    return false;
  }

  /* ---------------- one move ----------------
     A move is {from, die}: `from` is a track index, or BAR. Everything the
     rules allow is expressed here, except the two rules about how many dice a
     turn must use — those need the whole turn and live further down. */
  function canStep(g, side, from, die) {
    if (!g.left.includes(die)) return false;
    if (g.bar[side] > 0 && from !== BAR) return false;      // the bar comes first
    if (from === BAR) {
      if (g.variant !== "short" || g.bar[side] === 0) return false;
      return landable(g, side, die - 1);
    }
    if (from < 0 || from >= POINTS) return false;
    if (atIndex(g, side, from) === 0) return false;
    const to = from + die;
    if (to >= POINTS) return canBearOff(g, side, from, die);
    if (!landable(g, side, to)) return false;
    // building a wall that nothing can get past is not a move you may make
    if (g.variant === "long") {
      const undo = step(g, side, from, die);
      const bad = wallsThemIn(g, side);
      undo();
      if (bad) return false;
    }
    return true;
  }

  /* Play it on the board and hand back the way to take it off again. Nothing
     here checks legality — `canStep` does that, and the search below needs to
     try moves and change its mind. */
  function step(g, side, from, die) {
    const to = from + die;
    const foe = other(side);
    let hit = false;
    if (from === BAR) g.bar[side]--;
    else put(g, side, pointAt(g, side, from), -1);

    if (to >= POINTS) {
      g.off[side]++;
    } else {
      const pt = pointAt(g, side, to);
      if (g.variant === "short" && countAt(g, foe, pt) === 1) {
        put(g, foe, pt, -1); g.bar[foe]++; hit = true;
      }
      put(g, side, pt, 1);
    }
    const i = g.left.indexOf(die);
    g.left.splice(i, 1);

    return function undo() {
      g.left.splice(i, 0, die);
      if (to >= POINTS) {
        g.off[side]--;
      } else {
        const pt2 = pointAt(g, side, to);
        put(g, side, pt2, -1);
        if (hit) { g.bar[foe]--; put(g, foe, pt2, 1); }
      }
      if (from === BAR) g.bar[side]++;
      else put(g, side, pointAt(g, side, from), 1);
    };
  }

  /* Every single step that is legal right now, before the "use all the dice"
     rules are applied to them. */
  function rawMoves(g, side) {
    const out = [];
    const dice = [...new Set(g.left)];
    for (const die of dice) {
      if (g.bar[side] > 0) {
        if (canStep(g, side, BAR, die)) out.push({ from: BAR, die });
        continue;
      }
      for (let i = 0; i < POINTS; i++)
        if (atIndex(g, side, i) > 0 && canStep(g, side, i, die)) out.push({ from: i, die });
    }
    return out;
  }

  /* ---------------- how many dice this turn must use ----------------
     Both rules everybody knows come out of one search: play as many dice as
     can be played, and when only one of two can be played, it must be the
     bigger one. Neither can be decided a move at a time — you have to look at
     where the whole turn could end up. */
  function deepest(g, side, seen) {
    if (!g.left.length) return 0;
    const key = g.pts.join(",") + "|" + g.bar + "|" + g.off + "|" + g.left.join(",");
    if (seen.has(key)) return seen.get(key);
    let best = 0;
    for (const mv of rawMoves(g, side)) {
      const undo = step(g, side, mv.from, mv.die);
      const n = 1 + deepest(g, side, seen);
      undo();
      if (n > best) best = n;
      if (best === g.left.length) break;
    }
    seen.set(key, best);
    return best;
  }

  function legalMoves(g) {
    const side = g.side;
    if (g.phase !== "move" || !g.left.length) return [];
    const want = deepest(g, side, new Map());
    if (want === 0) return [];
    let moves = rawMoves(g, side).filter((mv) => {
      const undo = step(g, side, mv.from, mv.die);
      const n = 1 + deepest(g, side, new Map());
      undo();
      return n === want;
    });
    /* Only one die can be played and the two are different: it has to be the
       bigger one, if the bigger one can be played at all. */
    if (want === 1 && g.left.length === 2 && g.left[0] !== g.left[1]) {
      const big = Math.max(g.left[0], g.left[1]);
      const withBig = moves.filter((m) => m.die === big);
      if (withBig.length) moves = withBig;
    }
    return moves;
  }

  // where a checker on this index may go, for a screen that wants to light up
  // the board when somebody touches a stack
  function targetsFrom(g, from) {
    return legalMoves(g).filter((m) => m.from === from)
      .map((m) => ({ die: m.die, to: from + m.die >= POINTS ? "off" : from + m.die }));
  }

  /* `hold` keeps the turn open after the last die is spent, so the player can
     look at what they have done and take it back before it counts. Whoever
     passes it is then the one who says when the turn is over — that is the
     Done button. Without it the turn ends inside the engine and there is
     nothing left to undo. */
  function move(g, from, die, hold) {
    if (g.phase !== "move") return false;
    const side = g.side;
    if (!legalMoves(g).some((m) => m.from === from && m.die === die)) return false;
    step(g, side, from, die);
    g.moved.push({ from, die });
    if (g.off[side] === CHECKERS) { finishRound(g, side); return true; }
    if (!hold && turnOver(g)) endTurn(g);
    return true;
  }

  /* Nothing more can be played: the dice are spent, or what is left of them
     has nowhere to go. */
  function turnOver(g) {
    return g.phase === "move" && (!g.left.length || !legalMoves(g).length);
  }

  /* Dice still in hand that the board will not take. This is not the same as a
     turn being over, and the difference is the whole of it: a die you SPENT is
     yours to look at and take back, so the turn waits for you; a die you were
     never able to play is not a decision, and holding the turn open for it only
     asks the player to press a button to agree that they are stuck. */
  function stuck(g) {
    return g.phase === "move" && g.left.length > 0 && !legalMoves(g).length;
  }

  function endTurn(g) {
    g.side = other(g.side);
    g.left = [];
    g.dice = null;
    g.phase = "roll";
  }

  /* ---------------- what a round is worth ----------------
     One point for a win. Two for a მარსი — the loser did not bear a single
     checker off. In backgammon three, if on top of that they still have a
     checker on the bar or in the winner's home. */
  function roundWorth(g, winner) {
    const loser = other(winner);
    if (g.off[loser] > 0) return 1;
    if (g.variant === "short") {
      if (g.bar[loser] > 0) return 3;
      for (let i = HOME_FROM; i < POINTS; i++)
        if (countAt(g, loser, pointAt(g, winner, i)) > 0) return 3;
    }
    return 2;
  }

  function finishRound(g, winner) {
    const worth = roundWorth(g, winner);
    g.roundWinner = winner;
    g.roundWorth = worth;
    g.scores[winner] += worth;
    g.left = [];
    g.phase = "roundOver";
    g.log = worth >= 3 ? "კოკა" : worth === 2 ? "მარსი" : "მოგება";
    if (g.scores[winner] >= g.target) { g.phase = "over"; g.matchWinner = winner; }
  }

  function nextRound(g) {
    if (g.phase !== "roundOver") return false;
    g.round++;
    g.side = other(g.roundWinner);        // the loser opens the next one
    g.roundWinner = null; g.roundWorth = 0;
    g.dice = null; g.left = []; g.moved = [];
    g.phase = "roll";
    g.log = "";
    setUp(g);
    return true;
  }

  /* ---------------- how far there is to go ----------------
     The sum of the steps every checker still owes. It decides nothing, but a
     screen wants to show it and the computer plays by it. */
  function pipCount(g, side) {
    let n = g.bar[side] * (POINTS + 1);
    for (let i = 0; i < POINTS; i++) n += atIndex(g, side, i) * (POINTS - i);
    return n;
  }

  /* ---------------- the computer ----------------
     Greedy, and honest about it: it looks one turn ahead and picks the whole
     turn that leaves the board it likes best. Running for home, keeping its
     checkers in pairs and shutting points in front of the enemy is most of
     what a beginner does, and it is enough to practise against. */
  function scoreBoard(g, side) {
    const foe = other(side);
    let s = -pipCount(g, side) * 1.0;
    s += g.off[side] * 30;
    for (let i = 0; i < POINTS; i++) {
      const n = atIndex(g, side, i);
      if (!n) continue;
      if (g.variant === "short") {
        if (n === 1) s -= 12;                      // a blot invites a hit
        if (n >= 2 && i >= 12) s += 4;             // points near home are worth holding
        if (n > 4) s -= (n - 4) * 3;               // a tower does nothing
      } else {
        if (n > 5) s -= (n - 5) * 2;
        if (i >= HOME_FROM) s += 3;
      }
    }
    if (g.variant === "short") s += g.bar[foe] * 18;
    return s;
  }

  /* Every way of playing the dice out, scored, best first. Returns the list of
     single moves to make, in order. */
  function bestTurn(g) {
    const side = g.side;
    let best = null;
    (function walk(done) {
      const moves = legalMoves(g);
      if (!moves.length) {
        const s = scoreBoard(g, side);
        if (!best || s > best.score) best = { score: s, moves: done.slice() };
        return;
      }
      for (const mv of moves) {
        const undo = step(g, side, mv.from, mv.die);
        done.push(mv);
        if (g.off[side] === CHECKERS) {
          const s = 1e6;
          if (!best || s > best.score) best = { score: s, moves: done.slice() };
        } else walk(done);
        done.pop();
        undo();
      }
    })([]);
    return best ? best.moves : [];
  }

  /* ---------------- reading the board ----------------
     What a screen needs and nothing it does not: the stacks, in board order,
     each with whose they are. */
  function view(g) {
    return g.pts.map((n, pt) => ({ pt, side: n === 0 ? null : (n > 0 ? 0 : 1), n: Math.abs(n) }));
  }

  return {
    POINTS, CHECKERS, HOME_FROM, BAR, HEAD,
    newGame, setUp, roll, move, turnOver, stuck, legalMoves, targetsFrom, canStep,
    endTurn, nextRound, finishRound, roundWorth,
    pointAt, indexOf, atIndex, countAt, homeReady, canBearOff,
    wallsThemIn, pipCount, view,
    bestTurn, scoreBoard,
  };
});
