/* =====================================================================
   The look a player bought.

   The server decides what they own; this only paints it. The choice is kept on
   the device as well so the table is already the right colour when a screen
   opens, before the server has answered — otherwise every game would start in
   the default green and change under the player a moment later.
   ===================================================================== */
(function (global) {
  "use strict";

  const KEY = "dominoLook";
  const P = global.Progress;

  function saved() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; }
    catch (e) { return {}; }
  }

  // Writes the item's colours onto the page as CSS variables. Everything else
  // is already built from those, so one assignment repaints every screen.
  function apply(look) {
    if (!P) return;
    const use = { ...P.DEFAULT_LOOK, ...(look || {}) };
    for (const kind of Object.keys(P.DEFAULT_LOOK)) {
      const item = P.shopById[use[kind]] || P.shopById[P.DEFAULT_LOOK[kind]];
      if (!item || !item.vars) continue;
      for (const [name, value] of Object.entries(item.vars))
        document.documentElement.style.setProperty(name, value);
    }
  }

  function remember(look) {
    if (!look) return;
    localStorage.setItem(KEY, JSON.stringify(look));
    apply(look);
  }

  apply(saved());        // paint immediately, before anything is asked of the server

  global.Look = { apply, remember, saved };
})(window);
