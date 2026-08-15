/* =====================================================================
   Where the game server lives.

   In a browser the page is already served by the server, so same-origin ("")
   is right and keeps working on localhost, the LAN and the deployed site.
   Inside the Android app the pages come from files packed in the APK — the
   WebView serves them from https://localhost, which looks like a real site
   but has no server behind it, so the address has to be given explicitly.
   ===================================================================== */
(function (global) {
  "use strict";

  const HOSTED = "https://domino-z4zg.onrender.com";

  // Capacitor injects this bridge before any page script runs.
  const native = !!(global.Capacitor && global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform());

  // Belt and braces: opened straight from a file, or the WebView's own
  // portless localhost origin (the dev server always carries a port).
  const fromFile = location.protocol === "file:";
  const webViewHost = location.hostname === "localhost" && !location.port;

  global.SERVER_URL = (native || fromFile || webViewHost) ? HOSTED : "";
})(window);
