/* =====================================================================
   Sound — every effect is synthesised here, so the game ships with zero
   audio files and still works with no internet (which the APK needs).

   Browsers refuse to start audio until the player touches something, so the
   context is created lazily and unlocked on the first gesture.
   ===================================================================== */
(function (global) {
  "use strict";

  const KEY = "dominoMuted";
  let ctx = null, master = null, unlocked = false;

  function muted() { return localStorage.getItem(KEY) === "1"; }
  function setMuted(v) {
    localStorage.setItem(KEY, v ? "1" : "0");
    if (master) master.gain.value = v ? 0 : 0.9;
    return v;
  }
  function toggle() { return setMuted(!muted()); }

  function ensure() {
    if (ctx) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted() ? 0 : 0.9;
    master.connect(ctx.destination);
    return ctx;
  }
  // the first tap anywhere is what lets audio start
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    const c = ensure();
    if (c && c.state === "suspended") c.resume();
  }
  ["pointerdown", "keydown", "touchstart"].forEach((e) =>
    global.addEventListener(e, unlock, { once: false, passive: true }));

  /* ---------------- building blocks ---------------- */
  // a short burst of noise, shaped — this is what makes wood sound like wood
  function noise(dur, freq, q, gain, decay, delay) {
    const c = ensure(); if (!c || muted()) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = "bandpass";
    bp.frequency.value = freq; bp.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(bp).connect(g).connect(master);
    src.start(c.currentTime + (delay || 0));
  }
  // a plain tone with a soft attack and decay
  function tone(freq, dur, gain, type, delay, endFreq) {
    const c = ensure(); if (!c || muted()) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator(); o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  /* ---------------- the game's voice ---------------- */
  const S = {
    // bone tile meeting the table: a bright clack over a low knock
    place() { noise(0.09, 2100, 1.1, 0.5, 7); tone(190, 0.1, 0.28, "triangle", 0, 120); },
    // taking from the boneyard — softer, duller
    draw()  { noise(0.07, 1200, 1.4, 0.3, 9); tone(150, 0.08, 0.16, "sine", 0, 110); },
    // points scored: two bright notes, like the brass pin ringing
    score() { tone(784, 0.16, 0.22, "triangle"); tone(1175, 0.22, 0.18, "triangle", 0.08); },
    // your move
    turn()  { tone(880, 0.14, 0.16, "sine"); },
    // clock about to bite
    warn()  { tone(330, 0.11, 0.2, "square"); },
    // one second gone off a burning fuse. `urgency` 0..1 raises the pitch and
    // bite as the seconds run out.
    tick(urgency) {
      const u = Math.min(1, Math.max(0, urgency || 0));
      noise(0.035, 1400 + u * 2200, 3 + u * 3, 0.14 + u * 0.2, 14);
      tone(520 + u * 460, 0.06 + u * 0.04, 0.1 + u * 0.16, "square");
    },
    // the fuse burns out
    boom() {
      noise(0.5, 120, 0.6, 0.5, 2);
      tone(90, 0.6, 0.35, "sine", 0, 45);
      tone(140, 0.35, 0.2, "square", 0.02, 60);
    },
    // a hand ends — short and clear
    handWin()  { tone(659, 0.16, 0.3, "triangle"); tone(880, 0.24, 0.26, "triangle", 0.1);
                 noise(0.05, 3200, 1.4, 0.14, 10); },
    handLose() { tone(392, 0.2, 0.26, "triangle"); tone(294, 0.3, 0.22, "triangle", 0.12); },

    // the match ends — a proper fanfare you can't miss
    win() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => {
        tone(f, 0.3, 0.32, "triangle", i * 0.1);
        tone(f * 2, 0.18, 0.1, "sine", i * 0.1);        // a little shimmer on top
      });
      // held major chord to finish on
      [523, 659, 784, 1047].forEach((f) => tone(f, 0.9, 0.16, "triangle", 0.52));
      // sparkles
      for (let i = 0; i < 7; i++) noise(0.05, 3000 + Math.random() * 2500, 2, 0.11, 9);
    },
    lose() {
      [440, 392, 330, 262].forEach((f, i) => tone(f, 0.34, 0.28, "triangle", i * 0.14));
      tone(196, 1.0, 0.2, "sine", 0.56, 130);          // a slow sag at the end
      tone(233, 0.9, 0.12, "triangle", 0.56);
    },
    /* ---- dice ----
       Two bone cubes in a hand: a dozen little collisions, each a bright tick
       over a hollow knock, thrown at slightly different moments so it rattles
       rather than buzzes. `secs` is how long the throw takes, so the sound and
       the picture end together. */
    diceShake(secs) {
      const dur = secs || 0.55;
      const n = Math.round(11 * dur / 0.55);
      for (let i = 0; i < n; i++) {
        const t = (i / n) * dur * 0.92;
        const bite = 0.5 + Math.random() * 0.5;
        noise(0.026, 2300 + Math.random() * 2200, 2.2, 0.1 * bite, 13, t);
        if (i % 2 === 0) tone(150 + Math.random() * 90, 0.05, 0.05, "triangle", t, 90);
      }
    },
    /* Landing: the first hit is the loudest, then two smaller bounces as they
       settle. Bone on wood — a sharp tick with a low knock under it. */
    diceLand() {
      [[0, 1], [0.085, 0.55], [0.155, 0.28]].forEach(([t, v]) => {
        noise(0.055, 2600 - t * 3000, 1.3, 0.42 * v, 9, t);
        tone(165 - t * 120, 0.09, 0.24 * v, "triangle", t, 105);
      });
    },
    // a double is worth a little bell
    diceDouble() { tone(988, 0.16, 0.18, "triangle", 0.02); tone(1319, 0.22, 0.14, "sine", 0.1); },

    // ui
    tap()  { noise(0.03, 2600, 1.6, 0.18, 12); },
    deal() { noise(0.06, 1500, 1.2, 0.22, 10); },
  };

  function play(name, ...args) {
    try { if (S[name]) S[name](...args); } catch (e) { /* audio must never break the game */ }
  }

  global.Sound = { play, muted, setMuted, toggle, unlock };
})(window);
