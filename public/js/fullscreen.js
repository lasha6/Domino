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

   All of this is best-effort — desktop and the packaged app skip it entirely,
   and a browser without the API (iPhone Safari) simply carries on.
   ===================================================================== */
(function () {
  "use strict";

  // The app already runs fullscreen, and a mouse means a desktop — leave both alone.
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (native || !touch) return;

  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;

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
})();
