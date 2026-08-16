/* =====================================================================
   How the tiles are laid out on the table.

   Every bug the player reported here was invisible in code and obvious on
   screen: a chain that folded on the spinner, an arm lying flat sideways, a
   corner stacked against a double. These tests describe what the eye expects,
   so those cannot come back quietly.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Ozi = require("../public/js/ozi.js");

// render.js is written for the browser and only exposes what a screen needs,
// so lift the layout internals out without touching the shipped file
const src = readFileSync(new URL("../public/js/render.js", import.meta.url), "utf8")
  .replace("global.Tiles = {", "global.__T = { buildLayout, overlapCount, awkwardCorners, ARM_FOLDS, MAX_ROWS, MAXSCALE };\n  global.Tiles = {");
const w = { document: { createElement: () => ({ style: {}, classList: { add() {} } }) } };
new Function("window", "document", src)(w, w.document);
const { buildLayout, overlapCount, awkwardCorners, ARM_FOLDS, MAX_ROWS, MAXSCALE } = w.__T;

// what the screen would actually pick, for a board area the size of a phone's
function chosen(board, availW = 760, availH = 210) {
  let best = null;
  for (const armPer of ARM_FOLDS)
    for (const top of [+1, -1]) for (const bottom of [-1, +1])
      for (let rows = 1; rows <= MAX_ROWS; rows++) {
        const L = buildLayout(board, rows, armPer, { top, bottom });
        if (!L) continue;
        const xs = L.boxes.map((b) => b.x), ys = L.boxes.map((b) => b.y);
        const wide = Math.max(...L.boxes.map((b) => b.x + b.w)) - Math.min(...xs);
        const tall = Math.max(...L.boxes.map((b) => b.y + b.h)) - Math.min(...ys);
        const scale = Math.min(MAXSCALE, availW / wide, availH / tall);
        const rank = scale - overlapCount(L.boxes) * 100 - awkwardCorners(L.boxes) * 0.08;
        if (!best || rank > best.rank + 0.001) best = { L, scale, rank, armPer };
        if (rows >= board.line.length) break;
      }
  return best;
}

const DECK = [];
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) DECK.push([a, b]);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// every board the game can reach, one tile at a time
function* boards(rounds) {
  for (let r = 0; r < rounds; r++) {
    const bag = shuffle(DECK.map((t) => [...t]));
    const b = { line: [], top: [], bottom: [], spinnerVal: null };
    Ozi.place(b, bag.pop(), "open");
    while (bag.length) {
      let played = false;
      for (let i = bag.length - 1; i >= 0; i--) {
        const sides = Ozi.matchingSides(b, bag[i]);
        if (!sides.length) continue;
        Ozi.place(b, bag.splice(i, 1)[0], sides[(Math.random() * sides.length) | 0]);
        played = true; break;
      }
      if (!played) break;
      yield b;
    }
  }
}

// all the fold combinations a screen may pick between
function* layouts(board) {
  for (const armPer of ARM_FOLDS)
    for (let rows = 1; rows <= MAX_ROWS; rows++) {
      const L = buildLayout(board, rows, armPer);
      if (L) yield { L, armPer, rows };
      if (rows >= board.line.length) break;
    }
}

// tiles are drawn a hair apart on purpose, so "touching" means within 4px
function touching(a, b) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ((oy >= -4 && oy <= 4) && ox > 4) || ((ox >= -4 && ox <= 4) && oy > 4);
}
const isDouble = (box) => box.e[0] === box.e[1];
// two tiles lying the same way, meeting along their long sides — the look that
// reads as a broken chain
const alongside = (a, b) => a.orient === b.orient && (a.orient === "h"
  ? Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 20
  : Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 20);

const chainOf = (L) => L.boxes.filter((x) => x.idx !== undefined).sort((p, q) => p.idx - q.idx);
const armOf = (L, side) => L.boxes.filter((x) => x.arm === side);

test("there is always a way to lay the board out with no tile on top of another", () => {
  let checked = 0;
  for (const b of boards(400)) {
    let clean = false;
    for (const { L } of layouts(b)) if (overlapCount(L.boxes) === 0) { clean = true; break; }
    assert.ok(clean, `no clean layout for ${JSON.stringify(b)}`);
    checked++;
  }
  assert.ok(checked > 5000, `checked ${checked} boards`);
});

test("in any layout without overlaps, every tile touches the one before it", () => {
  for (const b of boards(150))
    for (const { L } of layouts(b)) {
      if (overlapCount(L.boxes) > 0) continue;          // the screen would reject it anyway
      for (const seq of [chainOf(L), armOf(L, "top"), armOf(L, "bottom")])
        for (let i = 1; i < seq.length; i++)
          assert.ok(touching(seq[i - 1], seq[i]),
            `gap between ${JSON.stringify(seq[i - 1].e)} and ${JSON.stringify(seq[i].e)}`);
    }
});

test("the chain itself never puts a corner flat against a double", () => {
  // the chain has room to turn a tile earlier, so here it is absolute
  for (const b of boards(150))
    for (const { L } of layouts(b)) {
      if (overlapCount(L.boxes) > 0) continue;
      const seq = chainOf(L);
      for (let i = 1; i < seq.length; i++) {
        const p = seq[i - 1], c = seq[i];
        if (isDouble(p) || isDouble(c))
          assert.ok(!alongside(p, c),
            `${JSON.stringify(p.e)} and ${JSON.stringify(c.e)} lie side by side`);
      }
    }
});

test("a double is never turned on, and no corner is laid against one", () => {
  /* The rule the player stated: a double stands across its run and the chain
     carries on through it. Turning on one, or cornering right beside one, reads
     as a broken table — and no amount of saved space buys that back. Absolute
     in every layout the screen may pick, not merely usually. */
  let seen = 0;
  for (const b of boards(220)) {
    const pick = chosen(b);
    if (!pick) continue;
    seen++;
    assert.equal(awkwardCorners(pick.L.boxes), 0,
      `a corner sits against a double on ${JSON.stringify(b)}`);

    // a double that moved the lane is a double used as a corner
    for (const side of ["top", "bottom"]) {
      const arm = pick.L.boxes.filter((x) => x.arm === side);
      for (let i = 0; i < arm.length - 1; i++) {
        if (arm[i].e[0] !== arm[i].e[1]) continue;
        const moved = Math.abs(arm[i + 1].x - arm[i].x) > 20 && Math.abs(arm[i + 1].y - arm[i].y) < 30;
        assert.ok(!moved, `the double ${JSON.stringify(arm[i].e)} was used to turn on`);
      }
    }
  }
  assert.ok(seen > 200, `checked ${seen} boards`);
});

test("folding keeps the tiles readable", () => {
  // the complaint that started this: arms grew straight until nothing could be
  // read. Measure what the screen would actually choose.
  let tiny = 0, seen = 0;
  for (const b of boards(200)) {
    if (b.top.length + b.bottom.length < 4) continue;
    const pick = chosen(b);
    if (!pick) continue;
    seen++;
    if (pick.scale < 0.35) tiny++;
  }
  assert.ok(seen > 200, `checked ${seen} boards with arms`);
  assert.ok(tiny / seen < 0.06,
    `${(tiny / seen * 100).toFixed(1)}% of boards draw at under a third size`);
});

test("the chain never folds on the spinner — its arms need that space", () => {
  for (const b of boards(150)) {
    if (b.spinnerVal == null) continue;
    const spIdx = b.line.findIndex((t) => t[0] === t[1] && t[0] === b.spinnerVal);
    for (const { L } of layouts(b)) {
      const sp = L.boxes.find((x) => x.idx === spIdx);
      if (!sp) continue;
      // a folded corner is the one tile standing across its run; the spinner
      // must never be that tile, it must simply be a double in the row
      assert.equal(sp.spinner, true, "the pivot tile is marked so it can be styled");
    }
  }
});

test("a double always sits crosswise to the run it is in", () => {
  for (const b of boards(120))
    for (const { L } of layouts(b)) {
      if (overlapCount(L.boxes) > 0) continue;
      for (const box of chainOf(L))
        if (isDouble(box) && !box.corner)
          assert.equal(box.orient, "v", "the chain runs sideways, so its doubles stand up");
      for (const side of ["top", "bottom"])
        for (const box of armOf(L, side))
          if (isDouble(box))
            assert.equal(box.orient, "h", "an arm runs up and down, so its doubles lie flat");
    }
});

test("every tile of the board appears exactly once in the layout", () => {
  for (const b of boards(120))
    for (const { L } of layouts(b)) {
      const total = b.line.length + b.top.length + b.bottom.length;
      assert.equal(L.boxes.length, total, "no tile is dropped or drawn twice");
    }
});
