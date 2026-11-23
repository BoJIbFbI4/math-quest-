'use strict';
// Picture models of a problem. Help pictures must be countable but must never print the answer.
(function (g) {
  const MQ = g.MQ;

  const svg = (w, h, body, label) =>
    `<svg class="viz-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label || ''}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;

  const cross = (cx, cy, r) =>
    `<path class="x" d="M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}"/>`;

  function tenframes({ a, b, op }) {
    const total = op === '+' ? a + b : a;
    const frames = Math.max(1, Math.ceil(total / 10));
    const C = 44;
    const FW = 5 * C;
    const FH = 2 * C;
    const GAP = 28;
    const W = frames * FW + (frames - 1) * GAP + 8;
    const H = FH + 8;
    let s = '';
    for (let f = 0; f < frames; f++) {
      const x0 = 4 + f * (FW + GAP);
      s += `<rect class="tf-frame" x="${x0}" y="4" width="${FW}" height="${FH}" rx="10"/>`;
      for (let c = 1; c < 5; c++) s += `<line class="tf-line" x1="${x0 + c * C}" y1="4" x2="${x0 + c * C}" y2="${4 + FH}"/>`;
      s += `<line class="tf-line" x1="${x0}" y1="${4 + C}" x2="${x0 + FW}" y2="${4 + C}"/>`;
    }
    const r = C * 0.34;
    for (let i = 0; i < total; i++) {
      const f = Math.floor(i / 10);
      const w = i % 10;
      const cx = 4 + f * (FW + GAP) + (w % 5) * C + C / 2;
      const cy = 4 + Math.floor(w / 5) * C + C / 2;
      const removed = op === '-' && i >= a - b;
      const cls = op === '+' && i >= a ? 'c2' : 'c1';
      s += `<circle class="dot ${cls}${removed ? ' gone' : ''}" cx="${cx}" cy="${cy}" r="${r}"/>`;
      if (removed) s += cross(cx, cy, r * 0.8);
    }
    return svg(W, H, s);
  }

  // Base-ten blocks: hundreds (flats), tens (rods), ones (cubes).
  const U = 14;
  const GAPB = 6;
  function blockPart(part, x0, y0, color) {
    const n = part.n;
    const h = Math.floor(n / 100);
    let t = Math.floor(n / 10) % 10;
    const o = n % 10;
    const crossN = part.cross || 0;
    const crossT = Math.floor(crossN / 10);
    const crossO = crossN % 10;
    let broken = 0;
    if (crossO > o) {
      // Not enough ones to take away: break one ten into ten ones.
      t -= 1;
      broken = 10;
    }
    const extra = part.extraTen ? 1 : 0;
    let s = '';
    const rodH = 10 * U;
    const FLATS_PER_ROW = 5;
    // Flats sit on the left; rods and cubes stand beside them on the same baseline, so the picture stays wide, not tall.
    const flatRows = Math.ceil(h / FLATS_PER_ROW);
    const flatsH = h ? flatRows * (rodH + GAPB) - GAPB : 0;
    const totalH = Math.max(flatsH, rodH);
    let x = x0 + (h ? Math.min(h, FLATS_PER_ROW) * (rodH + GAPB) + GAPB * 2 : 0);
    const y = y0 + totalH - rodH;
    for (let i = 0; i < h; i++) {
      const fx = x0 + (i % FLATS_PER_ROW) * (rodH + GAPB);
      const fy = y0 + Math.floor(i / FLATS_PER_ROW) * (rodH + GAPB);
      s += `<rect class="blk ${color}" x="${fx}" y="${fy}" width="${rodH}" height="${rodH}" rx="2"/>`;
      for (let k = 1; k < 10; k++) {
        s += `<line class="blk-line" x1="${fx + k * U}" y1="${fy}" x2="${fx + k * U}" y2="${fy + rodH}"/>`;
        s += `<line class="blk-line" x1="${fx}" y1="${fy + k * U}" x2="${fx + rodH}" y2="${fy + k * U}"/>`;
      }
    }
    const rods = t + extra;
    for (let i = 0; i < rods; i++) {
      const isExtra = i >= t;
      s += `<rect class="blk ${isExtra ? 'c2 extra' : color}" x="${x}" y="${y}" width="${U}" height="${rodH}" rx="2"/>`;
      for (let k = 1; k < 10; k++) s += `<line class="blk-line" x1="${x}" y1="${y + k * U}" x2="${x + U}" y2="${y + k * U}"/>`;
      if (!isExtra && i >= t - crossT) s += `<path class="x" d="M${x - 3} ${y + 8}L${x + U + 3} ${y + rodH - 8}M${x + U + 3} ${y + 8}L${x - 3} ${y + rodH - 8}"/>`;
      x += U + GAPB;
    }
    // Broken-ten cubes come first so crossing starts with the original ones, as in counting back to the ten.
    const cubes = broken + o;
    const crossFrom = cubes - crossO;
    for (let i = 0; i < cubes; i++) {
      const col = Math.floor(i / 5);
      const row = i % 5;
      const cx = x + col * (U + GAPB);
      const cy = y + rodH - (row + 1) * (U + 3);
      const isBroken = i < broken;
      s += `<rect class="blk ${color}${isBroken ? ' broken' : ''}" x="${cx}" y="${cy}" width="${U}" height="${U}" rx="2"/>`;
      if (i >= crossFrom) s += cross(cx + U / 2, cy + U / 2, U / 2 + 1);
    }
    x += Math.ceil(cubes / 5) * (U + GAPB);
    return { s, w: Math.max(x - x0, U), h: totalH };
  }

  function blocks({ parts, op }, t) {
    let x = 8;
    let s = '';
    let H = 0;
    const pieces = parts.map((p, i) => blockPart(p, 0, 8, i === 0 ? 'c1' : 'c2'));
    pieces.forEach((pc, i) => {
      if (i > 0) {
        s += `<text class="viz-op" x="${x + 18}" y="${8 + pc.h / 2 + 12}">${MQ.esc(t ? t.op(op) : op)}</text>`;
        x += 44;
      }
      s += `<g transform="translate(${x} 0)">${pc.s}</g>`;
      x += pc.w + 8;
      H = Math.max(H, pc.h);
    });
    return svg(Math.max(x, 60), H + 16, s);
  }

  // Number line with unit hops. Only landmarks and known numbers are labelled; the unknown spot is a "?".
  function numberline({ max, start, end, unknown, answer }) {
    const W = 680;
    const pad = 26;
    const unit = (W - 2 * pad) / max;
    const y = 112;
    const X = (n) => pad + n * unit;
    let s = `<line class="nl-axis" x1="${pad - 10}" y1="${y}" x2="${W - pad + 10}" y2="${y}"/>`;
    const labels = new Set();
    for (let n = 0; n <= max; n += 5) labels.add(n);
    if (unknown !== 'start') labels.add(start);
    if (unknown !== 'end') labels.add(end);
    labels.delete(unknown === 'start' ? start : unknown === 'end' ? end : -1);
    labels.delete(answer);
    for (let n = 0; n <= max; n++) {
      const big = n % 5 === 0;
      s += `<line class="nl-tick" x1="${X(n)}" y1="${y - (big ? 12 : 7)}" x2="${X(n)}" y2="${y + (big ? 12 : 7)}"/>`;
      if (labels.has(n)) s += `<text class="nl-label" x="${X(n)}" y="${y + 44}">${n}</text>`;
    }
    const dir = end > start ? 1 : -1;
    const hops = Math.min(Math.abs(end - start), max); // bounded even if stored data is odd
    for (let i = 0; i < hops; i++) {
      const n = start + i * dir;
      const x1 = X(n);
      const x2 = X(n + dir);
      const xm = (x1 + x2) / 2;
      s += `<path class="nl-hop" d="M${x1} ${y - 4}Q${xm} ${y - 40} ${x2} ${y - 4}"/>`;
      s += `<path class="nl-arrow" d="M${x2 - dir * 7} ${y - 13}L${x2} ${y - 4}L${x2 - dir * 1} ${y - 15}"/>`;
    }
    const mark = (n, cls) => `<circle class="nl-dot ${cls}" cx="${X(n)}" cy="${y}" r="8"/>`;
    s += mark(start, 'c1') + mark(end, 'c2');
    const q = unknown === 'start' ? start : unknown === 'end' ? end : null;
    if (q !== null) s += `<g class="nl-q"><circle cx="${X(q)}" cy="${y + 36}" r="19"/><text x="${X(q)}" y="${y + 45}">?</text></g>`;
    return svg(W, 172, s);
  }

  // Part-part-whole bar. `values` are the true sizes (for proportions); `labels` may contain '?'.
  function bar({ values, labels }) {
    const [p1, p2] = values;
    const W = 640;
    const x0 = 20;
    const total = p1 + p2;
    const w1 = Math.max(70, ((W - 2 * x0) * p1) / total);
    const w2 = W - 2 * x0 - w1;
    let s = `<rect class="bar-whole" x="${x0}" y="14" width="${W - 2 * x0}" height="52" rx="8"/>`;
    s += `<text class="bar-label" x="${W / 2}" y="50">${MQ.esc(labels[2])}</text>`;
    s += `<rect class="bar-part c1" x="${x0}" y="84" width="${w1}" height="52" rx="8"/>`;
    s += `<rect class="bar-part c2" x="${x0 + w1}" y="84" width="${w2}" height="52" rx="8"/>`;
    s += `<text class="bar-label" x="${x0 + w1 / 2}" y="120">${MQ.esc(labels[0])}</text>`;
    s += `<text class="bar-label" x="${x0 + w1 + w2 / 2}" y="120">${MQ.esc(labels[1])}</text>`;
    return svg(W, 150, s);
  }

  function groups({ g: count, n, emoji, split }) {
    let s = '<div class="groups">';
    for (let i = 0; i < count; i++) {
      if (split && i === 5) s += '<div class="grp-split" aria-hidden="true"></div>';
      s += '<div class="grp">';
      for (let k = 0; k < n; k++) s += emoji ? `<span class="pic">${MQ.esc(emoji)}</span>` : '<span class="gdot"></span>';
      s += '</div>';
    }
    return s + '</div>';
  }

  // Emoji rows for story problems; items are chunked in fives so they can be counted at a glance.
  function pictures({ rows }) {
    let s = '<div class="pics">';
    for (const row of rows) {
      s += `<div class="pic-row ${MQ.esc(row.cls || '')}">`;
      for (let i = 0; i < row.n; i++) {
        if (i && i % 5 === 0) s += '<span class="pic-gap"></span>';
        const gone = row.cross && i >= row.n - row.cross;
        s += `<span class="pic${gone ? ' gone' : ''}">${MQ.esc(row.emoji)}</span>`;
      }
      s += '</div>';
    }
    return s + '</div>';
  }

  MQ.viz = {
    render(v, t) {
      if (!v) return '';
      switch (v.type) {
        case 'tenframes':
          return tenframes(v);
        case 'blocks':
          return blocks(v, t);
        case 'numberline':
          return numberline(v);
        case 'bar':
          return bar(v);
        case 'groups':
          return groups(v);
        case 'pictures':
          return pictures(v);
        default:
          return '';
      }
    },
  };
})(globalThis);
