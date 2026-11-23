'use strict';
(function (g) {
  const MQ = g.MQ;

  function gen(level, r) {
    let a;
    let b;
    let viz;
    let steps;
    if (level === 1) {
      a = r.int(2, 10);
      b = r.int(1, a - 1);
      viz = { type: 'tenframes', a, b, op: '-' };
      steps = [[{ w: 'countBack', a, b }]];
    } else if (level === 2) {
      a = r.int(11, 19);
      b = r.int(1, a - 10);
      const o = a - 10;
      viz = { type: 'tenframes', a, b, op: '-' };
      steps = [[o, '-', b, '=', o - b], [10, '+', o - b, '=', '?']];
    } else if (level === 3) {
      a = r.int(11, 18);
      const o = a - 10;
      b = r.int(o + 1, 9);
      viz = { type: 'tenframes', a, b, op: '-' };
      steps = [[b, '=', o, '+', b - o], [a, '-', o, '=', 10], [10, '-', b - o, '=', '?']];
    } else if (level === 4) {
      do {
        a = r.int(2, 9) * 10 + r.int(1, 9);
        b = r.chance(0.4) ? r.int(1, a % 10) : r.int(1, Math.floor(a / 10)) * 10 + r.int(0, a % 10);
      } while (b >= a);
      viz = { type: 'blocks', op: '-', parts: [{ n: a, cross: b }] };
      const ta = a - (a % 10);
      const oa = a % 10;
      if (b < 10) {
        steps = [[oa, '-', b, '=', oa - b], [ta, '+', oa - b, '=', '?']];
      } else {
        const tb = b - (b % 10);
        const ob = b % 10;
        steps = [[ta, '-', tb, '=', ta - tb], [oa, '-', ob, '=', oa - ob], [ta - tb, '+', oa - ob, '=', '?']];
      }
    } else {
      const oa = r.int(0, 8);
      const ob = r.int(oa + 1, 9);
      const ta = r.int(2, 9);
      const tb = r.chance(0.3) ? 0 : r.int(1, ta - 1);
      a = ta * 10 + oa;
      b = tb * 10 + ob;
      viz = { type: 'blocks', op: '-', parts: [{ n: a, cross: b }] };
      const afterTens = a - tb * 10;
      steps = tb ? [[a, '-', tb * 10, '=', afterTens]] : [];
      if (oa === 0) {
        const rest = afterTens - 10;
        steps.push([afterTens, '=', rest, '+', 10], [10, '-', ob, '=', 10 - ob], [rest, '+', 10 - ob, '=', '?']);
      } else {
        const toTen = afterTens - oa;
        steps.push([ob, '=', oa, '+', ob - oa], [afterTens, '-', oa, '=', toTen], [toTen, '-', ob - oa, '=', '?']);
      }
    }
    return { key: `${a}-${b}`, q: { kind: 'eq', parts: [a, '-', b, '=', '?'] }, answer: a - b, viz, steps, a, b };
  }

  function diagnose(p, given) {
    const { a, b } = p;
    if (given === a + b) return 'tip.minus';
    if ((a % 10) < (b % 10) && a >= 10) {
      // Classic bug: subtract the smaller digit from the larger in each column.
      const bug = Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10));
      if (given === bug || given === p.answer + 10) return 'tip.borrow';
    }
    return null;
  }

  MQ.topic({ id: 'sub', icon: '➖', hue: 210, gen, diagnose });
})(globalThis);
