'use strict';
(function (g) {
  const MQ = g.MQ;

  // Splits a two-digit sum into tens and ones lines: 47 + 38 → 40+30, 7+8, 70+15.
  const placeSteps = (a, b) => {
    const ta = a - (a % 10);
    const oa = a % 10;
    if (b < 10) return [[oa, '+', b, '=', oa + b], [ta, '+', oa + b, '=', '?']];
    const tb = b - (b % 10);
    const ob = b % 10;
    return [[ta, '+', tb, '=', ta + tb], [oa, '+', ob, '=', oa + ob], [ta + tb, '+', oa + ob, '=', '?']];
  };

  function gen(level, r) {
    let a;
    let b;
    let viz;
    let steps;
    if (level === 1) {
      a = r.int(1, 9);
      b = r.int(1, 10 - a);
      viz = { type: 'tenframes', a, b, op: '+' };
      steps = [[{ w: 'countOn', a: Math.max(a, b), b: Math.min(a, b) }]];
    } else if (level === 2) {
      a = r.int(11, 18);
      b = r.int(1, 19 - a);
      steps = [[a - 10, '+', b, '=', a - 10 + b], [10, '+', a - 10 + b, '=', '?']];
      if (r.chance(0.3)) [a, b] = [b, a];
      viz = { type: 'tenframes', a, b, op: '+' };
    } else if (level === 3) {
      a = r.int(2, 9);
      b = r.int(Math.max(2, 11 - a), 9);
      const big = Math.max(a, b);
      const small = Math.min(a, b);
      const need = 10 - big;
      steps = [[small, '=', need, '+', small - need], [big, '+', need, '=', 10], [10, '+', small - need, '=', '?']];
      viz = { type: 'tenframes', a, b, op: '+' };
    } else if (level === 4) {
      do {
        a = r.int(1, 8) * 10 + r.int(0, 9);
        b = r.chance(0.5) ? r.int(1, 9) : r.int(1, 8) * 10 + r.int(0, 9);
      } while ((a % 10) + (b % 10) > 9 || a + b > 99);
      if (b >= 10 && r.chance(0.3)) [a, b] = [b, a];
      viz = { type: 'blocks', op: '+', parts: [{ n: a }, { n: b }] };
      steps = placeSteps(Math.max(a, b), Math.min(a, b));
    } else {
      const oa = r.int(1, 9);
      const ob = r.int(10 - oa, 9);
      const ta = r.int(1, 7);
      const tb = r.int(1, 8 - ta);
      a = ta * 10 + oa;
      b = tb * 10 + ob;
      viz = { type: 'blocks', op: '+', parts: [{ n: a }, { n: b }] };
      steps = placeSteps(a, b);
    }
    return { key: `${a}+${b}`, q: { kind: 'eq', parts: [a, '+', b, '=', '?'] }, answer: a + b, viz, steps, a, b };
  }

  function diagnose(p, given) {
    const { a, b } = p;
    if (given === Math.abs(a - b)) return 'tip.plus';
    if (a >= 10 && b >= 10 && (a % 10) + (b % 10) >= 10) {
      const noCarry = p.answer - 10;
      const glued = Number(String(Math.floor(a / 10) + Math.floor(b / 10)) + String((a % 10) + (b % 10)));
      if (given === noCarry || given === glued) return 'tip.carry';
    }
    return null;
  }

  MQ.topic({ id: 'add', icon: '➕', hue: 6, gen, diagnose });
})(globalThis);
