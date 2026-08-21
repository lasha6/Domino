/* =====================================================================
   Three ways the ნარდი board went wrong on screen, and none of them could
   fail a test that only runs the rules.

   All three were invisible to Node and invisible to me until I measured the
   page: a highlight with no height, and a cube flattened into a line. They are
   pinned here by reading the stylesheet, which is blunt but catches exactly the
   mistakes that were actually made.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../public/css/board.css", import.meta.url), "utf8");

// the declarations of one rule, by its selector
function ruleFor(selector) {
  const i = css.indexOf(selector + "{");
  const j = css.indexOf(selector + " {");
  const at = i >= 0 ? i : j;
  assert.notEqual(at, -1, `no rule for ${selector}`);
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}

test("a point keeps its height even with nothing on it", () => {
  /* The bottom row aligned its points to flex-end, which sized each one to its
     checkers. An empty point has none, so it had no height, so nothing could be
     drawn on it — every "you may go here" mark in the near half of the board
     was invisible. The player asked why the board was blank on his side. */
  assert.match(ruleFor(".nrow"), /align-items\s*:\s*stretch/,
    ".nrow must stretch its points to the full row");
  const bottom = css.match(/\.nrow\.nbot\{([^}]*)\}/);
  if (bottom) assert.doesNotMatch(bottom[1], /align-items/,
    ".nrow.nbot must not size its points to their contents");
});

test("the stacks still sit against the outer edge", () => {
  // which is the point's own doing, not the row's
  assert.match(ruleFor(".nrow.nbot .npt"), /flex-direction\s*:\s*column-reverse/);
});

test("nothing flattens the dice", () => {
  /* `filter` and `opacity` both flatten a preserve-3d subtree. With either on
     the cube, its six faces collapse onto one plane and a die showing 2, 3, 4
     or 5 turns edge-on: a thin line lying on the felt. Measured at the time:
     35x35 lit, 0x35 dimmed. */
  const die = ruleFor(".d3");
  assert.match(die, /transform-style\s*:\s*preserve-3d/);
  assert.doesNotMatch(die, /filter\s*:/, "a filter on .d3 flattens the cube");
  assert.doesNotMatch(die, /(^|;)\s*opacity\s*:/, "opacity on .d3 flattens the cube");

  const spent = css.match(/\.d3\.spent[^{]*\{([^}]*)\}/);
  assert.ok(spent, "there is a way to show a die as spent");
  assert.ok(/\.d3\.spent\s+\.f\s*\{/.test(css),
    "a spent die is dimmed on its faces, which are flat, not on the cube");
});

test("the dice layer takes no taps", () => {
  // they land among the checkers; touching one must reach the board beneath
  assert.match(ruleFor(".diceLayer"), /pointer-events\s*:\s*none/);
});

test("the highlights are told apart by colour, not by luck", () => {
  /* Warm means "this one is yours", green means "it goes here". They were the
     same green once and a player cannot read that. */
  const can = ruleFor(".npt.can .tri");
  const pick = ruleFor(".npt.pick .tri");
  const from = ruleFor(".npt.from .tri");
  assert.match(can, /--ptInk\s*:\s*#5/, "a destination is green");
  assert.match(pick, /--ptInk\s*:\s*#ffe/, "one of yours is brass");
  assert.match(from, /--ptInk\s*:\s*var\(--brass-lit\)/, "the one in hand, brighter");
  assert.notEqual(can, pick, "and they are not the same mark");
  assert.ok(css.includes(".npt.pick .chk:last-child"),
    "the top checker of the stack is marked too, where the finger goes");
});

test("a highlight reads the same either way up", () => {
  /* The bottom row is the top row upside down. A highlight painted as a
     top-to-bottom gradient therefore fades out at exactly the end that half of
     the board shows you, which is how the near half once came to look
     unmarked. One flat colour has no end to fade at. */
  for (const sel of [".npt.can .tri", ".npt.from .tri", ".npt.pick .tri"])
    assert.doesNotMatch(ruleFor(sel), /linear-gradient/,
      sel + " must not depend on which way the point points");
});

test("the case opens the way a real one does", () => {
  /* A ნარდი board is hinged down the MIDDLE and opens like a book: the left
     half and the right half swing about the vertical seam. It was written as a
     lid folding off the top once, and the player who owns one said so at once.
     So the fold is pinned to the axis it actually turns about. */
  assert.ok(css.includes("@keyframes openLeft"), "there is a left half to open");
  assert.ok(css.includes("@keyframes openRight"), "and a right half");
  const left = css.match(/@keyframes openLeft\{([^}]*\}[^}]*)\}/);
  assert.ok(left && /rotateY\(-?90deg\)/.test(left[1]),
    "it turns about the vertical axis, not the horizontal one");
  assert.doesNotMatch(css, /@keyframes openTop/,
    "the old lid-off-the-top fold is gone");
  assert.match(ruleFor(".nboard.opening .nhalf.left"), /transform-origin\s*:\s*100%/,
    "the left half is hinged on its inner edge");
  assert.match(ruleFor(".nboard.opening .nhalf.right"), /transform-origin\s*:\s*0/,
    "and the right half on its own");
});

test("a point is the carved teardrop, not a triangle", () => {
  const tri = ruleFor(".npt .tri");
  assert.match(tri, /mask\s*:\s*var\(--tearMask\)/, "the shape is a mask");
  assert.doesNotMatch(tri, /clip-path/, "the flat triangle is gone");
  assert.ok(css.includes("--tearMask:url("), "and the drawing is held once");
  assert.ok(css.includes("--vineMask:url(") && css.includes("--pomMask:url("),
    "each half has its own inlay in the middle");
});
