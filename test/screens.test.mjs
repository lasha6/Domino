/* =====================================================================
   Every screen's own script has to PARSE.

   This exists because of a real one that shipped. An edit was anchored on a
   line like

       if (st.hand) { ... }
       else paintWaiting(st);

   and a call was inserted between the two — which is a syntax error, so the
   browser threw away the WHOLE inline script. The socket was never created
   and the screen sat forever on "სერვერს ვუკავშირდები", looking exactly like
   a server that was down. Nothing else in the suite could see it: the server
   was fine, and every test here talks to the server.

   A parse is not a run — this cannot tell whether a screen behaves — but a
   file that does not parse cannot behave at all, and that is worth one cheap
   check over every screen in the app.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUB = fileURLToPath(new URL("../public", import.meta.url));
const screens = readdirSync(PUB).filter((f) => f.endsWith(".html"));

/* Inline blocks only: a <script src> is a file of its own and is checked
   below. `type="module"` is parsed as a module, the rest as a script. */
function blocks(html) {
  const out = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || "";
    if (/\bsrc=/.test(attrs)) continue;
    out.push({ code: m[2], module: /type\s*=\s*["']module["']/.test(attrs) });
  }
  return out;
}

test("every screen has at least one script, and all of them parse", () => {
  assert.ok(screens.length >= 8, "found " + screens.length + " screens");
  const broken = [];
  for (const f of screens) {
    const html = readFileSync(path.join(PUB, f), "utf8");
    const bs = blocks(html);
    bs.forEach((b, i) => {
      try {
        // a Function body is parsed as a script, which is what these are
        if (!b.module) new Function(b.code);
      } catch (e) {
        broken.push(`${f} block ${i + 1}: ${e.message}`);
      }
    });
  }
  assert.deepEqual(broken, [], "these screens would throw their script away");
});

test("every script file the screens load parses too", () => {
  const dir = path.join(PUB, "js");
  const broken = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) {
    if (f === "socket.io.min.js") continue;       // somebody else's, and minified
    const code = readFileSync(path.join(dir, f), "utf8");
    try { new Function(code); } catch (e) { broken.push(`${f}: ${e.message}`); }
  }
  assert.deepEqual(broken, [], "these files would not load");
});

test("no screen loads a script that is not there", () => {
  /* A missing src is silent in the same way: the page keeps going and the
     thing that file was for simply never happens. */
  const missing = [];
  for (const f of screens) {
    const html = readFileSync(path.join(PUB, f), "utf8");
    for (const m of html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) {
      const src = m[1];
      if (/^https?:|^\/\//.test(src)) continue;   // nothing external is expected
      try { readFileSync(path.join(PUB, src)); }
      catch { missing.push(`${f} → ${src}`); }
    }
  }
  assert.deepEqual(missing, [], "these files are asked for and are not there");
});

/* =====================================================================
   A parse is not a run — and this is the gap it leaves.

   A helper declared inside one block and called from another parses
   perfectly and then throws ReferenceError the first time a state arrives.
   That is the same failure as the syntax error above (a screen that never
   gets going) with none of the same warning, so the helpers every online
   screen shares get their nesting checked: the block a helper is declared in
   must be the block, or an ancestor of the block, that uses it.

   Depth alone is not enough and that was worth finding out — two sibling
   blocks are at the same depth and see nothing of each other, which is
   exactly the mistake this is here to stop.
   ===================================================================== */

/* Brace depth at every character, with strings and comments stepped over —
   a `{` inside a selector string would otherwise make the rest of the file
   look nested. */
function depths(src) {
  const out = new Int16Array(src.length);
  let d = 0, i = 0;
  const fill = (from, to, at) => { for (let k = from; k < to && k < src.length; k++) out[k] = at; };
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      const e = src.indexOf("\n", i); const to = e < 0 ? src.length : e;
      fill(i, to, d); i = to; continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i); const to = e < 0 ? src.length : e + 2;
      fill(i, to, d); i = to; continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; let k = i + 1;
      while (k < src.length && src[k] !== q) { if (src[k] === "\\") k++; k++; }
      fill(i, k + 1, d); i = k + 1; continue;
    }
    if (c === "{") d++;
    out[i] = d;
    if (c === "}") d--;
    i++;
  }
  return out;
}

/* The stretch of the file the block around `at` covers. */
function scopeOf(dep, at) {
  const d = dep[at];
  let start = at, end = at;
  while (start > 0 && dep[start - 1] >= d) start--;
  while (end < dep.length - 1 && dep[end + 1] >= d) end++;
  return [start, end];
}

test("a shared helper is never declared where the code using it cannot see it", () => {
  const ONLINE = ["online.html", "buraonline.html", "jokeronline.html",
                  "nardi.html", "damka.html"];
  for (const f of ONLINE) {
    const html = readFileSync(path.join(PUB, f), "utf8");
    const dep = depths(html);
    for (const name of ["wireEmotes", "emoteAnchor", "hints"]) {
      /* Plain string scanning, not a built regex: a backslash that has to
         survive a string literal on its way into RegExp is exactly what
         quietly turns a word boundary into a backspace character, and a test
         that matches nothing passes. */
      let decl = html.indexOf("function " + name);
      if (decl < 0) decl = html.indexOf("const " + name);
      assert.notEqual(decl, -1, f + " never declares " + name);
      const [from, to] = scopeOf(dep, decl);

      /* Every mention, not only the ones with a `(` after them — a helper
         handed over as a value (`anchor: emoteAnchor`) is used from wherever
         it is named, and that is the mention that must be able to see it. */
      let seen = 0, i = 0;
      for (;;) {
        i = html.indexOf(name, i);
        if (i < 0) break;
        const start = i;
        i += name.length;
        if (start === decl || start === decl + 9 || start === decl + 6) continue;
        const before = html.slice(Math.max(0, start - 10), start);
        if (before.endsWith("function ") || /[\w$]$/.test(before)) continue;
        seen++;
        assert.ok(start >= from && start <= to,
          f + ": " + name + " is declared in a block the mention at " + start +
          " cannot see");
      }
      assert.ok(seen > 0, f + " declares " + name + " and never uses it");
    }
  }
});
