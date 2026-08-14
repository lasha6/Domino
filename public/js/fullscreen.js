/* =====================================================================
   The whole screen, in a phone browser too.

   The Android app hides the system bars itself. A browser cannot — the URL
   bar and the navigation bar keep eating the edges of the table, and the page
   never scrolls, so Chrome never collapses the URL bar on its own. Fullscreen
   is only granted from a real user gesture, so we ask on the first tap.

   Everything here is best-effort: desktop, iPhone Safari and any browser that
   refuses simply carry on as before.
   ===================================================================== */
(function () {
  "use strict";

  // The app is already fullscreen, and a mouse means a desktop — leave both alone.
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (native || !touch) return;

  const el = document.documentElement;
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  function go() {
    if (isFull()) return;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    // navigationUI:"hide" asks Android to drop the navigation bar as well
    Promise.resolve(req.call(el, { navigationUI: "hide" }))
      .then(function () {
        // landscape-only design — hold the orientation while we have the chance
        if (screen.orientation && screen.orientation.lock) {
          Promise.resolve(screen.orientation.lock("landscape")).catch(function () {});
        }
      })
      .catch(function () {});   // refused (iPhone, or no gesture) — nothing to do
  }

  // One attempt per screen: asking again after the player deliberately left
  // fullscreen would fight them.
  document.addEventListener("pointerdown", function once() {
    document.removeEventListener("pointerdown", once, true);
    go();
  }, true);
})();
