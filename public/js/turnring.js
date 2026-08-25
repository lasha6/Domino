/* =====================================================================
   Whose turn it is, drawn as a ring that empties.

   The screens said it in words — "შენი სვლა", and a number counting down in a
   pill. Words have to be read; a ring that is draining beside somebody's face
   is seen without looking at it, which is what a player wants while they are
   looking at the board.

   It is a CSS animation and not a ticking timer, for one reason: the server
   sends `moveLeft` when something HAPPENS, not once a second, so anything
   driven off state pushes would jump rather than sweep. The duration is the
   whole clock, and a player who arrives in the middle of somebody else's turn
   gets a NEGATIVE delay — which starts an animation partway through, exactly
   where the clock already is.
   ===================================================================== */
(function (global) {
  "use strict";

  /* Restart an animation. Removing the class and adding it back in the same
     frame does nothing at all — the browser never sees the "off" state — so
     the layout has to be read in between to force it. */
  function restart(el) {
    el.classList.remove("ticking");
    void el.offsetWidth;
    el.classList.add("ticking");
  }

  /* el       the thing wearing the ring (the avatar, or the seat plate)
     active   is it this player's turn
     left     seconds still on their clock, or null if there is no clock
     total    seconds the clock started at
     spending true once the turn clock is gone and the BANK is going — the
              ring turns red, because from here on it costs them the match */
  function set(el, active, left, total, spending) {
    if (!el) return;
    el.classList.toggle("onTurn", !!active);
    el.classList.toggle("spending", !!(active && spending));
    if (!active || !total || left == null) {
      el.classList.remove("ticking");
      el.style.removeProperty("--tSec");
      el.style.removeProperty("--tFrom");
      return;
    }
    const secs = Math.max(1, +total);
    const spent = Math.max(0, secs - Math.max(0, +left));
    const key = secs + ":" + Math.round(+left);
    /* Only restart when this is a NEW turn. A state push in the middle of one
       would otherwise send the ring back to full every time anything happened
       on the board. */
    if (el.dataset.ring === key) return;
    // a turn that is merely ticking down sends the same key less often than
    // once a second, so a change of second alone must not restart it either
    const wasSpent = +(el.dataset.spent || -1);
    el.dataset.ring = key;
    el.style.setProperty("--tSec", secs + "s");
    el.style.setProperty("--tFrom", "-" + spent + "s");
    if (wasSpent < 0 || spent < wasSpent) restart(el);   // a fresh turn, not a tick
    el.dataset.spent = spent;
  }

  /* Nobody's turn any more: the match is over, or paused. */
  function clear(el) {
    if (!el) return;
    el.classList.remove("onTurn", "ticking", "spending");
    delete el.dataset.ring;
    delete el.dataset.spent;
  }

  global.TurnRing = { set, clear };
})(typeof window !== "undefined" ? window : this);
