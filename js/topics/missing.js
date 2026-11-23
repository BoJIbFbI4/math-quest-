'use strict';
(function (g) {
  const MQ = g.MQ;

  function gen(level, r) {
    let parts;
    let x;
    let viz;
    let steps;
    if (level === 1) {
      const a = r.int(1, 8);
      x = r.int(1, 10 - a);
      const c = a + x;
      parts = [a, '+', '?', '=', c];
      viz = { type: 'numberline', max: 10, start: a, end: c, unknown: null, answer: x };
      steps = [[c, '-', a, '=', '?']];
    } else if (level === 2) {
      const b = r.int(2, 9);
      x = r.int(Math.max(2, 11 - b), 20 - b);
      const c = x + b;
      parts = ['?', '+', b, '=', c];
      viz = { type: 'numberline', max: 20, start: x, end: c, unknown: 'start', answer: x };
      steps = [[c, '-', b, '=', '?']];
    } else if (level === 3) {
      const a = r.int(11, 20);
      x = r.int(2, 9);
      const c = a - x;
      parts = [a, '-', '?', '=', c];
      viz = { type: 'numberline', max: 20, start: a, end: c, unknown: null, answer: x };
      steps = [[a, '-', c, '=', '?']];
    } else if (level === 4) {
      let a;
      let c;
      if (r.chance(0.5)) {
        const t1 = r.int(1, 8);
        a = t1 * 10;
        c = r.int(t1 + 1, 9) * 10;
      } else {
        const t1 = r.int(1, 8);
        a = t1 * 10 + r.int(1, 9);
        c = (t1 + 1) * 10;
      }
      x = c - a;
      parts = [a, '+', '?', '=', c];
      viz = { type: 'bar', values: [a, x], labels: [a, '?', c] };
      steps = [[c, '-', a, '=', '?']];
    } else {
      const form = r.int(1, 4);
      if (form === 1) {
        const a = r.int(11, 79);
        x = r.int(11, 99 - a);
        const c = a + x;
        parts = [a, '+', '?', '=', c];
        viz = { type: 'bar', values: [a, x], labels: [a, '?', c] };
        steps = [[c, '-', a, '=', '?']];
      } else if (form === 2) {
        const b = r.int(11, 79);
        x = r.int(11, 99 - b);
        const c = x + b;
        parts = ['?', '+', b, '=', c];
        viz = { type: 'bar', values: [x, b], labels: ['?', b, c] };
        steps = [[c, '-', b, '=', '?']];
      } else if (form === 3) {
        const a = r.int(30, 99);
        x = r.int(11, a - 11);
        const c = a - x;
        parts = [a, '-', '?', '=', c];
        viz = { type: 'bar', values: [c, x], labels: [c, '?', a] };
        steps = [[a, '-', c, '=', '?']];
      } else {
        const b = r.int(11, 49);
        const c = r.int(11, 99 - b);
        x = b + c;
        parts = ['?', '-', b, '=', c];
        viz = { type: 'bar', values: [c, b], labels: [c, b, '?'] };
        steps = [[c, '+', b, '=', '?']];
      }
    }
    return { key: parts.join(''), q: { kind: 'eq', parts }, answer: x, viz, steps };
  }

  // Any wrong answer here is best met with the self-check strategy: put it in the box and test it.
  const diagnose = () => 'tip.check';

  MQ.topic({ id: 'missing', icon: '🔍', hue: 150, gen, diagnose });
})(globalThis);
