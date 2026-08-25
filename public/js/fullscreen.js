/* =====================================================================
   The whole screen, in a phone browser too.

   The Android app hides the system bars itself. A browser cannot — the URL bar
   and the navigation bar keep eating the edges of the table, and the page never
   scrolls, so Chrome never collapses the URL bar on its own.

   Fullscreen is only granted while the browser considers a real user action to
   be in progress. On Android that window opens when the finger is LIFTED, not
   when it lands: a touch that has only started might still turn into a scroll,
   so Chrome withholds permission until `click` / `touchend`. Asking on
   `pointerdown` is refused without a word — which is what happened first.

   Browsers still refuse for reasons we cannot see, so there is a fallback: a
   small corner button appears whenever we are not fullscreen and the automatic
   attempt did not take. It doubles as the way back in after the player leaves
   fullscreen themselves.

   iPhone is a different problem and gets a different answer. Every browser on
   iOS is Safari underneath — Chrome and Firefox there are the same engine with
   a different badge — so when Safari will not do something, none of them will,
   and the Fullscreen API is one of those things: on iPhone it is either absent
   or behind a setting the player has to have found for themselves. There is
   nothing to ask for and no button worth showing.

   What DOES work on iPhone is "Add to Home Screen": launched from the icon,
   the page runs with no address bar and no toolbar, which is the fullscreen
   the player was after. So on iPhone this file stops trying and says that
   instead — once, and never again after they have read it.
   ===================================================================== */
(function () {
  "use strict";

  // The app already runs fullscreen, and a mouse means a desktop — leave both alone.
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (native || !touch) return;

  /* Already launched from the home screen: there are no bars to be rid of.
     iOS answers `navigator.standalone`; everyone else answers the media
     query, and both are asked because neither covers the other. */
  const standalone = !!(window.navigator.standalone) ||
    (window.matchMedia && (window.matchMedia("(display-mode: standalone)").matches ||
                           window.matchMedia("(display-mode: fullscreen)").matches));
  if (standalone) return;

  const nav = window.navigator;
  const iOS = /iPad|iPhone|iPod/.test(nav.userAgent) ||
    // an iPad on iPadOS 13+ says it is a Mac, and only the touch points give it away
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);

  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (iOS || !req) { if (iOS) tellIPhone(); return; }

  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  /* ---------- the corner button ---------- */
  let btn = null;
  function button() {
    if (btn) return btn;
    const css = document.createElement("style");
    css.textContent =
      ".fsbtn{position:fixed;z-index:60;right:calc(6px + var(--safeR,0px));" +
      "bottom:calc(6px + var(--safeB,0px));width:34px;height:34px;padding:0;" +
      "display:none;place-items:center;border-radius:9px;cursor:pointer;" +
      "border:1px solid var(--brass-dim,#8a6524);background:rgba(4,26,14,.62);" +
      "color:var(--brass-lit,#f2cd7e);font:16px/1 var(--font-ui,sans-serif);" +
      "-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}" +
      ".fsbtn.show{display:grid;}";
    document.head.appendChild(css);

    btn = document.createElement("button");
    btn.className = "fsbtn";
    btn.type = "button";
    btn.textContent = "⛶";
    btn.title = "სრული ეკრანი";
    btn.setAttribute("aria-label", "სრული ეკრანი");
    btn.addEventListener("click", function (ev) { ev.stopPropagation(); ask(true); });
    document.body.appendChild(btn);
    return btn;
  }
  function showButton(on) {
    const b = button();
    b.classList.toggle("show", !!on);
  }

  /* ---------- asking ---------- */
  let tries = 0;
  const EVENTS = ["click", "touchend"];   // the events that open the permission window
  const listen = (on) => EVENTS.forEach((n) =>
    document[(on ? "add" : "remove") + "EventListener"](n, auto, true));

  function ask(manual) {
    if (isFull()) return;
    // navigationUI:"hide" asks Android to drop the navigation bar as well
    Promise.resolve(req.call(el, { navigationUI: "hide" }))
      .then(function () {
        // landscape-only design — hold the orientation while we are allowed to
        if (screen.orientation && screen.orientation.lock) {
          Promise.resolve(screen.orientation.lock("landscape")).catch(function () {});
        }
      })
      .catch(function () { if (manual) showButton(true); });
  }

  function auto() {
    if (isFull()) { listen(false); return; }
    ask(false);
    // A few quiet attempts, then hand the player the button instead of nagging.
    if (++tries >= 3) { listen(false); setTimeout(function () { if (!isFull()) showButton(true); }, 300); }
  }

  listen(true);
  document.addEventListener("fullscreenchange", function () {
    showButton(!isFull());          // gone while fullscreen, back if they leave it
    if (isFull()) listen(false);
  });

  /* ---------- the one thing that works on iPhone ----------

     Said on the front page only. A note like this in the middle of a hand is
     an interruption, and by then it is too late to act on anyway. Said once:
     a player who has read it and decided not to bother should not be asked
     again every time they open the game. */
  function tellIPhone() {
    const KEY = "iosHomeHint";
    try { if (localStorage.getItem(KEY)) return; } catch (e) {}
    const path = location.pathname.replace(/\/+$/, "");
    const lobby = path === "" || /\/index\.html$/.test(path);
    if (!lobby) return;

    const css = document.createElement("style");
    css.textContent =
      /* A width, not a max-width: a flex box with neither shrinks to fit its
         longest WORD, and the note came out as a narrow column of wrapped
         Georgian with the button squeezed alongside it. */
      ".iosTip{position:fixed;z-index:62;left:50%;transform:translateX(-50%);" +
      "bottom:calc(10px + var(--safeB,0px));width:min(92vw,430px);" +
      "box-sizing:border-box;" +
      "display:flex;align-items:center;gap:10px;padding:9px 12px;" +
      "border-radius:12px;border:1px solid var(--brass-dim,#8a6524);" +
      "background:rgba(6,30,17,.96);color:var(--cream,#f6efdd);" +
      "font:13px/1.35 var(--font-ui,sans-serif);" +
      "box-shadow:0 8px 26px rgba(0,0,0,.5);}" +
      ".iosTip b{color:var(--brass-lit,#f2cd7e);font-weight:700;}" +
      ".iosTip span{flex:1 1 auto;min-width:0;}" +
      ".iosTip button{flex:0 0 auto;margin-left:auto;border:0;background:transparent;cursor:pointer;" +
      "color:var(--brass-lit,#f2cd7e);font:700 12px/1 var(--font-ui,sans-serif);" +
      "padding:6px 4px;}";
    document.head.appendChild(css);

    const tip = document.createElement("div");
    tip.className = "iosTip";
    const text = document.createElement("span");
    /* Written as the two taps it actually is, in the order they happen. */
    text.innerHTML = "სრული ეკრანი iPhone-ზე: " +
      "<b>გადაგზავნა</b> → " +
      "<b>მთავარ ეკრანზე დამატება</b>";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = "გავიგე";
    ok.addEventListener("click", function () {
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      tip.remove();
    });
    tip.appendChild(text); tip.appendChild(ok);

    const put = function () { document.body.appendChild(tip); };
    if (document.body) put();
    else document.addEventListener("DOMContentLoaded", put);
  }
})();
