/* =====================================================================
   Cards, checked by reading what they are made of.

   A blank card with only a suit on it stands in for the trump once the deck
   is empty — the card itself has already been drawn by somebody, so drawing
   it again would say nobody holds it when somebody does. It went through
   several layers of card-size rules that were each written for a different
   fan (the hand, the stock, the trick) and none of them reached it, so on a
   phone the mark came out as an 18px-wide card with a 30px suit painted over
   the top of it — invisible in practice. Read here so it cannot happen again
   without a test going red.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../public/css/cards.css", import.meta.url), "utf8");

function ruleFor(selector) {
  const at = css.indexOf(selector + "{");
  assert.notEqual(at, -1, `no rule for ${selector}`);
  const open = css.indexOf("{", at);
  return css.slice(open + 1, css.indexOf("}", open));
}

test("a blank trump card's suit fills the card, and has a floor under it", () => {
  const pip = ruleFor(".card.suitOnly .pip");
  assert.match(pip, /position\s*:\s*static/, "taken out of the corner");
  assert.match(pip, /font-size\s*:\s*max\(\s*30px/, "and never smaller than this");
});

test("the trump box's own card is not shrunk to match the fans around it", () => {
  /* This is the one card at the table a player must be able to read. It used
     to inherit --jkW/--jkH exactly, so on a narrow window it shrank in step
     with the stock pile and the hand until it read as a smear of colour. */
  const box = ruleFor(".btable.jk .trumpBox .card");
  assert.match(box, /width\s*:\s*max\(\s*\d+px/, "no floor under the card's width");
  assert.match(box, /height\s*:\s*max\(\s*\d+px/, "no floor under the card's height");
  const suit = ruleFor(".btable.jk .trumpBox .card.suitOnly .pip");
  assert.match(suit, /font-size\s*:\s*max\(\s*2[4-9]px/,
    "the blank-trump suit in the box has too low a floor");
});

test("every card fan that shows a suit-only card sets its own size", () => {
  /* The corner-pip rules for the hand, the stock and the trick are each three
     or four classes deep, which is more specific than .card.suitOnly .pip on
     its own — so without an override in every one of them, a suit-only card
     inside any of those fans falls back to the corner position instead of
     filling the card. */
  for (const sel of [
    ".btable.jk .stock .card.suitOnly .pip",
    ".btable.jk .trumpBox .card.suitOnly .pip",
    ".jkHand .card.suitOnly .pip",
    ".trick.cross .trickRow .card.suitOnly .pip",
  ]) assert.ok(css.includes(sel), "no suit-only override for " + sel);
});
