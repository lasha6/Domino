/* =====================================================================
   The timber, and the things cut into it.

   Wood is noise. Perlin noise stretched hard along one axis gives the streaks;
   a table in the component transfer bends grey into walnut; and a second, very
   coarse noise pushed through a displacement map makes those streaks wander,
   which is the difference between a board and a sheet of laminate. Nothing is
   loaded from anywhere — no photograph of wood, no font, no library — so the
   APK carries it for free and it works with no network at all.

   TWO THINGS THAT COST A DAY EACH, WRITTEN DOWN SO THEY ARE NOT PAID TWICE:

   1. A filter works in linearRGB unless it is told otherwise, and the result is
      converted to sRGB on the way out, which LIFTS every value. Walnut kept
      coming out looking like pine however far the numbers were pushed down.
      `color-interpolation-filters="sRGB"` on every filter, always.

   2. A duplicate attribute is an XML parse error, and a data-URI SVG that will
      not parse is a mask that hides everything rather than a mask that fails
      loudly. Build the stroke attributes in one place.
   ===================================================================== */
(function (global) {
  "use strict";

  /* ---------------- the timber ---------------- */
  const FILTERS = `
    <filter id="wgCase" x="0" y="0" width="100%" height="100%"
            color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.010 0.42" numOctaves="6" seed="7" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0" result="g"/>
      <feComponentTransfer in="g" result="wood">
        <feFuncR type="table" tableValues="0.09 0.17 0.25 0.18 0.29 0.20 0.14"/>
        <feFuncG type="table" tableValues="0.05 0.09 0.14 0.10 0.16 0.11 0.07"/>
        <feFuncB type="table" tableValues="0.02 0.05 0.08 0.05 0.09 0.06 0.04"/>
      </feComponentTransfer>
      <feTurbulence type="fractalNoise" baseFrequency="0.003 0.035" numOctaves="4" seed="19" result="f"/>
      <feColorMatrix in="f" type="saturate" values="0" result="fg"/>
      <feComponentTransfer in="fg" result="fig">
        <feFuncA type="table" tableValues="0 0.30 0"/>
      </feComponentTransfer>
      <feComposite in="fig" in2="wood" operator="atop" result="lit"/>
      <feBlend in="lit" in2="wood" mode="multiply" result="flat"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="5" result="warp"/>
      <feDisplacementMap in="flat" in2="warp" scale="26" xChannelSelector="R" yChannelSelector="G"/>
    </filter>

    <filter id="wgField" x="0" y="0" width="100%" height="100%"
            color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.011 0.38" numOctaves="6" seed="23" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0" result="g"/>
      <feComponentTransfer in="g" result="flat">
        <feFuncR type="table" tableValues="0.19 0.30 0.40 0.31 0.44 0.33 0.25"/>
        <feFuncG type="table" tableValues="0.11 0.18 0.24 0.18 0.27 0.20 0.15"/>
        <feFuncB type="table" tableValues="0.05 0.08 0.12 0.09 0.14 0.10 0.07"/>
      </feComponentTransfer>
      <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="2" seed="11" result="warp"/>
      <feDisplacementMap in="flat" in2="warp" scale="30" xChannelSelector="R" yChannelSelector="G"/>
    </filter>

    <filter id="wgSpine" x="0" y="0" width="100%" height="100%"
            color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.44" numOctaves="5" seed="41" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0" result="g"/>
      <feComponentTransfer in="g">
        <feFuncR type="table" tableValues="0.08 0.15 0.22 0.16 0.26"/>
        <feFuncG type="table" tableValues="0.04 0.08 0.13 0.09 0.15"/>
        <feFuncB type="table" tableValues="0.02 0.04 0.07 0.05 0.08"/>
      </feComponentTransfer>
    </filter>`;

  let defsIn = false;
  function defs() {
    if (defsIn || !global.document) return;
    defsIn = true;
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    host.setAttribute("aria-hidden", "true");
    host.innerHTML = '<svg width="0" height="0"><defs>' + FILTERS + "</defs></svg>";
    document.body.appendChild(host);
  }

  /* Lay a piece of timber inside an element. The rect fills its box and the
     filter paints it; the element keeps whatever background it had as the
     fallback, for a browser that will not run filters. */
  function fill(el, which) {
    if (!el) return null;
    defs();
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "grain");
    svg.setAttribute("preserveAspectRatio", "none");
    const r = document.createElementNS(ns, "rect");
    r.setAttribute("width", "100%");
    r.setAttribute("height", "100%");
    r.setAttribute("filter", "url(#" + (which || "wgField") + ")");
    svg.appendChild(r);
    el.insertBefore(svg, el.firstChild);
    return svg;
  }

  /* ---------------- the things cut into it ----------------
     Each drawing is an SVG in a data URI used as a CSS mask, so the metal is a
     CSS colour: the same drawing is gold on a rail and gold on a checker, and
     a highlight recolours it without a second copy. */
  const svg = (vb, body) =>
    "url(\"data:image/svg+xml;utf8," +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '">' + body + "</svg>") +
    "\")";
  const S = 'fill="none" stroke="#000" stroke-linecap="round"';

  /* a grape leaf: five pointed lobes with a notch between each, and veins
     running from the stem to every tip. Drawn round, it stops being a leaf. */
  const leaf =
    '<path ' + S + ' stroke-width="2.6" stroke-linejoin="round" d="' +
    'M50 97V78' +
    'C43 85 29 86 19 79 C9 72 8 62 15 57 C4 55 0 44 7 36 C14 27 26 26 32 33' +
    'C25 20 31 8 41 5 C47 3 50 9 50 16' +
    'C50 9 53 3 59 5 C69 8 75 20 68 33 C74 26 86 27 93 36 C100 44 96 55 85 57' +
    'C92 62 91 72 81 79 C71 86 57 85 50 78Z"/>' +
    '<g ' + S + ' stroke-width="1.5" opacity="0.9">' +
    '<path d="M50 78V30M50 62L22 48M50 62l28-14M50 48L28 26M50 48l22-22"/></g>';

  const grapes =
    '<g fill="#000">' +
    '<circle cx="24" cy="30" r="7"/><circle cx="40" cy="30" r="7"/><circle cx="56" cy="30" r="7"/>' +
    '<circle cx="32" cy="43" r="7"/><circle cx="48" cy="43" r="7"/>' +
    '<circle cx="24" cy="56" r="7"/><circle cx="40" cy="56" r="7"/><circle cx="56" cy="56" r="7"/>' +
    '<circle cx="32" cy="69" r="7"/><circle cx="48" cy="69" r="7"/>' +
    '<circle cx="40" cy="82" r="7"/></g>' +
    '<g ' + S + ' stroke-width="2.4"><path d="M40 22V6"/>' +
    '<path d="M40 10c9-6 20-4 24 4-9 6-20 4-24-4z"/></g>';

  const vine = svg("0 0 190 100",
    '<g transform="translate(2 0)">' + leaf + '</g>' +
    '<g transform="translate(112 4) scale(0.86)">' + grapes + '</g>' +
    '<g ' + S + ' stroke-width="2"><path d="M96 40c8-6 18-6 26 0"/></g>');

  /* Georgia. The border is simplified from coordinates rather than sketched by
     hand — drawn by eye it came out looking like a shoe. The regions are cut in
     lighter inside it, because a single silhouette reads as a sticker and it is
     the divisions the eye reads the country from. Every internal line runs
     border to border: one that stops short leaves a region as an open cell. */
  const GE =
    'M0 8 L7.4 12 L23.7 22 L38.5 40 L49.5 58 L47.4 72 L45.9 83.2 L62.2 86 L77 96' +
    ' L91.9 100 L102.2 94 L118.5 96 L133.3 90 L148.1 96 L165.9 92 L189.6 100' +
    ' L199.1 96 L189.6 80 L177.8 64 L165.9 48 L148.1 40 L133.3 36 L118.5 40' +
    ' L103.7 34 L88.9 24 L74.1 16 L59.3 12 L29.6 8Z';
  const MKHARE = [
    'M38 39 L46 25 L59.3 12',                 // აფხაზეთი
    'M48.6 61 L60 54 L72 46 L83 39 L92 27',   // სამეგრელო-ზემო სვანეთი
    'M83 39 L93 47 L104 49',                  // რაჭა-ლეჩხუმი, სამხრეთი
    'M104 49 L104.5 34.5',                    // და მისი აღმოსავლეთი
    'M48.6 61 L58 66 L69 71',                 // გურია, ჩრდილოეთი
    'M46.6 79 L57 75 L69 71',                 // გურია, სამხრეთი — აჭარა იწყება
    'M69 71 L73 82 L77 96',                   // აჭარა, აღმოსავლეთი
    'M69 71 L80 70 L90 73',                   // იმერეთი, სამხრეთი
    'M104 49 L100 58 L95 66 L90 73',          // იმერეთი, აღმოსავლეთი
    'M90 73 L100 84 L102.2 94',               // სამცხე-ჯავახეთი
    'M104 49 L117 47 L129 53',                // შიდა ქართლი, ჩრდილოეთი
    'M90 73 L106 75 L121 73',                 // შიდა ქართლი, სამხრეთი
    'M129 53 L140 58 L147 71 L148.1 96',      // კახეთი, დასავლეთი
    'M121 73 L134 79 L145 90',                // ქვემო ქართლი
  ].join('');

  const map = svg("0 0 200 102",
    '<path d="' + GE + '" fill="#000" fill-opacity="0.10"/>' +
    '<path d="' + MKHARE + '" ' + S + ' stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="' + GE + '" ' + S + ' stroke-width="3.2" stroke-linejoin="round"/>');

  /* a small bunch for the face of a playing piece */
  const bunch = svg("0 0 44 44",
    '<g fill="#000">' +
    '<circle cx="22" cy="20" r="4.2"/><circle cx="14" cy="26" r="4.2"/><circle cx="30" cy="26" r="4.2"/>' +
    '<circle cx="18" cy="33" r="4.2"/><circle cx="26" cy="33" r="4.2"/><circle cx="22" cy="40" r="4.2"/>' +
    '</g><g ' + S + ' stroke-width="2"><path d="M22 15V6"/>' +
    '<path d="M22 9c5-4 11-4 15 0-4 4-11 4-15 0z"/></g>');

  function paint() {
    if (!global.document) return;
    const r = document.documentElement.style;
    r.setProperty("--ornVine", vine);
    r.setProperty("--ornMap", map);
    r.setProperty("--ornBunch", bunch);
  }
  paint();

  global.Wood = { defs, fill, paint, drawings: { vine, map, bunch } };
})(typeof window !== "undefined" ? window : this);
