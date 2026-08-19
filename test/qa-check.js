/* A sweep for the things a designer notices and a tester can measure:
   controls sitting on top of each other, anything hanging off the screen,
   text too small to read, and tap targets too small to hit. */
(function () {
  const VISIBLE = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
             right: Math.round(r.right), bottom: Math.round(r.bottom) };
  };
  const name = (el) => {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 22);
    return (el.id ? "#" + el.id : el.className ? "." + String(el.className).split(" ")[0] : el.tagName)
         + (t ? ' "' + t + '"' : "");
  };
  const nested = (a, b) => a.contains(b) || b.contains(a);
  /* An element scrolled out of a list is clipped, not visible — its rectangle
     still reports where it would be, which reads as a collision with whatever
     is below the list. */
  const clipped = (el) => {
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (!/auto|scroll|hidden/.test(s.overflowY + s.overflowX)) continue;
      const pr = p.getBoundingClientRect();
      if (r.bottom <= pr.top + 1 || r.top >= pr.bottom - 1) return true;
      if (r.right <= pr.left + 1 || r.left >= pr.right - 1) return true;
    }
    return false;
  };
  // an open dialog is MEANT to cover the screen behind it
  const layer = (el) => el.closest(".overlay, .roomOverlay");
  const sameLayer = (a, b) => layer(a) === layer(b);

  const controls = [...document.querySelectorAll("button, .mode, .game, .room, .playercard, .cur, .store, .iconbtn, .backGame")]
    .filter(VISIBLE).filter((el) => !clipped(el));

  const overlaps = [];
  for (let i = 0; i < controls.length; i++)
    for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      if (nested(a, b) || !sameLayer(a, b)) continue;
      const A = box(a), B = box(b);
      const ox = Math.min(A.right, B.right) - Math.max(A.x, B.x);
      const oy = Math.min(A.bottom, B.bottom) - Math.max(A.y, B.y);
      if (ox > 2 && oy > 2) {
        const area = ox * oy;
        overlaps.push({ a: name(a), b: name(b), overlapPx: area,
                        share: Math.round(area / Math.min(A.w * A.h, B.w * B.h) * 100) + "%" });
      }
    }

  const offscreen = controls.filter((el) => {
    const r = box(el);
    return r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1;
  }).map((el) => ({ el: name(el), box: box(el) }));

  const tiny = controls.filter((el) => {
    const r = box(el);
    return r.w < 32 || r.h < 26;                 // smaller than a fingertip
  }).map((el) => ({ el: name(el), size: box(el).w + "x" + box(el).h }));

  // a label drawn with pseudo-elements sets font-size:0 on purpose
  const drawnNotWritten = (el) => getComputedStyle(el).color === "rgba(0, 0, 0, 0)";
  const small = [...document.querySelectorAll("button, .mode, .gName, .gSub, .rName, .logo-sub, .roomSub, .lbl")]
    .filter(VISIBLE).filter((el) => !drawnNotWritten(el))
    .filter((el) => (el.textContent || "").trim() && parseFloat(getComputedStyle(el).fontSize) < 10)
    .map((el) => ({ el: name(el), size: getComputedStyle(el).fontSize }));

  return {
    viewport: innerWidth + "x" + innerHeight,
    controlsChecked: controls.length,
    overlaps, offscreen, tapTargetsTooSmall: tiny, textTooSmall: small,
    pageScrolls: document.documentElement.scrollHeight > innerHeight + 1,
  };
})();

/* HOW TO RUN THIS
   It measures a live page, so it needs a browser rather than the test runner:
     1. copy it next to the pages:  cp test/qa-check.js public/
     2. open a screen and evaluate: eval(await (await fetch("/qa-check.js")).text())
     3. remove it again:            rm public/qa-check.js
   Deliberately not left in public/ — nothing ships in the APK that the game
   itself does not need. */
