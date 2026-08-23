/* =====================================================================
   The game's voice.

   Every sound is synthesised in `sound.js` — there are no audio files — so a
   screen asking for one that was never written fails silently. `play()` looks
   the name up, finds nothing, and returns; no error, no noise, and nobody
   notices until a player says a card makes no sound. That is exactly what
   happened to ჯოკერი: both its screens asked for "play", and the effect is
   called "card".

   Reading the files is blunt, but a name that does not exist is a spelling
   mistake, and a spelling mistake is what this catches.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUB = fileURLToPath(new URL("../public", import.meta.url));
const src = readFileSync(path.join(PUB, "js", "sound.js"), "utf8");

/* the table of effects, as written */
const table = src.slice(src.indexOf("const S = {"));
const effects = new Set(
  [...table.matchAll(/^ {4}([a-zA-Z][a-zA-Z0-9]*)\s*\(/gm)].map((m) => m[1]));

const screens = readdirSync(PUB).filter((f) => f.endsWith(".html"));

test("every sound a screen asks for is one that exists", () => {
  const missing = [];
  for (const f of screens) {
    const html = readFileSync(path.join(PUB, f), "utf8");
    const asked = new Set(
      [...html.matchAll(/Sound\.play\(\s*"([a-zA-Z0-9]+)"/g)].map((m) => m[1]));
    for (const name of asked)
      if (!effects.has(name)) missing.push(`${f} asks for "${name}"`);
  }
  assert.deepEqual(missing, [], "these calls make no sound at all");
});

test("the sounds a game needs are all there", () => {
  /* Not every screen uses every voice, but these are the ones the games are
     written around, and losing one of them would be silent in both senses. */
  for (const name of ["place", "card", "draw", "win", "lose", "handWin", "handLose",
                      "tap", "turn", "diceLand", "diceDouble", "boardOpen"])
    assert.ok(effects.has(name), "sound.js has lost " + name);
});

test("a card sounds like paper and a tile sounds like bone", () => {
  /* The two are not interchangeable: a domino has an edge and gives a clack, a
     card has none. If `card` were written with the same bright transient as
     `place` there would have been no point adding it. */
  const one = (name) => {
    const at = table.indexOf("\n    " + name + "(");
    assert.notEqual(at, -1, name + " is missing");
    return table.slice(at, table.indexOf("},", at));
  };
  assert.notEqual(one("card"), one("place"));
  assert.doesNotMatch(one("card"), /"triangle"/,
    "the clack of a bone tile has no business in a card");
});

test("every screen that makes a sound loads the file that makes it", () => {
  for (const f of screens) {
    const html = readFileSync(path.join(PUB, f), "utf8");
    if (!/Sound\.play\(/.test(html)) continue;
    assert.match(html, /src="js\/sound\.js"/,
      f + " calls Sound.play but never loads sound.js");
  }
});
