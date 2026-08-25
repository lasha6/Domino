/* =====================================================================
   The second language, and whether it actually covers the app.

   Georgian is the source: every string is written in Georgian where it stands,
   and i18n.js says what each one is in English. That is a good arrangement with
   one failure mode, and it is a silent one — a new string simply stays Georgian
   in front of an English-speaking player. Nothing throws, nothing logs, and it
   is invisible to anybody who reads Georgian, which is everybody who works on
   this.

   So the dictionary is checked against the app rather than against itself: every
   Georgian string a player can SEE, run through i18n's own matcher. "Covered"
   here means exactly what it means at runtime, because it is the same function.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUB = path.join(ROOT, "public");
const KA = /[ა-ჿ]/;

/* Load i18n the way a browser does. Every global it touches has to be handed
   in as a PARAMETER: inside the function body `localStorage` is a bare global,
   and if the read throws, i18n's own catch swallows it and the dictionary
   quietly reports itself as switched off — which made a first draft of this
   test find 585 "missing" strings, all of them false. */
function loadI18N() {
  const doc = { addEventListener() {}, documentElement: { setAttribute() {} },
                body: null, readyState: "complete", title: "" };
  const g = { navigator: { language: "en" }, document: doc };
  g.window = g;
  new Function("window", "document", "localStorage", "MutationObserver",
    readFileSync(path.join(PUB, "js", "i18n.js"), "utf8"))
    .call(g, g, doc, { getItem: () => "en", setItem() {} },
          function () { return { observe() {} }; });
  assert.equal(g.I18N.lang, "en", "the harness did not switch the dictionary on");
  return g.I18N;
}
const I18N = loadI18N();
const covered = (s) => I18N.t(s) !== s;
const norm = (s) => s.trim().replace(/[\s ]+/g, " ");

const screens = readdirSync(PUB).filter((f) => f.endsWith(".html"));
/* Two design sketches that no player ever opens. They are kept because they
   are what the boards were drawn from, not because they are screens. */
const SKETCHES = new Set(["neon.html", "wood.html"]);

test("the dictionary is switched on, and it translates", () => {
  assert.equal(I18N.t("აირჩიე თამაში"), "Choose a game");
  assert.equal(I18N.t("ნარდი"), "Backgammon", "the English name is a transliteration");
  assert.equal(I18N.t("დამკა"), "Checkers", "the English name is a transliteration");
});

test("every word written into a screen has an English one", () => {
  /* Text nodes and the three attributes i18n walks. This is the half that is
     certain: it is on the page before a single line of script runs. */
  const missing = [];
  for (const f of screens) {
    if (SKETCHES.has(f)) continue;
    const html = readFileSync(path.join(PUB, f), "utf8")
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");
    for (const m of html.matchAll(/\b(placeholder|title|aria-label)="([^"]*)"/g)) {
      const s = norm(m[2]);
      if (KA.test(s) && !covered(s)) missing.push(`${f} @${m[1]}: ${s}`);
    }
    for (const piece of html.split(/<[^>]*>/)) {
      const s = norm(piece);
      /* A single letter is an INITIAL, not a word — the one in the avatar is a
         placeholder that script replaces with the first letter of whoever is
         actually signed in, in whatever language they are reading. */
      if (s.length < 2) continue;
      if (s && KA.test(s) && !covered(s)) missing.push(`${f}: ${s}`);
    }
  }
  assert.deepEqual(missing, [], "these stay Georgian on an English screen");
});

test("what a browser tab says has an English one too", () => {
  /* The title lives in the HEAD, which the walker never reaches — it is given
     the body. So this went untranslated on every screen for a long time, in the
     tab, in bookmarks and in the app switcher, and nobody could see it because
     the page underneath was already English. */
  const i18n = readFileSync(path.join(PUB, "js", "i18n.js"), "utf8");
  assert.match(i18n, /document\.title = one\(document\.title\)/,
    "the title is never translated");
  for (const f of screens) {
    if (SKETCHES.has(f)) continue;
    const t = (readFileSync(path.join(PUB, f), "utf8").match(/<title>([^<]+)<\/title>/) || [])[1];
    assert.ok(t, f + " has no title");
    if (!KA.test(t)) continue;              // already written in English
    assert.ok(covered(norm(t)), f + ": the tab stays Georgian — " + t);
  }
});

/* ---------------- the two files that are almost all words ---------------- */

test("every achievement and every thing in the shop is named in English", () => {
  /* A player reading English opened their profile to a wall of Georgian: the
     shop's colours and every achievement's name and hint. Thirty-five strings,
     all of them user-facing, none of them in the dictionary. */
  const src = readFileSync(path.join(PUB, "js", "progress.js"), "utf8");
  const missing = [];
  for (const m of src.matchAll(/\b(?:title|hint):\s*"([^"]+)"/g))
    if (KA.test(m[1]) && !covered(m[1])) missing.push(m[1]);
  assert.deepEqual(missing, [], "these stay Georgian in the profile and the shop");
});

test("every tip on the match card is written in both languages", () => {
  const src = readFileSync(path.join(PUB, "js", "versus.js"), "utf8");
  const block = src.slice(src.indexOf("const TIPS"), src.indexOf("const pick"));
  const tips = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((s) => KA.test(s));
  assert.ok(tips.length >= 10, "found only " + tips.length + " tips");
  const missing = tips.filter((s) => !covered(s));
  assert.deepEqual(missing, [], "these stay Georgian on the match card");
});

/* ---------------- the sentences a screen builds ---------------- */

test("a sentence built around a number or a name is matched whole", () => {
  /* The dictionary is looked up with the WHOLE of what landed on screen, so a
     fragment like "ველოდებით — " could never match anything on its own. These
     have to be patterns, and the patterns have to be the shape of the finished
     line. */
  const cases = [
    "კომპიუტერმა ითამაშა [3–5] — ახლა შენი სვლაა",
    "სვლა არ გაქვს. აირჩიე ქვა (7 ასაღები, ბოლო 2 რჩება).",
    "მოწინააღმდეგე ×2 ფსონს გთავაზობს. თუ არ დათანხმდი, მატჩს კარგავ.",
    "შეთავაზება გაგზავნილია — ×4. ველოდებით პასუხს.",
    "ველოდებით — ლაშა, ნიკა",
    "ხელი აიღო — ლაშა",
    "ლაშა ჩამოვიდა",
    "ლაშა გავიდა",
  ];
  const missing = cases.filter((s) => !covered(s));
  assert.deepEqual(missing, [], "these reach a player as Georgian");
});

test("a sentence is translated whole or not at all", () => {
  /* Georgian glues its endings on, so swapping the words a sentence happens to
     contain produced things like "ცოცხალ Opponentსთან". The rule is written
     into i18n and this is here so nobody undoes it in the name of coverage. */
  const i18n = readFileSync(path.join(PUB, "js", "i18n.js"), "utf8");
  assert.match(i18n, /A sentence is translated whole or not at all/,
    "the rule is no longer written down");
  assert.equal(I18N.t("ეს წინადადება ლექსიკონში არ არის"),
    "ეს წინადადება ლექსიკონში არ არის",
    "an unknown sentence came back changed, which means words are being swapped");
});

/* ---------------- what a player wrote is not ours to change ---------------- */

test("a player's own name is never looked up in the dictionary", () => {
  /* The computer's opponents are called გიორგი, დათო and ნინო, and those ARE
     in the dictionary so an English reader can say them. Names go through the
     same walker as labels, so a real player with one of those names had it
     rewritten in front of them — and somebody who called themselves ერთი was
     shown to everybody as "One".

     `data-raw` is how an element says "this subtree is somebody's text, leave
     it alone". */
  const i18n = readFileSync(path.join(PUB, "js", "i18n.js"), "utf8");
  assert.match(i18n, /node\.hasAttribute\("data-raw"\)\) return;/,
    "nothing can opt out of being translated");
  // it has to be checked BEFORE the text node is touched, or it does nothing
  const at = i18n.indexOf("function walk(node)");
  const body = i18n.slice(at, i18n.indexOf("\n  }", at));
  assert.ok(body.indexOf("data-raw") < body.indexOf("nodeType === 3"),
    "the guard is read after the text has already been swapped");

  // and it is actually used where a real name is shown
  assert.match(readFileSync(path.join(PUB, "index.html"), "utf8"),
    /who\.setAttribute\("data-raw", ""\)/, "the leaderboard translates names");
  assert.match(readFileSync(path.join(PUB, "js", "versus.js"), "utf8"),
    /name\.setAttribute\("data-raw", ""\)/, "the match card translates names");
  for (const f of ["nardi.html", "damka.html"]) {
    const html = readFileSync(path.join(PUB, f), "utf8");
    assert.match(html, /<b id="meName" data-raw>/, f + " translates my own name");
    assert.match(html, /<b id="themName" data-raw>/, f + " translates their name");
  }
});
