/* =====================================================================
   Levels, experience and streaks.

   Kept in its own file, and shared by the server and the browser exactly the
   way the game engine is — so the bar the player watches fill and the number
   the server records can never disagree.

   The server is what actually awards anything. The browser uses this only to
   draw the same picture.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Progress = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------- levels ----------------
     The climb gets longer, but never steep enough to feel stuck: level 2 is
     four hands away, level 10 about an evening, and it keeps going. */
  const BASE = 120, GROWTH = 40;

  function xpForLevel(level) {          // xp needed to leave `level` behind
    return BASE + (Math.max(1, level) - 1) * GROWTH;
  }
  // Total xp is kept as one number, so a level is worked out rather than stored
  function levelFromXp(xp) {
    let level = 1, left = Math.max(0, xp | 0);
    while (left >= xpForLevel(level) && level < 999) { left -= xpForLevel(level); level++; }
    return { level, into: left, need: xpForLevel(level) };
  }

  /* ---------------- what earns experience ---------------- */
  const XP = {
    handPlayed: 2,          // just for turning up
    handWon: 10,
    matchWon: 60,
    perFivePoints: 1,       // 1 xp per 5 points scored, so a big hand shows
    dailyClaim: 15,
  };

  // Everything a finished hand is worth. `points` is what they scored in it.
  function handXp(won, points) {
    return XP.handPlayed + (won ? XP.handWon : 0) + Math.floor(Math.max(0, points) / 5) * XP.perFivePoints;
  }
  function matchXp(won) { return won ? XP.matchWon : 0; }

  /* ---------------- daily reward ----------------
     Seven days, then it starts over — but the streak itself keeps counting,
     so a long run is still something to protect. Missing a day resets it. */
  const DAILY = [50, 75, 100, 150, 200, 300, 500];

  // The day turns over in the timezone the server runs in — one line for
  // everybody, and nothing a player can move by changing their clock.
  const dayNumber = (t) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 86400000);

  // Returns what claiming right now would give, or why it cannot be claimed.
  function dailyState(daily, now) {
    const today = dayNumber(now == null ? Date.now() : now);
    const last = daily && daily.lastClaim != null ? dayNumber(daily.lastClaim) : null;
    if (last === today) {
      return { canClaim: false, streak: daily.streak || 1, reward: 0, day: ((daily.streak || 1) - 1) % 7 };
    }
    const continues = last != null && today - last === 1;
    const streak = continues ? (daily.streak || 0) + 1 : 1;
    return { canClaim: true, streak, reward: DAILY[(streak - 1) % 7], day: (streak - 1) % 7, broke: last != null && !continues };
  }

  return {
    XP, DAILY,
    xpForLevel, levelFromXp, handXp, matchXp,
    dailyState, dayNumber,
  };
});
