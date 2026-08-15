/* =====================================================================
   Levels, experience and the daily streak.

   Numbers a player will stare at for months, so they had better be right:
   a bar that fills wrong, or a streak that resets on a day they did play,
   is the kind of thing that makes someone stop trusting the game.
   ===================================================================== */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const P = require("../public/js/progress.js");

const DAY = 86400000;

test("levels start at one and never go backwards", () => {
  assert.equal(P.levelFromXp(0).level, 1);
  assert.equal(P.levelFromXp(-500).level, 1, "nonsense xp cannot demote anyone");
  let last = 0;
  for (let xp = 0; xp < 60000; xp += 137) {
    const l = P.levelFromXp(xp).level;
    assert.ok(l >= last, `level fell from ${last} to ${l} at ${xp} xp`);
    last = l;
  }
});

test("the bar always shows how far into a level you are", () => {
  for (let xp = 0; xp < 40000; xp += 97) {
    const { level, into, need } = P.levelFromXp(xp);
    assert.ok(into >= 0 && into < need, `${into}/${need} is not a fraction of a level at ${xp} xp`);
    assert.equal(need, P.xpForLevel(level), "the bar length matches what this level costs");
  }
});

test("each level costs a little more than the one before", () => {
  for (let l = 1; l < 50; l++)
    assert.ok(P.xpForLevel(l + 1) > P.xpForLevel(l), `level ${l + 1} is not dearer than ${l}`);
  // Level 2 should land around the end of a first won match — early enough to
  // feel like the game noticed, not so early that it means nothing.
  const aMatch = P.matchXp(true) + 3 * P.handXp(true, 15);
  assert.ok(aMatch > P.xpForLevel(1) * 0.6, "a won match is most of the way to level 2");
  assert.ok(aMatch < P.xpForLevel(1) * 2.5, "but not three levels at once");
});

test("a hand is worth more when you win it, and more again when you score", () => {
  assert.ok(P.handXp(true, 0) > P.handXp(false, 0), "winning beats losing");
  assert.ok(P.handXp(true, 40) > P.handXp(true, 0), "scoring beats not scoring");
  assert.equal(P.handXp(false, 0), P.XP.handPlayed, "even a lost hand is worth turning up");
  assert.ok(P.handXp(true, -50) >= P.XP.handPlayed, "negative points cannot take xp away");
  assert.ok(P.matchXp(true) > P.matchXp(false));
});

test("the daily reward can be taken once a day", () => {
  const t = Date.UTC(2026, 7, 15, 12, 0, 0);
  const fresh = { lastClaim: null, streak: 0 };
  const first = P.dailyState(fresh, t);
  assert.equal(first.canClaim, true, "a new player can claim straight away");
  assert.equal(first.streak, 1);
  assert.equal(first.reward, P.DAILY[0]);

  const claimed = { lastClaim: t, streak: 1 };
  assert.equal(P.dailyState(claimed, t + 3600000).canClaim, false, "not twice in one day");
  assert.equal(P.dailyState(claimed, t + DAY).canClaim, true, "but again tomorrow");
});

test("coming back the next day grows the streak, missing one resets it", () => {
  const t = Date.UTC(2026, 7, 15, 9, 0, 0);
  let daily = { lastClaim: null, streak: 0 };
  for (let day = 0; day < 7; day++) {
    const s = P.dailyState(daily, t + day * DAY);
    assert.equal(s.canClaim, true);
    assert.equal(s.streak, day + 1, `day ${day + 1} of the run`);
    assert.equal(s.reward, P.DAILY[day], "each day of the week is worth more");
    daily = { lastClaim: t + day * DAY, streak: s.streak };
  }
  // day eight starts the rewards over, but the streak keeps counting
  const eighth = P.dailyState(daily, t + 7 * DAY);
  assert.equal(eighth.streak, 8);
  assert.equal(eighth.reward, P.DAILY[0], "the week of rewards begins again");

  // skip a day and it is back to the beginning
  const missed = P.dailyState({ lastClaim: t, streak: 5 }, t + 2 * DAY);
  assert.equal(missed.streak, 1, "a missed day costs the run");
  assert.equal(missed.broke, true, "and the screen can say so");
});

test("claiming late at night and again next morning still counts as two days", () => {
  // built from local time on purpose — the day turns over in the server's
  // timezone, and these two moments must fall either side of that line
  const night = new Date(2026, 7, 15, 23, 30).getTime();
  const morning = new Date(2026, 7, 16, 7, 0).getTime();
  assert.notEqual(P.dayNumber(night), P.dayNumber(morning), "these are two different days here");
  const s = P.dailyState({ lastClaim: night, streak: 3 }, morning);
  assert.equal(s.canClaim, true, "a new calendar day, only hours later");
  assert.equal(s.streak, 4, "and the run continues rather than resetting");
});

test("the seven rewards only get bigger", () => {
  for (let i = 1; i < P.DAILY.length; i++)
    assert.ok(P.DAILY[i] > P.DAILY[i - 1], `day ${i + 1} must beat day ${i}`);
});
