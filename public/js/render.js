/* =====================================================================
   Shared domino rendering — used by both the vs-computer screen and the
   online screen, so tiles look and behave identically everywhere.

   Layout: the board is drawn like a real table. The chain runs left/right and
   FOLDS onto another row when it gets long; the spinner's arms run up/down and
   fold sideways the same way. At every turn the tile is stood on its other axis
   so it bridges the two runs end-to-end — a fold must never read as a loose
   open end. Several fold combinations are tried and the one that keeps the
   tiles biggest (without any overlap) wins, so nothing ever needs scrolling.
   ===================================================================== */
(function (global) {
  "use strict";

  // Pip layouts in a 3x3 grid (indices 0..8), one map per orientation so a 6
  // reads as two columns standing up and two rows lying down.
  //   0 1 2
  //   3 4 5
  //   6 7 8
  const PATTERNS_V = {0:[],1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  const PATTERNS_H = {0:[],1:[4],2:[2,6],3:[2,4,6],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,1,2,6,7,8]};

  function half(n, horiz) {
    const p = horiz ? PATTERNS_H[n] : PATTERNS_V[n];
    let c = "";
    for (let i = 0; i < 9; i++) c += '<span class="pip">' + (p.includes(i) ? "<i></i>" : "") + "</span>";
    return '<div class="dhalf">' + c + "</div>";
  }
  function domV(x, y) { return '<div class="domino">' + half(x,false) + '<div class="dbar"></div>' + half(y,false) + "</div>"; }
  function backTile() { return '<div class="domino back">' + half(0,false) + '<div class="dbar"></div>' + half(0,false) + "</div>"; }

  // `flip` swaps the halves so the matching pip always faces its neighbour.
  function boardTileInner(e, horiz, flip) {
    const a = flip ? e[1] : e[0], b = flip ? e[0] : e[1];
    return half(a, horiz) + '<div class="dbar"></div>' + half(b, horiz);
  }

  const HW = 52, HH = 26, VW = 26, VH = 52;   // lying / standing tile size
  const GAP = 3;
  const PITCH = VH;          // runs sit exactly one tile-length apart, so a single
                             // turned tile bridges them end to end
  const INSET = (HW - VW) / 2;   // 13 — offset of a run's tile band inside its lane
  const MAXSCALE = 2.3;
  const MAX_ROWS = 4;
  // Tiles per arm lane before it turns. Never 1 — that would make every tile a
  // turn, so the arm would lie flat sideways instead of standing up.
  const ARM_FOLDS = [99, 4, 3, 2];

  const bandY = (r) => r * PITCH;
  const rowY  = (r) => bandY(r) + INSET;

  /* ---------- the chain: runs sideways, folds downward ---------- */
  function placeLine(boxes, line, rows, spIdx) {
    const n = line.length;
    const per = Math.max(1, Math.ceil(n / rows));
    let r = 0, dir = 1, x = 0, noGap = false, inRow = 0, prevDbl = false;

    for (let i = 0; i < n; i++) {
      const e = line[i], dbl = e[0] === e[1];
      // Never turn on the spinner: it needs the space above and below it for
      // its arms, and a fold would steal exactly that. Turn a tile later.
      // A double is already crosswise, so a corner next to one would touch it
      // side to side instead of end to end — wait a tile and turn on the next.
      // ...and never on the last tile: nothing follows it, so a corner there is
      // just a tile lying flat at the open end.
      if (inRow >= per && r < rows - 1 && i !== spIdx && i < n - 1 && !dbl && !prevDbl) {
        const cx = dir > 0 ? x : x - VW;            // turn: stand the tile up
        boxes.push({ e, idx: i, x: cx, y: rowY(r), w: VW, h: VH, orient: "v", flip: false, row: r });
        r++; dir = -dir;
        x = dir > 0 ? cx : cx + VW; noGap = true; inRow = 0; prevDbl = false;
        continue;
      }
      inRow++; prevDbl = dbl;
      const w = dbl ? VW : HW, h = dbl ? VH : HH;
      const y = dbl ? bandY(r) : rowY(r);
      const g = noGap ? 0 : GAP; noGap = false;
      let tx;
      if (dir > 0) { tx = x + (i === 0 ? 0 : g); x = tx + w; }
      else         { tx = x - g - w;             x = tx; }
      boxes.push({ e, idx: i, x: tx, y, w, h, orient: dbl ? "v" : "h", flip: dir < 0, row: r });
    }
    return { dir, x, row: r };            // where the right-hand end continues
  }

  /* ---------- an arm: runs up or down, folds sideways ---------- */
  function placeArm(boxes, arm, cx, startEdge, dirY, per, side) {
    let lane = cx - VW / 2 - INSET;       // left edge of the current column lane
    let dir = dirY, cursor = startEdge, noGap = false, inLane = 0, prevDbl = false;

    arm.forEach((e, i) => {
      const dbl = e[0] === e[1];
      // Same rule as the chain: a corner must never lie flat against a double,
      // or the two touch along their sides and the arm reads as broken — and
      // never turn on the last tile, which would leave it flat at the open end.
      if (per > 0 && inLane >= per && i < arm.length - 1 && !dbl && !prevDbl) {  // turn: lay it flat
        const w = HW, h = HH;
        const x = side > 0 ? lane + INSET : lane + INSET - (HW - VW);
        const y = dir < 0 ? cursor - GAP - h : cursor + GAP;
        boxes.push({ e, x, y, w, h, orient: "h", flip: side < 0 });
        lane += side * HW;
        dir = -dir;
        cursor = dir < 0 ? y + h : y;
        noGap = true; inLane = 0; prevDbl = false;
        return;
      }
      // doubles always sit crosswise to the run they're in
      const w = dbl ? HW : VW, h = dbl ? HH : VH;
      const x = dbl ? lane : lane + INSET;
      const g = noGap ? 0 : GAP; noGap = false;
      const y = dir < 0 ? cursor - g - h : cursor + g;
      boxes.push({ e, x, y, w, h, orient: dbl ? "h" : "v", flip: dir < 0 });
      cursor = dir < 0 ? y : y + h;
      inLane++; prevDbl = dbl;
    });
    return { lane, cursor, dir };         // where this arm continues
  }

  function buildLayout(board, rows, armPer) {
    const line = board.line;
    if (!line.length) return null;
    const boxes = [];
    // work out the spinner first — the fold logic has to steer around it
    const spIdx = board.spinnerVal == null ? -1
      : line.findIndex((e) => e[0] === e[1] && e[0] === board.spinnerVal);
    const endRight = placeLine(boxes, line, rows, spIdx);
    const endLeft = { dir: 1, x: -GAP, row: 0 };   // row 0 always starts at x=0 going right

    let topTip = null, botTip = null;
    if (spIdx >= 0) {
      const sb = boxes.find((b) => b.idx === spIdx);
      if (sb) {
        sb.spinner = true;              // the pivot tile gets its own look
        const cx = sb.x + sb.w / 2;
        const n0 = boxes.length;
        topTip = placeArm(boxes, board.top,    cx, sb.y,        -1, armPer, +1);
        for (let i = n0; i < boxes.length; i++) boxes[i].arm = "top";
        const n1 = boxes.length;
        botTip = placeArm(boxes, board.bottom, cx, sb.y + sb.h, +1, armPer, -1);
        for (let i = n1; i < boxes.length; i++) boxes[i].arm = "bottom";
      }
    }
    return { boxes, endLeft, endRight, topTip, botTip };
  }

  /* ---------- green drop spots ---------- */
  function dropBoxes(L, sides, selDbl) {
    const drops = [];
    if (!sides || !sides.length) return drops;
    sides.forEach((side) => {
      if (side === "left" || side === "right") {
        const end = side === "left" ? { dir: -1, x: L.endLeft.x, row: L.endLeft.row } : L.endRight;
        const w = selDbl ? VW : HW, h = selDbl ? VH : HH;
        drops.push({ side, w, h,
          x: end.dir > 0 ? end.x : end.x - w,
          y: selDbl ? bandY(end.row) : rowY(end.row) });
      } else {
        const tip = side === "top" ? L.topTip : L.botTip;
        if (!tip) return;
        const w = selDbl ? HW : VW, h = selDbl ? HH : VH;
        drops.push({ side, w, h,
          x: selDbl ? tip.lane : tip.lane + INSET,
          y: tip.dir < 0 ? tip.cursor - GAP - h : tip.cursor + GAP });
      }
    });
    return drops;
  }

  function bounds(list) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    list.forEach((b) => {
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    return { minX, minY, w: maxX - minX, h: maxY - minY };
  }

  // A fold combination that makes tiles sit on top of each other is unusable,
  // however big it would draw them.
  function overlapCount(boxes) {
    let n = 0;
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.x + a.w - 1 > b.x && b.x + b.w - 1 > a.x &&
            a.y + a.h - 1 > b.y && b.y + b.h - 1 > a.y) n++;
      }
    return n;
  }

  function renderBoard(boardEl, board, selTile, sides, onDrop) {
    const sel = selTile || null;
    const selDbl = sel ? sel[0] === sel[1] : false;

    if (!board.line.length) {
      if (!sel) { boardEl.innerHTML = '<div class="empty">დაფა ცარიელია</div>'; return; }
      const w = selDbl ? VW : HW, h = selDbl ? VH : HH;
      boardEl.innerHTML = '<div class="bwrap" style="width:'+w+'px;height:'+h+'px;transform:scale(2);">'
        + '<div class="drop" data-side="open" style="left:0;top:0;width:'+w+'px;height:'+h+'px;"></div></div>';
      bind(boardEl, onDrop); return;
    }

    const rect = boardEl.getBoundingClientRect();
    const availW = Math.max(40, rect.width - 16), availH = Math.max(40, rect.height - 16);

    let best = null;
    for (const armPer of ARM_FOLDS) {
      for (let rows = 1; rows <= MAX_ROWS; rows++) {
        const L = buildLayout(board, rows, armPer);
        if (!L) continue;
        const all = L.boxes.concat(dropBoxes(L, sides, selDbl));
        const bb = bounds(all);
        const scale = Math.min(MAXSCALE, availW / bb.w, availH / bb.h);
        const rank = scale - overlapCount(L.boxes) * 100;   // overlaps are disqualifying
        if (!best || rank > best.rank + 0.001) best = { L, bb, scale, all, rank };
        if (rows >= board.line.length) break;
      }
    }
    if (!best) return;

    const { bb, scale, all } = best;
    let html = "";
    all.forEach((b) => {
      if (b.side) {
        html += '<div class="drop" data-side="'+b.side+'" style="left:'+(b.x-bb.minX)+'px;top:'+(b.y-bb.minY)
             + 'px;width:'+b.w+'px;height:'+b.h+'px;"></div>';
      } else {
        // tag every tile so a screen can find the one that was just played
        const tag = b.arm ? ' data-arm="'+b.arm+'"' : ' data-idx="'+b.idx+'"';
        html += '<div class="bt '+(b.orient==="h"?"btH":"btV")+(b.spinner?" spinner":"")+'"'+tag
             + ' style="left:'+(b.x-bb.minX)+'px;top:'+(b.y-bb.minY)+'px;">'
             + boardTileInner(b.e, b.orient==="h", b.flip) + "</div>";
      }
    });
    boardEl.innerHTML = '<div class="bwrap" style="width:'+bb.w+'px;height:'+bb.h+'px;transform:scale('+scale+');">'+html+"</div>";
    bind(boardEl, onDrop);
  }

  function bind(boardEl, onDrop) {
    if (!onDrop) return;
    boardEl.querySelectorAll(".drop").forEach((d) => { d.onclick = () => onDrop(d.dataset.side); });
  }

  // Make the tile that was just played drop onto the table.
  function flashPlaced(boardEl, board, side) {
    if (!side) return;
    if (side === "top" || side === "bottom") {
      const arm = boardEl.querySelectorAll('.bt[data-arm="' + side + '"]');
      if (arm.length) arm[arm.length - 1].classList.add("justPlaced");
      return;
    }
    const idx = (side === "right") ? board.line.length - 1 : 0;   // open/left -> 0
    const el = boardEl.querySelector('.bt[data-idx="' + idx + '"]');
    if (el) el.classList.add("justPlaced");
  }

  // Float scored points up off the table.
  function popPoints(boardEl, pts) {
    if (!pts) return;
    const el = document.createElement("div");
    el.className = "pointsPop";
    el.textContent = "+" + pts;
    boardEl.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1250);
  }

  global.Tiles = { half, domV, backTile, boardTileInner, renderBoard, flashPlaced, popPoints };
})(window);
