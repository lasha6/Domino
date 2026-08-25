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
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
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

/* =====================================================================
   The name of the place.

   Five games under one roof, and for a while the roof was called after one of
   them: added to a home screen it came out as "დომინო" with a domino icon,
   which is wrong four times out of five.

   The rule these protect is the one that decides everything else: no single
   word can be both ownable AND searched. So there are two names. The short one
   owns the home screen; the long one carries backgammon, dominoes and draughts,
   which is what a search engine and an app store actually read.
   ===================================================================== */

test("the app has one name, and it is not one of its games", () => {
  const man = JSON.parse(readFileSync(path.join(ROOT, "public", "manifest.webmanifest"), "utf8"));
  const GAMES = ["domino", "დომინო", "bura", "ბურა", "joker", "ჯოკერი",
                 "nardi", "ნარდი", "damka", "დამკა"];
  const short = man.short_name.toLowerCase();
  for (const g of GAMES)
    assert.notEqual(short, g.toLowerCase(),
      "the whole app is named after one of its five games");
  assert.ok(man.short_name.length <= 12,
    "a home screen truncates past about twelve characters: " + man.short_name);
});

test("the long name carries the words people actually type", () => {
  /* A brand has no search volume — it cannot, that is what makes it a brand.
     The volume has to come from somewhere, and this is the somewhere. */
  const man = JSON.parse(readFileSync(path.join(ROOT, "public", "manifest.webmanifest"), "utf8"));
  const html = readFileSync(path.join(ROOT, "public", "index.html"), "utf8");
  const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1] || "";
  for (const word of ["ackgammon", "omino"]) {
    assert.ok(man.name.includes(word), "the install name never says " + word);
    assert.ok(title.includes(word), "the page title never says " + word);
  }
  assert.match(html, /<meta name="description"/,
    "there is nothing for a search result to quote");
  // and the description says it in both languages, because both are audiences
  const desc = (html.match(/name="description" content="([^"]+)"/) || [])[1] || "";
  assert.match(desc, /[ა-ჿ]/, "the description is English only");
  assert.match(desc, /[a-z]{4}/, "the description is Georgian only");
});

test("the icon is the app's own, at every size a home screen asks for", () => {
  const man = JSON.parse(readFileSync(path.join(ROOT, "public", "manifest.webmanifest"), "utf8"));
  const sizes = man.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"), "a size is missing");
  assert.ok(man.icons.some((i) => i.purpose === "maskable"),
    "Android crops a non-maskable icon into a circle and takes the corners with it");
  for (const i of man.icons) {
    // the src carries a cache-busting version; the file behind it does not
    const png = readFileSync(path.join(ROOT, "public", i.src.split("?")[0]));
    assert.equal(png.slice(1, 4).toString(), "PNG", i.src + " is not a PNG");
    // the width lives in the IHDR, bytes 16..20
    assert.equal(png.readUInt32BE(16), +i.sizes.split("x")[0],
      i.src + " is not the size it claims");
  }
});

test("the brand is on the front page, and it is not translated", () => {
  /* A brand keeps its spelling in both languages, the way brands do. The line
     UNDER it is the part that changes. */
  const html = readFileSync(path.join(ROOT, "public", "index.html"), "utf8");
  const man = JSON.parse(readFileSync(path.join(ROOT, "public", "manifest.webmanifest"), "utf8"));
  assert.match(html, new RegExp('<div class="brand"><b>' + man.short_name + "</b>"),
    "the front page never says what the app is called");
  const i18n = readFileSync(path.join(ROOT, "public", "js", "i18n.js"), "utf8");
  assert.ok(!i18n.includes('"' + man.short_name + '":'),
    "the brand is in the dictionary, so it would change language under the player");
});

test("iPhone is given an icon at a path it has never cached", () => {
  /* iOS takes the home-screen icon ONCE, when the page is added, and never
     looks again — no header, no API, nothing in a page can change an icon that
     is already sitting on somebody's home screen. Removing and re-adding is
     the only way, and that is the platform's rule, not ours.

     Which is exactly why the path matters. Safari had already cached the old
     art under icons/icon-192.png, so pointing the touch icon there would have
     handed a player re-adding the app the very same domino again — and made
     re-adding look like it did not work either. A path that has never been
     fetched cannot be served from a cache. */
  const icon = "icons/apple-touch-icon-180.png";
  const png = readFileSync(path.join(ROOT, "public", icon));
  assert.equal(png.readUInt32BE(16), 180, "Apple's own size is 180");
  assert.equal(png.readUInt32BE(20), 180, "and it has to be square");

  const screens = readdirSync(path.join(ROOT, "public")).filter((f) => f.endsWith(".html"));
  for (const f of screens) {
    const html = readFileSync(path.join(ROOT, "public", f), "utf8");
    assert.match(html, new RegExp('rel="apple-touch-icon" href="' + icon.replace(/[.]/g, "[.]") + '"'),
      f + " points iOS at an icon path that is already in Safari's cache");
  }
});

test("the manifest's icons are versioned, so a cached manifest cannot serve stale art", () => {
  const man = JSON.parse(readFileSync(path.join(ROOT, "public", "manifest.webmanifest"), "utf8"));
  for (const i of man.icons) {
    assert.match(i.src, /\?v=\d+$/, i.src + " can be served from a cache forever");
    // ...and the file behind it still has to exist, query string stripped
    readFileSync(path.join(ROOT, "public", i.src.split("?")[0]));
  }
});
