/* =====================================================================
   What they just did.

   Against the computer it does not matter: the move happens while you are
   looking. Online it happens while you are not — you glance up from your own
   hand, or come back to the tab, and the board is simply DIFFERENT, with no
   way to tell whether one checker moved or three. That is the moment a player
   stops trusting the board and starts counting from scratch.

   So the change is remembered rather than animated. An animation is over by
   the time you look; a mark is still there. It is cleared when the player
   acts, because by then they have read it and it would only be in the way.

   The whole thing works off a DIFF of two board arrays. That is what makes it
   the same code for ნარდი and დამკა, whose boards have nothing else in
   common: the only question either screen asks is "which squares are not what
   they were", and the answer is a set of keys the screen paints however it
   likes.
   ===================================================================== */
(function (global) {
  "use strict";

  /* Boards are arrays of small numbers, so plain !== is enough. Anything the
     screen would rather compare its own way can be given as strings. */
  function changed(prev, next) {
    const out = [];
    if (!prev || !next) return out;
    const n = Math.max(prev.length, next.length);
    for (let i = 0; i < n; i++) if (prev[i] !== next[i]) out.push(i);
    return out;
  }

  /* One tracker per board. It holds the marks and nothing else — where they
     are drawn is the screen's business. */
  function track() {
    let keys = new Set();
    let seen = false;

    return {
      /* Take note of a change made by SOMEBODY ELSE. A player's own move needs
         no mark: they watched themselves make it, and marking it would say
         "look at this" about the one thing on the board they already know. */
      note(prev, next, mine) {
        /* The first board is not a change — there is nothing for it to have
           changed FROM. Somebody coming back to a match in progress would
           otherwise be shown the whole board as "what just happened", which
           is both wrong and the least useful moment to be shown it. */
        const firstEver = !seen;
        seen = true;
        if (firstEver) return this;
        if (mine) return this.clear();
        const list = changed(prev, next);
        // Nothing changed on the board (a pass, a roll, a scoreline) is not a
        // move, and must not wipe a mark the player has not looked at yet.
        if (!list.length) return this;
        keys = new Set(list.map(String));
        return this;
      },

      /* Straight from the screen: is this square part of what they did? */
      has(key) { return keys.has(String(key)); },

      /* Read once the player has acted on it. */
      clear() { keys = new Set(); return this; },

      get size() { return keys.size; },
      /* Only for the tests: has a board been through here yet. */
      get started() { return seen; },
      list() { return [...keys]; },
    };
  }

  global.LastMove = { track, changed };
})(typeof window !== "undefined" ? window : this);
