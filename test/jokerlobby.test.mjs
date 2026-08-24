/* =====================================================================
   ჯოკერი's room picker, the same shape ბურა's already is.

   The four-card grid that used to sit on the room itself did not survive a
   phone: at 640px wide the cards ran off the edge of the screen. ბურა solved
   this months ago with a modal — pick teams, then which game, then go — and
   ჯოკერი now uses the identical structure rather than a new one, so a fix to
   one is a fix to both and a phone that fits ბურა fits ჯოკერი too.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

function overlay(id) {
  const at = html.indexOf('<div class="roomOverlay" id="' + id + '"');
  assert.notEqual(at, -1, "no overlay #" + id);
  const end = html.indexOf('<div class="roomOverlay"', at + 1);
  return html.slice(at, end === -1 ? html.length : end);
}

test("ჯოკერი has its own modal, the same shape as ბურა's", () => {
  const jk = overlay("jokerOverlay");
  const bu = overlay("buraOverlay");
  for (const cls of ['class="sizePick"', 'class="rooms"', 'class="room best"', 'class="roomClose"'])
    assert.ok(jk.includes(cls) && bu.includes(cls),
      "ჯოკერი's modal is missing " + cls + " that ბურა's has");
});

test("the room card grid that could not fit a phone is gone", () => {
  const view = html.slice(html.indexOf('id="viewJoker"'), html.indexOf('<!-- ---- nardi'));
  assert.doesNotMatch(view, /class="games"/,
    "the four-card grid is still on the room and will overflow a phone again");
});

test("teams cannot be picked against the computer", () => {
  assert.match(html, /jokerMode\s*===\s*"cpu"\)\s*jokerTeams\s*=\s*false/,
    "opening practice mode does not force teams off");
  assert.match(html, /function pickJokerTeams\(on\)\{\s*if\s*\(jokerMode === "cpu"\) return;/,
    "practice mode can still have teams toggled");
});

test("creating a friend table for ჯოკერი goes through its own modal, not straight to a URL", () => {
  /* ბურა's create button opens ბურა's own modal so the size can still be
     chosen; ჯოკერი has the same choice to make (which game, pairs or not) and
     must not skip it. */
  const at = html.indexOf("function friendCreate()");
  const body = html.slice(at, html.indexOf("function doJoin"));
  assert.match(body, /friendGame === "joker".*openJoker\("friend"\)/s);
});

test("every game in the lobby opens through its own control, and joker's is openJoker", () => {
  const view = html.slice(html.indexOf('id="viewJoker"'), html.indexOf('<!-- ---- nardi'));
  assert.match(view, /onclick="openJoker\('quick'\)"/);
  assert.match(view, /onclick="openFriend\('joker'\)"/);
  assert.match(view, /onclick="openJoker\('cpu'\)"/);
});
