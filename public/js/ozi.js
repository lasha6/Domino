/* =====================================================================
   Georgian "Ozi" domino engine  (All Fives scoring, with spinner/სტავკა)
   Pure logic, no DOM — reusable later on the server for online play.

   Board model:
     g.line    : horizontal chain, array of [leftShown, rightShown], left->right
     g.top     : spinner's upward arm,   array of [innerShown, outerShown]
     g.bottom  : spinner's downward arm, array of [innerShown, outerShown]
     g.spinnerVal : value of the spinner double (the FIRST double), or null

   The spinner's perpendicular arms (top/bottom) become playable only once the
   spinner has a tile on BOTH of its line sides ("closed" / ჩაკეტილი).
   ===================================================================== */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Node (server)
  else root.Ozi = api;                                                    // browser
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function makeDeck() {
    const d = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) d.push([a, b]);
    return d;
  }
  function shuffle(arr) {
    arr = arr.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  const isDouble = (t) => t[0] === t[1];
  const pip = (t) => t[0] + t[1];
  const roundUp5 = (n) => Math.ceil(n / 5) * 5;
  const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];

  // players: 2 (1v1) or 4 (2v2 — partners sit opposite, seats 0+2 vs 1+3).
  // scores always has two entries: in 1v1 they are the players, in 2v2 the teams.
  function newGame(target, players) {
    const g = { players: players === 4 ? 4 : 2,
      hands: [], boneyard: [], scores: [0, 0], target: target || 365,
      turn: 0, round: 1, roundOver: false, matchOver: false, passes: 0,
      line: [], top: [], bottom: [], spinnerVal: null };
    dealOpeningHand(g);
    return g;
  }
  const teamOf = (g, seat) => (g.players === 4 ? seat % 2 : seat);
  const seatsOfTeam = (g, team) => {
    const out = [];
    for (let s = 0; s < g.players; s++) if (teamOf(g, s) === team) out.push(s);
    return out;
  };

  // The first hand opens with the highest double, so it must contain one.
  // With 14 of 28 tiles dealt this fails ~0.3% of the time — re-deal when it does.
  // (With four players every tile is dealt, so a double is always present.)
  function dealOpeningHand(g) {
    for (let i = 0; i < 200; i++) {
      deal(g);
      if (highestDouble(g.hands)) return true;
    }
    return false;
  }
  function deal(g) {
    const deck = shuffle(makeDeck());
    const n = g.players || 2;
    g.hands = [];
    for (let i = 0; i < n; i++) g.hands.push(deck.slice(i * 7, i * 7 + 7));
    // 2 players leave 14 tiles to draw from; 4 players use the whole set, so
    // there is no boneyard and a stuck player simply passes.
    g.boneyard = n === 4 ? [] : deck.slice(14);
    g.line = []; g.top = []; g.bottom = []; g.spinnerVal = null;
    g.roundOver = false; g.passes = 0;
  }

  function highestDouble(hands) {
    let best = null, bestP = -1;
    for (let p = 0; p < hands.length; p++)
      for (const t of hands[p])
        if (isDouble(t) && (best === null || t[0] > best[0])) { best = t; bestP = p; }
    return best ? { player: bestP, tile: best } : null;
  }

  // ---- board helpers (operate on any board-like object b) ----
  function spinnerIndex(b) {
    if (b.spinnerVal == null) return -1;
    return b.line.findIndex((e) => e[0] === e[1] && e[0] === b.spinnerVal);
  }
  function perpActive(b) {
    const i = spinnerIndex(b);
    return i > 0 && i < b.line.length - 1; // flanked on both line sides
  }
  const leftMatch = (b) => b.line.length ? b.line[0][0] : null;
  const rightMatch = (b) => b.line.length ? b.line[b.line.length - 1][1] : null;
  const topMatch = (b) => b.top.length ? b.top[b.top.length - 1][1] : b.spinnerVal;
  const bottomMatch = (b) => b.bottom.length ? b.bottom[b.bottom.length - 1][1] : b.spinnerVal;

  // playable ends (for legal moves) — matching values are single (not doubled)
  function targets(b) {
    if (b.line.length === 0) return [];
    const t = [{ side: "left", value: leftMatch(b) }, { side: "right", value: rightMatch(b) }];
    if (perpActive(b)) {
      t.push({ side: "top", value: topMatch(b) });
      t.push({ side: "bottom", value: bottomMatch(b) });
    }
    return t;
  }

  function legalMoves(b, hand) {
    if (b.line.length === 0) return hand.map((t) => ({ tile: t, side: "open" }));
    const tg = targets(b), out = [], seen = new Set();
    for (const t of hand)
      for (const g0 of tg)
        if (t[0] === g0.value || t[1] === g0.value) {
          const key = t[0] + "," + t[1] + "," + g0.side;
          if (!seen.has(key)) { seen.add(key); out.push({ tile: t, side: g0.side }); }
        }
    return out;
  }
  function hasMove(b, hand) { return legalMoves(b, hand).length > 0; }

  // which sides a single tile can play on (for the UI side-choice)
  function matchingSides(b, tile) {
    if (b.line.length === 0) return ["open"];
    const s = [];
    for (const g0 of targets(b))
      if (tile[0] === g0.value || tile[1] === g0.value) if (!s.includes(g0.side)) s.push(g0.side);
    return s;
  }
  function targetValue(b, side) {
    const f = targets(b).find((t) => t.side === side);
    return f ? f.value : null;
  }

  // Who is the spinner? The opening tile if it is a double — otherwise the
  // first double to get CLOSED IN, i.e. with a tile on both of its sides.
  // A double sitting at an open end is NOT the spinner yet.
  function updateSpinner(b) {
    if (b.spinnerVal != null) return;
    if (b.line.length === 1 && b.line[0][0] === b.line[0][1]) { b.spinnerVal = b.line[0][0]; return; }
    for (let i = 1; i < b.line.length - 1; i++)
      if (b.line[i][0] === b.line[i][1]) { b.spinnerVal = b.line[i][0]; return; }
  }

  // place a tile onto board b (mutates b)
  function place(b, tile, side) {
    if (side === "open") {
      b.line = [[tile[0], tile[1]]];
      updateSpinner(b);
      return;
    }
    if (side === "left") {
      const m = leftMatch(b), o = (tile[0] === m) ? tile[1] : tile[0];
      b.line.unshift([o, m]);
      updateSpinner(b);
      return;
    }
    if (side === "right") {
      const m = rightMatch(b), o = (tile[0] === m) ? tile[1] : tile[0];
      b.line.push([m, o]);
      updateSpinner(b);
      return;
    }
    if (side === "top") {
      const m = topMatch(b), o = (tile[0] === m) ? tile[1] : tile[0];
      b.top.push([m, o]);
      return;
    }
    if (side === "bottom") {
      const m = bottomMatch(b), o = (tile[0] === m) ? tile[1] : tile[0];
      b.bottom.push([m, o]);
      return;
    }
  }

  // exposed pip values at every open end (doubles at a tip count both pips)
  function openEnds(b) {
    if (b.line.length === 0) return [];
    if (b.line.length === 1 && !perpActive(b)) return [b.line[0][0], b.line[0][1]];
    const e = [];
    const L = b.line[0], R = b.line[b.line.length - 1];
    e.push(L[0] === L[1] ? L[0] * 2 : L[0]);
    e.push(R[0] === R[1] ? R[1] * 2 : R[1]);
    // Only arms that actually hold a tile are counting ends. An empty arm is a
    // playable spot, not an open end — counting the spinner value there would
    // inflate every count (and double-count it when both arms are empty).
    if (perpActive(b)) {
      if (b.top.length) { const T = b.top[b.top.length - 1]; e.push(T[0] === T[1] ? T[1] * 2 : T[1]); }
      if (b.bottom.length) { const B = b.bottom[b.bottom.length - 1]; e.push(B[0] === B[1] ? B[1] * 2 : B[1]); }
    }
    return e;
  }
  function openSum(b) { return openEnds(b).reduce((a, c) => a + c, 0); }

  function cloneBoard(b) {
    return { line: b.line.map((e) => e.slice()), top: b.top.map((e) => e.slice()),
      bottom: b.bottom.map((e) => e.slice()), spinnerVal: b.spinnerVal };
  }
  /* What a move is worth. One exception to the divide-by-five rule: the very
     first tile on an empty table scores only when it is the 5-5. Other opening
     tiles do add up to a multiple of five — 2-3 makes five, 4-6 makes ten —
     but by the rules of the game those do not count. */
  function scoreFor(board, wasEmpty, tile) {
    if (wasEmpty && !(tile[0] === 5 && tile[1] === 5)) return 0;
    const s = openSum(board);
    return (s > 0 && s % 5 === 0) ? s : 0;
  }

  function movePoints(b, tile, side) {
    const wasEmpty = b.line.length === 0;
    const c = cloneBoard(b);
    place(c, tile, side);
    return scoreFor(c, wasEmpty, tile);
  }

  function applyMove(g, playerIdx, tile, side) {
    const hand = g.hands[playerIdx];
    const idx = hand.findIndex((t) => sameTile(t, tile));
    if (idx >= 0) hand.splice(idx, 1);
    const wasEmpty = g.line.length === 0;
    place(g, tile, side);
    const pts = scoreFor(g, wasEmpty, tile);
    if (pts) g.scores[teamOf(g, playerIdx)] += pts;   // partners share a score
    return pts;
  }

  function handPoints(hand) {
    if (hand.length === 1 && hand[0][0] === 0 && hand[0][1] === 0) return 10;
    let sum = 0;
    for (const t of hand) sum += t[0] + t[1];
    return roundUp5(sum);
  }
  function rawPoints(hand) { let s = 0; for (const t of hand) s += t[0] + t[1]; return s; }

  // What a team is still holding — the bonus the other side collects when a
  // hand ends. Both partners' tiles count as one pile.
  function teamRawPoints(g, team) {
    let s = 0;
    for (const seat of seatsOfTeam(g, team)) s += rawPoints(g.hands[seat]);
    return s;
  }
  function teamHandPoints(g, team) {
    const seats = seatsOfTeam(g, team);
    const tiles = [];
    for (const seat of seats) tiles.push(...g.hands[seat]);
    return handPoints(tiles);            // keeps the lone 0-0 = 10 rule
  }

  /* Is the match finished? Reaching the target is not enough, for two reasons.

     A match can never be taken on a BLOCKED hand. Georgian "რიბა": a player who
     sees the opponent reach the target blocks on purpose, and that buys the
     trailing side one more hand to catch up.

     And nobody wins level. Both sides can cross the target in the same hand and
     land on the same number — the player hit 190:190 against a target of 175
     and was told he had lost. There is no winner there yet, so it is another
     extra hand, exactly like a რიბა. `reason` says which of the two it was, so
     a screen can explain it without guessing. */
  function matchResult(g, wasBlocked) {
    const reached = Math.max(g.scores[0], g.scores[1]) >= g.target;
    if (!reached) return { over: false, riba: false, reason: null, champTeam: null };
    if (wasBlocked) return { over: false, riba: true, reason: "block", champTeam: null };
    if (g.scores[0] === g.scores[1])
      return { over: false, riba: true, reason: "level", champTeam: null };
    return { over: true, riba: false, reason: null, champTeam: g.scores[0] > g.scores[1] ? 0 : 1 };
  }

  // Blocked hand: ONLY the side left holding fewer pips scores, and it takes
  // what the other side is holding. The side with more pips gets nothing.
  // Equal pips = nobody scores.
  function blockResult(g) {
    const a = teamRawPoints(g, 0), b = teamRawPoints(g, 1);
    if (a === b) return { draw: true, team: null, bonus: 0, pips: [a, b] };
    const team = a < b ? 0 : 1;
    return { draw: false, team, bonus: teamHandPoints(g, 1 - team), pips: [a, b] };
  }

  function aiChoose(g, playerIdx) {
    const moves = legalMoves(g, g.hands[playerIdx]);
    if (moves.length === 0) return null;
    let best = moves[0], bestScore = -1, bestTie = -1;
    for (const m of moves) {
      const p = movePoints(g, m.tile, m.side);
      const tie = (isDouble(m.tile) ? 100 : 0) + pip(m.tile);
      if (p > bestScore || (p === bestScore && tie > bestTie)) { best = m; bestScore = p; bestTie = tie; }
    }
    return best;
  }

  // boneyard (fixed slots)
  // Ozi rule: the last two tiles may never be drawn — they always stay.
  const BONE_RESERVE = 2;
  function boneCount(g) { let n = 0; for (const t of g.boneyard) if (t) n++; return n; }
  function drawableCount(g) { return Math.max(0, boneCount(g) - BONE_RESERVE); }
  function canDraw(g) { return drawableCount(g) > 0; }
  function drawSlot(g, playerIdx, i) {
    if (!canDraw(g)) return null;          // last two are locked
    const t = g.boneyard[i];
    if (!t) return null;
    g.boneyard[i] = null;
    g.hands[playerIdx].push(t);
    return t;
  }
  function randomBoneSlot(g) {
    const idx = [];
    for (let i = 0; i < g.boneyard.length; i++) if (g.boneyard[i]) idx.push(i);
    return idx.length ? idx[Math.floor(Math.random() * idx.length)] : -1;
  }

  return {
    makeDeck, shuffle, isDouble, pip, roundUp5, sameTile,
    newGame, deal, dealOpeningHand, highestDouble, teamOf, seatsOfTeam,
    spinnerIndex, perpActive, targets, legalMoves, hasMove, matchingSides, targetValue,
    place, openEnds, openSum, movePoints, applyMove,
    handPoints, rawPoints, teamRawPoints, teamHandPoints, blockResult, matchResult, aiChoose,
    boneCount, drawableCount, canDraw, drawSlot, randomBoneSlot, BONE_RESERVE,
  };
});
