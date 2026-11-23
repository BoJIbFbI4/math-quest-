'use strict';
(function (g) {
  const MQ = g.MQ;
  const TABLES = [null, [2, 10], [5, 3], [4, 6], [7, 8, 9], [2, 3, 4, 5, 6, 7, 8, 9, 10]];

  // Steps add equal groups; from 6 groups on, use "5 groups + the rest" so the list stays short.
  function stepsFor(small, big) {
    if (small === 1) return []; // "1 group of 7" would print the answer; the picture is enough
    const lines = [[{ w: 'groupsOf', g: small, n: big }]];
    if (big === 10) {
      lines.push([{ w: 'tensN', n: small }, '=', '?']);
    } else if (small >= 2 && small <= 5) {
      let acc = big;
      for (let i = 2; i <= small; i++) {
        lines.push([acc, '+', big, '=', i === small ? '?' : acc + big]);
        acc += big;
      }
    } else if (small > 5) {
      const rest = small - 5;
      lines.push([5, '*', big, '=', 5 * big], [rest, '*', big, '=', rest * big], [5 * big, '+', rest * big, '=', '?']);
    }
    return lines;
  }

  function gen(level, r) {
    const table = r.pick(TABLES[level]);
    const k = level === 5 ? r.int(2, 10) : r.int(1, 10);
    const [a, b] = r.chance(0.5) ? [table, k] : [k, table];
    const small = Math.min(a, b);
    const big = Math.max(a, b);
    return {
      key: `${a}*${b}`,
      q: { kind: 'eq', parts: [a, '*', b, '=', '?'] },
      answer: a * b,
      viz: { type: 'groups', g: small, n: big, split: small > 5 }, // split matches the "5 groups + the rest" steps
      steps: stepsFor(small, big),
      a,
      b,
    };
  }

  const diagnose = (p, given) => (given === p.a + p.b && p.answer !== p.a + p.b ? 'tip.mulAdd' : null);

  MQ.topic({ id: 'mul', icon: '✖️', hue: 280, gen, diagnose });
})(globalThis);
