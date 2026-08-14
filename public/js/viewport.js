/* =====================================================================
   Real screen height.

   `100vh` lies inside Android's WebView — it reports the window without the
   system bars, so the bottom of the layout (our hand of tiles) fell off the
   screen. We measure what is actually visible and hand it to CSS as --appH.
   ===================================================================== */
(function () {
  "use strict";
  function set() {
    const vv = window.visualViewport;
    const h = (vv && vv.height) || window.innerHeight || document.documentElement.clientHeight;
    if (h) document.documentElement.style.setProperty("--appH", Math.round(h) + "px");
  }
  set();
  window.addEventListener("resize", set);
  window.addEventListener("orientationchange", function () { setTimeout(set, 150); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", set);
    window.visualViewport.addEventListener("scroll", set);
  }
  // Belt and braces: some WebViews resize without firing an event, so watch the
  // element itself too.
  if (window.ResizeObserver) new ResizeObserver(set).observe(document.documentElement);
  // and the WebView sometimes settles a moment after load
  window.addEventListener("load", function () { setTimeout(set, 60); setTimeout(set, 400); });
})();
