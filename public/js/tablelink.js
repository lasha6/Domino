/* =====================================================================
   Which screen a table is played on.

   A friend's code is four letters and says nothing about which game it
   belongs to. The lobby used to guess from which friend window it was typed
   into — and დამკა has no window of its own, it lives in the ნარდი room, so
   a დამკა code went to the ნარდი screen. The server now says what a table is
   (`peekTable` → `tableInfo`, and `wrongTable` for a screen that guessed
   wrong); this is the one place that turns that answer into an address.

   Every parameter here is one the screen itself reads from its address, so
   the screen opens already shaped like the table it is joining — and when it
   asks to be seated, what it says about itself matches what the table is.
   ===================================================================== */
(function (global) {
  "use strict";

  function screenFor(t) {
    const q = new URLSearchParams();
    let page;
    switch (t.game) {
      case "bura":
        page = "buraonline.html";
        q.set("size", t.size === 4 ? "4" : "2");
        if (t.variant === "3") q.set("variant", "3");
        if (t.target) q.set("target", t.target);
        break;
      case "joker":
        page = "jokeronline.html";
        if (t.variant === "nines") q.set("v", "nines");
        if (t.teams) q.set("teams", "1");
        break;
      case "nardi":
        page = "nardi.html";
        q.set("v", t.variant === "short" ? "short" : "long");
        if (t.target) q.set("target", t.target);
        break;
      case "damka":
        page = "damka.html";
        break;
      default:
        page = "online.html";
        q.set("size", t.size === 4 ? "4" : "2");
        if (t.target) q.set("target", t.target);
    }
    q.set("mode", "join");
    q.set("code", String(t.code || "").toUpperCase());
    return page + "?" + q.toString();
  }

  /* A screen that was sent to the wrong table goes to the right one — once.
     If it is told again after that, something disagrees about what the table
     is, and bouncing between two screens for ever is the worst answer there
     is; the caller shows the error instead. */
  function redirectOnce(t) {
    const here = new URLSearchParams(global.location.search);
    if (here.get("moved") === "1") return false;
    const to = screenFor(t) + "&moved=1";
    global.location.replace(to);
    return true;
  }

  global.TableLink = { screenFor, redirectOnce };
})(typeof window !== "undefined" ? window : this);
