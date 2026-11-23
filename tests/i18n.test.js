'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MQ } = require('./_load');

const EN = MQ.langs.en;
const SAMPLE = { n: 21, a: 3, b: 4, t: 2, o: 5, h: 3, g: 3, name: 'Маша', total: 10 };
const bad = /undefined|NaN|\{|\}|\[object/;

test('every language has the same keys', () => {
  assert.deepEqual(Object.keys(MQ.langs).sort(), [...MQ.LANG_CODES].sort());
  for (const code of MQ.LANG_CODES) {
    const L = MQ.langs[code];
    assert.deepEqual(Object.keys(L.t).sort(), Object.keys(EN.t).sort(), `${code} t keys`);
    assert.deepEqual(Object.keys(L.ops).sort(), Object.keys(EN.ops).sort(), `${code} ops`);
    assert.deepEqual(Object.keys(L.say).sort(), Object.keys(EN.say).sort(), `${code} say`);
    assert.deepEqual(Object.keys(L.lists).sort(), Object.keys(EN.lists).sort(), `${code} lists`);
    assert.deepEqual(Object.keys(L.story).sort(), Object.keys(EN.story).sort(), `${code} story`);
    assert.ok(L.names.length >= MQ.STORY_NAMES && L.items.length >= MQ.STORY_ITEMS, `${code} story data`);
  }
});

test('topic and level labels exist for every registered topic', () => {
  for (const code of MQ.LANG_CODES) {
    for (const tp of MQ.topics) {
      assert.ok(MQ.langs[code].t[`topic.${tp.id}`], `${code} topic.${tp.id}`);
      for (let l = 1; l <= MQ.LEVELS; l++) assert.ok(MQ.langs[code].t[`lvl.${tp.id}.${l}`], `${code} lvl.${tp.id}.${l}`);
    }
  }
});

test('every string renders cleanly for both genders', () => {
  for (const code of MQ.LANG_CODES) {
    for (const g of ['f', 'm']) {
      const t = MQ.i18n(code, g);
      for (const key of Object.keys(EN.t)) {
        const s = t(key, SAMPLE);
        assert.ok(typeof s === 'string' && s.length && !bad.test(s), `${code}/${g} ${key}: ${s}`);
      }
      for (const key of Object.keys(EN.lists)) {
        const list = t.list(key);
        assert.ok(Array.isArray(list) && list.length >= 3, `${code}/${g} list ${key}`);
      }
    }
  }
});

test('Russian and Italian praise agrees with a girl or a boy', () => {
  assert.ok(MQ.i18n('ru', 'f').list('praise').includes('Ты справилась!'));
  assert.ok(MQ.i18n('ru', 'm').list('praise').includes('Ты справился!'));
  assert.equal(MQ.i18n('it', 'f').list('praise')[0], 'Brava!');
  assert.equal(MQ.i18n('it', 'm').list('praise')[0], 'Bravo!');
});

test('Russian plurals', () => {
  const t = MQ.i18n('ru', 'f');
  const tens = (n) => t('w.tensN', { n });
  assert.equal(tens(1), '1 десяток');
  assert.equal(tens(2), '2 десятка');
  assert.equal(tens(5), '5 десятков');
  assert.equal(tens(11), '11 десятков');
  assert.equal(tens(21), '21 десяток');
  assert.equal(tens(22), '22 десятка');
  assert.equal(tens(25), '25 десятков');
  assert.equal(tens('?'), '? десятков');
  assert.equal(t('w.onesN', { n: 3 }), '3 единицы');
  assert.equal(t('w.hundredsN', { n: 5 }), '5 сотен');
});

test('story problems read correctly in every language, for every name and item', () => {
  for (const code of MQ.LANG_CODES) {
    const L = MQ.langs[code];
    for (const tpl of Object.keys(L.story)) {
      for (let ni = 0; ni < MQ.STORY_NAMES; ni++) {
        for (let ii = 0; ii < MQ.STORY_ITEMS; ii++) {
          for (const [a, b] of [[5, 2], [21, 11], [12, 4], [3, 5]]) {
            const s = L.story[tpl]({ a, b, name: L.names[ni], name2: L.names[(ni + 1) % MQ.STORY_NAMES], item: L.items[ii] });
            assert.ok(!bad.test(s) && s.includes(String(a)), `${code} ${tpl}: ${s}`);
          }
        }
      }
    }
  }
  const ru = MQ.langs.ru;
  assert.equal(
    ru.story.join({ a: 3, b: 5, name: ru.names[0], item: ru.items[0] }),
    'У Маши было 3 яблока. Ей дали ещё 5 яблок. Сколько яблок стало у Маши?'
  );
  const it = MQ.langs.it;
  assert.equal(
    it.story.separate({ a: 9, b: 4, name: it.names[3], item: it.items[0] }),
    'Marco aveva 9 mele. Ne ha regalate 4 a un amico. Quante mele gli restano?'
  );
});

test('operators follow each school tradition', () => {
  assert.equal(MQ.i18n('ru').op('*'), '·');
  assert.equal(MQ.i18n('ru').op('/'), ':');
  assert.equal(MQ.i18n('it').op('*'), '×');
  assert.equal(MQ.i18n('it').op('/'), ':');
  assert.equal(MQ.i18n('en').op('/'), '÷');
});
