'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MQ } = require('./_load');

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};
const sum = (stars, clean = 10, total = 10, missed = [], cleanKeys = []) => ({ stars, clean, total, missed, cleanKeys });
const prob = (key) => ({
  key,
  q: { kind: 'eq', parts: [1, '+', 1, '=', '?'] },
  answer: 2,
  viz: { type: 'tenframes', a: 1, b: 1, op: '+' },
  steps: [[1, '+', 1, '=', '?']],
});

test('garbage or foreign data falls back to defaults', () => {
  for (const raw of [null, 42, 'x', [], { v: 2 }, { v: 1, stars: -5, lang: 'xx', gender: 'q', levels: 'no' }]) {
    const s = MQ.store.sanitize(raw);
    assert.equal(s.v, 1);
    assert.equal(s.stars, 0);
    assert.ok(MQ.LANG_CODES.includes(s.lang));
    assert.equal(s.gender, 'f');
    assert.deepEqual(s.levels, {});
  }
});

test('valid fields survive; invalid entries are dropped', () => {
  const s = MQ.store.sanitize({
    v: 1,
    lang: 'ru',
    name: 'Маша',
    gender: 'm',
    buddy: '🦊',
    settings: { sound: false, roundLen: 15, unlockAll: 'yes' },
    levels: { 'add:2': { best: 9, plays: 3, clean: 20, total: 30, last: 5 }, 'bad key': {}, 'sub:9': {} },
    review: {
      'add:2': [
        prob('a'),
        { key: 1 },
        null,
        { ...prob('no-steps'), steps: undefined },
        { ...prob('bad-kind'), q: { kind: 'html', parts: [] } },
        { ...prob('eq-no-parts'), q: { kind: 'eq' } },
        { ...prob('no-viz'), viz: null },
      ],
    },
    stars: 12,
  });
  assert.equal(s.lang, 'ru');
  assert.equal(s.name, 'Маша');
  assert.equal(s.gender, 'm');
  assert.equal(s.buddy, '🦊');
  assert.equal(s.settings.sound, false);
  assert.equal(s.settings.roundLen, 15);
  assert.equal(s.settings.unlockAll, false);
  assert.deepEqual(Object.keys(s.levels), ['add:2']);
  assert.equal(s.levels['add:2'].best, 3);
  assert.equal(s.review['add:2'].length, 1);
  assert.equal(s.stars, 12);
});

test('save/load round-trips and survives a broken storage', () => {
  const ls = memStorage();
  const s = MQ.store.defaults();
  s.stars = 7;
  assert.equal(MQ.store.save(s, ls), true);
  assert.equal(MQ.store.load(ls).stars, 7);
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
  assert.equal(MQ.store.load(broken).stars, 0);
  assert.equal(MQ.store.save(s, broken), false);
  ls.setItem(MQ.store.KEY, '{not json');
  assert.equal(MQ.store.load(ls).stars, 0);
});

test('backup code round-trips unicode and rejects junk', () => {
  const s = MQ.store.defaults();
  s.name = 'Маша 🌟';
  s.buddy = '🦄';
  s.stars = 60;
  s.review['mul:4'] = Array.from({ length: 40 }, (_, i) => prob('k' + i));
  const back = MQ.store.importCode(MQ.store.exportCode(s));
  assert.equal(back.name, 'Маша 🌟');
  assert.equal(back.buddy, '🦄');
  assert.equal(back.review['mul:4'].length, MQ.store.REVIEW_CAP);
  assert.equal(MQ.store.importCode('hello'), null);
  assert.equal(MQ.store.importCode(''), null);
  assert.equal(MQ.store.importCode(btoa('{"v":3}')), null);
});

test('levels unlock at two stars on the previous level', () => {
  const s = MQ.store.defaults();
  assert.equal(MQ.store.unlocked(s, 'add', 1), true);
  assert.equal(MQ.store.unlocked(s, 'add', 2), false);
  let res = MQ.store.applyRound(s, 'add', 1, sum(1, 6), 1);
  assert.equal(res.unlockedNext, false);
  res = MQ.store.applyRound(s, 'add', 1, sum(2, 8), 2);
  assert.equal(res.unlockedNext, true);
  res = MQ.store.applyRound(s, 'add', 1, sum(3), 3);
  assert.equal(res.unlockedNext, false); // already open
  assert.equal(s.levels['add:1'].best, 3);
  assert.equal(s.levels['add:1'].plays, 3);
  s.settings.unlockAll = true;
  assert.equal(MQ.store.unlocked(s, 'mul', 5), true);
});

test('every 5 stars earns the next sticker', () => {
  const s = MQ.store.defaults();
  assert.deepEqual(MQ.store.stickers(0), [MQ.STICKERS[0]]);
  assert.deepEqual(MQ.store.applyRound(s, 'add', 1, sum(3), 1).newStickers, []);
  assert.deepEqual(MQ.store.applyRound(s, 'add', 1, sum(3), 2).newStickers, [MQ.STICKERS[1]]);
  assert.equal(s.stars, 6);
  assert.equal(MQ.store.starsToNext(6), 4);
  assert.equal(MQ.store.starsToNext(MQ.STICKERS.length * MQ.STARS_PER_STICKER), 0);
});

test('review list adds misses and drops problems solved cleanly', () => {
  const s = MQ.store.defaults();
  MQ.store.applyRound(s, 'sub', 3, sum(1, 5, 10, [prob('a'), prob('b')], []), 1);
  assert.deepEqual(s.review['sub:3'].map((p) => p.key), ['a', 'b']);
  MQ.store.applyRound(s, 'sub', 3, sum(2, 8, 10, [{ ...prob('b'), reask: true, review: true }, prob('c')], ['a']), 2);
  assert.deepEqual(s.review['sub:3'].map((p) => p.key), ['b', 'c']);
  assert.equal(s.review['sub:3'][0].reask, undefined);
});

test('a round left early keeps its misses but earns nothing', () => {
  const s = MQ.store.defaults();
  assert.equal(MQ.store.applyPartial(s, 'mul', 4, sum(0, 0, 0), 1), false);
  assert.deepEqual(s.levels, {});
  assert.equal(MQ.store.applyPartial(s, 'mul', 4, sum(3, 1, 3, [prob('7*8'), prob('9*6')], ['2*3']), 5), true);
  assert.deepEqual(s.levels['mul:4'], { best: 0, plays: 0, clean: 1, total: 3, last: 5 });
  assert.equal(s.stars, 0);
  assert.deepEqual(s.review['mul:4'].map((p) => p.key), ['7*8', '9*6']);
  assert.deepEqual(MQ.store.levelStatus(s, 'mul', 4), { struggling: true, toReview: 2 });
  assert.equal(MQ.store.unlocked(s, 'mul', 5), false);
});

test('a level stops being "struggling" at two stars; leftover misses stay to review', () => {
  const s = MQ.store.defaults();
  assert.deepEqual(MQ.store.levelStatus(s, 'add', 2), { struggling: false, toReview: 0 });
  MQ.store.applyRound(s, 'add', 2, sum(1, 5, 10, [prob('a')]), 1);
  assert.equal(MQ.store.levelStatus(s, 'add', 2).struggling, true);
  MQ.store.applyRound(s, 'add', 2, sum(2, 8, 10, [prob('b')]), 2);
  assert.deepEqual(MQ.store.levelStatus(s, 'add', 2), { struggling: false, toReview: 2 });
});

test('reset keeps settings and language but clears progress', () => {
  const s = MQ.store.defaults();
  s.lang = 'it';
  s.settings.sound = false;
  MQ.store.applyRound(s, 'add', 1, sum(3), 1);
  MQ.store.resetProgress(s);
  assert.equal(s.stars, 0);
  assert.deepEqual(s.levels, {});
  assert.equal(s.lang, 'it');
  assert.equal(s.settings.sound, false);
});
