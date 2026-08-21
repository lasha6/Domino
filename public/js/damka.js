/* =====================================================================
   დამკა — the engine.

   Eight by eight, twelve pieces a side on the dark squares, and the rules
   everybody in Georgia plays by — the ones a Russian board calls шашки:

     · a man walks one square diagonally forward
     · a man CAPTURES in every direction, forwards and backwards alike
     · capturing is not a choice: if there is a jump, a jump is what you play
     · a jump that can go on must go on, and it is one move, not several
     · a man that reaches the far row becomes a დამკა, there and then — and if
       it can carry on capturing it does so as a queen, from that square
     · a queen slides any distance along a diagonal, and captures at a
       distance: over one enemy piece, with any amount of empty air on either
       side of it
     · a piece is jumped once in a move and no more. What is captured is lifted
       at the END of the move, so a queen cannot come round and take the same
       piece twice — the rule the boards call a Turkish strike

   When several captures are open the player picks freely. That is the Russian
   rule and it is the one played here; the international boards that make you
   take the longest line are a different game.

   ---------------------------------------------------------------------
   The board is 64 squares, of which 32 are ever used. A square holds one of
   MAN/QUEEN for either colour, signed: positive is white, negative is black.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Damka = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SIZE = 8;
  const MAN = 1, QUEEN = 2;
  const DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  const at = (g, r, c) => g.cells[r * SIZE + c];
  const set = (g, r, c, v) => { g.cells[r * SIZE + c] = v; };
  const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  const dark = (r, c) => (r + c) % 2 === 1;
  const sideOf = (v) => (v === 0 ? null : v > 0 ? 0 : 1);
  const kindOf = (v) => Math.abs(v);
  const sq = (r, c) => r * SIZE + c;
  const rowOf = (s) => Math.floor(s / SIZE);
  const colOf = (s) => s % SIZE;
  const other = (side) => 1 - side;
  const sign = (side) => (side === 0 ? 1 : -1);

  /* White starts on rows 0–2 and walks up the board; black starts on 5–7 and
     walks down. The far row is 7 for white and 0 for black. */
  const forward = (side) => (side === 0 ? 1 : -1);
  const lastRow = (side) => (side === 0 ? SIZE - 1 : 0);

  function newGame(o) {
    o = o || {};
    const g = {
      cells: new Array(SIZE * SIZE).fill(0),
      side: o.first === 1 ? 1 : 0,
      mustFrom: null,          // mid-jump: this piece has to carry on
      pending: [],             // what this move has captured, lifted at the end
      moved: [],               // the squares this move has passed through
      phase: "move",
      winner: null,
      quiet: 0,                // moves since a capture or a man moved
      log: "",
    };
    setUp(g);
    return g;
  }

  function setUp(g) {
    g.cells = new Array(SIZE * SIZE).fill(0);
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (!dark(r, c)) continue;
        if (r <= 2) set(g, r, c, MAN);
        else if (r >= 5) set(g, r, c, -MAN);
      }
  }

  /* ---------------- what one piece can do ----------------
     Captures and quiet moves are worked out separately, because the rule that
     matters most — if a capture exists you must take it — needs to know
     whether ANY piece has one before a single quiet move may be offered. */

  // one jump from a square, as {to, over}; `skip` is what has already been
  // captured this move and may not be jumped again
  function jumpsFrom(g, s, skip) {
    const v = at(g, rowOf(s), colOf(s));
    const side = sideOf(v);
    if (side === null) return [];
    const out = [];
    const queen = kindOf(v) === QUEEN;
    for (const [dr, dc] of DIRS) {
      let r = rowOf(s) + dr, c = colOf(s) + dc;
      // a queen may slide up to the piece it takes; a man must be next to it
      if (queen) while (inside(r, c) && at(g, r, c) === 0) { r += dr; c += dc; }
      if (!inside(r, c)) continue;
      const victim = at(g, r, c);
      if (victim === 0 || sideOf(victim) === side) continue;
      if (skip && skip.includes(sq(r, c))) continue;       // never twice
      let lr = r + dr, lc = c + dc;
      if (queen) {
        while (inside(lr, lc) && at(g, lr, lc) === 0) {
          out.push({ to: sq(lr, lc), over: sq(r, c) });
          lr += dr; lc += dc;
        }
      } else if (inside(lr, lc) && at(g, lr, lc) === 0) {
        out.push({ to: sq(lr, lc), over: sq(r, c) });
      }
    }
    return out;
  }

  function quietFrom(g, s) {
    const v = at(g, rowOf(s), colOf(s));
    const side = sideOf(v);
    if (side === null) return [];
    const out = [];
    if (kindOf(v) === QUEEN) {
      for (const [dr, dc] of DIRS) {
        let r = rowOf(s) + dr, c = colOf(s) + dc;
        while (inside(r, c) && at(g, r, c) === 0) { out.push({ to: sq(r, c) }); r += dr; c += dc; }
      }
    } else {
      const dr = forward(side);
      for (const dc of [1, -1]) {
        const r = rowOf(s) + dr, c = colOf(s) + dc;
        if (inside(r, c) && at(g, r, c) === 0) out.push({ to: sq(r, c) });
      }
    }
    return out;
  }

  const mySquares = (g, side) => {
    const out = [];
    for (let s = 0; s < SIZE * SIZE; s++) if (sideOf(g.cells[s]) === side) out.push(s);
    return out;
  };

  /* Everything the player may do right now, as {from, to, over}. `over` is
     absent on a quiet move. */
  function legalMoves(g) {
    if (g.phase !== "move") return [];
    const side = g.side;
    if (g.mustFrom != null)
      return jumpsFrom(g, g.mustFrom, g.pending.map((p) => p.sq))
        .map((j) => ({ from: g.mustFrom, to: j.to, over: j.over }));

    const caps = [];
    for (const s of mySquares(g, side))
      for (const j of jumpsFrom(g, s, [])) caps.push({ from: s, to: j.to, over: j.over });
    if (caps.length) return caps;                    // taking is compulsory

    const out = [];
    for (const s of mySquares(g, side))
      for (const q of quietFrom(g, s)) out.push({ from: s, to: q.to });
    return out;
  }

  const targetsFrom = (g, from) => legalMoves(g).filter((m) => m.from === from);

  /* ---------------- making a move ---------------- */
  function move(g, from, to) {
    const mv = legalMoves(g).find((m) => m.from === from && m.to === to);
    if (!mv) return false;
    const side = g.side;
    const v = at(g, rowOf(from), colOf(from));
    const wasMan = kindOf(v) === MAN;

    set(g, rowOf(from), colOf(from), 0);
    let piece = v;
    // the far row makes a queen the moment it is reached, mid-jump or not
    if (wasMan && rowOf(to) === lastRow(side)) piece = QUEEN * sign(side);
    set(g, rowOf(to), colOf(to), piece);
    g.moved.push(to);

    if (mv.over != null) {
      /* Lifted at the end of the move, not now — otherwise a queen could turn
         round and jump the same piece a second time. It stays on the board and
         out of play until the move is over. */
      g.pending.push({ sq: mv.over, was: at(g, rowOf(mv.over), colOf(mv.over)) });
      const more = jumpsFrom(g, to, g.pending.map((p) => p.sq));
      if (more.length) { g.mustFrom = to; return true; }   // the move goes on
    }
    finishMove(g, wasMan);
    return true;
  }

  function finishMove(g, wasMan) {
    const took = g.pending.length;
    for (const p of g.pending) set(g, rowOf(p.sq), colOf(p.sq), 0);
    g.pending = [];
    g.mustFrom = null;
    g.moved = [];
    g.quiet = (took || wasMan) ? 0 : g.quiet + 1;
    g.side = other(g.side);
    settle(g);
  }

  /* ---------------- is it over? ----------------
     You lose when you have nothing left, and equally when you have nothing to
     play — a side shut in with no move has lost, which is the rule people
     forget. A long stretch of queens shuffling with nothing taken is a draw. */
  function settle(g) {
    const side = g.side;
    if (!mySquares(g, side).length) {
      g.phase = "over"; g.winner = other(side); g.log = "ქვები აღარ დარჩა";
      return;
    }
    if (!legalMoves(g).length) {
      g.phase = "over"; g.winner = other(side); g.log = "სვლა აღარ არის";
      return;
    }
    if (g.quiet >= 30) { g.phase = "over"; g.winner = null; g.log = "ფრე"; }
  }

  /* ---------------- the computer ----------------
     Looks a few moves ahead and counts material, with a queen worth three men
     and a man worth a little more the closer it is to becoming one. Enough to
     punish a careless jump, which is what practice is for. */
  function value(g, side) {
    let n = 0;
    for (let s = 0; s < SIZE * SIZE; s++) {
      const v = g.cells[s];
      if (!v) continue;
      const who = sideOf(v);
      const mult = who === side ? 1 : -1;
      if (kindOf(v) === QUEEN) n += mult * 30;
      else {
        const rows = who === 0 ? rowOf(s) : SIZE - 1 - rowOf(s);
        n += mult * (10 + rows);
        // a man on the edge cannot be taken
        if (colOf(s) === 0 || colOf(s) === SIZE - 1) n += mult * 2;
      }
    }
    return n;
  }

  /* A whole turn may be several jumps; the search treats them as one move, the
     way the rules do, by walking until the turn actually changes hands. */
  function snapshot(g) {
    return { cells: g.cells.slice(), side: g.side, mustFrom: g.mustFrom,
             pending: g.pending.slice(), moved: g.moved.slice(),
             phase: g.phase, winner: g.winner, quiet: g.quiet, log: g.log };
  }
  function restore(g, s) { Object.assign(g, s, { cells: s.cells.slice() }); }

  function search(g, side, depth) {
    if (g.phase === "over")
      return g.winner === side ? 9999 : g.winner === null ? 0 : -9999;
    if (depth === 0) return value(g, side);
    const moves = legalMoves(g);
    if (!moves.length) return value(g, side);
    const mine = g.side === side;
    let best = mine ? -Infinity : Infinity;
    for (const mv of moves) {
      const save = snapshot(g);
      move(g, mv.from, mv.to);
      // a jump that carries on is still the same turn
      let n = search(g, side, g.side === save.side ? depth : depth - 1);
      restore(g, save);
      if (mine ? n > best : n < best) best = n;
    }
    return best;
  }

  function bestMove(g, depth) {
    const side = g.side;
    const moves = legalMoves(g);
    if (!moves.length) return null;
    let best = null;
    for (const mv of moves) {
      const save = snapshot(g);
      move(g, mv.from, mv.to);
      const n = search(g, side, g.side === save.side ? (depth || 4) : (depth || 4) - 1);
      restore(g, save);
      if (!best || n > best.score) best = { score: n, mv };
    }
    return best.mv;
  }

  /* ---------------- reading the board ---------------- */
  function view(g) {
    const out = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (!dark(r, c)) continue;
        const v = at(g, r, c);
        out.push({ sq: sq(r, c), r, c,
                   side: sideOf(v), queen: kindOf(v) === QUEEN,
                   doomed: g.pending.some((p) => p.sq === sq(r, c)) });
      }
    return out;
  }
  const count = (g, side) => mySquares(g, side).length;

  return {
    SIZE, MAN, QUEEN,
    newGame, setUp, legalMoves, targetsFrom, move, view, count,
    at, set, sq, rowOf, colOf, dark, sideOf, kindOf, mySquares,
    jumpsFrom, quietFrom, value, bestMove, snapshot, restore,
  };
});
