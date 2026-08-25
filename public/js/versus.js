/* =====================================================================
   The versus card.

   How a real match is announced: who is across the table, what it is worth,
   and a word of advice while it settles. One card for all five games — the
   server sends the same `roster` and `stake` on every view, so nothing here
   knows or cares which game it is introducing beyond the tip it prints.

   It is shown ONCE per match, and only for a table with people at it: there
   is nobody to be introduced to when you are practising against the computer.
   A tap skips it, because the second time a player sees it they already know.
   ===================================================================== */
(function (global) {
  "use strict";

  /* Something true and short, and about THIS game rather than about games in
     general. A tip nobody can act on is decoration. */
  const TIPS = {
    domino: [
      "მაგიდის ღია ბოლოები დათვალე სვლამდე — ხუთზე გაყოფადი ჯამი ქულაა.",
      "დუბლი ბოლოს არ შეინახო: ბაზარი გამოილევა და ხელში დაგრჩება.",
      "თუ მოწინააღმდეგე ბაზრიდან იღებს, ის ფერი აღარ აქვს — დაიმახსოვრე.",
    ],
    bura: [
      "კოზირს ნუ დახარჯავ ადრე — ბოლო ხელები კოზირით იგება.",
      "ოცდაერთი ქულა ერთ ხელში: ტუზი და ათიანი ერთ ფერშია ყველაზე ძვირი.",
      "მოწინააღმდეგის კოზირები დათვალე — რამდენი გავიდა, იმდენი აღარ დარჩა.",
    ],
    joker: [
      "ბიდი დათვალე ხელის ნახვის შემდეგ, არა იმედით — ხიშტი ძვირია.",
      "ჯოკერი შენახვას ღირს: ბოლო ხელებში ის წყვეტს.",
      "ცხრიან ხელში კოზირის სიგრძე უფრო მნიშვნელოვანია, ვიდრე ტუზები.",
    ],
    nardi: [
      "მარტო მდგომი ქვა იჭმევა — წყვილად დააყენე, სადაც შეგიძლია.",
      "ექვსი პუნქტი ზედიზედ კედელია: მოწინააღმდეგე ვერსად გაივლის.",
      "სახლში შესვლა ააჩქარე — გატანა მხოლოდ მაშინ დაიწყება.",
    ],
    damka: [
      "ჭამა სავალდებულოა — მოწინააღმდეგეს აჭმევინე ის, რაც შენ გინდა.",
      "უკანა რიგი ბოლომდე შეინახე: სწორედ ის აჩერებს დამკად გასვლას.",
      "ქვები ერთად ატარე — მარტო დარჩენილი ქვა იჭმევა.",
    ],
  };

  const pick = (game) => {
    const list = TIPS[game] || [];
    return list.length ? list[Math.floor(Math.random() * list.length)] : "";
  };

  /* A picture if there is one, otherwise the first letter of the name struck
     into brass. The letter is left as it was typed — Georgian has no capitals
     to raise it to, only მთავრული, which is unreadable at this size. */
  function face(p) {
    const el = document.createElement("span");
    el.className = "vsFace";
    if (p.pic) {
      el.style.backgroundImage = 'url("' + String(p.pic).replace(/["\\]/g, "") + '")';
      el.classList.add("hasPic");
    } else {
      el.textContent = (p.name || "?").trim().charAt(0) || "?";
    }
    if (p.level != null) {
      const r = document.createElement("span");
      r.className = "vsRank";
      r.textContent = p.level;
      el.appendChild(r);
    }
    return el;
  }

  function player(p) {
    const row = document.createElement("div");
    row.className = "vsPlayer";
    const who = document.createElement("span");
    who.className = "vsWho";
    const name = document.createElement("b");
    name.setAttribute("data-raw", "");   // a name is not a word to look up
    name.textContent = p.name || "მოთამაშე";
    who.appendChild(name);
    if (p.bot) {
      const note = document.createElement("i");
      note.textContent = "ავტომატურად";
      who.appendChild(note);
    }
    row.appendChild(face(p));
    row.appendChild(who);
    return row;
  }

  let wrap = null, timer = null, showing = false;

  function build() {
    if (wrap) return wrap;
    wrap = document.createElement("div");
    wrap.className = "vsWrap";
    wrap.innerHTML =
      '<div class="vsCard">' +
      '  <div class="vsRow">' +
      '    <div class="vsSide left"></div>' +
      '    <div class="vsMark"><span></span><b>VS</b><span></span></div>' +
      '    <div class="vsSide right"></div>' +
      '  </div>' +
      '  <div class="vsStake"><i></i><em></em><b></b></div>' +
      '  <div class="vsTip"></div>' +
      '  <div class="vsBar"><i></i></div>' +
      "</div>";
    document.body.appendChild(wrap);
    return wrap;
  }

  /* `st` is any game's state as the server sends it. Everything the card needs
     is on it already: who is seated, which side they are on, and what the
     match is worth. */
  function show(st, opts) {
    const o = opts || {};
    const ms = o.ms || 2600;
    const list = (st && st.roster) || [];
    if (showing || list.length < 2) return Promise.resolve(false);
    // nobody to be introduced to: a table of one, or one with a computer in it
    if (!list.some((p) => p.me) || list.every((p) => p.me || p.bot)) return Promise.resolve(false);

    const el = build();
    const mine = list.find((p) => p.me);
    const ours = list.filter((p) => p.team === mine.team);
    const theirs = list.filter((p) => p.team !== mine.team);
    if (!theirs.length) return Promise.resolve(false);

    const left = el.querySelector(".vsSide.left");
    const right = el.querySelector(".vsSide.right");
    left.innerHTML = ""; right.innerHTML = "";
    // mine first on my own side, so the eye starts where the player is
    ours.sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0)).forEach((p) => left.appendChild(player(p)));
    theirs.forEach((p) => right.appendChild(player(p)));

    const stake = st.stake || 0;
    const box = el.querySelector(".vsStake");
    box.style.display = stake > 0 ? "" : "none";
    box.querySelector("em").textContent = "ფსონი";
    box.querySelector("b").textContent = stake.toLocaleString("en-US");

    el.querySelector(".vsTip").textContent = pick(o.game || st.game);
    el.style.setProperty("--vsMs", ms + "ms");
    // restart the bar: a class alone would not replay an animation
    const bar = el.querySelector(".vsBar i");
    bar.style.animation = "none";
    void bar.offsetWidth;
    bar.style.animation = "";

    showing = true;
    el.classList.add("show");
    if (global.Sound) Sound.play("score");

    return new Promise((done) => {
      const finish = () => {
        if (!showing) return;
        showing = false;
        clearTimeout(timer);
        el.removeEventListener("click", finish);
        el.classList.remove("show");
        done(true);
      };
      // a tap skips it: the second time a player sees this they already know
      el.addEventListener("click", finish);
      timer = setTimeout(finish, ms);
    });
  }

  /* ---------------- the end of it ----------------
     The card that announces a match should have a twin that closes it. The
     start of a match was an occasion and the end of one was a line of text —
     which is the wrong way round, because the end is the part a player came
     for. Same two sides, the winning one lit; then the things a player wants
     counted out rather than stated: the coins, and the bar towards the next
     level.

     It does not replace the dialog that follows it. That dialog owns the
     buttons, and taking those over would mean five screens rewiring what
     happens next for the sake of a flourish. */
  function count(el, from, to, ms) {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      // fast first, then settling — a number that lands rather than stops
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e).toLocaleString("en-US");
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  let rWrap = null, rTimer = null;
  function resultBuild() {
    if (rWrap) return rWrap;
    rWrap = document.createElement("div");
    rWrap.className = "vsWrap vsEnd";
    rWrap.innerHTML =
      '<div class="vsCard">' +
      '  <div class="vsVerdict"></div>' +
      '  <div class="vsRow">' +
      '    <div class="vsSide left"></div>' +
      '    <div class="vsMark"><span></span><b class="vsScore"></b><span></span></div>' +
      '    <div class="vsSide right"></div>' +
      '  </div>' +
      '  <div class="vsPurse"><i></i><b>0</b><em></em></div>' +
      /* The rating gets the same treatment as the coins, and stands next to
         them: they are the two things a match moved, and a player should see
         both move rather than read one and be told the other. */
      '  <div class="vsRate"><i></i><b>0</b><em></em></div>' +
      '  <div class="vsXp"><span class="vsXpBar"><i></i></span><em></em></div>' +
      "</div>";
    document.body.appendChild(rWrap);
    return rWrap;
  }

  /* `st` is the last state seen (for the roster); `r` is the matchOver payload
     exactly as the server sends it. */
  function result(st, r) {
    const o = r || {};
    const ms = o.ms || 3200;
    const list = (st && st.roster) || [];
    if (showing) return Promise.resolve(false);
    const mine = list.find((p) => p.me);
    if (!mine || list.length < 2) return Promise.resolve(false);
    const ours = list.filter((p) => p.team === mine.team);
    const theirs = list.filter((p) => p.team !== mine.team);
    if (!theirs.length) return Promise.resolve(false);

    const el = resultBuild();
    const won = !!o.youWon;
    el.classList.toggle("weWon", won);

    const left = el.querySelector(".vsSide.left");
    const right = el.querySelector(".vsSide.right");
    left.innerHTML = ""; right.innerHTML = "";
    ours.sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0)).forEach((p) => left.appendChild(player(p)));
    theirs.forEach((p) => right.appendChild(player(p)));
    left.classList.toggle("beat", !won);
    right.classList.toggle("beat", won);

    el.querySelector(".vsVerdict").textContent =
      o.draw ? "ფრე" : won ? "მოიგე!" : "წააგე";

    const sc = el.querySelector(".vsScore");
    if (Array.isArray(o.scores) && o.scores.length >= 2) {
      const t = o.myTeam || 0;
      sc.textContent = o.scores[t] + " : " + o.scores[1 - t];
    } else sc.textContent = "—";   // the word above already says who won

    /* The coins are counted, not stated. A number that arrives already at its
       new value tells a player nothing about what just happened to it. */
    const purse = el.querySelector(".vsPurse");
    const settled = o.settled;
    if (settled && typeof settled.after === "number") {
      const before = settled.after - (settled.delta || 0);
      purse.style.display = "";
      purse.classList.toggle("lost", (settled.delta || 0) < 0);
      purse.querySelector("em").textContent =
        (settled.delta > 0 ? "+" : "") + (settled.delta || 0).toLocaleString("en-US");
      const b = purse.querySelector("b");
      b.textContent = before.toLocaleString("en-US");
      setTimeout(() => count(b, before, settled.after, 1100), 620);
    } else purse.style.display = "none";

    /* And the rating, counted the same way and a beat later, so the two
       numbers move one after the other rather than together — two things
       climbing at once is a slot machine, not a result. */
    const rate = el.querySelector(".vsRate");
    const rt = o.rating;
    if (rt && typeof rt.after === "number" && rt.move) {
      const from = Math.max(0, rt.after - rt.move);
      rate.style.display = "";
      rate.classList.toggle("lost", rt.move < 0);
      rate.querySelector("em").textContent = (rt.move > 0 ? "+" : "") + rt.move;
      const rb = rate.querySelector("b");
      rb.textContent = String(from);
      setTimeout(() => count(rb, from, rt.after, 900), 1000);
    } else rate.style.display = "none";

    const xp = el.querySelector(".vsXp");
    const p = o.progress;
    if (p && typeof p.into === "number" && p.need) {
      xp.style.display = "";
      xp.querySelector("em").textContent = "დონე " + p.level;
      const bar = xp.querySelector(".vsXpBar i");
      bar.style.width = "0%";
      setTimeout(() => { bar.style.width = Math.max(2, Math.min(100, p.into / p.need * 100)) + "%"; }, 700);
    } else xp.style.display = "none";

    showing = true;
    el.classList.add("show");
    if (global.Haptic) Haptic.tap(won ? "win" : "lose");

    return new Promise((done) => {
      const finish = () => {
        if (!showing) return;
        showing = false;
        clearTimeout(rTimer);
        el.removeEventListener("click", finish);
        el.classList.remove("show");
        done(true);
      };
      el.addEventListener("click", finish);
      rTimer = setTimeout(finish, ms);
    });
  }

  const open = () => showing;

  global.Versus = { show, result, open };
})(typeof window !== "undefined" ? window : this);
