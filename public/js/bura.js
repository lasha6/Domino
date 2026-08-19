/* =====================================================================
   ბურა — the engine.

   Written the same way as the domino engine: one file, used by the server and
   the browser alike, so both sides count by identical rules and the server can
   check every move.

   Two variants, both for two players here:
     "5" — the full 36-card deck, five in hand
     "3" — sixes to nines removed (20 cards), three in hand

   Card = [suit, rank]. Ranks are stored in STRENGTH order, so a plain number
   comparison is the whole of "which card wins" — in ბურა the ten sits above
   the king, and writing that down once here keeps it from being got wrong
   everywhere else.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Bura = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SUITS = ["♠", "♥", "♦", "♣"];
  // weakest first: 6 7 8 9 J Q K 10 A
  const RANKS = ["6", "7", "8", "9", "J", "Q", "K", "10", "A"];
  const POINTS = [0, 0, 0, 0, 2, 3, 4, 10, 11];
  const SHORT_FROM = 4;            // the 3-card game starts at the jack

  const suitOf = (c) => c[0];
  const rankOf = (c) => c[1];
  const pointsOf = (c) => POINTS[c[1]];
  const nameOf = (c) => RANKS[c[1]] + SUITS[c[0]];
  const sameCard = (a, b) => a[0] === b[0] && a[1] === b[1];

  function handPoints(cards) {
    let n = 0;
    for (const c of cards) n += pointsOf(c);
    return n;
  }

  /* ---------------- the deck ---------------- */
  function makeDeck(variant) {
    const from = variant === "3" ? SHORT_FROM : 0;
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = from; r < RANKS.length; r++) d.push([s, r]);
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

  /* ---------------- who beats whom ----------------
     A trump beats anything that is not a trump. Otherwise only a higher card
     of the SAME suit beats: another suit is simply thrown away, not a cut. */
  function beats(a, b, trump) {
    const at = suitOf(a) === trump, bt = suitOf(b) === trump;
    if (at && !bt) return true;
    if (!at && bt) return false;
    return suitOf(a) === suitOf(b) && rankOf(a) > rankOf(b);
  }

  /* Can `mine` beat every one of `led`? Each led card must be answered by a
     different card of mine. Taking the strongest led card first and spending
     the weakest card that still beats it is the best you can do here — a card
     that beats a stronger led card always beats a weaker one of the same suit,
     and trumps beat everything — so a greedy pass is exact, not a guess. */
  function beatsAll(mine, led, trump) {
    if (mine.length !== led.length) return false;
    const pool = mine.slice();
    const order = led.slice().sort((x, y) => strength(y, trump) - strength(x, trump));
    for (const target of order) {
      let pick = -1, pickStrength = Infinity;
      for (let i = 0; i < pool.length; i++) {
        if (!beats(pool[i], target, trump)) continue;
        const s = strength(pool[i], trump);
        if (s < pickStrength) { pickStrength = s; pick = i; }
      }
      if (pick < 0) return false;
      pool.splice(pick, 1);
    }
    return true;
  }
  // one number for "how strong", so trumps always outrank plain cards
  const strength = (c, trump) => (suitOf(c) === trump ? 100 : 0) + rankOf(c);

  /* ---------------- a new game ---------------- */
  /* Who sits with whom. Four players are two pairs facing each other, 0+2
     against 1+3, the same seating the domino table uses. With two players a
     seat IS its team, so every rule below can be written in teams once and hold
     for both. */
  const teamOf = (g, seat) => seat % 2;
  const nextSeat = (g, seat) => (seat + 1) % g.players;
  const teamSeats = (g, team) => {
    const out = [];
    for (let s = team; s < g.players; s += 2) out.push(s);
    return out;
  };

  function newGame(opts) {
    const o = opts || {};
    // Pairs are ხუთკარტა only — the player was clear about that, and the short
    // deck could not feed four hands anyway: 20 cards, 12 dealt, 8 left over.
    const players = o.players === 4 ? 4 : 2;
    const variant = players === 4 ? "5" : (o.variant === "3" ? "3" : "5");
    const target = [6, 11, 21].includes(o.target) ? o.target : 11;
    const handSize = variant === "3" ? 3 : 5;

    const deck = shuffle(makeDeck(variant), o.rnd);
    const g = {
      variant, target, handSize, players,
      // ხუთკარტა only: whether a plain suit counts as a malutka at this table.
      // On by default — every table plays it that way unless one says otherwise.
      openMalutka: o.openMalutka !== false,
      deck, trumpCard: null, trump: null,
      hands: [], taken: [],
      scores: [0, 0],           // match points, one per TEAM
      turn: 0,                  // whose lead it is
      lead: null,               // { seat, cards }
      answers: [],              // what the others have put down, in play order
      answerSoFar: null,        // cards the answering player already has down
      answerBy: null,
      phase: "play",            // play | roundOver | over
      round: 1,
      bid: { level: 0, team: null, pending: null },  // pending = a call awaiting an answer
      log: "",
      roundWinner: null, matchWinner: null,
    };
    for (let p = 0; p < players; p++) { g.hands.push([]); g.taken.push([]); }
    for (let i = 0; i < handSize; i++) for (let p = 0; p < players; p++) g.hands[p].push(g.deck.pop());
    // the turned card sits under the deck and is the very last one drawn
    g.trumpCard = g.deck.length ? g.deck[0] : null;
    g.trump = g.trumpCard ? suitOf(g.trumpCard) : suitOf(g.hands[0][0]);
    return g;
  }

  /* ---------------- leading ----------------
     Any number of cards from one up to a full hand, all of one suit. */
  function legalLeads(hand) {
    const bySuit = {};
    hand.forEach((c, i) => { (bySuit[suitOf(c)] = bySuit[suitOf(c)] || []).push(i); });
    const out = [];
    for (const idxs of Object.values(bySuit))
      for (let n = 1; n <= idxs.length; n++) out.push(idxs.slice(0, n));
    return out;
  }
  const oneSuit = (cards) => cards.every((c) => suitOf(c) === suitOf(cards[0]));

  function canLead(g, seat, cards) {
    if (g.phase !== "play" || g.lead || g.turn !== seat) return false;
    if (!cards.length || cards.length > g.hands[seat].length) return false;
    if (!oneSuit(cards)) return false;
    return holdsAll(g.hands[seat], cards);
  }
  function holdsAll(hand, cards) {
    const pool = hand.slice();
    for (const c of cards) {
      const i = pool.findIndex((x) => sameCard(x, c));
      if (i < 0) return false;
      pool.splice(i, 1);
    }
    return true;
  }
  function removeAll(hand, cards) {
    for (const c of cards) hand.splice(hand.findIndex((x) => sameCard(x, c)), 1);
  }

  /* ---------------- მალუტკა ----------------
     A whole hand of one suit. It may be put down at any moment, in or out of
     turn — that is what "without a turn" means — and there are two ways it
     lands:

       · on an empty table, it simply becomes the lead
       · on a card somebody has just led, it is turned straight back at them:
         their card stays on the table, the malutka becomes the new target, and
         it is now THEIR job to beat it

     A hand of three trumps is what gives the game its name. In the three-card
     game any one suit will do; with five, trumps always count and a plain suit
     only if the table said so when it was made. */
  /* ---------------- ბურა ----------------
     A whole hand of trumps — three of them in the short game, five in the long
     one. It is what the game is named after, and it does not merely go on the
     table: showing it wins the round outright, at whatever the calls have made
     the round worth. */
  function isBura(g, seat) {
    const hand = g.hands[seat];
    return g.phase === "play"
        && hand.length === g.handSize
        && hand.every((c) => suitOf(c) === g.trump);
  }
  /* What a hand of trumps is worth differs between the two games, and the
     player was explicit about both: in the short game it takes the round
     outright; in the long one it is only a hand that may be put down out of
     turn, and still has to be played for. */
  const buraTakesRound = (g) => g.variant === "3";

  function canMalutka(g, seat, allowAnySuit) {
    const hand = g.hands[seat];
    if (g.phase !== "play") return false;
    if (hand.length !== g.handSize) return false;   // it has to be the whole hand
    if (!oneSuit(hand)) return false;
    if (g.lead && g.lead.seat === seat) return false;  // not on top of your own lead
    const suit = suitOf(hand[0]);
    // trumps always go down — that hand is ბურა, and putting it on the table is
    // how it is played rather than announced
    if (suit === g.trump) return true;
    if (g.variant === "3") return true;                 // three of any suit will do
    return allowAnySuit === undefined ? !!g.openMalutka : !!allowAnySuit;
  }
  // kept under its old name as well: an empty table is the out-of-turn case
  function canUnturned(g, seat, allowAnySuit) {
    return !g.lead && canMalutka(g, seat, allowAnySuit);
  }

  /* Turn a lead back on the player who made it. Their cards stay on the table
     and go with the trick; the malutka becomes what has to be beaten. */
  function malutka(g, seat, allowAnySuit) {
    if (!canMalutka(g, seat, allowAnySuit)) return false;
    const cards = g.hands[seat].slice();
    if (g.lead) {
      // their card stays where it is and counts towards their answer
      g.answerSoFar = g.lead.cards.slice();
      g.answerBy = g.lead.seat;
    }
    removeAll(g.hands[seat], cards);
    const allTrumps = cards.every((c) => suitOf(c) === g.trump);
    g.lead = { seat, cards: cards.map((c) => c.slice()), malutka: true, bura: allTrumps };
    g.turn = nextSeat(g, seat);
    g.answers = [];
    return true;
  }

  function lead(g, seat, cards, opts) {
    const out = (opts && opts.unturned)
      ? canUnturned(g, seat, opts.allowAnySuit) && holdsAll(g.hands[seat], cards) && cards.length === g.handSize
      : canLead(g, seat, cards);
    if (!out) return false;
    removeAll(g.hands[seat], cards);
    g.lead = { seat, cards: cards.map((c) => c.slice()), unturned: !!(opts && opts.unturned) };
    g.turn = nextSeat(g, seat);
    g.answers = [];
    return true;
  }

  /* ---------------- answering ----------------
     Card for card — but when a malutka is turned back, the card the other
     player had already led STAYS on the table and counts as part of their
     answer. Against a malutka of three they have one down already and add two.
     That card is left face up: the malutka was played knowing it, so hiding it
     would only be hiding it from the person who put it there. */
  function committed(g, seat) {
    return (g.answerBy === seat && g.answerSoFar) ? g.answerSoFar : [];
  }
  function answerSize(g, seat) {
    if (!g.lead) return 0;
    const still = g.lead.cards.length - committed(g, seat).length;
    return Math.max(0, Math.min(still, g.hands[seat].length));
  }
  function canAnswer(g, seat, cards) {
    if (g.phase !== "play" || !g.lead || g.turn !== seat) return false;
    if (cards.length !== answerSize(g, seat)) return false;
    return holdsAll(g.hands[seat], cards);
  }

  /* Play the answer. Returns the seat that took the trick, `null` if the move
     was not legal, and -1 when the answer was taken but the trick is still
     going round the table — which only happens with four players, so a
     two-player screen never sees it.

     Round the table, each player in turn beats what is WINNING rather than
     what was led: the trick belongs to whoever has the best cards down, and
     the next player either takes it off them or gives. Nobody is obliged to
     try. The player was asked and was clear about it: whether you beat your
     partner's card or let it through is your own business, there is no duty
     either way — so an answer that beats nothing is simply thrown in. */
  function answer(g, seat, cards) {
    if (!canAnswer(g, seat, cards)) return null;
    removeAll(g.hands[seat], cards);
    // whatever they had already put down is part of what they are answering with
    const full = committed(g, seat).concat(cards);
    g.answerSoFar = null; g.answerBy = null;
    g.answers.push({ seat, cards: full.map((c) => c.slice()) });

    let holder = g.lead.seat, held = g.lead.cards;
    for (const a of g.answers)
      if (beatsAll(a.cards, held, g.trump)) { holder = a.seat; held = a.cards; }

    if (g.answers.length < g.players - 1) {      // the rest still have to answer
      g.turn = nextSeat(g, seat);
      g.log = holder === g.lead.seat ? "ვერ გაიჭრა" : "გაიჭრა";
      return -1;
    }

    const pot = g.lead.cards.concat(...g.answers.map((a) => a.cards));
    const wasBura = !!g.lead.bura;
    const ledBy = g.lead.seat;
    g.taken[holder].push(...pot);
    g.log = holder === ledBy ? "ვერ გაიჭრა" : "გაიჭრა";
    g.lead = null; g.answers = [];
    g.turn = holder;
    // ბურა wins the round when it actually takes the trick — if the other
    // player manages to beat it, it has won nothing
    if (wasBura && holder === ledBy && buraTakesRound(g)) {
      endRound(g, teamOf(g, holder), callValue(g.bid.level), "ბურა");
      return holder;
    }
    refill(g, holder);
    if (g.hands.every((h) => !h.length)) finishRound(g);
    return holder;
  }

  /* The winner draws first and the rest follow round the table — and the
     turned trump is the very last card to leave the deck. */
  function refill(g, first) {
    const order = [];
    for (let i = 0, s = first; i < g.players; i++, s = nextSeat(g, s)) order.push(s);
    for (let i = 0; i < g.handSize; i++)
      for (const p of order)
        if (g.hands[p].length < g.handSize && g.deck.length) g.hands[p].push(g.deck.pop());
  }

  /* ---------------- calls: დავი, სე, ჩარი, ფანჯი, შაში ---------------- */
  const CALLS = ["დავი", "სე", "ჩარი", "ფანჯი", "შაში"];
  const callValue = (level) => (level <= 0 ? 1 : level + 1);   // დავი = x2
  /* Only on your own turn, and only one step above whatever stands.
     "Your own turn" means any moment the move is yours — leading, or answering
     something already on the table. Raising the price while looking at what has
     been led is a large part of the point.

     A call belongs to a SIDE, not to a chair: a raise is answered by either of
     the two opposite it, and neither of a pair may raise its own call. */
  function canCall(g, seat) {
    if (g.phase !== "play" || g.bid.pending) return false;
    if (g.bid.level >= CALLS.length) return false;
    if (g.bid.level > 0 && g.bid.team === teamOf(g, seat)) return false;  // the other side answers
    return g.turn === seat;
  }
  function call(g, seat) {
    if (!canCall(g, seat)) return false;
    g.bid.pending = { by: teamOf(g, seat), level: g.bid.level + 1, agreed: [] };
    g.log = CALLS[g.bid.level] + " — გამოძახებულია";
    return true;
  }
  /* A raise stands only once EVERY player on the other side has taken it — the
     player was explicit: both of the opposing pair have to say yes. One of them
     giving it up ends the round there and then, so the partner is never asked
     to answer for a call their side has already dropped. With two players there
     is only one to ask and this is the old behaviour exactly. */
  function pendingOpponents(g, p) { return teamSeats(g, 1 - p.by); }
  function canAnswerCall(g, seat) {
    const p = g.bid.pending;
    return !!p && teamOf(g, seat) !== p.by && p.agreed.indexOf(seat) < 0;
  }
  function acceptCall(g, seat) {
    const p = g.bid.pending;
    if (!canAnswerCall(g, seat)) return false;
    p.agreed.push(seat);
    const waiting = pendingOpponents(g, p).filter((s) => p.agreed.indexOf(s) < 0);
    if (waiting.length) {                       // the partner still has to answer
      g.log = CALLS[p.level - 1] + " — ელოდება პარტნიორს";
      return true;
    }
    g.bid = { level: p.level, team: p.by, pending: null };
    g.log = CALLS[p.level - 1] + " — მიღებულია";
    return true;
  }
  // Giving it up ends the round at once: the caller takes what the round was
  // worth BEFORE the call, and the cards stop mattering.
  function concede(g, seat) {
    const p = g.bid.pending;
    if (!canAnswerCall(g, seat)) return false;
    const worth = callValue(p.level - 1);
    g.bid = { level: p.level - 1, team: p.by, pending: null };
    endRound(g, p.by, worth, "დათმობა");
    return true;
  }


  /* ---------------- ვარ (three-card game only) ----------------
     Claim the round: right if you already hold 32 or more, and lost outright
     if you do not. */
  const VAR_NEEDED = 32;
  function canSayVar(g, seat) {
    return g.variant === "3" && g.phase === "play" && !g.lead && g.turn === seat && !g.bid.pending;
  }
  function sayVar(g, seat) {
    if (!canSayVar(g, seat)) return null;
    const mine = handPoints(g.taken[seat]);
    const right = mine >= VAR_NEEDED;
    const winner = right ? seat : 1 - seat;
    endRound(g, winner, callValue(g.bid.level), right ? "ვარ — სწორი" : "ვარ — არასწორი");
    return { right, points: mine };
  }

  /* ---------------- ending a round ----------------
     What a side took is what its players took between them. There are 120
     points in the deck, so 60 is exactly half: the player put it plainly —
     winning means 60+, and 60 apiece is a draw with nothing written down. */
  function roundStanding(g) {
    return [0, 1].map((t) =>
      teamSeats(g, t).reduce((n, s) => n + handPoints(g.taken[s]), 0));
  }
  function finishRound(g) {
    const [a, b] = roundStanding(g);
    if (a === b) return endRound(g, null, 0, "ყაიმი");         // 60 each: nobody scores
    endRound(g, a > b ? 0 : 1, callValue(g.bid.level), "რაუნდი");
  }
  function endRound(g, team, worth, why) {
    g.phase = "roundOver";
    g.roundWinner = team;
    g.roundWorth = worth;
    g.log = why;
    if (team != null) g.scores[team] += worth;
    if (Math.max(g.scores[0], g.scores[1]) >= g.target) {
      g.phase = "over";
      g.matchWinner = g.scores[0] >= g.target ? 0 : 1;
    }
  }

  // Deal again for the next round; the side that lost the last one leads.
  function nextRound(g) {
    if (g.phase !== "roundOver") return false;
    const starter = g.roundWinner == null
      ? g.turn
      : teamSeats(g, 1 - g.roundWinner)[0];
    const fresh = newGame({ variant: g.variant, target: g.target, players: g.players,
                            openMalutka: g.openMalutka });
    Object.assign(g, {
      deck: fresh.deck, trumpCard: fresh.trumpCard, trump: fresh.trump,
      hands: fresh.hands, taken: fresh.taken,
      turn: starter, lead: null, answers: [], answerSoFar: null, answerBy: null, phase: "play",
      bid: { level: 0, team: null, pending: null },
      round: g.round + 1, roundWinner: null, roundWorth: 0, log: "",
    });
    return true;
  }

  /* ---------------- a simple opponent ---------------- */
  function aiLead(g, seat) {
    const hand = g.hands[seat];
    // lead the cheapest thing, keeping points back for later
    const leads = legalLeads(hand).map((idxs) => idxs.map((i) => hand[i]));
    leads.sort((x, y) => handPoints(x) - handPoints(y) || x.length - y.length);
    return leads[0];
  }
  /* Whoever currently has the trick, and with what. Round a table of four the
     answer has to beat what is WINNING, not what was led. */
  function standing(g) {
    let holder = g.lead.seat, held = g.lead.cards;
    for (const a of g.answers)
      if (beatsAll(a.cards, held, g.trump)) { holder = a.seat; held = a.cards; }
    return { holder, held };
  }
  function aiAnswer(g, seat) {
    const hand = g.hands[seat], n = answerSize(g, seat);
    const { holder, held } = standing(g);
    const cheapest = () =>
      hand.slice().sort((a, b) => pointsOf(a) - pointsOf(b) || rankOf(a) - rankOf(b)).slice(0, n);

    /* If a partner is holding it, the trick is already coming to this side. It
       is not forbidden to take it off them — the player was clear there is no
       duty either way — but there is nothing in it, so feed them points instead
       and keep the good cards. */
    if (holder !== seat && teamOf(g, holder) === teamOf(g, seat)) {
      const last = g.answers.length === g.players - 2;   // nobody left to take it away
      if (last) return hand.slice()
        .sort((a, b) => pointsOf(b) - pointsOf(a) || rankOf(b) - rankOf(a)).slice(0, n);
      return cheapest();
    }
    // take it if that can be done, spending as little as possible
    const winners = combinations(hand, n).filter((c) => beatsAll(c, held, g.trump));
    if (winners.length) {
      winners.sort((x, y) => handPoints(x) - handPoints(y));
      return winners[0];
    }
    // otherwise throw away the cheapest cards
    return cheapest();
  }
  function combinations(arr, n) {
    const out = [];
    (function walk(start, picked) {
      if (picked.length === n) { out.push(picked.slice()); return; }
      for (let i = start; i < arr.length; i++) { picked.push(arr[i]); walk(i + 1, picked); picked.pop(); }
    })(0, []);
    return out;
  }

  return {
    SUITS, RANKS, POINTS, CALLS, VAR_NEEDED,
    suitOf, rankOf, pointsOf, nameOf, sameCard, handPoints,
    makeDeck, shuffle, beats, beatsAll, strength,
    newGame, teamOf, nextSeat, teamSeats, legalLeads, canLead, lead, canUnturned, canMalutka, malutka,
    isBura, buraTakesRound,
    canAnswer, answer, refill, answerSize, committed,
    canCall, call, canAnswerCall, acceptCall, concede, callValue,
    canSayVar, sayVar,
    roundStanding, finishRound, endRound, nextRound,
    aiLead, aiAnswer, standing, combinations,
  };
});
