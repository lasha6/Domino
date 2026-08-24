/* =====================================================================
   ჯოკერი — the engine.

   Written the same way as the domino and ბურა engines: one file, used by the
   server and the browser alike, so both sides count by identical rules and the
   server can check every move.

   Four players, and — unlike ბურა — no teams. Everybody plays for themselves.

   Card = [suit, rank]. Ranks are stored in STRENGTH order, so a plain number
   comparison is the whole of "which card wins". The order here is NOT ბურა's:
   the ten sits BELOW the jack, and the player was explicit about it. Writing it
   down once here keeps it from being got wrong everywhere else.

   The jokers are cards too, with suit JOKER (4). There are two and they are
   equal, which is why they carry an index rather than a rank.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Joker = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SUITS = ["♠", "♥", "♦", "♣"];
  const JOKER = 4;                       // the fifth "suit": neither red nor black
  // weakest first, so a > b means a wins
  const RANKS = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const NOTRUMP = -1;                    // ბეზი

  const suitOf = (c) => c[0];
  const rankOf = (c) => c[1];
  const isJoker = (c) => c[0] === JOKER;
  const sameCard = (a, b) => a[0] === b[0] && a[1] === b[1];
  const nameOf = (c) => (isJoker(c) ? "ჯოკერი" : RANKS[c[1]] + SUITS[c[0]]);

  /* ---------------- how a hand is held ----------------
     Trumps first and highest first, the other suits after them, the jokers on
     the end. A player has to see at a glance what he holds and in which suit
     before he can say what he will take, and a shuffled fan tells him nothing.

     It is sorted again when the trump is named, because until then there is no
     first suit to put first. */
  const isRed = (s) => s === 1 || s === 2;          // ♥ and ♦

  /* Trumps first, and after them the colours alternate: two red suits side by
     side blur into one long red block, and the player is counting suits, not
     admiring them. */
  function suitOrder(trump) {
    const out = [];
    let rest = [0, 1, 2, 3];
    if (trump != null && trump !== NOTRUMP) {
      out.push(trump);
      rest = rest.filter((s) => s !== trump);
    }
    while (rest.length) {
      const wantRed = out.length ? !isRed(out[out.length - 1]) : false;
      let i = rest.findIndex((s) => isRed(s) === wantRed);
      if (i < 0) i = 0;
      out.push(rest[i]);
      rest.splice(i, 1);
    }
    return out;
  }

  function sortHand(hand, trump) {
    const order = suitOrder(trump);
    const bySuit = (c) => {
      const s = suitOf(c);
      return s === JOKER ? 9 : order.indexOf(s);   // the jokers go last, always
    };
    hand.sort((a, b) => bySuit(a) - bySuit(b) || rankOf(b) - rankOf(a));
    return hand;
  }
  const sortHands = (g) => { g.hands.forEach((h) => sortHand(h, g.trump)); return g; };

  /* The deck: 36 cards, but the two BLACK sixes are not in it — the jokers take
     their place. So 34 ordinary cards and two jokers. */
  function makeDeck() {
    const d = [];
    for (let s = 0; s < 4; s++)
      for (let r = 0; r < RANKS.length; r++) {
        const blackSix = r === 0 && (s === 0 || s === 3);      // ♠6 and ♣6
        if (!blackSix) d.push([s, r]);
      }
    d.push([JOKER, 0], [JOKER, 1]);
    return d;
  }
  function shuffle(d, rnd) {
    const r = rnd || Math.random;
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  /* ---------------- the twenty-four hands ----------------
     Four sets: up from one to eight, four nines, back down from eight to one,
     four nines again. The set a hand belongs to decides what a ხიშტი costs. */
  const SET_SIZES = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [9, 9, 9, 9],
    [8, 7, 6, 5, 4, 3, 2, 1],
    [9, 9, 9, 9],
  ];
  const SCHEDULE = (function () {
    const out = [];
    SET_SIZES.forEach((sizes, i) => {
      sizes.forEach((size, j) => out.push({ set: i + 1, size, first: j === 0, last: j === sizes.length - 1 }));
    });
    return out;
  })();
  const HANDS = SCHEDULE.length;                              // 24

  /* ---------------- scoring ----------------
     Exact: fifty a trick and fifty for being right, so 0/0 is 50 and 3/3 is
     200. Bidding every trick and taking every trick is worth a hundred each
     instead — and only then; taking them all without having said so is still a
     miss. A miss is ten a trick. And ხიშტი: having said you would take at
     least one and taken none costs 200 in the short sets, 500 in the nines. */
  const WHIST = { 1: -200, 2: -500, 3: -200, 4: -500 };
  function handScore(bid, took, size, set) {
    if (bid === took) {
      if (bid === size) return 100 * size;                    // all of them, called
      return bid * 50 + 50;
    }
    if (bid >= 1 && took === 0) return WHIST[set];            // ხიშტი
    return took * 10;
  }

  /* Which card takes the trick.

     A joker played high takes it, and if there are two of them the one played
     LAST does — the player was asked and was clear. A joker played low takes
     nothing; it is a card thrown away, which is the whole point of it.

     Otherwise the highest trump wins, or, if no trump was played, the highest
     card of the suit that was led. A card of any other suit cannot win however
     big it is. */
  function trickWinner(trick, trump, ledSuit) {
    let best = -1, bestKey = null;
    trick.forEach((p, i) => {
      let key = null;
      if (isJoker(p.card)) {
        if (p.high) key = [3, 0];                             // above everything
      } else if (trump !== NOTRUMP && suitOf(p.card) === trump) {
        key = [2, rankOf(p.card)];
      } else if (suitOf(p.card) === ledSuit) {
        key = [1, rankOf(p.card)];
      }
      if (!key) return;
      // ">=" so that the later of two equal jokers takes it
      if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] >= bestKey[1])) {
        best = i; bestKey = key;
      }
    });
    return best < 0 ? 0 : best;      // somebody always takes it
  }

  /* ---------------- a new match ---------------- */
  function newGame(opts) {
    const o = opts || {};
    return {
      players: 4,
      hand: 0,                       // index into SCHEDULE
      dealer: o.dealer != null ? o.dealer : 0,
      scores: [0, 0, 0, 0],
      // every hand's result, so a set bonus can be worked out from the record
      history: [],
      bonuses: {},                   // what each set was worth on top, by set number
      phase: "deal",                 // deal | choose | bid | play | handOver | over
      rnd: o.rnd || null,
      hands: [[], [], [], []],
      deck: [], turned: null, trump: NOTRUMP,
      bids: [null, null, null, null],
      took: [0, 0, 0, 0],
      turn: 0,
      trick: [], ledSuit: null, lastTrick: null,
      log: "",
      winner: null,
    };
  }

  const spec = (g) => SCHEDULE[g.hand];
  const nextSeat = (g, s) => (s + 1) % g.players;
  const leftOfDealer = (g) => nextSeat(g, g.dealer);

  /* ---------------- dealing ----------------
     In the small hands the top card of what is left is turned and its suit is
     trump — a turned joker means ბეზი, no trump at all.

     In the nines there is nothing left to turn: four times nine is the whole
     deck. So dealing stops when the player on the dealer's left has three
     cards, and THAT player names the trump, or ბეზი, seeing only those three.
     Then the rest is dealt. */
  function deal(g) {
    if (g.phase !== "deal") return false;
    const s = spec(g);
    g.deck = shuffle(makeDeck(), g.rnd);
    g.hands = [[], [], [], []];
    g.bids = [null, null, null, null];
    g.took = [0, 0, 0, 0];
    g.trick = []; g.ledSuit = null; g.lastTrick = null;
    g.turned = null; g.trump = NOTRUMP;

    if (s.size === 9) {
      // three cards to the player who will choose, and nothing more yet
      const chooser = leftOfDealer(g);
      for (let i = 0; i < 3; i++) g.hands[chooser].push(g.deck.pop());
      sortHands(g);
      g.phase = "choose";
      g.turn = chooser;
      g.log = "კოზირს აცხადებს";
      return true;
    }

    for (let i = 0; i < s.size; i++)
      for (let p = 0, seat = leftOfDealer(g); p < g.players; p++, seat = nextSeat(g, seat))
        g.hands[seat].push(g.deck.pop());
    g.turned = g.deck.pop() || null;
    g.trump = (g.turned && !isJoker(g.turned)) ? suitOf(g.turned) : NOTRUMP;
    sortHands(g);
    startBidding(g);
    return true;
  }

  // the chooser has seen three cards and names a suit, or ბეზი
  function chooseTrump(g, seat, trump) {
    if (g.phase !== "choose" || seat !== g.turn) return false;
    const ok = trump === NOTRUMP || (trump >= 0 && trump < 4);
    if (!ok) return false;
    g.trump = trump;
    // now the rest of the deal, the chooser included
    const s = spec(g);
    while (g.deck.length)
      for (let p = 0, st = leftOfDealer(g); p < g.players && g.deck.length; p++, st = nextSeat(g, st))
        if (g.hands[st].length < s.size) g.hands[st].push(g.deck.pop());
    sortHands(g);           // the trump is known now, so it goes to the front
    startBidding(g);
    return true;
  }

  /* ---------------- bidding ----------------
     Round the table from the dealer's left, the dealer last — and the dealer
     may not make the bids add up to the number of tricks. Somebody has to be
     wrong, which is what makes the hand worth playing. */
  function startBidding(g) {
    g.phase = "bid";
    g.turn = leftOfDealer(g);
    g.log = "ბიდი";
  }
  const bidsIn = (g) => g.bids.filter((b) => b != null).length;
  const bidTotal = (g) => g.bids.reduce((n, b) => n + (b || 0), 0);
  function forbiddenBid(g, seat) {
    // only the dealer is restricted, and only on the last bid of the hand
    if (seat !== g.dealer || bidsIn(g) !== g.players - 1) return null;
    const left = spec(g).size - bidTotal(g);
    return left >= 0 && left <= spec(g).size ? left : null;
  }
  function canBid(g, seat, n) {
    if (g.phase !== "bid" || g.turn !== seat) return false;
    if (!Number.isInteger(n) || n < 0 || n > spec(g).size) return false;
    return n !== forbiddenBid(g, seat);
  }
  function bid(g, seat, n) {
    if (!canBid(g, seat, n)) return false;
    g.bids[seat] = n;
    if (bidsIn(g) === g.players) {
      g.phase = "play";
      g.turn = leftOfDealer(g);       // the first to bid is the first to lead
      g.log = "";
    } else {
      g.turn = nextSeat(g, seat);
    }
    return true;
  }

  /* ---------------- playing ----------------
     Follow the suit that was led. Without it you must trump. Without that
     either, anything. A joker may always be played, whatever you are holding —
     that is what makes it a joker. */
  const hasSuit = (hand, suit) => suit != null && suit !== NOTRUMP
    && hand.some((c) => !isJoker(c) && suitOf(c) === suit);

  function legalPlays(g, seat) {
    const hand = g.hands[seat];
    if (!g.trick.length) return hand.slice();          // leading: anything
    const jokers = hand.filter(isJoker);
    /* A joker led high asks for a suit, and the highest card of it. Only the
       highest — a lower one is not a legal answer. */
    const lead = g.trick[0];
    if (isJoker(lead.card) && lead.high) {
      const mine = hand.filter((c) => !isJoker(c) && suitOf(c) === g.ledSuit);
      if (mine.length) {
        let top = mine[0];
        mine.forEach((c) => { if (rankOf(c) > rankOf(top)) top = c; });
        return jokers.concat([top]);
      }
    } else if (hasSuit(hand, g.ledSuit)) {
      return jokers.concat(hand.filter((c) => !isJoker(c) && suitOf(c) === g.ledSuit));
    }
    if (g.trump !== NOTRUMP && hasSuit(hand, g.trump))
      return jokers.concat(hand.filter((c) => !isJoker(c) && suitOf(c) === g.trump));
    return hand.slice();
  }
  const canPlay = (g, seat, card) =>
    g.phase === "play" && g.turn === seat
    && legalPlays(g, seat).some((c) => sameCard(c, card));

  /* opts for a joker:
       high  — true takes the trick, false gives it away
       suit  — only when LEADING: the suit everyone is then asked for

     Leading a joker is a declaration, and there are two of them.

     "The joker takes it" (high): everybody owes the HIGHEST card they hold of
     the named suit, and the joker wins.

     "Let hearts take it" (low): the named suit decides instead. Nobody owes
     their highest — the player gave the example himself: hearts is called,
     ნინო holds the ten and გიორგი the six and the ace, and გიორგი may put down
     the six and let ნინო have it, or put down the ace and take it. Which is
     exactly an ordinary lead of that suit, so it is played as one: follow it if
     you hold it, trump it if you do not, and the best card wins. A trump does
     take it, and if the suit turns out to be in nobody's hand the joker takes
     it after all — both of those the player was asked about.

     Omitting high on a lead means the joker takes it, which is the older and
     commoner of the two. */
  function play(g, seat, card, opts) {
    if (!canPlay(g, seat, card)) return false;
    const o = opts || {};
    const leading = g.trick.length === 0;
    let high = true, askSuit = null;

    if (isJoker(card)) {
      if (leading) {
        askSuit = o.suit;
        if (!(askSuit >= 0 && askSuit < 4)) return false;      // a suit must be named
        high = o.high !== false;
      } else {
        high = !!o.high;
      }
    }

    const i = g.hands[seat].findIndex((c) => sameCard(c, card));
    g.hands[seat].splice(i, 1);
    g.trick.push({ seat, card: card.slice(), high, suit: askSuit });

    if (leading) g.ledSuit = isJoker(card) ? askSuit : suitOf(card);
    if (g.trick.length < g.players) { g.turn = nextSeat(g, seat); return true; }

    // the trick is complete
    const w = trickWinner(g.trick, g.trump, g.ledSuit);
    const winner = g.trick[w].seat;
    g.took[winner]++;
    g.lastTrick = { cards: g.trick.slice(), winner, ledSuit: g.ledSuit };
    g.trick = []; g.ledSuit = null;
    g.turn = winner;
    if (g.hands.every((h) => !h.length)) finishHand(g);
    return true;
  }

  /* ---------------- the end of a hand ---------------- */
  function finishHand(g) {
    const s = spec(g);
    const points = [0, 1, 2, 3].map((p) => handScore(g.bids[p], g.took[p], s.size, s.set));
    points.forEach((n, p) => { g.scores[p] += n; });
    g.history.push({ hand: g.hand, set: s.set, size: s.size,
                     bids: g.bids.slice(), took: g.took.slice(), points });
    g.lastPoints = points;
    g.setBonus = null;

    /* The set bonus. Getting every single bid in a set exactly right is worth
       the best hand of it again. A bid of nothing counts as well, as long as it
       was right — the player was asked about that too. */
    if (s.last) {
      const rows = g.history.filter((h) => h.set === s.set);
      const bonus = [0, 0, 0, 0];
      for (let p = 0; p < 4; p++) {
        if (!rows.every((h) => h.bids[p] === h.took[p])) continue;
        bonus[p] = Math.max(...rows.map((h) => h.points[p]));
      }
      if (bonus.some((n) => n > 0)) {
        bonus.forEach((n, p) => { g.scores[p] += n; });
        g.setBonus = bonus;
      }
      // kept whether it was won or not, so the record can total the set
      g.bonuses[s.set] = bonus;
    }

    g.phase = "handOver";
    g.log = "ხელი დასრულდა";
  }

  // deal the next one; the deal moves round the table
  function nextHand(g) {
    if (g.phase !== "handOver") return false;
    if (g.hand + 1 >= HANDS) {
      g.phase = "over";
      let best = 0;
      g.scores.forEach((n, p) => { if (n > g.scores[best]) best = p; });
      g.winner = best;
      return true;
    }
    g.hand++;
    g.dealer = nextSeat(g, g.dealer);
    g.phase = "deal";
    deal(g);
    return true;
  }

  /* ---------------- a simple opponent ----------------
     Enough to hold a seat: it counts the cards it thinks will win, bids that,
     and then plays to make the bid rather than at random. */
  function aiBid(g, seat) {
    const hand = g.hands[seat];
    let n = 0;
    hand.forEach((c) => {
      if (isJoker(c)) { n++; return; }
      if (g.trump !== NOTRUMP && suitOf(c) === g.trump) { if (rankOf(c) >= 5) n++; return; }
      if (rankOf(c) >= 7) n++;                       // king or ace
    });
    n = Math.min(n, spec(g).size);
    const no = forbiddenBid(g, seat);
    if (n === no) n = n > 0 ? n - 1 : n + 1;
    return n;
  }
  function aiPlay(g, seat) {
    const legal = legalPlays(g, seat);
    const wantMore = g.took[seat] < g.bids[seat];
    const plain = legal.filter((c) => !isJoker(c));
    const pick = (arr, big) => arr.slice().sort((a, b) =>
      big ? rankOf(b) - rankOf(a) : rankOf(a) - rankOf(b))[0];
    if (!plain.length) {
      /* Only jokers left. Taking the trick if one is still wanted, giving it
         away if not — and when leading, calling the suit it holds least of, so
         that whatever it asks for is unlikely to come back to it. */
      const opts = { high: wantMore };
      if (!g.trick.length) {
        const count = [0, 0, 0, 0];
        g.hands.forEach((h, p) => { if (p === seat) h.forEach((c) => { if (!isJoker(c)) count[suitOf(c)]++; }); });
        let pick = 0;
        count.forEach((n, i) => { if (n < count[pick]) pick = i; });
        opts.suit = pick;
      }
      return { card: legal[0], opts };
    }
    const card = pick(plain, wantMore);
    return { card, opts: {} };
  }

  return {
    SUITS, RANKS, JOKER, NOTRUMP, SET_SIZES, SCHEDULE, HANDS, WHIST,
    suitOf, rankOf, isJoker, sameCard, nameOf, makeDeck, shuffle,
    handScore, trickWinner, sortHand, suitOrder,
    newGame, deal, chooseTrump, spec, nextSeat, leftOfDealer,
    startBidding, canBid, bid, forbiddenBid, bidTotal, bidsIn,
    legalPlays, canPlay, play, finishHand, nextHand,
    aiBid, aiPlay,
  };
});
