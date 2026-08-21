/* =====================================================================
   The board screens, checked by reading what they are made of.

   Everything in here is something that went wrong on screen and could not fail
   a test that only runs the rules: a highlight with no height, a cube flattened
   into a line, a mark that faded out at the one end half the board shows you.
   Reading the stylesheet is blunt, but it catches exactly the mistakes that
   were actually made, and it costs nothing to run.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../public/css/board.css", import.meta.url), "utf8");
const screens = ["nardi", "damka"].map((n) => ({
  name: n,
  html: readFileSync(new URL(`../public/${n}.html`, import.meta.url), "utf8"),
}));

function ruleFor(selector) {
  const i = css.indexOf(selector + "{");
  const j = css.indexOf(selector + " {");
  const at = i >= 0 ? i : j;
  assert.notEqual(at, -1, `no rule for ${selector}`);
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}

/* ---------------- layout ---------------- */

test("a point keeps its height even with nothing on it", () => {
  /* The bottom row aligned its points to flex-end, which sized each one to its
     checkers. An empty point has none, so it had no height, so nothing could be
     drawn on it — every "you may go here" mark in the near half of the board
     was invisible, and the player asked why his side was blank. */
  assert.match(ruleFor(".nrow"), /align-items\s*:\s*stretch/,
    ".nrow must stretch its points to the full row");
  const bottom = css.match(/\.nrow\.nbot\{([^}]*)\}/);
  if (bottom) assert.doesNotMatch(bottom[1], /align-items/,
    ".nrow.nbot must not size its points to their contents");
});

test("the stacks still sit against the outer edge", () => {
  assert.match(ruleFor(".nrow.nbot .npt"), /flex-direction\s*:\s*column-reverse/);
});

/* ---------------- the dice ---------------- */

test("nothing flattens the dice", () => {
  /* `filter` and `opacity` both flatten a preserve-3d subtree. With either on
     the cube its six faces collapse onto one plane, and a die showing 2, 3, 4
     or 5 turns edge-on: a thin line lying on the board. Measured at the time,
     35x35 lit and 0x35 dimmed. */
  const die = ruleFor(".d3");
  assert.match(die, /transform-style\s*:\s*preserve-3d/);
  assert.doesNotMatch(die, /filter\s*:/, "a filter on .d3 flattens the cube");
  assert.doesNotMatch(die, /(^|;)\s*opacity\s*:/, "opacity on .d3 flattens the cube");
  assert.ok(/\.d3\.spent\s+\.f\s*\{/.test(css),
    "a spent die is dimmed on its faces, which are flat, not on the cube");
});

test("the dice layer takes no taps", () => {
  // they land among the checkers; touching one must reach the board beneath
  assert.match(ruleFor(".diceLayer"), /pointer-events\s*:\s*none/);
});

/* ---------------- the marks a player plays by ---------------- */

test("the three marks are told apart, and none of them is the same as another", () => {
  const can = ruleFor(".npt.can .tri") + ruleFor(".npt.can .tri::after");
  const from = ruleFor(".npt.from .tri") + ruleFor(".npt.from .tri::after");
  const pick = ruleFor(".npt.pick .tri");
  assert.notEqual(can, from);
  assert.notEqual(can, pick);
  assert.notEqual(from, pick);
  assert.ok(css.includes(".npt.pick .chk:last-child"),
    "the top checker of a stack is marked too, where the finger goes");
  assert.ok(css.includes(".npt.from .chk:last-child"),
    "and the one in hand more strongly");
});

test("a mark reads the same either way up", () => {
  /* The bottom row is the top row upside down. A mark painted as a
     top-to-bottom gradient fades out at exactly the end that half of the board
     shows you, which is how the near half came to look unmarked. */
  for (const sel of [".npt.can .tri", ".npt.from .tri", ".npt.pick .tri"])
    assert.doesNotMatch(ruleFor(sel), /linear-gradient/,
      sel + " must not depend on which way the point points");
});

/* ---------------- opening the case ---------------- */

test("the case opens the way a real one does", () => {
  /* Hinged down the MIDDLE and opened like a book: the cover comes over to the
     left about the vertical seam, and the half underneath does not move. It was
     written as a lid folding off the top once, and the man who owns one said so
     at a glance. */
  assert.ok(css.includes("@keyframes openCover"), "there is a cover to turn");
  const body = css.slice(css.indexOf("@keyframes openCover"),
                         css.indexOf("@keyframes trayIn"));
  assert.match(body, /rotateY\(180deg\)/, "it starts shut, face down over the other half");
  assert.doesNotMatch(body, /rotateX\(/, "and turns about the vertical axis, never the horizontal");
  assert.doesNotMatch(css, /@keyframes openTop/, "the old lid-off-the-top fold is gone");
  assert.match(ruleFor(".nboard.opening .nhalf.left"), /transform-origin\s*:\s*100%/,
    "hinged on its inner edge, which is the seam");
  assert.ok(css.includes("@keyframes caseCentre"),
    "and the shut case sits in the middle of the table, not off to one side");
});

test("the case has an outside, and it covers what it covers", () => {
  /* .nrows flattens its children into one plane, so without a z-index the half
     underneath painted straight through the lid and you could read the board
     through the wood. */
  assert.match(ruleFor(".nhalf .face"), /backface-visibility\s*:\s*hidden/);
  assert.match(ruleFor(".nhalf .face.outside"), /rotateY\(180deg\)/);
  assert.match(ruleFor(".nboard.opening .nhalf.left"), /z-index\s*:\s*3/,
    "the cover is drawn in front of the half it lies on");
  assert.match(ruleFor(".nhalf"), /transform-style\s*:\s*preserve-3d/);
});

/* ---------------- the look ---------------- */

test("every drawing travels with the app", () => {
  /* The APK has to work with no network at all. Every ornament is an inline
     SVG in a data URI, and nothing may point at a host. */
  const urls = css.match(/url\(([^)]*)\)/g) || [];
  assert.ok(urls.length >= 6, `found ${urls.length} drawings`);
  for (const u of urls)
    assert.match(u, /^url\('data:image\/svg\+xml/,
      "a board must not fetch anything: " + u.slice(0, 60));
});

test("the ornament is drawn, never typed", () => {
  /* No emoji anywhere on these two screens — not in the markup, not in the
     script that fills it in. An emoji is somebody else's drawing, at somebody
     else's size, in whatever style the phone happens to ship. */
  // arrows are typography, not emoji: the back button and the score keep theirs
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
  for (const s of screens) {
    const found = s.html.split("\n")
      .map((line, i) => ({ line: line.trim(), i: i + 1 }))
      .filter((x) => emoji.test(x.line));
    assert.deepEqual(found.map((f) => `${s.name}.html:${f.i} ${f.line.slice(0, 60)}`), [],
      "these lines carry an emoji");
  }
});

test("the palette is the one that was asked for", () => {
  /* Walnut, wine, ivory, brass, navy — and no green baize, which is the card
     tables' and was what these screens inherited. */
  const root = css.slice(css.indexOf(":root{"), css.indexOf("}", css.indexOf(":root{")));
  for (const token of ["--wal", "--wine", "--ivory", "--br", "--nv-bg"])
    assert.ok(root.includes(token + ":"), "the palette names " + token);
  assert.doesNotMatch(css, /var\(--baize/, "no green felt on a wooden board");
});

test("the checker's engraving is small and quiet", () => {
  /* "Do not put grape icons on every checker." It is a mark on a playing
     piece — a third of the disc, half-transparent — not a picture of a fruit. */
  const mark = ruleFor(".chk::after");
  const inset = /inset\s*:\s*(\d+)%/.exec(mark);
  assert.ok(inset && +inset[1] >= 28,
    "the engraving takes up less than half the checker");
  const op = /opacity\s*:\s*([\d.]+)/.exec(mark);
  assert.ok(op && +op[1] <= 0.6, "and it is cut shallow");
});

test("the carving does not depend on a unit a WebView may not have", () => {
  /* An unsupported unit does not degrade — it invalidates the whole
     declaration, and the text falls back to whatever it inherited. */
  assert.doesNotMatch(css, /cqw|cqi|cqh/, "no container units in here");
});
