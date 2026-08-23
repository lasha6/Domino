/* =====================================================================
   One principle, every game.

   A player learns the front of this app once. Whichever game they open, the
   same three things are in the same three places: a big green ითამაშე that
   means ONLINE, and under it 👥 მეგობართან and 🤖 კომპიუტერთან, always in
   that order, with "ონლაინ" written under the title.

   It is the kind of rule that rots quietly — a game gets added in a hurry and
   its two buttons come out the other way round — so it is written down here as
   well as in CLAUDE.md.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");

/* every <div class="center gameView" id="viewX"> ... up to the next one */
function views() {
  const out = [];
  const re = /<div class="center gameView" id="view(\w+)"[^>]*>/g;
  let m;
  const starts = [];
  while ((m = re.exec(html))) starts.push({ name: m[1], at: m.index });
  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].at : html.length;
    out.push({ name: s.name, body: html.slice(s.at, end) });
  });
  return out;
}

test("the lobby has a room for every game", () => {
  const names = views().map((v) => v.name);
  for (const g of ["Domino", "Joker", "Nardi", "Bura"])
    assert.ok(names.includes(g), "no room for " + g + ", found: " + names.join(", "));
});

test("every game says ონლაინ under its name", () => {
  for (const v of views())
    assert.match(v.body, /class="logo-sub"[^>]*>ონლაინ</,
      v.name + " does not say what the big button does");
});

test("every game has one green ითამაშე, and it is the online one", () => {
  for (const v of views()) {
    const play = v.body.match(/<button class="play"[^>]*>/g) || [];
    assert.equal(play.length, 1, v.name + " has " + play.length + " play buttons");
    assert.match(v.body, /<button class="play"[^>]*>[\s\S]*?ითამაშე/,
      v.name + "'s big button is not ითამაშე");
  }
});

test("the two modes are always the same two, always in the same order", () => {
  for (const v of views()) {
    const modes = [...v.body.matchAll(/<button class="mode"[^>]*>([^<]*)</g)]
      .map((m) => m[1].trim());
    assert.equal(modes.length, 2, v.name + " has " + modes.length + " modes");
    assert.match(modes[0], /^👥 მეგობართან$/, v.name + ": first mode is " + modes[0]);
    assert.match(modes[1], /^🤖 კომპიუტერთან$/, v.name + ": second mode is " + modes[1]);
  }
});

test("a board game screen carries the two plates, as the others do", () => {
  /* Who is playing belongs in the same two corners on every table. */
  for (const f of ["nardi.html", "damka.html"]) {
    const s = readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
    assert.match(s, /class="seatPlate me"/, f + " has no plate for the player");
    assert.match(s, /class="seatPlate them"/, f + " has no plate for the opponent");
    assert.ok(s.indexOf('class="seatPlate me"') < s.indexOf('class="seatPlate them"'),
      f + ": mine is on the left, theirs on the right");
    assert.match(s, /src="js\/coins\.js"/, f + " shows a purse it never loaded");
  }
});
