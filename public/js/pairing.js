/* =====================================================================
   The 2v2 waiting room — who you play WITH.

   Written once and used by every game that seats four, because it was
   written once and used by one: დომინო had it, ბურა and ჯოკერი did not, and
   at those two tables your partner was simply whoever joined in step with
   you. Four names and no way to choose between them is not a waiting room,
   it is a queue.

   Nothing here decides anything. The server owns who is paired with whom
   (`choosePartner` / `stayAlone`) and says so in every state; this only
   draws what it was told and sends back what was tapped.
   ===================================================================== */
(function (global) {
  "use strict";

  const doc = global.document;
  let cdTimer = null, cdLeft = 0;

  /* The server pushes a state when something happens, not once a second, so
     the countdown to sitting everybody down has to run locally. */
  function paint() {
    const el = doc.getElementById("autoCount");
    if (el) el.innerHTML = "მაგიდა სავსეა — <b>" + cdLeft + " წმ</b>-ში ავტომატურად დავსხდებით";
  }
  function startCountdown(secs) {
    cdLeft = secs; paint();
    if (cdTimer) return;
    cdTimer = setInterval(() => {
      cdLeft = Math.max(0, cdLeft - 1);
      paint();
      if (cdLeft === 0) stopCountdown();
    }, 1000);
  }
  function stopCountdown() { if (cdTimer) { clearInterval(cdTimer); cdTimer = null; } }

  /* `st.pairs` and not `st.size === 4`: ჯოკერი seats four and is usually
     every player for themselves, and offering partners there would be
     offering something the table does not have. */
  function render(box, st, socket) {
    if (!box) return;
    if (!st || !st.pairs || !st.lobby) { clear(box); return; }
    box.innerHTML = "";

    st.lobby.forEach((p) => {
      const row = doc.createElement("div");
      row.className = "lrow" + (p.me ? " me" : "");

      /* A name is typed by a stranger, so it is set as TEXT and never as
         markup — and it is never translated either, which is what data-raw
         says to i18n. */
      const nameEl = doc.createElement("span");
      nameEl.className = "lname";
      nameEl.setAttribute("data-raw", "1");
      nameEl.textContent = p.name + (p.me ? " (შენ)" : "");
      if (p.verified) {
        const tick = doc.createElement("span");
        tick.className = "vtick";
        tick.textContent = "✓";
        tick.title = "დამოწმებული სახელი";
        nameEl.appendChild(tick);
      }
      row.appendChild(nameEl);

      const team = doc.createElement("span");
      team.className = "lteam" + (p.team === 0 ? " t0" : p.team === 1 ? " t1" : "");
      team.textContent = p.team === 0 ? "წყვილი A" : p.team === 1 ? "წყვილი B" : "უწყვილო";
      row.appendChild(team);

      if (p.pairable) {
        const b = doc.createElement("button");
        b.textContent = "დაწყვილდი";
        b.onclick = () => socket.emit("choosePartner", { idx: p.idx });
        row.appendChild(b);
      }
      box.appendChild(row);
    });

    /* The countdown goes ABOVE the hint, and both are appended after the
       rows — the order the eye reads them in: who is here, how long there
       is, then what to do about it. */
    if (st.autoStartIn != null) {
      const c = doc.createElement("div");
      c.className = "lobbyHint"; c.id = "autoCount";
      box.appendChild(c);
      startCountdown(st.autoStartIn);
    } else {
      stopCountdown();
    }

    const hint = doc.createElement("div");
    hint.className = "lobbyHint";
    if (st.canStayAlone) {
      hint.appendChild(doc.createTextNode("შენს წყვილს ელოდები? "));
      const b = doc.createElement("button");
      b.textContent = "მარტო დაველოდები";
      b.className = "lobbyAlone";
      b.onclick = () => socket.emit("stayAlone");
      hint.appendChild(b);
    } else {
      hint.textContent = "აირჩიე ვისთან გინდა წყვილში, ან დაელოდე შენს ადამიანს";
    }
    box.appendChild(hint);
  }

  function clear(box) {
    stopCountdown();
    if (box) box.innerHTML = "";
  }

  global.Pairing = { render, clear };
})(typeof window !== "undefined" ? window : this);
