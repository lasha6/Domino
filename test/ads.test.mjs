/* =====================================================================
   Advertising — the groundwork, before any of it runs.

   Nothing shows an ad yet. What is built is the part that would be
   expensive to get wrong: where an ad tag is allowed to load.

   The account this would earn on is years old and already pays out. An ad
   tag loading while we test — a phone reloading the lobby forty times an
   afternoon, a headless browser taking screenshots — is invalid traffic on
   that account, and invalid traffic is answered by limiting or closing it.
   Not the game's earnings. All of them.

   So most of this file is about the word NO: every address a test can be
   run from must be refused, and refused with the switch on as well as off.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (...p) => readFileSync(path.join(ROOT, ...p), "utf8");
const SRC = read("public", "js", "ads.js");

/* A page at a given address. `live` turns the switch on so the refusals can
   be checked in the state that actually matters — with ads running. */
function page(where, o) {
  const opt = o || {};
  const src = opt.live ? SRC.replace("const LIVE = false;", "const LIVE = true;") : SRC;
  assert.ok(!opt.live || src.includes("const LIVE = true;"), "the switch could not be found");

  const added = [];
  const g = {
    location: Object.assign({ protocol: "https:", hostname: "", port: "" }, where),
    document: {
      createElement: () => ({ set src(v) { this._src = v; }, get src() { return this._src; } }),
      head: { appendChild: (el) => added.push(el.src) },
    },
    Capacitor: opt.native ? { isNativePlatform: () => true } : undefined,
  };
  new Function("window", src).call(g, g);
  g.added = added;
  return g;
}

const REAL = { hostname: "pips.ge", protocol: "https:", port: "" };

/* ---------------- every address we test from is refused ---------------- */

const OURS = [
  ["a browser on this machine", { hostname: "localhost" }],
  ["the same, by number", { hostname: "127.0.0.1" }],
  ["and over IPv6", { hostname: "::1" }],
  ["a page opened straight from a file", { hostname: "", protocol: "file:" }],
  ["a name a local network made up", { hostname: "my-pc.local" }],
  ["a phone on the same Wi-Fi", { hostname: "192.168.1.14" }],
  ["...a different Wi-Fi", { hostname: "10.0.0.5" }],
  ["...and the third private range", { hostname: "172.20.4.9" }],
  ["the static server the screenshots come from", { hostname: "pips.ge", port: "3099" }],
  ["the dev server", { hostname: "pips.ge", port: "3000" }],
];

for (const [what, where] of OURS) {
  test("no ads on " + what, () => {
    /* Checked with the switch ON. Off, everything refuses and the test would
       pass with the whole guard deleted. */
    const w = page(where, { live: true });
    assert.equal(w.Ads.available(), false, what + " is treated as somewhere to advertise");
    assert.equal(w.Ads.start(), false, "the tag was loaded anyway");
    assert.deepEqual(w.added, [], "Google's script was fetched from our own machine");
  });
}

test("no ads inside the Android app — that is AdMob's job", () => {
  /* Google's own guidance: a game inside an app served with the web tag is
     neither high-performing nor policy compliant. */
  const w = page(REAL, { live: true, native: true });
  assert.equal(w.Ads.available(), false);
  assert.deepEqual(w.added, []);
});

/* ---------------- and nothing runs before it is allowed to ---------------- */

test("the switch is off, and one place says so", () => {
  assert.match(SRC, /const LIVE = false;/,
    "advertising is switched on before Google has approved it");
  const w = page(REAL);
  assert.equal(w.Ads.available(), false, "a real address is serving ads already");
  assert.deepEqual(w.added, [], "Google's script is being fetched on the live site");
});

test("with the switch on, a real address is where an ad may load", () => {
  /* The other half: a guard that refuses everywhere is not a guard, it is an
     off switch, and it would hide the day the real site stopped working. */
  const w = page(REAL, { live: true });
  assert.equal(w.Ads.available(), true, "nowhere at all can show an ad");
  assert.equal(w.Ads.start(), true);
  assert.equal(w.added.length, 1, "the tag was not loaded");
  assert.match(w.added[0], /pagead2\.googlesyndication\.com/);
  assert.match(w.added[0], /client=ca-pub-7087199697693403/, "loaded under the wrong publisher");
});

test("a reward that cannot be shown is not a reward", () => {
  /* The caller has to be able to fall back on whatever the player could do
     before — so this resolves false rather than hanging or throwing. */
  const w = page({ hostname: "localhost" }, { live: true });
  return w.Ads.rewarded({ name: "coins-rescue" }).then((earned) => {
    assert.equal(earned, false, "a reward was granted with no ad shown");
  });
});

/* ---------------- the publisher id, in two files ---------------- */

test("ads.txt names the publisher, in the form buyers read", () => {
  /* The file is read by the buyers, not by us: a domain that does not name
     its publisher is unauthorised inventory and quietly stops being bid on. */
  const txt = read("public", "ads.txt");
  const lines = txt.split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  assert.equal(lines.length, 1, "expected exactly one seller, found " + lines.length);
  const parts = lines[0].split(",").map((x) => x.trim());
  assert.equal(parts[0], "google.com");
  assert.match(parts[1], /^pub-\d{16}$/, "that is not a publisher id: " + parts[1]);
  assert.equal(parts[2], "DIRECT");
  assert.equal(parts[3], "f08c47fec0942fa0", "Google's certification id is wrong");
});

test("the publisher id is the same number in both places", () => {
  /* One number, two files. They disagree silently: the tag keeps loading and
     the inventory simply stops being bought. */
  const txt = read("public", "ads.txt");
  const inTxt = (txt.match(/pub-\d{16}/) || [])[0];
  const inJs = (SRC.match(/pub-\d{16}/) || [])[0];
  assert.ok(inTxt && inJs, "a publisher id is missing");
  assert.equal(inJs, inTxt, "ads.js and ads.txt name different publishers");
});

/* ---------------- the policy ---------------- */

const priv = read("public", "privacy.html");
const lobby = read("public", "index.html");

test("there is a privacy policy, and it can be reached", () => {
  /* Every ad programme asks to see one, and a page nobody can open is not
     one. It lives in the menu beside everything else. */
  assert.match(lobby, /href='privacy\.html'|href="privacy\.html"/,
    "nothing in the app links to the privacy policy");
});

test("the policy is written in both languages, whole", () => {
  /* A policy is the one text where a half-translated sentence is worse than
     none, so both are written out and one is shown — and i18n is told to
     keep out. */
  assert.match(priv, /<section id="ka">/, "no Georgian");
  assert.match(priv, /<section id="en">/, "no English");
  assert.match(priv, /data-raw/, "i18n will translate the policy a line at a time");
  for (const [lang, words] of [["ka", ["Google", "cookie", "13"]],
                               ["en", ["Google", "cookie", "13"]]]) {
    const at = priv.indexOf('<section id="' + lang + '">');
    const body = priv.slice(at, priv.indexOf("</section>", at));
    for (const w of words)
      assert.ok(body.toLowerCase().includes(w.toLowerCase()),
        lang + " never mentions " + w);
  }
});

test("the policy says the things an ad programme requires it to say", () => {
  for (const phrase of ["policies.google.com/technologies/ads", "AdSense"]) {
    assert.ok(priv.includes(phrase), "the policy never mentions " + phrase);
  }
});

test("advertising cannot go live while the contact line is still a placeholder", () => {
  /* Preparing with a placeholder is fine — applying with one is not, and a
     policy with nobody to write to is the kind of thing that is noticed on
     the day it matters. So the two are tied together: the moment LIVE is
     turned on, this fails until a real address is in. */
  const unfilled = priv.includes("[საკონტაქტო ელფოსტა]") || priv.includes("[contact email]");
  const live = /const LIVE = true;/.test(SRC);
  assert.ok(!(live && unfilled),
    "ads are switched on while the privacy policy still says [contact email]");
  // and there is a contact section at all, placeholder or not
  assert.match(priv, /id="contactKa"/);
  assert.match(priv, /id="contactEn"/);
});
