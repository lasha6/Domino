/* =====================================================================
   The first match.

   Every one of these games is one somebody's grandfather taught them, and the
   app has no grandfather. What it has instead is three sentences per game,
   shown once, each one at the moment it is about to matter rather than all
   three on a wall of text before the first move — which is where instructions
   go to be skipped.

   Three is the whole budget, and it is a budget rather than a target: a
   fourth would turn the first match into a tutorial, and the games are not
   difficult. They are only unfamiliar in their details — which die a tap
   plays, that taking is compulsory, that the turn has to be handed over.

   Seen once is seen. Nothing here ever comes back on its own; `reset()` is
   there so a settings screen can offer them again, and until something calls
   it, a player who dismissed a hint has dismissed it for good.
   ===================================================================== */
(function (global) {
  "use strict";

  const KEY = "hintsSeen";
  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }
    catch (e) { return {}; }
  };
  const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };

  const seen = (id) => !!read()[id];
  const mark = (id) => { const o = read(); o[id] = 1; write(o); };

  let layer = null, showing = null, steps = [], game = "";

  function build() {
    layer = document.createElement("div");
    layer.className = "hintLayer";
    document.body.appendChild(layer);
  }

  function close() {
    if (!showing) return;
    const el = showing;
    showing = null;
    el.classList.remove("in");
    setTimeout(() => el.remove(), 220);
  }

  /* One at a time, anchored where the thing it is about actually is. A hint
     that floats in the middle of the screen is a dialog, and a dialog is the
     thing this is meant to avoid. */
  function put(step) {
    const at = typeof step.at === "function" ? step.at() : null;
    const b = document.createElement("div");
    b.className = "hintBubble";
    b.innerHTML = '<span class="hintTxt"></span><span class="hintOk">კარგი</span>';
    b.querySelector(".hintTxt").textContent = step.text;
    layer.appendChild(b);

    const r = at && at.getBoundingClientRect ? at.getBoundingClientRect() : null;
    if (r && r.width > 0 && r.height > 0) {
      const w = b.offsetWidth, h = b.offsetHeight;
      let x = r.left + r.width / 2 - w / 2;
      x = Math.max(8, Math.min(x, innerWidth - w - 8));
      /* Above if there is room above, below if there is room below, and
         whichever has more if there is room for neither — a bubble hanging
         off the bottom of a landscape phone is a hint nobody reads. Asking
         only "is the thing far enough down the screen" was not enough: on a
         board that fills the height, both answers are wrong and it has to be
         the LESS wrong one. */
      const roomAbove = r.top - 10, roomBelow = innerHeight - r.bottom - 10;
      const above = roomAbove >= h ? true : roomBelow >= h ? false : roomAbove > roomBelow;
      let y = above ? r.top - h - 10 : r.bottom + 10;
      y = Math.max(6, Math.min(y, innerHeight - h - 6));
      b.style.left = x + "px";
      b.style.top = y + "px";
      b.classList.toggle("below", !above);
    } else {
      /* No anchor is not no hint: it still has to be readable, so it goes
         where a caption goes. */
      b.style.left = "50%";
      b.style.top = "18%";
      b.style.transform = "translateX(-50%)";
      b.classList.add("loose");
    }

    showing = b;
    requestAnimationFrame(() => b.classList.add("in"));
    b.addEventListener("click", close);
    return b;
  }

  /* Called with every state the screen gets. Cheap on purpose: it does
     nothing at all once the three are gone. */
  function check(st) {
    if (showing || !steps.length) return;
    for (const step of steps) {
      const id = game + ":" + step.key;
      if (seen(id)) continue;
      let ready = false;
      try { ready = !step.when || !!step.when(st); } catch (e) { ready = false; }
      if (!ready) continue;
      mark(id);                       // shown is shown, even if they ignore it
      put(step);
      return;
    }
  }

  /* game   which game's hints these are, so two games never share one
     steps  at most three: { key, text, at(), when(st) } */
  function attach(o) {
    if (!layer) build();
    game = (o && o.game) || "";
    steps = ((o && o.steps) || []).slice(0, 3);
    return { check, close };
  }

  function reset(which) {
    const o = read();
    for (const k of Object.keys(o)) if (!which || k.indexOf(which + ":") === 0) delete o[k];
    write(o);
  }

  global.Hints = { attach, check, close, reset, seen };
})(typeof window !== "undefined" ? window : this);
