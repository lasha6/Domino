/* =====================================================================
   The jester — the face on a ჯოკერი card.

   Drawn here rather than in ჯოკერი's screen because the lobby wants the
   same face on the mark above the game's name, and a drawing that exists
   twice is a drawing that will differ twice. Its colours live in
   `css/cards.css` under `.jkArt`, so a page that shows it must load that.

   No image is fetched, at any size: the app has to work with no network at
   all once it is installed.
   ===================================================================== */
(function (global) {
  "use strict";

  const SVG =
    '<svg class="jkArt" viewBox="0 0 100 132" aria-hidden="true">'
    // the face first, so the cap can be laid over its forehead
    + '<path class="face" d="M22 56 C21 80 27 102 39 113 C45 118 55 118 61 113 C73 102 79 80 78 56 Z"/>'
    // the two outer points, then the tall middle one, split down the centre
    + '<path class="capR" d="M24 68 C17 56 12 44 11 33 C22 40 30 52 37 66 Z"/>'
    + '<path class="capB" d="M76 68 C83 56 88 44 89 33 C78 40 70 52 63 66 Z"/>'
    + '<path class="capR" d="M50 4 C45 24 40 46 39 66 L50 68 Z"/>'
    + '<path class="capB" d="M50 4 C55 24 60 46 61 66 L50 68 Z"/>'
    // the band across the brow that ties the three together
    + '<path class="capR" d="M50 51 C34 51 24 55 18 62 C28 69 38 71 50 71 Z"/>'
    + '<path class="capB" d="M50 51 C66 51 76 55 82 62 C72 69 62 71 50 71 Z"/>'
    + '<circle class="bell" cx="10" cy="31" r="6.4"/>'
    + '<circle class="bell" cx="90" cy="31" r="6.4"/>'
    // laughing eyes and a wide grin
    + '<path class="ink" d="M28 78 C33 70 42 73 47 83 C41 78 33 76 28 78 Z"/>'
    + '<path class="ink" d="M72 78 C67 70 58 73 53 83 C59 78 67 76 72 78 Z"/>'
    + '<path class="ink" d="M33 94 C40 109 60 109 67 94 C59 100 41 100 33 94 Z"/>'
    + '</svg>';

  global.Jester = { svg: () => SVG };
})(typeof window !== "undefined" ? window : this);
