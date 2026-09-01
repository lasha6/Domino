/* =====================================================================
   The mark that stands for each game.

   One drawing per game, used in two places: large above the game's own
   heading, and small on the card that chooses it. It lived in the markup
   twice — which is how the picker ended up showing a raw 🃏 emoji beside
   three hand-drawn marks, and how დომინო's card showed two blank slabs
   while its own screen showed tiles with pips on them. A drawing that
   exists twice is a drawing that will differ twice.

   Elements and CSS, never an image: the app has to work with no network
   once it is installed, and the card faces are painted with the shop's
   own --bone-*, so a player who buys a set sees it in both places.

   Styles: `css/lobby.css` (.gameArt, .mcard, .tiles) and `css/cards.css`
   (.jkArt, for the jester's colours).
   ===================================================================== */
(function (global) {
  "use strict";

  // a 3×3 face: `i` is a pip, `_` a gap — written out so it reads as a face
  const face = (rows) =>
    '<div class="pips">' +
    rows.split("").map((c) => (c === "i" ? "<i></i>" : "<span></span>")).join("") +
    "</div>";

  const tile = (which, a, b) =>
    '<div class="tile ' + which + '">' +
    '<div class="half">' + face(a) + "</div>" +
    '<div class="half">' + face(b) + "</div></div>";

  const card = (cls, suit) =>
    '<div class="mcard ' + cls + '">' +
    '<span class="cnr">' + suit + "</span>" +
    '<span class="big">' + suit + "</span></div>";

  // a die face, same 3×3 idea: `i` is a pip, `_` a gap
  const die = (which, pips) =>
    '<div class="die ' + which + '"><span class="dp">' +
    pips.split("").map((c) => (c === "i" ? "<i></i>" : "<b></b>")).join("") +
    "</span></div>";

  const MARKS = {
    // two tiles, fanned, with the groove and the brass pin between the halves
    domino: () =>
      '<div class="tiles">' +
      tile("a", "i_i_i_i_i", "____i____") +          // five and one
      tile("b", "i_ii_ii_i", "i_i___i_i") +          // six and four
      "</div>",

    // ბურა: two cards, lying the way the dominoes lie
    bura: () =>
      '<div class="gameArt fan2">' +
      card("black back", "♠") + card("red fore", "♥") +
      "</div>",

    // ჯოკერი: three, and the one in front is why the game has a name
    joker: () =>
      '<div class="gameArt fan3">' +
      card("red back", "♦") + card("black fore", "♠") +
      '<div class="mcard jok"><span class="cnr">ჯოკ</span>' +
      (global.Jester ? global.Jester.svg() : "") + "</div>" +
      "</div>",

    // ნარდი: a slice of its own board, and the two dice always on it
    nardi: () =>
      '<div class="gameArt nard">' +
      '<div class="pts"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      die("a", "i___i___i") + die("b", "i_i___i_i") +
      "</div>",
  };

  const html = (game) => (MARKS[game] ? MARKS[game]() : "");

  /* Fill in every placeholder on the page. Called once the scripts are in;
     a placeholder naming a game that does not exist is left empty rather
     than throwing, because a missing picture must not take a screen down. */
  function paint(root) {
    const where = (root || global.document).querySelectorAll("[data-mark]");
    for (let i = 0; i < where.length; i++) {
      where[i].innerHTML = html(where[i].getAttribute("data-mark"));
    }
  }

  global.GameMark = { html, paint, games: Object.keys(MARKS) };
})(typeof window !== "undefined" ? window : this);
