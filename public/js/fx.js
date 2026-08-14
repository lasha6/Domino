/* =====================================================================
   Celebration effects — confetti and the way a result lands on screen.
   Everything is drawn with plain elements and CSS, no images.
   ===================================================================== */
(function (global) {
  "use strict";

  const COLOURS = ["#f2cd7e", "#c2913c", "#fffdf6", "#7ce9a6", "#8fd4ff", "#e8dfc8"];

  // Gold-and-bone confetti raining down the screen.
  function confetti(count, opts) {
    const o = opts || {};
    const layer = document.createElement("div");
    layer.className = "confetti";
    document.body.appendChild(layer);
    const n = count || 60;
    for (let i = 0; i < n; i++) {
      const c = document.createElement("i");
      c.className = "conf";
      const size = 6 + Math.random() * 8;
      c.style.left = Math.random() * 100 + "vw";
      c.style.width = size + "px";
      c.style.height = size * (0.6 + Math.random() * 1.2) + "px";
      c.style.background = COLOURS[(Math.random() * COLOURS.length) | 0];
      c.style.animationDuration = (1.6 + Math.random() * 1.6) + "s";
      c.style.animationDelay = (Math.random() * (o.spread || 0.5)) + "s";
      c.style.setProperty("--spin", (Math.random() * 1080 - 540) + "deg");
      c.style.setProperty("--drift", (Math.random() * 160 - 80) + "px");
      if (Math.random() < 0.3) c.style.borderRadius = "50%";
      layer.appendChild(c);
    }
    setTimeout(() => { if (layer.parentNode) layer.remove(); }, 4200);
  }

  // How the result modal arrives: a bounce for a win, a shake for a loss.
  function result(modalEl, won) {
    if (!modalEl) return;
    modalEl.classList.remove("fxWin", "fxLose");
    void modalEl.offsetWidth;               // restart the animation
    modalEl.classList.add(won ? "fxWin" : "fxLose");
  }

  // A small burst for winning a single hand.
  function cheer() { confetti(22, { spread: 0.25 }); }

  global.Fx = { confetti, result, cheer };
})(window);
