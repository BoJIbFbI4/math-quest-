'use strict';
(function (g) {
  const MQ = g.MQ;
  // Every language pack must provide at least this many story names and items (checked by tests).
  MQ.STORY_NAMES = 6;
  MQ.STORY_ITEMS = 5;
  const EMOJI = ['🍎', '✏️', '🎈', '🌼', '🍪'];

  function gen(level, r) {
    const ni = r.int(0, MQ.STORY_NAMES - 1);
    let n2 = r.int(0, MQ.STORY_NAMES - 2);
    if (n2 >= ni) n2 += 1;
    const ii = r.int(0, MQ.STORY_ITEMS - 1);
    const e = EMOJI[ii];
    let tpl;
    let a;
    let b;
    let answer;
    let viz;
    if (level === 1) {
      tpl = 'join';
      a = r.int(2, 7);
      b = r.int(2, 10 - a);
      viz = { type: 'pictures', rows: [{ n: a, emoji: e }, { n: b, emoji: e, cls: 'second' }] };
    } else if (level === 2) {
      tpl = 'separate';
      a = r.int(6, 18);
      b = r.int(2, a - 2);
      viz = { type: 'pictures', rows: [{ n: a, emoji: e, cross: b }] };
    } else if (level === 3) {
      tpl = 'compare';
      a = r.int(6, 18);
      b = r.int(2, a - 2);
      viz = { type: 'pictures', rows: [{ n: a, emoji: e }, { n: b, emoji: e, cls: 'second' }] };
    } else if (level === 4) {
      if (r.chance(0.5)) {
        tpl = 'join';
        a = r.int(21, 69);
        b = r.int(11, 98 - a);
        viz = { type: 'bar', values: [a, b], labels: [a, b, '?'] };
      } else {
        tpl = 'separate';
        a = r.int(35, 99);
        b = r.int(11, a - 11);
        viz = { type: 'bar', values: [a - b, b], labels: ['?', b, a] };
      }
    } else {
      tpl = 'groups';
      a = r.int(2, 6);
      b = r.int(2, 5);
      viz = { type: 'groups', g: a, n: b, emoji: e };
    }
    let steps;
    if (tpl === 'join') {
      answer = a + b;
      steps = [[a, '+', b, '=', '?']];
    } else if (tpl === 'groups') {
      answer = a * b;
      const line = [];
      for (let i = 0; i < a; i++) line.push(...(i ? ['+', b] : [b]));
      steps = [line.concat('=', '?')];
    } else {
      answer = a - b;
      steps = [[a, '-', b, '=', '?']];
    }
    return { key: `${tpl}:${a}:${b}`, q: { kind: 'story', d: { tpl, a, b, ni, n2, ii } }, answer, viz, steps, tpl, a, b };
  }

  function diagnose(p, given) {
    if (p.tpl === 'join' && given === p.a - p.b) return 'tip.storyPlus';
    if ((p.tpl === 'separate' || p.tpl === 'compare') && given === p.a + p.b) return 'tip.storyMinus';
    if (p.tpl === 'groups' && given === p.a + p.b && p.answer !== p.a + p.b) return 'tip.mulAdd';
    return null;
  }

  MQ.topic({ id: 'story', icon: '📖', hue: 340, gen, diagnose });
})(globalThis);
