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

const GAMES = ["Domino", "Bura", "Joker", "Nardi", "Damka"];
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

test("every game the front page can start has its own rules", () => {
  /* Whatever the lobby can start has to be explained here. This is the check
     that would have caught ბურა and ჯოკერი going in with only domino
     written up, and it caught ნარდი and დამკა doing the same.

     Two ways in are counted: a card on the front page, and a screen the lobby
     sends you straight to — დამკა has no card of its own, it lives in the
     ნარდი room, and it still needs its rules. */
  const cards = [...html.matchAll(/chooseGame\('(\w+)'\)/g)].map((m) => m[1]);
  /* Every screen the lobby names, however it gets there — a card, a direct
     link, or a name held in one of its maps. Scraping only `location.href=`
     missed დამკა the moment its button went through a function. */
  const screens = [...html.matchAll(/["'](\w+)\.html/g)].map((m) => m[1]);
  const startable = new Set([...cards, ...screens]
    .filter((n) => !["index", "online", "buraonline", "jokeronline", "game",
                     // not a game: the policy every ad programme asks to see
                     "privacy"].includes(n)));
  assert.ok(startable.size >= 5, `the lobby starts ${[...startable].join(", ")}`);
  for (const g of startable) {
    const tab = "rules" + g[0].toUpperCase() + g.slice(1);
    assert.ok(block.includes(`id="${tab}"`), `${g} can be started but has no rules`);
  }
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
  const n = textNodes(paneOf("Nardi")).join(" ");
  const k = textNodes(paneOf("Damka")).join(" ");
  assert.ok(n.includes("მარსი"), "ნარდი explains the gammon");
  assert.ok(n.includes("დუბლი"), "ნარდი explains what a double is worth");
  assert.ok(k.includes("დამკა"), "დამკა explains the crowning");
  assert.ok(k.includes("სავალდებულ"), "დამკა says taking is compulsory");
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
