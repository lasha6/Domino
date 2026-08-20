/* =====================================================================
  What the ბურა table is showing.

  Small, and on its own, because it has now been wrong twice: once leaving the
  trick before it in front of a player who had not played, and once showing a
  card twice. Both needed a particular deal to see from outside — a whole suit
  in one hand turns up in about seven per cent of them — so the rule lives here
  where a test can build the case rather than wait for it.

  It lives beside the server rather than in public/js: the screens are told
  what the table shows, they do not work it out, so nothing here needs to ship
  in the app.

  A trick is: what was led, and one entry per player who has answered. The
  entry holds EVERY card that player has put into this trick, which matters
  when a whole hand is turned back on somebody: the card they had already led
  stays on the table, face up, and counts as part of their answer. It is one
  entry, not two, however many times it is recorded.
   ===================================================================== */

/* A new lead wipes the table. The one thing that survives is a card already
   led that a turned-back hand is now being answered with — pass it as
   `committed` ({ seat, cards }) and it stays where it is. */
export function startTrick(led, leadSeat, committed) {
  const keep = committed && committed.cards && committed.cards.length
    ? [{ seat: committed.seat, cards: committed.cards.slice(), open: committed.cards.length }]
    : [];
  return withOld({ led: led.slice(), leadSeat, answers: keep, took: null, hidden: false });
}

/* One entry per player. A player who already had a card down is UPDATED
   rather than added to — their entry carries the whole of what they have
   played, the earlier card included, so pushing a second one put that card on
   the table twice. */
export function addAnswer(trick, seat, cards, open) {
  if (!trick) return trick;
  const entry = { seat, cards: cards.map((c) => c.slice()), open: open || 0 };
  const at = trick.answers.findIndex((a) => a.seat === seat);
  if (at >= 0) trick.answers[at] = entry;
  else trick.answers.push(entry);
  return withOld(trick);
}

// who took it, and whether the answer stays face down (the short game only)
export function settle(trick, took, faceDown) {
  if (!trick) return trick;
  trick.took = took;
  trick.hidden = !!faceDown;
  return withOld(trick);
}

// every card on the table, once each
export function cardsOn(trick) {
  if (!trick) return [];
  return trick.led.concat.apply(trick.led, trick.answers.map((a) => a.cards));
}

/* The two-player screen reads a single answer off the trick rather than the
   list. Kept filled in so an older screen — one already installed on a phone
   — goes on working. */
function withOld(t) {
  const last = t.answers.length ? t.answers[t.answers.length - 1] : null;
  t.ans = last ? last.cards : [];
  t.ansSeat = last ? last.seat : null;
  t.open = last ? last.open : 0;
  return t;
}
