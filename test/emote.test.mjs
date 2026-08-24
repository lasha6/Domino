/* =====================================================================
   A word across the table.

   The interesting part of this feature is not the bubble, it is the refusal
   to carry a sentence. Everything checked here is a rule about what CANNOT
   happen: no free text over the wire, no unbounded stream, no phrase that
   only exists in one language, no button on a table where the only other
   players are the computer.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (...p) => readFileSync(path.join(ROOT, ...p), "utf8");
const server = read("server.js");
const emote = read("public", "js", "emote.js");
const i18n = read("public", "js", "i18n.js");
const base = read("public", "css", "base.css");

const ONLINE = ["online.html", "buraonline.html", "jokeronline.html",
                "nardi.html", "damka.html"];

/* The phrases as the client actually holds them. */
const SAYINGS = (() => {
  const at = emote.indexOf("const SAYINGS");
  const list = emote.slice(at, emote.indexOf("];", at));
  return [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
})();

test("what crosses the wire is a number, never a sentence", () => {
  /* This is the whole moderation policy. The moment the server accepts text
     it needs a filter, a report button and somebody to read the reports. */
  const at = server.indexOf('on("emote"');
  assert.notEqual(at, -1, "the server has no emote relay");
  const body = server.slice(at, server.indexOf("\n  });", at));
  assert.match(body, /const i = Math\.floor\(Number\(msg\.i\)\)/,
    "the payload is not reduced to a number");
  assert.doesNotMatch(body, /msg\.text|msg\.say|msg\.message/,
    "the server reads text off the wire");
  assert.match(body, /if \(!\(i >= 0 && i < EMOTE_COUNT\)\) return;/,
    "an index outside the list is not rejected");
});

test("the server and the client agree on how many phrases there are", () => {
  /* They are deliberately in two places — the words belong to the client, the
     bound belongs to the server — so the only thing that can drift is the
     count, and a drift means phrases that silently cannot be sent. */
  const m = server.match(/const EMOTE_COUNT = (\d+);/);
  assert.ok(m, "the server has no bound");
  assert.equal(SAYINGS.length, +m[1],
    `client has ${SAYINGS.length} phrases, server accepts ${m[1]}`);
});

test("one player cannot bury another's screen", () => {
  const at = server.indexOf('on("emote"');
  const body = server.slice(at, server.indexOf("\n  });", at));
  assert.match(body, /now - sent\[sent\.length - 1\] < EMOTE_GAP/, "there is no gap between phrases");
  assert.match(body, /sent\.length >= EMOTE_BURST/, "there is no ceiling on a burst");
  // and the limit is counted per PLAYER, not per table: one loud player must
  // not stop everybody else being heard
  assert.match(body, /p\.emotes = sent/, "the count is not kept on the player");
});

test("a phrase that was swallowed does not appear on the sender's own screen", () => {
  /* Otherwise the sender sees a conversation the others are not in. */
  const at = server.indexOf('on("emote"');
  const body = server.slice(at, server.indexOf("\n  });", at));
  assert.match(body, /room\.players\.forEach/, "it is not sent to the whole table");
  assert.match(body, /mine: q\.seat === p\.seat/, "the sender is not told which one is theirs");
});

test("the computer cannot say anything", () => {
  const at = server.indexOf('on("emote"');
  const body = server.slice(at, server.indexOf("\n  });", at));
  assert.match(body, /if \(!p \|\| p\.bot\) return;/, "a bot seat can emit phrases");
});

test("there is no keyboard anywhere in it", () => {
  assert.doesNotMatch(emote, /<input|<textarea|contentEditable|prompt\(/,
    "emote.js offers somewhere to type");
});

test("every phrase exists in both languages", () => {
  /* Georgian is the source and English is added in i18n.js. A phrase left out
     of the dictionary simply stays Georgian on an English screen — which is
     not a crash, and is exactly why it would never be noticed. */
  assert.equal(SAYINGS.length, 8, "there should be eight");
  for (const t of SAYINGS)
    assert.ok(i18n.includes('"' + t + '"'), "no English for: " + t);
  for (const t of ["ფრაზები", "გამორთე ფრაზები", "ჩართე ფრაზები"])
    assert.ok(i18n.includes('"' + t + '"'), "no English for: " + t);
});

test("nothing in the phrases is an emoji", () => {
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
  assert.doesNotMatch(emote, emoji, "emote.js carries an emoji");
});

test("a player can turn them off, and it is remembered", () => {
  /* Canned phrases are friendly until somebody uses them as a hammer, and the
     answer to that has to be on the screen of the person being hit. */
  assert.match(emote, /localStorage\.getItem\(OFF_KEY\)/, "the choice is not stored");
  // both directions: a muted player neither sends one nor is shown one
  const showAt = emote.indexOf("function show(seat, i, mine)");
  assert.match(emote.slice(showAt, showAt + 160), /if \(off\(\)/,
    "a muted player is still shown other people's phrases");
  const sendAt = emote.indexOf("function send(i)");
  assert.match(emote.slice(sendAt, sendAt + 160), /if \(off\(\)/,
    "a muted player still sends them");
});

test("the button is not offered at a table of computers", () => {
  assert.match(emote, /function live\(on\)/, "there is no way to hide the button");
  for (const f of ONLINE) {
    const html = read("public", f);
    assert.match(html, /src="js\/emote\.js"/, f + " never loads emote.js");
    assert.match(html, /Emote\.live\(\(st\.roster \|\| \[\]\)\.some\(\(p\) => !p\.me && !p\.bot\)\)/,
      f + " never asks whether anyone human is left");
  }
});

test("a bubble outlives the seat it points at", () => {
  /* Seat boxes are rebuilt on every state push. A bubble placed inside one
     would be swept away mid-sentence, which reads as a message that failed. */
  assert.match(emote, /layer\.appendChild\(b\)/, "the bubble is not put in its own layer");
  assert.match(base, /\.emLayer\{ position:fixed; inset:0;/, "there is no layer");
  assert.match(base, /\.emLayer\{[^}]*pointer-events:none/,
    "the layer would swallow taps meant for the board");
});

test("a hidden seat never pulls a phrase into the corner of the screen", () => {
  /* A display:none element measures as a zero-sized rectangle at 0,0. In 1v1
     every seat box on the card tables is hidden, so pointing at one would put
     the phrase in the top-left corner — which reads as a bug rather than as
     a phrase with nowhere to go. */
  assert.match(emote, /if \(r && r\.width > 0 && r\.height > 0\)/,
    "a zero-sized anchor is still used as an anchor");
  for (const f of ["buraonline.html", "jokeronline.html"]) {
    const html = read("public", f);
    assert.match(html, /box && box\.offsetParent/,
      f + ": a hidden seat box is handed over as an anchor");
  }
});

test("the tray closes when the board is touched", () => {
  /* An open tray over the board is a tray that gets tapped by somebody
     trying to play a piece. */
  assert.match(emote, /document\.addEventListener\("pointerdown"/,
    "nothing outside the tray closes it");
});

test("every screen points a phrase at the face that said it", () => {
  for (const f of ONLINE) {
    const html = read("public", f);
    assert.match(html, /emoteAnchor/, f + " has no anchor for a phrase");
    assert.match(html, /Emote\.mount\(\{ socket, anchor: emoteAnchor \}\)/,
      f + " does not hand the anchor over");
  }
});
