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

  /* ---------------- achievements ----------------
     Goals along the way, not a checklist to grind. Deliberately mixed: a
     couple reachable in the first sitting, a few over a week, and two that
     take real playing — so there is always one within sight and one worth
     staying for. Each one reads its own number off the profile, so nothing
     needs counting separately and an old record scores correctly the first
     time it is looked at. */
  const level = (p) => levelFromXp(p.xp || 0).level;
  const st = (p, k) => ((p && p.stats) || {})[k] || 0;

  const ACHIEVEMENTS = [
    { id: "first-win",  title: "პირველი მოგება", hint: "მოიგე მატჩი",              goal: 1,    coins: 100, xp: 20,  value: (p) => st(p, "matchWins") },
    { id: "wins-10",    title: "ათი მოგება",     hint: "მოიგე 10 მატჩი",           goal: 10,   coins: 250, xp: 60,  value: (p) => st(p, "matchWins") },
    { id: "wins-50",    title: "ორმოცდაათი",     hint: "მოიგე 50 მატჩი",           goal: 50,   coins: 750, xp: 200, value: (p) => st(p, "matchWins") },
    { id: "hands-100",  title: "ასი ხელი",       hint: "ითამაშე 100 ხელი",         goal: 100,  coins: 300, xp: 80,  value: (p) => st(p, "hands") },
    { id: "big-hand",   title: "დიდი ხელი",      hint: "აიღე 30 ქულა ერთ ხელში",   goal: 30,   coins: 200, xp: 50,  value: (p) => st(p, "bestHand") },
    { id: "huge-hand",  title: "უზარმაზარი",     hint: "აიღე 50 ქულა ერთ ხელში",   goal: 50,   coins: 500, xp: 150, value: (p) => st(p, "bestHand") },
    { id: "streak-3",   title: "სამი ზედიზედ",   hint: "მოიგე 3 მატჩი ზედიზედ",    goal: 3,    coins: 300, xp: 80,  value: (p) => st(p, "bestStreak") },
    { id: "streak-5",   title: "ხუთი ზედიზედ",   hint: "მოიგე 5 მატჩი ზედიზედ",    goal: 5,    coins: 600, xp: 180, value: (p) => st(p, "bestStreak") },
    { id: "daily-7",    title: "მთელი კვირა",    hint: "შემოდი 7 დღე ზედიზედ",     goal: 7,    coins: 500, xp: 120, value: (p) => (p.daily && p.daily.streak) || 0 },
    { id: "points-1000",title: "ათასი ქულა",     hint: "დააგროვე 1000 ქულა",       goal: 1000, coins: 400, xp: 100, value: (p) => st(p, "points") },
    { id: "level-5",    title: "მეხუთე დონე",    hint: "მიაღწიე მე-5 დონეს",       goal: 5,    coins: 250, xp: 0,   value: level },
    { id: "level-10",   title: "მეათე დონე",     hint: "მიაღწიე მე-10 დონეს",      goal: 10,   coins: 600, xp: 0,   value: level },
  ];

  const byId = {};
  ACHIEVEMENTS.forEach((a) => { byId[a.id] = a; });

  // How each one is going, for the screen to draw.
  function achievementProgress(p) {
    return ACHIEVEMENTS.map((a) => {
      const have = Math.max(0, a.value(p) || 0);
      const done = !!(p.achievements && p.achievements[a.id]);
      return {
        id: a.id, title: a.title, hint: a.hint, goal: a.goal, coins: a.coins,
        have: Math.min(have, a.goal), done,
        percent: Math.min(100, Math.round(have / a.goal * 100)),
      };
    });
  }

  // Which ones have just been earned. Pure — the server does the awarding,
  // because a level nobody can check is only a number a player could type.
  function newlyEarned(p) {
    return ACHIEVEMENTS.filter((a) => !(p.achievements && p.achievements[a.id]) && (a.value(p) || 0) >= a.goal);
  }

  return {
    XP, DAILY, ACHIEVEMENTS, byId,
    xpForLevel, levelFromXp, handXp, matchXp,
    dailyState, dayNumber,
    achievementProgress, newlyEarned,
  };
});
