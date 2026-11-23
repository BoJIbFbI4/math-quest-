'use strict';
(function (g) {
  const MQ = g.MQ;
  const tens = (n) => ({ w: 'tensN', n });
  const ones = (n) => ({ w: 'onesN', n });

  function gen(level, r) {
    let q;
    let answer;
    let viz;
    let steps;
    let key;
    if (level === 1 || level === 2) {
      const t = level === 1 ? r.int(1, 4) : r.int(1, 9);
      const o = r.int(0, 9);
      answer = t * 10 + o;
      q = level === 1 ? { kind: 'text', key: 'q.count', showViz: true } : { kind: 'text', key: 'q.tensOnes', p: { t, o } };
      viz = { type: 'blocks', parts: [{ n: answer }] };
      steps = [[tens(t), '=', t * 10], [t * 10, '+', o, '=', '?']];
      key = `${level === 1 ? 'c' : 'to'}${answer}`;
    } else if (level === 3) {
      const n = r.int(11, 99);
      const t = Math.floor(n / 10);
      const o = n % 10;
      const askTens = r.chance(0.5);
      answer = askTens ? t : o;
      q = { kind: 'text', key: askTens ? 'q.howTens' : 'q.howOnes', p: { n } };
      viz = { type: 'blocks', parts: [{ n }] };
      steps = askTens ? [[n, '=', tens('?'), '+', ones(o)]] : [[n, '=', tens(t), '+', ones('?')]];
      key = `${askTens ? 't' : 'o'}${n}`;
    } else if (level === 4) {
      const more = r.chance(0.5);
      const n = more ? r.int(10, 89) : r.int(20, 99);
      const t = Math.floor(n / 10);
      const o = n % 10;
      const t2 = more ? t + 1 : t - 1;
      answer = more ? n + 10 : n - 10;
      q = { kind: 'text', key: more ? 'q.tenMore' : 'q.tenLess', p: { n } };
      viz = { type: 'blocks', parts: [more ? { n, extraTen: true } : { n, cross: 10 }] };
      steps = [[tens(t), more ? '+' : '-', tens(1), '=', tens(t2)], [t2 * 10, '+', o, '=', '?']];
      key = `${more ? 'm' : 'l'}${n}`;
    } else {
      const h = r.int(1, 9);
      const t = r.chance(0.25) ? 0 : r.int(1, 9);
      const o = t && r.chance(0.2) ? 0 : r.int(1, 9);
      answer = h * 100 + t * 10 + o;
      q = { kind: 'text', key: 'q.hto', p: { h, t, o } };
      viz = { type: 'blocks', parts: [{ n: answer }] };
      steps = [[{ w: 'hundredsN', n: h }, '=', h * 100], [tens(t), '=', t * 10], [h * 100, '+', t * 10, '+', o, '=', '?']];
      key = `h${answer}`;
    }
    return { key, q, answer, viz, steps, level };
  }

  function diagnose(p, given) {
    const a = p.answer;
    if (p.level === 3) {
      const n = p.q.p.n;
      if (p.q.key === 'q.howTens') {
        if (given === n % 10) return 'tip.tensOnes';
        if (given === n - (n % 10)) return 'tip.howMany';
      } else if (given === Math.floor(n / 10)) return 'tip.tensOnes';
      return null;
    }
    if (p.level === 4) return given === p.q.p.n + 1 || given === p.q.p.n - 1 ? 'tip.tensOnes' : null;
    if (p.level === 5 && p.q.p.t === 0 && given === p.q.p.h * 10 + p.q.p.o) return 'tip.zero';
    const reversed = Number(String(a).split('').reverse().join(''));
    if (given === reversed && given !== a) return 'tip.swap';
    return null;
  }

  MQ.topic({ id: 'place', icon: '🧱', hue: 32, gen, diagnose });
})(globalThis);
