'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MQ } = require('./_load');

const SEEDS = 400;
const ones = (n) => n % 10;

// Per-level promises from the plan's curriculum table.
const RULES = {
  add: {
    1: (p) => p.a >= 1 && p.b >= 1 && p.answer <= 10,
    2: (p) => p.answer >= 11 && p.answer <= 19 && ones(p.a) + ones(p.b) <= 9,
    3: (p) => p.a <= 9 && p.b <= 9 && p.answer >= 11,
    4: (p) => p.answer <= 99 && Math.max(p.a, p.b) >= 10 && ones(p.a) + ones(p.b) <= 9,
    5: (p) => p.a >= 10 && p.b >= 10 && ones(p.a) + ones(p.b) >= 10 && p.answer <= 100,
  },
  sub: {
    1: (p) => p.a <= 10 && p.answer >= 1,
    2: (p) => p.a >= 11 && p.a <= 19 && p.b <= ones(p.a) && p.answer >= 10,
    3: (p) => p.a >= 11 && p.a <= 18 && p.b <= 9 && p.b > ones(p.a) && p.answer < 10,
    4: (p) => p.a <= 99 && ones(p.a) >= ones(p.b) && p.answer >= 1,
    5: (p) => p.a <= 99 && ones(p.a) < ones(p.b) && p.answer >= 1,
  },
  missing: {
    1: (p) => p.q.parts.every((x) => typeof x !== 'number' || x <= 10),
    2: (p) => p.q.parts.every((x) => typeof x !== 'number' || x <= 20),
    3: (p) => p.q.parts.every((x) => typeof x !== 'number' || x <= 20),
    4: (p) => p.q.parts.every((x) => typeof x !== 'number' || x <= 90),
    5: (p) => p.q.parts.every((x) => typeof x !== 'number' || x <= 99),
  },
  place: {
    1: (p) => p.answer >= 10 && p.answer <= 49,
    2: (p) => p.answer >= 10 && p.answer <= 99,
    3: (p) => p.answer >= 0 && p.answer <= 9,
    4: (p) => Math.abs(p.answer - p.q.p.n) === 10,
    5: (p) => p.answer >= 100 && p.answer <= 999 && p.answer % 100 !== 0,
  },
  mul: {
    1: (p) => [2, 10].includes(p.a) || [2, 10].includes(p.b),
    2: (p) => [5, 3].includes(p.a) || [5, 3].includes(p.b),
    3: (p) => [4, 6].includes(p.a) || [4, 6].includes(p.b),
    4: (p) => [7, 8, 9].includes(p.a) || [7, 8, 9].includes(p.b),
    5: (p) => p.a >= 2 && p.b >= 2 && p.answer <= 100,
  },
  story: {
    1: (p) => p.tpl === 'join' && p.answer <= 10 && p.b >= 2,
    2: (p) => p.tpl === 'separate' && p.a <= 18 && p.answer >= 2,
    3: (p) => p.tpl === 'compare' && p.a <= 18 && p.answer >= 2,
    4: (p) => ['join', 'separate'].includes(p.tpl) && p.answer <= 98 && p.answer >= 11,
    5: (p) => p.tpl === 'groups' && p.answer <= 30,
  },
};

const numbersIn = (tokens) =>
  tokens.flatMap((x) => (typeof x === 'number' ? [x] : x && typeof x === 'object' ? Object.values(x).filter((v) => typeof v === 'number') : []));
const svgNumbers = (html) => [...html.replace(/<[^>]+>/g, ' ').matchAll(/\d+/g)].map((m) => Number(m[0]));
const questionNumbers = (p) => (p.q.kind === 'eq' ? numbersIn(p.q.parts) : Object.values(p.q.p || p.q.d || {}).filter(Number.isInteger));

test('every registered topic has a rule set and 5 levels', () => {
  assert.deepEqual(MQ.topics.map((t) => t.id).sort(), Object.keys(RULES).sort());
  for (const tp of MQ.topics) {
    assert.equal(typeof tp.gen, 'function');
    assert.ok(tp.icon && Number.isFinite(tp.hue), tp.id);
  }
});

for (const tp of MQ.topics) {
  for (let level = 1; level <= MQ.LEVELS; level++) {
    test(`${tp.id} level ${level}: valid problems`, () => {
      const t = MQ.i18n('en', 'f');
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = tp.gen(level, MQ.rng(seed * 7919 + level));
        const where = `${tp.id}:${level} seed ${seed} ${p.key}`;
        assert.ok(Number.isInteger(p.answer) && p.answer >= 0 && p.answer <= 999, `answer ${where}`);
        assert.ok(typeof p.key === 'string' && p.key.length, `key ${where}`);
        assert.ok(RULES[tp.id][level](p), `level rule ${where}`);

        if (p.q.kind === 'eq') {
          assert.equal(p.q.parts.filter((x) => x === '?').length, 1, `one blank ${where}`);
          assert.equal(MQ.evalLine(p.q.parts, p.answer), true, `equation ${where}`);
        }
        for (const line of p.steps) {
          const ok = MQ.evalLine(line, p.answer);
          assert.notEqual(ok, false, `step ${JSON.stringify(line)} ${where}`);
        }
        // Help must never print the answer: steps end in "?" or contain no copy of it.
        const stepNums = p.steps.flatMap(numbersIn);
        const hasBlank = p.steps.some((l) => l.some((x) => x === '?' || (x && x.n === '?')));
        if (!hasBlank) assert.ok(!stepNums.includes(p.answer) || questionNumbers(p).includes(p.answer), `steps leak ${where}`);
        const html = MQ.viz.render(p.viz, t);
        assert.ok(html.length > 20, `viz renders ${where}`);
        if (svgNumbers(html).includes(p.answer)) assert.ok(questionNumbers(p).includes(p.answer), `viz leaks answer ${where}`);
      }
    });
  }
}

test('generators are deterministic for a seed', () => {
  for (const tp of MQ.topics) {
    const a = tp.gen(3, MQ.rng(42));
    const b = tp.gen(3, MQ.rng(42));
    assert.deepEqual(a, b, tp.id);
  }
});

test('misconception tips fire on the classic bugs and never on the right answer', () => {
  const add = MQ.topicById.add;
  const sub = MQ.topicById.sub;
  const mul = MQ.topicById.mul;
  const place = MQ.topicById.place;
  const p47 = { a: 47, b: 38, answer: 85 };
  assert.equal(add.diagnose(p47, 75), 'tip.carry');
  assert.equal(add.diagnose(p47, 715), 'tip.carry');
  assert.equal(add.diagnose(p47, 85), null);
  const p52 = { a: 52, b: 27, answer: 25 };
  assert.equal(sub.diagnose(p52, 35), 'tip.borrow');
  assert.equal(sub.diagnose(p52, 79), 'tip.minus');
  assert.equal(sub.diagnose(p52, 25), null);
  assert.equal(mul.diagnose({ a: 3, b: 4, answer: 12 }, 7), 'tip.mulAdd');
  assert.equal(mul.diagnose({ a: 2, b: 2, answer: 4 }, 4), null);
  const pv = { level: 2, answer: 47, q: { p: { t: 4, o: 7 } } };
  assert.equal(place.diagnose(pv, 74), 'tip.swap');
  const pz = { level: 5, answer: 305, q: { p: { h: 3, t: 0, o: 5 } } };
  assert.equal(place.diagnose(pz, 35), 'tip.zero');
});

test('every tip a topic can return exists in every language', () => {
  const tips = new Set();
  for (const tp of MQ.topics) {
    for (let level = 1; level <= MQ.LEVELS; level++) {
      for (let seed = 1; seed <= 60; seed++) {
        const p = tp.gen(level, MQ.rng(seed));
        for (let given = 0; given <= 120; given++) {
          if (given === p.answer) continue;
          const tip = tp.diagnose && tp.diagnose(p, given);
          if (tip) tips.add(tip);
        }
      }
    }
  }
  assert.ok(tips.size >= 6);
  for (const code of MQ.LANG_CODES) for (const tip of tips) assert.ok(MQ.langs[code].t[tip], `${code} ${tip}`);
});
