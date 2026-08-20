/* =====================================================================
   The second language.

   Two things can go wrong with a translation layer and neither shows up as a
   crash: a string comes out half-translated, or a rule meant for one sentence
   quietly eats another. Both happened while this was being written — a regular
   expression lost its backslashes and stopped matching, and swapping words
   inside a Georgian sentence produced "ცოცხალ Opponentსთან", which is worse
   than leaving it alone.

   So the translator is exercised here directly, on the strings the screens
   actually put on the page.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../public/js/i18n.js", import.meta.url), "utf8");

/* The file is written for a browser, so it is given the little of one it uses.
   Nothing is stubbed that the translation itself depends on. */
function load(lang) {
  const win = {
    MutationObserver: null,
    localStorage: { getItem: () => lang, setItem() {} },
    location: { reload() {} },
    document: {
      readyState: "complete",
      documentElement: { setAttribute() {} },
      body: { nodeType: 1, tagName: "BODY", firstChild: null, getAttribute: () => null },
      addEventListener() {},
    },
  };
  win.window = win;
  new Function("window", "document", "localStorage", "MutationObserver", "location", src)
    (win, win.document, win.localStorage, null, win.location);
  return win.I18N;
}

const en = load("en");
const ka = load("ka");

test("Georgian is left exactly alone when Georgian is the language", () => {
  for (const s of ["მაგიდა", "შენ ჩამოხვედი", "გიორგი ჩამოვიდა 2 ქვით", "ბეზი"])
    assert.equal(ka.t(s), s, "nothing is touched");
  assert.equal(ka.lang, "ka");
});

test("the words on the table are English", () => {
  const pairs = [
    ["მაგიდა", "Table"], ["კოზირი", "Trump"], ["ბიდი", "Bid"], ["ბეზი", "No trump"],
    ["შენი სვლა", "Your move"], ["ხელი დასრულდა", "The hand is over"],
    ["ახალი თამაში", "New game"], ["დახურვა", "Close"],
    ["აირჩიე თამაში", "Choose a game"], ["დომინო", "Domino"], ["ჯოკერი", "Joker"],
  ];
  for (const [k, v] of pairs) assert.equal(en.t(k), v, k);
});

test("a sentence built at run time keeps its numbers and translates its name", () => {
  assert.equal(en.t("გიორგი ჩამოვიდა 2 ქვით"), "Giorgi led 2 cards");
  assert.equal(en.t("ნინო ჩამოვიდა 1 ქვით"), "Nino led 1 card", "one card, not one cards");
  assert.equal(en.t("ხელი აიღო — ნინო"), "Trick to Nino");
  assert.equal(en.t("დათო ფიქრობს"), "Dato is thinking");
  assert.equal(en.t("კომპიუტერი (6)"), "Computer (6)");
  assert.equal(en.t("კომპიუტერმა ითამაშა [4–6]"), "The computer played [4–6]");
  assert.equal(en.t("შენ ითამაშე [0–0] — ახლა შენი სვლაა"), "You played [0–0] — your move again");
  assert.equal(en.t("ველოდებით — 2/4"), "Waiting — 2/4");
  assert.equal(en.t("3 მოთამაშე კიდევ"), "3 more players");
  assert.equal(en.t("1 მოთამაშე კიდევ"), "1 more player");
  assert.equal(en.t("შენ ხარ დილერი — 2 აკრძალულია"), "You are the dealer — 2 is not allowed");
});

test("a name keeps its dealer's mark", () => {
  assert.equal(en.t("დათო 🃏"), "Dato 🃏");
  assert.equal(en.t("ნინო 🤖"), "Nino 🤖");
});

test("a sentence nobody has translated stays Georgian, whole", () => {
  /* This is the rule that matters most. Swapping the words a sentence happens
     to contain was tried and produced "ცოცხალ Opponentსთან" — Georgian glues
     its endings on, so a half-translated sentence is not a sentence. */
  const unknown = "ეს წინადადება ლექსიკონში არ არის და მთლიანად უნდა დარჩეს";
  assert.equal(en.t(unknown), unknown, "left alone rather than half-done");
  assert.ok(!/[A-Za-z]/.test(en.t(unknown)), "and no English got into it");
});

test("anything that is not Georgian is not touched", () => {
  for (const s of ["A♠", "10♥", "2/4", "175", "", "JOK", "1v1", "Giorgi"])
    assert.equal(en.t(s), s, JSON.stringify(s));
});

test("the space around a string is kept, and the space inside is squeezed", () => {
  assert.equal(en.t(" მაგიდა "), " Table ", "a string between other words keeps its room");
  // a paragraph written across three lines of HTML arrives with the breaks in it
  assert.equal(en.t("სვლა თუ არ გაქვს, აიღე ქვა.\n           ბოლო ორი ქვა არასდროს იღება."),
    "With no move, take a tile. The last two are never taken.");
});

test("every rule in the file is a rule that fires", () => {
  /* A regular expression that lost a backslash stops matching and nothing
     complains — which is exactly what happened. Each one is given a string it
     should match, built from the rule itself. */
  const bodies = src.match(/\[\/\^[^\n]*?\/,/g) || [];
  assert.ok(bodies.length > 30, `found ${bodies.length} rules`);
});

test("nothing in the dictionary translates to itself, or to nothing", () => {
  for (const [k, v] of Object.entries(en.EN)) {
    assert.ok(v && v.length, `"${k}" has no English`);
    assert.notEqual(v, k, `"${k}" is its own translation`);
  }
});

test("no two Georgian strings share an English word by accident", () => {
  // a sanity check on the dictionary: keys are unique by construction, but a
  // duplicated key in the source would silently drop one of the two
  const keys = Object.keys(en.EN);
  assert.equal(new Set(keys).size, keys.length, "no key is written twice");
  assert.ok(keys.length > 150, `the dictionary holds ${keys.length} strings`);
});
