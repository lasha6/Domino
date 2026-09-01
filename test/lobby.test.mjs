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

/* =====================================================================
   The mark that stands for a game

   Every game is drawn twice — large above its own heading, small on the
   card that chooses it — and for a while those were two different drawings
   kept in two places. They drifted exactly as you would expect: ჯოკერი's
   card showed a raw 🃏 emoji beside three hand-drawn marks, and დომინო's
   showed two blank slabs while its own screen showed tiles with pips. The
   rule is now one definition, two placements.
   ===================================================================== */

const marks = readFileSync(new URL("../public/js/gamemark.js", import.meta.url), "utf8");

test("every game the picker offers has a mark, and it is drawn not written", () => {
  const picked = [...html.matchAll(/onclick="chooseGame\('(\w+)'\)"/g)].map((m) => m[1]);
  assert.ok(picked.length >= 4, "found only " + picked.length + " games on the picker");
  for (const g of picked) {
    assert.ok(marks.includes(g + ": () =>"),
      g + " has no mark of its own in js/gamemark.js");
    assert.match(html, new RegExp('data-mark="' + g + '"[^]*data-mark="' + g + '"'),
      g + " is not drawn in BOTH places from the one definition");
  }
});

test("no game is represented by an emoji", () => {
  /* The house rule, and the reason it is a rule: an emoji is somebody
     else's drawing, it is a different drawing on every phone, and beside
     four marks made of the app's own materials it looks like a mistake —
     which is what it was. */
  const cards = html.slice(html.indexOf('<div class="games">'),
                           html.indexOf("</div>", html.indexOf('<div class="games">')));
  assert.doesNotMatch(cards, /[\u{1F000}-\u{1FAFF}]/u,
    "a picker card is showing an emoji instead of a drawn mark");
});

test("the marks are made of the app's own materials, so a bought set shows in them", () => {
  /* --bone-* is what the shop writes when a player buys a table. A mark
     painted with fixed colours would be the one place their set does not
     reach — and it is the first thing they look at. */
  const lobbyCss = readFileSync(new URL("../public/css/lobby.css", import.meta.url), "utf8");
  for (const sel of [".mcard{", ".nard .die{"]) {
    const at = lobbyCss.indexOf(sel);
    assert.notEqual(at, -1, "no " + sel);
    assert.match(lobbyCss.slice(at, at + 400), /var\(--bone/,
      sel + " is painted with a colour the shop cannot reach");
  }
});

test("the jester is one drawing, not two", () => {
  /* It is on ჯოკერი's cards and on ჯოკერი's mark. Drawn out twice it would
     be corrected once. */
  const jester = readFileSync(new URL("../public/js/jester.js", import.meta.url), "utf8");
  assert.match(jester, /viewBox="0 0 100 132"/, "the drawing does not live in js/jester.js");
  for (const f of ["joker.html", "index.html"]) {
    const src = readFileSync(path.join(ROOT, "public", f), "utf8");
    assert.match(src, /js\/jester\.js/, f + " does not load the shared drawing");
    assert.doesNotMatch(src, /viewBox="0 0 100 132"/, f + " carries its own copy of it");
  }
});

test("shrinking the heading's mark cannot shrink the picker's", () => {
  /* Each mark is drawn twice, and the short-screen rules mean only the big
     one. Written unqualified they reached both: on a landscape phone the
     picker's copies came out at four fifths of full size and un-centred,
     spilling across the card and over its words. It looked like the marks
     had broken; what had happened was one selector matching twice.

     So inside those blocks, anything that resizes a mark must say .hero. */
  const css = readFileSync(new URL("../public/css/lobby.css", import.meta.url), "utf8");
  const parts = css.split("@media (max-height:");
  assert.ok(parts.length >= 3, "the short-screen rules have gone");
  const risky = /(^|[\s,>])(\.gameArt|\.tiles|\.tile|\.pips|\.mcard|\.nard)\b/;
  const loose = [];
  for (const part of parts.slice(1)) {
    const body = part.slice(part.indexOf("{") + 1, part.indexOf("\n}"));
    for (const line of body.split("\n")) {
      const sel = line.split("{")[0];
      if (!line.includes("{") || !risky.test(sel)) continue;
      if (!sel.includes(".hero")) loose.push(sel.trim());
    }
  }
  assert.deepEqual(loose, [],
    "these resize every copy of a mark, including the small ones on the picker");
});

test("nothing writes a transform onto the picker's copy of a mark", () => {
  /* That is what keeps it out of reach: the shrinking is done on the wrapper
     and the mark's own transform is left alone, so a rule that sets one
     elsewhere cannot land here and undo the centring. */
  const css = readFileSync(new URL("../public/css/lobby.css", import.meta.url), "utf8");
  const at = css.indexOf(".gMark > *{");
  assert.notEqual(at, -1, "the picker no longer places its mark");
  const body = css.slice(at, css.indexOf("}", at));
  assert.doesNotMatch(body, /transform:/,
    "the picker's mark carries a transform, which a later rule can overwrite");
  assert.match(css.slice(css.indexOf(".gMark{"), at), /transform:scale\(/,
    "nothing shrinks the picker's copy at all");
});
