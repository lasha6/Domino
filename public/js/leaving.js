/* =====================================================================
   Leaving a table.

   A chair is held for anybody who disappears by accident — the phone sleeping,
   the tunnel, a closed tab — and they are put back in it when they come back.
   The one way to give a chair up is to be asked and to say yes, which is what
   this does.

   It builds its own dialog rather than asking each screen to carry one, so the
   question is worded the same way everywhere and cannot drift.
   ===================================================================== */
(function (global) {
  "use strict";

  function build() {
    let ov = document.getElementById("leaveOverlay");
    if (ov) return ov;
    ov = document.createElement("div");
    ov.className = "overlay";
    ov.id = "leaveOverlay";
    ov.innerHTML =
      '<div class="modal">' +
      '  <h2 id="leaveTitle">მაგიდის დატოვება?</h2>' +
      '  <p id="leaveText">თუ დარჩები, ადგილი შენია. თუ გახვალ, ადგილს დაკარგავ და მატჩი წაგებულად ჩაგეთვლება.</p>' +
      '  <div class="modalActions">' +
      '    <button class="alt" id="leaveStay">დავრჩები</button>' +
      '    <button id="leaveGo">გასვლა</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(ov);
    return ov;
  }

  /* Ask, and only then leave. `onYes` is what actually gives the chair up —
     usually telling the server and going back to the front page. */
  function confirmLeave(onYes, words) {
    const ov = build();
    const w = words || {};
    if (w.title) ov.querySelector("#leaveTitle").textContent = w.title;
    if (w.text) ov.querySelector("#leaveText").textContent = w.text;
    const stay = ov.querySelector("#leaveStay");
    const go = ov.querySelector("#leaveGo");
    const close = () => ov.classList.remove("show");
    stay.onclick = () => { close(); if (global.Sound) Sound.play("tap"); };
    go.onclick = () => { close(); onYes(); };
    ov.classList.add("show");
  }

  /* Before a match has started there is nothing to lose by walking away, so
     the question is a lighter one. */
  function confirmLeaveWaiting(onYes) {
    confirmLeave(onYes, {
      title: "მაგიდიდან გასვლა?",
      text: "თამაში ჯერ არ დაწყებულა — ადგილს უბრალოდ დატოვებ.",
    });
  }

  global.Leaving = { confirmLeave, confirmLeaveWaiting };
})(window);
