/* =====================================================================
   The rules window.

   It said "how we play" and explained only domino, while the front page
   offered three games. Nothing failed — a window is not code, and nobody
   notices a missing paragraph until a player goes looking for it.

   So the window is checked the way a reader would check it: every game the
   front page offers has a tab, every tab says something substantial, and every
   sentence in it can be read in English too.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const block = html.slice(html.indexOf("<!-- rules -->"), html.indexOf("<!-- promo code -->"));

const GAMES = ["Domino", "Bura", "Joker"];
const georgian = (s) => /[Ⴀ-ჿ]/.test(s);

// the text a reader actually sees, one node at a time, the way I18N sees it
function textNodes(s) {
  return [...new Set(s.split(/<[^>]+>/)
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t && georgian(t)))];
}

function paneOf(game) {
  const id = `id="rules${game}"`;
  const i = block.indexOf(id);
  assert.notEqual(i, -1, `there is a pane for ${game}`);
  const from = block.lastIndexOf("<div", i);
  const next = GAMES.map((g) => block.indexOf(`id="rules${g}"`))
    .filter((n) => n > i).sort((a, b) => a - b)[0];
  return block.slice(from, next === undefined ? block.indexOf("<button class=\"roomClose\"") : next);
}

/* The translator, given the little of a browser it uses. Same trick as
   i18n.test.mjs — the shipped file is read, not a copy of it. */
function loadI18N(lang) {
  const src = readFileSync(new URL("../public/js/i18n.js", import.meta.url), "utf8");
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

test("every game the front page offers has its own rules", () => {
  /* The front page lists the games it can start. Whatever is there has to be
     explained here — this is the check that would have caught ბურა and ჯოკერი
     going in with only domino written up. */
  const offered = [...html.matchAll(/chooseGame\('(\w+)'\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(offered)].sort(), ["bura", "domino", "joker"],
    "the front page offers exactly these three");
  for (const g of GAMES) {
    assert.ok(block.includes(`id="rules${g}"`), `${g} has a pane`);
    assert.ok(block.includes(`showRules('${g.toLowerCase()}')`), `${g} has a tab that opens it`);
  }
});

test("each set of rules says something worth reading", () => {
  for (const g of GAMES) {
    const pane = paneOf(g);
    const paras = pane.match(/<p[ >]/g) || [];
    assert.ok(paras.length >= 8, `${g} has ${paras.length} paragraphs, expected at least eight`);
    // counted in letters, not words: Georgian says more per word than English
    const size = textNodes(pane).join(" ").length;
    assert.ok(size >= 700, `${g} runs to ${size} letters, expected at least 700`);
    assert.ok(/<b>/.test(pane), `${g} names what each paragraph is about`);
  }
});

test("the rules of one game are not the rules of another", () => {
  // a copy-paste would pass every count above and still be wrong
  const [d, b, j] = GAMES.map((g) => textNodes(paneOf(g)).join(" "));
  assert.notEqual(d, b);
  assert.notEqual(b, j);
  assert.ok(d.includes("სტავკა"), "domino explains the spinner");
  assert.ok(b.includes("კოზირი"), "ბურა explains the trump");
  assert.ok(b.includes("ყაიმი"), "ბურა explains the draw");
  assert.ok(j.includes("ხიშტი"), "ჯოკერი explains the whist");
  assert.ok(j.includes("ბიდი"), "ჯოკერი explains the bidding");
});

test("the two rules that are easiest to confuse are both written down", () => {
  /* The ten sits above the jack in ბურა and below it in ჯოკერი. It is the one
     thing a player coming from the other game will get wrong, so both panes say
     it, and each says which way round it is. */
  const b = textNodes(paneOf("Bura")).join(" ");
  const j = textNodes(paneOf("Joker")).join(" ");
  assert.ok(/ათიანი ჯოტზე მაღლა/.test(b), "ბურა: the ten is above the jack");
  assert.ok(/ათიანი ჯოტზე დაბლა/.test(j), "ჯოკერი: the ten is below the jack");
});

test("every sentence in the window can be read in English", () => {
  const en = loadI18N("en");
  const left = textNodes(block).filter((t) => en.t(t) === t);
  assert.deepEqual(left, [], "these have no English yet");
});

test("and in Georgian nothing is touched", () => {
  const ka = loadI18N("ka");
  for (const t of textNodes(block)) assert.equal(ka.t(t), t);
});
