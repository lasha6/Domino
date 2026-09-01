/* =====================================================================
   Who else is at the table.

   One row, drawn the same way in all five games, because it answers the
   same question in all five: who am I playing, what are they holding, and
   whose move is it.

   What it replaced was a label, a line of loose face-down pieces and a
   sentence — three things that did not belong together, left-aligned with
   the sentence drifting off to the right. And whose turn it was got
   written out in words, which is the screen telling a player something
   they are already looking at.

   Here the turn is a lit plate. Nothing says it.

   The pieces in the fan are wood, whichever game it is: face down is wood
   and face up is bone, one rule for the whole app. That is also why the
   ozi table used to show six small green squares — its backs were stained
   the colour of the cloth they were lying on.
   ===================================================================== */
(function (global) {
  "use strict";

  const doc = global.document;
  const MOST = 7;          // beyond this the fan is a smear; the count carries it

  /* A name is typed by a stranger, so it is set as text and never as
     markup, and it is never translated either — data-raw says so to i18n.
     The initial is the first character of whatever is on screen, which is
     the only initial that can be right in both languages. */
  function plate(who) {
    const el = doc.createElement("div");
    el.className = "foe"
      + (who.turn ? " on" : "") + (who.mate ? " mate" : "")
      + (who.bot ? " bot" : "") + (who.away ? " away" : "");
    if (who.seat != null) el.dataset.seat = who.seat;   // a phrase finds its face by this

    /* The roundel says what KIND of player this is without a picture of one:
       copper for a person, steel for a seat the computer has taken over. */
    const name = String(who.name == null ? "" : who.name);
    const ini = doc.createElement("span");
    ini.className = "ini";
    ini.textContent = name.trim().charAt(0) || "?";
    el.appendChild(ini);

    /* textContent, never innerHTML. This is a name a stranger typed, and it
       used to be concatenated straight into markup. */
    const nm = doc.createElement("span");
    nm.className = "nm";
    nm.setAttribute("data-raw", "1");
    nm.textContent = name;
    if (who.verified) {
      const tick = doc.createElement("span");
      tick.className = "vtick";
      tick.textContent = "✓";
      tick.title = "დამოწმებული სახელი";
      nm.appendChild(tick);
    }
    el.appendChild(nm);

    /* The bank of thinking time, and only once it has started going down —
       a number at its full value all match is furniture. */
    if (who.bank) {
      const b = doc.createElement("span");
      b.className = "bank" + (who.bankLow ? " low" : "");
      if (who.seat != null) b.setAttribute("data-bank", who.seat);
      b.textContent = who.bank;
      el.appendChild(b);
    }

    /* What they are holding. `show` turns the hand face up — at the end of a
       round the tiles are what the score is made of, so they can be counted
       rather than taken on trust. */
    if (who.show) {
      const up = doc.createElement("span");
      up.className = "up";
      up.innerHTML = who.show;                 // drawn by the caller, from pieces
      el.appendChild(up);
      return el;
    }
    const n = Math.max(0, who.count | 0);
    if (n > 0) {
      const fan = doc.createElement("span");
      fan.className = "fan";
      for (let i = 0; i < Math.min(n, MOST); i++) fan.appendChild(doc.createElement("i"));
      el.appendChild(fan);
      const cnt = doc.createElement("span");
      cnt.className = "cnt";
      cnt.textContent = n;
      el.appendChild(cnt);
    }
    return el;
  }

  /* `list` is everybody except the player, in the order they should be read
     — round the table from the player's own left. */
  function paint(box, list) {
    if (!box) return;
    box.innerHTML = "";
    (list || []).forEach((who) => { if (who) box.appendChild(plate(who)); });
  }

  global.Foes = { paint, plate, MOST };
})(typeof window !== "undefined" ? window : this);
