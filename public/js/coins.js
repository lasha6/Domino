/* =====================================================================
   Coins — the stake a player puts up for a match.
   Winner takes the stake, loser pays it. Balance lives on the device for
   now (no accounts yet); when accounts arrive this must move to the server,
   because anything kept in localStorage can be edited by the player.
   ===================================================================== */
(function (global) {
  "use strict";

  const KEY = "dominoCoins";
  const START = 1000;

  // stake per room — bigger target, bigger risk
  const STAKES = { 75: 50, 175: 100, 255: 250, 355: 500 };
  const MIN_STAKE = Math.min(...Object.values(STAKES));
  const FREE_TOPUP = 500;               // handed out when a player is cleaned out

  function get() {
    const v = parseInt(localStorage.getItem(KEY), 10);
    if (!Number.isFinite(v) || v < 0) { set(START); return START; }
    return v;
  }
  function set(v) {
    localStorage.setItem(KEY, String(Math.max(0, Math.round(v))));
    return get();
  }
  function add(n) { return set(get() + n); }

  function stakeFor(target) { return STAKES[target] || STAKES[175]; }
  function canAfford(target) { return get() >= stakeFor(target); }
  function isBroke() { return get() < MIN_STAKE; }
  function format(n) { return Number(n).toLocaleString("en-US"); }

  // Settle a finished match. Returns what changed, for the result screen.
  function settle(target, won) {
    const stake = stakeFor(target);
    const delta = won ? stake : -stake;
    const before = get();
    const after = add(delta);
    return { stake, delta, before, after };
  }

  global.Coins = { get, set, add, settle, stakeFor, canAfford, isBroke, format,
    STAKES, MIN_STAKE, START, FREE_TOPUP };
})(window);
