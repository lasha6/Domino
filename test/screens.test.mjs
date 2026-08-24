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
