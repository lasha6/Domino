/* =====================================================================
   The whole screen, in a phone browser too.

   The Android app hides the system bars itself. A browser cannot — the URL bar
   and the navigation bar keep eating the edges of the table, and the page never
   scrolls, so Chrome never collapses the URL bar on its own.

   Fullscreen is only granted while the browser considers a real user action to
   be in progress. On Android that window opens when the finger is LIFTED, not
   when it lands: a touch that has only started might still turn into a scroll,
   so Chrome withholds permission until `click` / `touchend`. Asking on
   `pointerdown` is refused without a word — which is what happened first.

   Browsers still refuse for reasons we cannot see, so there is a fallback: a
   small corner button appears whenever we are not fullscreen and the automatic
   attempt did not take. It doubles as the way back in after the player leaves
   fullscreen themselves.

   iPhone is a different problem and gets a different answer. Every browser on
   iOS is Safari underneath — Chrome and Firefox there are the same engine with
   a different badge — so when Safari will not do something, none of them will,
   and the Fullscreen API is one of those things: on iPhone it is either absent
   or behind a setting the player has to have found for themselves. There is
   nothing to ask for and no button worth showing.

   What DOES work on iPhone is "Add to Home Screen": launched from the icon,
   the page runs with no address bar and no toolbar, which is the fullscreen
   the player was after. So on iPhone this file stops trying and says that
   instead — once, and never again after they have read it.
   ===================================================================== */
(function () {
  "use strict";

  // The app already runs fullscreen, and a mouse means a desktop — leave both alone.
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (native || !touch) return;

  /* Already launched from the home screen: there are no bars to be rid of.
     iOS answers `navigator.standalone`; everyone else answers the media
     query, and both are asked because neither covers the other. */
  const standalone = !!(window.navigator.standalone) ||
    (window.matchMedia && (window.matchMedia("(display-mode: standalone)").matches ||
                           window.matchMedia("(display-mode: fullscreen)").matches));
  if (standalone) return;

  const nav = window.navigator;
  const iOS = /iPad|iPhone|iPod/.test(nav.userAgent) ||
    // an iPad on iPadOS 13+ says it is a Mac, and only the touch points give it away
    (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);

  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (iOS || !req) { if (iOS) tellIPhone(); return; }

  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  /* ---------- the corner button ---------- */
  let btn = null;
  function button() {
    if (btn) return btn;
    const css = document.createElement("style");
    css.textContent =
      ".fsbtn{position:fixed;z-index:60;right:calc(6px + var(--safeR,0px));" +
      "bottom:calc(6px + var(--safeB,0px));width:34px;height:34px;padding:0;" +
      "display:none;place-items:center;border-radius:9px;cursor:pointer;" +
      "border:1px solid var(--brass-dim,#8a6524);background:rgba(4,26,14,.62);" +
      "color:var(--brass-lit,#f2cd7e);font:16px/1 var(--font-ui,sans-serif);" +
      "-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}" +
      ".fsbtn.show{display:grid;}";
    document.head.appendChild(css);

    btn = document.createElement("button");
    btn.className = "fsbtn";
    btn.type = "button";
    btn.textContent = "⛶";
    btn.title = "სრული ეკრანი";
    btn.setAttribute("aria-label", "სრული ეკრანი");
    btn.addEventListener("click", function (ev) { ev.stopPropagation(); ask(true); });
    document.body.appendChild(btn);
    return btn;
  }
  function showButton(on) {
    const b = button();
    b.classList.toggle("show", !!on);
  }

  /* ---------- asking ---------- */
  let tries = 0;
  const EVENTS = ["click", "touchend"];   // the events that open the permission window
  const listen = (on) => EVENTS.forEach((n) =>
    document[(on ? "add" : "remove") + "EventListener"](n, auto, true));

  function ask(manual) {
    if (isFull()) return;
    // navigationUI:"hide" asks Android to drop the navigation bar as well
    Promise.resolve(req.call(el, { navigationUI: "hide" }))
      .then(function () {
        // landscape-only design — hold the orientation while we are allowed to
        if (screen.orientation && screen.orientation.lock) {
          Promise.resolve(screen.orientation.lock("landscape")).catch(function () {});
        }
      })
      .catch(function () { if (manual) showButton(true); });
  }

  function auto() {
    if (isFull()) { listen(false); return; }
    ask(false);
    // A few quiet attempts, then hand the player the button instead of nagging.
    if (++tries >= 3) { listen(false); setTimeout(function () { if (!isFull()) showButton(true); }, 300); }
  }

  listen(true);
  document.addEventListener("fullscreenchange", function () {
    showButton(!isFull());          // gone while fullscreen, back if they leave it
    if (isFull()) listen(false);
  });

  /* ---------- the one thing that works on iPhone ----------

     iOS gives a page NO way to add itself to the home screen. There is no API
     and there is no permission to ask for: only Safari's own Share menu can do
     it, and the player has to open that menu themselves. So everything here is
     an instruction, and the whole design problem is making that obvious.

     The first version got it wrong in the most ordinary way. It was one line
     of text with one button, and the button said "Got it". A player who wants
     fullscreen presses the only button on the note and expects fullscreen —
     which is exactly what happened, and it did nothing but close the note.

     So: no button that could be mistaken for the action. A plain ✕ to dismiss,
     numbered steps, the Share glyph drawn so it can be RECOGNISED in the
     toolbar rather than looked for by name, and one line saying in as many
     words that this happens in Safari's menu and not here.

     Said on the front page only — a note like this in the middle of a hand is
     an interruption, and by then it is too late to act on anyway — and said
     once. */
  function tellIPhone() {
    const KEY = "iosHomeHint";
    try { if (localStorage.getItem(KEY)) return; } catch (e) {}
    const path = location.pathname.replace(/\/+$/, "");
    const lobby = path === "" || /\/index\.html$/.test(path);
    if (!lobby) return;

    /* Chrome and Firefox on iOS are the same engine, but not the same chrome:
       their share button lives in the menu behind ⋯ rather than in a toolbar
       at the bottom. Sending somebody to the wrong corner of their own phone
       is worse than saying nothing. */
    const ua = nav.userAgent;
    const inSafari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

    const css = document.createElement("style");
    css.textContent =
      /* A width, not a max-width: a flex box with neither shrinks to fit its
         longest WORD, and the note first came out as a narrow column of
         wrapped Georgian. */
      ".iosTip{position:fixed;z-index:62;left:50%;transform:translateX(-50%);" +
      "bottom:calc(10px + var(--safeB,0px));width:min(94vw,430px);" +
      "box-sizing:border-box;padding:11px 13px 12px;" +
      "border-radius:14px;border:1px solid var(--brass-dim,#8a6524);" +
      "background:rgba(6,30,17,.97);color:var(--cream,#f6efdd);" +
      "font:13px/1.4 var(--font-ui,sans-serif);" +
      "box-shadow:0 10px 30px rgba(0,0,0,.55);}" +
      ".iosTip h4{margin:0 26px 7px 0;font:700 13.5px/1.2 var(--font-ui,sans-serif);" +
      "color:var(--brass-lit,#f2cd7e);}" +
      ".iosTip ol{margin:0;padding:0 0 0 18px;}" +
      ".iosTip li{margin:0 0 4px;}" +
      ".iosTip b{color:var(--brass-lit,#f2cd7e);font-weight:700;}" +
      /* the Share glyph, inline with the words, so it is recognised rather
         than hunted for by name */
      ".iosTip svg{width:13px;height:16px;vertical-align:-3px;margin:0 2px;" +
      "fill:none;stroke:var(--brass-lit,#f2cd7e);stroke-width:1.7;" +
      "stroke-linecap:round;stroke-linejoin:round;}" +
      ".iosTip .note{margin:8px 0 0;color:var(--cream-dim,rgba(246,239,221,.62));" +
      "font-size:11.5px;line-height:1.35;}" +
      /* A ✕ and nothing else. Anything with a word on it reads as the action. */
      ".iosTip .x{position:absolute;top:6px;right:8px;width:26px;height:26px;" +
      "display:grid;place-items:center;border:0;background:transparent;" +
      "cursor:pointer;color:var(--cream-dim,rgba(246,239,221,.62));" +
      "font:400 17px/1 var(--font-ui,sans-serif);padding:0;}";
    document.head.appendChild(css);

    const SHARE =
      '<svg viewBox="0 0 14 17" aria-hidden="true">' +
      '<path d="M7 1.6v9"/><path d="M4.1 4.4 7 1.4l2.9 3"/>' +
      '<path d="M3.2 7.2H1.8v8.2h10.4V7.2h-1.4"/></svg>';

    const tip = document.createElement("div");
    tip.className = "iosTip";
    tip.style.position = "fixed";

    const h = document.createElement("h4");
    h.textContent = "სრული ეკრანი iPhone-ზე";

    const ol = document.createElement("ol");
    ol.innerHTML = inSafari
      ? "<li>ქვემოთ, Safari-ს ზოლში დააჭირე " + SHARE + "</li>" +
        "<li>ჩამონათვალში აირჩიე <b>მთავარ ეკრანზე დამატება</b></li>" +
        "<li>გახსენი ხატულადან — ზოლების გარეშე</li>"
      : "<li>ზემოთ, მისამართის გვერდით დააჭირე " + SHARE + " ან <b>⋯</b></li>" +
        "<li>ჩამონათვალში აირჩიე <b>მთავარ ეკრანზე დამატება</b></li>" +
        "<li>გახსენი ხატულადან — ზოლების გარეშე</li>";

    const note = document.createElement("p");
    note.className = "note";
    /* The sentence the first version was missing, and the only one that
       explains why nothing on this note is a button. */
    note.textContent = "ეს ბრაუზერის მენიუში კეთდება — თამაშიდან ვერ ჩაირთვება.";

    const x = document.createElement("button");
    x.type = "button";
    x.className = "x";
    x.textContent = "✕";
    x.setAttribute("aria-label", "დახურვა");
    x.addEventListener("click", function () {
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      tip.remove();
    });

    tip.appendChild(x); tip.appendChild(h); tip.appendChild(ol); tip.appendChild(note);

    const put = function () { document.body.appendChild(tip); };
    if (document.body) put();
    else document.addEventListener("DOMContentLoaded", put);
  }
})();
