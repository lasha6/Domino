/* =====================================================================
   Who else is at the table.

   The row above the board used to be three things that did not belong
   together: a label, a line of loose face-down pieces, and a sentence
   saying whose turn it was. It sat left-aligned with the sentence drifting
   off to the right, and on the ozi table the opponent's dominoes came out
   as six small green squares — because the back of a tile was stained the
   colour of the cloth it was lying on.

   What is checked here is what the new one must never do: put a name into
   markup, invent a hand longer than the row can hold, light two plates at
   once, or go back to writing the turn out in words.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (...p) => readFileSync(path.join(ROOT, ...p), "utf8");
const SRC = read("public", "js", "foes.js");

/* Enough of a document to build a row in, and — the point of doing it this
   way rather than reading the source — a `textContent` that really is text
   and an `innerHTML` that really would be markup. */
function fakeDoc() {
  const node = (tag) => ({
    tag, className: "", children: [], attrs: {}, dataset: {},
    _text: "", _html: null,
    set textContent(v) { this._text = String(v); this.children = []; },
    get textContent() {
      return this._text + this.children.map((c) => c.textContent).join("");
    },
    set innerHTML(v) { this._html = String(v); this.children = []; this._text = ""; },
    get innerHTML() { return this._html; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    get title() { return this.attrs.title; },
    set title(v) { this.attrs.title = v; },
  });
  return { createElement: node };
}

function build(who) {
  const g = { document: fakeDoc() };
  new Function("window", SRC).call(g, g);
  return { Foes: g.Foes, el: g.Foes.plate(who) };
}
const find = (el, cls) => {
  if (String(el.className).split(" ").includes(cls)) return el;
  for (const c of el.children) { const hit = find(c, cls); if (hit) return hit; }
  return null;
};

/* ---------------- a name is a name, not markup ---------------- */

test("a name is set as text and never as markup", () => {
  /* It used to be concatenated into an innerHTML string, and it is typed by
     a stranger sitting at the same table. Fourteen characters is plenty. */
  const nasty = '<img src=x onerror="a">';
  const { el } = build({ name: nasty, count: 3 });
  const nm = find(el, "nm");
  assert.equal(nm.textContent, nasty, "the name did not survive as itself");
  assert.equal(nm.innerHTML, null, "the name went in as markup");
  assert.match(SRC, /nm\.textContent = name;/, "the name is not set as text");
});

test("a name is never translated either", () => {
  /* A player called "ერთი" was being shown to everybody as "One". */
  const { el } = build({ name: "ერთი", count: 1 });
  assert.equal(find(el, "nm").attrs["data-raw"], "1", "the dictionary can reach the name");
});

test("the initial is the first letter of the name that is shown", () => {
  assert.equal(find(build({ name: "გიორგი" }).el, "ini").textContent, "გ");
  assert.equal(find(build({ name: "  Lasha " }).el, "ini").textContent, "L");
  assert.equal(find(build({ name: "" }).el, "ini").textContent, "?", "an empty name has no initial");
  assert.equal(find(build({}).el, "ini").textContent, "?", "a missing name threw or blanked");
});

/* ---------------- the hand ---------------- */

test("the fan stops before it becomes a smear, and the count still tells the truth", () => {
  const { Foes, el } = build({ name: "დათო", count: 14 });
  assert.equal(find(el, "fan").children.length, Foes.MOST, "the fan grew past its limit");
  assert.equal(find(el, "cnt").textContent, "14", "the count was capped along with the fan");
});

test("an empty hand shows neither fan nor number", () => {
  /* Nought pieces and a "0" beside them is two ways of saying nothing. */
  const { el } = build({ name: "ნინო", count: 0 });
  assert.equal(find(el, "fan"), null);
  assert.equal(find(el, "cnt"), null);
});

test("a hand turned face up replaces the fan rather than joining it", () => {
  /* At the end of a round the tiles are what the score is made of. */
  const { el } = build({ name: "ლაშა", count: 5, show: "<div class='domino'></div>" });
  assert.equal(find(el, "fan"), null, "the backs are still there behind the faces");
  assert.ok(find(el, "up"), "the revealed hand was not drawn");
});

/* ---------------- whose move it is ---------------- */

test("the plate of whoever is to move is the one that is lit", () => {
  assert.ok(build({ name: "ა", turn: true }).el.className.includes("on"));
  assert.ok(!build({ name: "ა", turn: false }).el.className.includes("on"));
});

test("a partner, a computer and somebody who dropped each look different", () => {
  assert.ok(build({ name: "ა", mate: true }).el.className.includes("mate"));
  assert.ok(build({ name: "ა", bot: true }).el.className.includes("bot"));
  assert.ok(build({ name: "ა", away: true }).el.className.includes("away"));
});

test("the bank is shown only when there is one to show", () => {
  assert.equal(find(build({ name: "ა" }).el, "bank"), null, "an empty bank took a place on the plate");
  assert.equal(find(build({ name: "ა", bank: "⏱ 1:12" }).el, "bank").textContent, "⏱ 1:12");
});

/* ---------------- and the screens ---------------- */

const screens = ["game.html", "online.html", "bura.html", "buraonline.html",
                 "joker.html", "jokeronline.html"];

test("no screen writes out whose turn it is any more", () => {
  /* The lit plate says it. A sentence saying "your turn — pick a tile" is
     the screen telling a player something they are already looking at, and
     it cost a whole line on a landscape phone to do it. */
  const said = [];
  for (const f of screens) {
    const src = read("public", f);
    for (const m of src.matchAll(/setMsg\(\s*"([^"]*)"/g))
      if (/შენი სვლაა|კომპიუტერის სვლაა|მოწინააღმდეგის სვლა/.test(m[1]))
        said.push(f + ": " + m[1]);
  }
  assert.deepEqual(said, [], "these write the turn out in words");
});

test("every screen that has an opponent strip draws it from the one place", () => {
  for (const f of ["game.html", "online.html", "bura.html", "buraonline.html"]) {
    const src = read("public", f);
    assert.match(src, /js\/foes\.js/, f + " does not load the shared row");
    assert.match(src, /Foes\.paint\(/, f + " builds its own opponents again");
  }
});

test("a message that says nothing takes up no room", () => {
  const css = read("public", "css", "table.css");
  assert.match(css, /\.msg:empty\{\s*display:none;\s*\}/,
    "an empty message still reserves a line");
  assert.match(css, /\.statusrow\{[^}]*justify-content:center/,
    "the row is not centred");
});

/* ---------------- the thing that started it ---------------- */

test("face down is wood, not the colour of the cloth", () => {
  /* The tile backs were baize-stained: a green tile on a green table, which
     is why the opponent's hand read as six small green squares with no
     domino in them anywhere. The cards had it right; the tiles now match. */
  const css = read("public", "css", "table.css");
  const at = css.indexOf(".domino.back{");
  assert.notEqual(at, -1, "there is no back");
  const body = css.slice(at, css.indexOf("}", at));
  assert.match(body, /var\(--wood/, "the back is not made of wood");
  assert.doesNotMatch(body, /#1d6b41|#0a3c22|#062a17/, "the back is stained baize again");
});

test("a tile you cannot play stays a tile", () => {
  /* At .42 opacity over green baize a bone domino borrows the baize and
     comes out pale green — the same reason the dice may never carry
     opacity. It goes into shadow instead, and stays opaque. */
  const css = read("public", "css", "table.css");
  const at = css.indexOf(".myhand .domino.dim{");
  assert.notEqual(at, -1);
  const body = css.slice(at, css.indexOf("}", at));
  assert.doesNotMatch(body, /opacity:/, "an unplayable tile goes see-through over the cloth");
  assert.match(body, /brightness\(/, "nothing marks it as unplayable at all");
});
