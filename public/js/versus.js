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

  const open = () => showing;

  global.Versus = { show, open };
})(typeof window !== "undefined" ? window : this);
