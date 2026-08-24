/* =====================================================================
   The phone's own answer.

   A tap that is felt as well as seen is the cheapest quality there is on a
   handset: a die that lands with a knock, a turn that arrives with a nudge,
   a piece taken with a short double. None of it is information — everything
   here is also on the screen — which is exactly why it may be missed, and why
   it follows the SOUND switch rather than having a switch of its own: a
   player who has silenced the game has said what they want.

   Nothing here is allowed to throw. `navigator.vibrate` is missing on
   desktop, refused in a background tab, and quietly ignored on iOS Safari;
   none of those is a reason for a game to stop.
   ===================================================================== */
(function (global) {
  "use strict";

  const nav = global.navigator;
  const can = !!(nav && typeof nav.vibrate === "function");

  /* Short, and shorter than you think. Anything past about 40ms on a phone
     stops reading as a knock and starts reading as a fault. */
  const P = {
    tap:      [8],                 // something was pressed
    place:    [14],                // a piece set down
    dice:     [10, 40, 18],        // two cubes landing, a beat apart
    turn:     [12, 60, 12],        // your move — a nudge, not an alarm
    take:     [18, 45, 26],        // a piece taken, a checker hit
    warn:     [30, 70, 30],        // the clock is about to bite
    win:      [22, 60, 22, 60, 46],
    lose:     [60],
  };

  /* Silenced by the sound switch, because that is the switch a player who
     wants to be left alone will have already reached for. */
  const muted = () => !!(global.Sound && global.Sound.muted && global.Sound.muted());

  function buzz(name) {
    if (!can || muted()) return false;
    const pattern = P[name];
    if (!pattern) return false;
    try { return nav.vibrate(pattern); }
    catch (e) { return false; }     // a game never stops for a missing motor
  }

  /* Every event in the game already plays a sound, so the sound is where the
     buzz is hung. Wiring it at the call sites instead would have meant finding
     and editing every one of them in five screens, and missing one would be
     invisible — a game that buzzes for four things out of five feels broken in
     a way nobody can name. */
  const FOR_SOUND = {
    place: "place", card: "place", draw: "tap", lay: "place",
    diceLand: "dice", diceDouble: "dice",
    turn: "turn", warn: "warn", boom: "warn", tick: null,
    win: "win", lose: "lose", handWin: "tap", handLose: "tap",
    score: "tap", tap: "tap", deal: "tap", boardOpen: "place",
  };

  let attached = false;
  function attach() {
    if (attached || !can || !global.Sound || typeof global.Sound.play !== "function") return false;
    attached = true;
    const play = global.Sound.play.bind(global.Sound);
    global.Sound.play = function (name) {
      const pattern = FOR_SOUND[name];
      if (pattern) buzz(pattern);
      return play.apply(null, arguments);
    };
    return true;
  }
  attach();

  global.Haptic = {
    tap: buzz,          // named for how it is called, not for what it does
    buzz,
    attach,
    available: can,
    patterns: P,
  };
})(typeof window !== "undefined" ? window : this);
