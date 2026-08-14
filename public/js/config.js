/* =====================================================================
   Where the game server lives.

   In a browser the page is already served by the server, so same-origin ("")
   is right and keeps working on localhost, the LAN and the deployed site.
   Inside the Android app the page is loaded from files packed in the APK, so
   there is no origin to talk to — it has to be told the address.
   ===================================================================== */
(function (global) {
  "use strict";
  const HOSTED = "https://domino-z4zg.onrender.com";
  const servedOverHttp = location.protocol === "http:" || location.protocol === "https:";
  global.SERVER_URL = servedOverHttp ? "" : HOSTED;
})(window);
