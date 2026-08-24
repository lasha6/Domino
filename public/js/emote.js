/* =====================================================================
   A word across the table.

   Four people who cannot say anything to each other are four people playing
   four solitaire games in the same room, and in 2v2 it is worse than that —
   a partner is somebody you are meant to be playing WITH.

   What travels is a NUMBER, never a sentence. The phrases are here, the same
   eight for everybody, which is the whole moderation policy: nothing to
   sanitise, nothing to report, and no way to use the table to say something
   that is not on the list. It is also why there is no keyboard — a keyboard
   at a card table is a support queue.

   Anyone can turn them off, and that choice is remembered. Canned phrases are
   friendly right up until somebody uses them as a hammer, and the answer to
   that has to be on the screen of the person being hit, not in an inbox.
   ===================================================================== */
(function (global) {
  "use strict";

  /* Eight, because a wheel you have to read is slower than saying nothing.
     They are ordered the way a hand goes: greeting, praise, feeling, thanks,
     the two that ask something of the other player, and the one that ends a
     match well. Keep it at eight — the server checks the same number. */
  const SAYINGS = [
    "გამარჯობა!",
    "კარგი სვლაა!",
    "ვაშა!",
    "ეჰ...",
    "მადლობა",
    "სწრაფად :)",
    "მოიცა...",
    "კარგი თამაში!",
  ];

  const OFF_KEY = "emoteOff";
  const off = () => { try { return localStorage.getItem(OFF_KEY) === "1"; } catch (e) { return false; } };
  const setOff = (v) => { try { localStorage.setItem(OFF_KEY, v ? "1" : "0"); } catch (e) {} };

  /* The button is drawn, not typed: an emoji is somebody else's picture at
     somebody else's size, and this one sits next to our own brass. */
  const BUBBLE_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M4 5h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>'
    + '<circle class="d" cx="8" cy="11" r="1.4"/><circle class="d" cx="12" cy="11" r="1.4"/>'
    + '<circle class="d" cx="16" cy="11" r="1.4"/></svg>';

  let layer = null, tray = null, btn = null, opts = null, openTray = false;

  function build() {
    layer = document.createElement("div");
    layer.className = "emLayer";
    document.body.appendChild(layer);

    btn = document.createElement("button");
    btn.className = "emBtn";
    btn.type = "button";
    btn.setAttribute("aria-label", "ფრაზები");
    btn.innerHTML = BUBBLE_SVG;
    document.body.appendChild(btn);

    tray = document.createElement("div");
    tray.className = "emTray";
    SAYINGS.forEach((text, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "emPick";
      b.textContent = text;
      b.addEventListener("click", () => { send(i); toggle(false); });
      tray.appendChild(b);
    });
    const q = document.createElement("button");
    q.type = "button";
    q.className = "emQuiet";
    q.addEventListener("click", () => { setOff(!off()); paintQuiet(); toggle(false); });
    tray.appendChild(q);
    document.body.appendChild(tray);
    paintQuiet();

    btn.addEventListener("click", () => toggle(!openTray));
    /* Anywhere else closes it. A tray that stays open over the board is a
       tray that gets tapped by somebody trying to play a piece. */
    document.addEventListener("pointerdown", (e) => {
      if (!openTray) return;
      if (tray.contains(e.target) || btn.contains(e.target)) return;
      toggle(false);
    }, true);
  }

  function paintQuiet() {
    const q = tray.querySelector(".emQuiet");
    q.textContent = off() ? "ჩართე ფრაზები" : "გამორთე ფრაზები";
    btn.classList.toggle("quiet", off());
  }

  function toggle(open) {
    openTray = !!open;
    tray.classList.toggle("open", openTray);
    btn.classList.toggle("open", openTray);
    if (openTray && global.Sound) Sound.play("tap");
  }

  function send(i) {
    if (off() || !opts || !opts.socket) return;
    opts.socket.emit("emote", { i });
  }

  /* A bubble lives beside the player who said it. It is positioned rather
     than placed inside the seat, because the seat boxes are redrawn on every
     state push and anything inside one would be swept away mid-sentence. */
  const bubbles = new Map();
  function show(seat, i, mine) {
    if (off() || !opts) return;
    const text = SAYINGS[i];
    if (!text) return;
    const el = opts.anchor ? opts.anchor(seat) : null;
    const old = bubbles.get(seat);
    if (old) { old.el.remove(); clearTimeout(old.t); }

    const b = document.createElement("div");
    b.className = "emSay" + (mine ? " mine" : "");
    b.textContent = text;
    layer.appendChild(b);

    /* Without an anchor — a seat this screen does not draw — it still has to
       be readable, so it goes where a caption goes. A HIDDEN element counts as
       no anchor: it measures as a zero-sized rectangle at the very corner of
       the screen, and pointing at that puts the phrase in the corner rather
       than at a player, which looks like a bug rather than like nothing. */
    const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (r && r.width > 0 && r.height > 0) {
      const w = b.offsetWidth;
      let x = r.left + r.width / 2 - w / 2;
      x = Math.max(6, Math.min(x, innerWidth - w - 6));
      const above = r.top > 90;
      b.style.left = x + "px";
      b.style.top = (above ? r.top - b.offsetHeight - 8 : r.bottom + 8) + "px";
      b.classList.toggle("below", !above);
    } else {
      b.style.left = "50%";
      b.style.top = "12%";
      b.style.transform = "translateX(-50%)";
    }
    requestAnimationFrame(() => b.classList.add("in"));
    if (global.Sound) Sound.play("tap");

    const t = setTimeout(() => {
      b.classList.remove("in");
      setTimeout(() => b.remove(), 260);
      bubbles.delete(seat);
    }, 2600);
    bubbles.set(seat, { el: b, t });
  }

  /* socket   to send on and to listen on
     anchor   seat -> the element the bubble should point at (may return null)
     alone    () -> true when there is nobody else human to say it to */
  function mount(o) {
    opts = o || {};
    if (!layer) build();
    if (opts.socket && !opts.socket.__emote) {
      opts.socket.__emote = true;
      opts.socket.on("emote", (m) => { if (m) show(m.seat, m.i, !!m.mine); });
    }
    return { show, send };
  }

  /* Hide the button when there is nobody on the other side: against the
     computer a greeting is a message to nobody. */
  function live(on) {
    if (btn) btn.classList.toggle("hidden", !on);
    if (!on) toggle(false);
  }

  global.Emote = { mount, show, send, live, SAYINGS, muted: off };
})(typeof window !== "undefined" ? window : this);
