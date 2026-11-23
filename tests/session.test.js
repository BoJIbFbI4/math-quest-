'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { MQ } = require('./_load');

const add = () => MQ.topicById.add;
const newSession = (opts = {}) => new MQ.Session({ topic: add(), level: 1, len: 10, seed: 5, now: 0, ...opts });

test('stars thresholds come from clean first tries', () => {
  assert.equal(MQ.starsFor(10, 10), 3);
  assert.equal(MQ.starsFor(9, 10), 3);
  assert.equal(MQ.starsFor(8, 10), 2);
  assert.equal(MQ.starsFor(7, 10), 2);
  assert.equal(MQ.starsFor(6, 10), 1);
  assert.equal(MQ.starsFor(5, 10), 1);
  assert.equal(MQ.starsFor(4, 10), 0);
  assert.equal(MQ.starsFor(0, 0), 0);
});

test('rounds have the requested length and no back-to-back repeats', () => {
  for (const tp of MQ.topics) {
    for (let level = 1; level <= MQ.LEVELS; level++) {
      for (let seed = 1; seed <= 40; seed++) {
        const round = MQ.makeRound(tp, level, 10, [], MQ.rng(seed));
        assert.equal(round.length, 10);
        for (let i = 1; i < round.length; i++) assert.notEqual(round[i].key, round[i - 1].key, `${tp.id}:${level}`);
      }
    }
  }
});

test('up to 3 review problems are mixed into a round', () => {
  const review = [1, 2, 3, 4, 5].map((n) => ({ key: `r${n}`, q: { kind: 'eq', parts: [n, '+', 1, '=', '?'] }, answer: n + 1 }));
  const round = MQ.makeRound(add(), 1, 10, review, MQ.rng(9));
  assert.equal(round.filter((p) => p.review).length, 3);
  assert.equal(MQ.makeRound(add(), 1, 5, review, MQ.rng(9)).filter((p) => p.review).length, 1);
});

test('clean first try counts; help or a second try does not', () => {
  const s = newSession();
  assert.deepEqual(s.submit(s.problem.answer, 5000), { result: 'correct', clean: true, attempt: 1, streak: 1 });
  s.next(6000);
  s.hint();
  assert.equal(s.submit(s.problem.answer, 9000).clean, false);
  s.next(10000);
  const w = s.submit(s.problem.answer + 1, 15000);
  assert.equal(w.result, 'wrong');
  assert.equal(w.lock, MQ.LOCK.first);
  assert.equal(w.hintLevel, 1);
  const r = s.submit(s.problem.answer, 15000 + MQ.LOCK.first + 10);
  assert.equal(r.result, 'correct');
  assert.equal(r.clean, false);
  assert.deepEqual(s.marks.slice(0, 3), ['clean', 'ok', 'ok']);
});

test('the pad is locked after a wrong answer and the lock grows', () => {
  const s = newSession();
  const bad = s.problem.answer + 1;
  const w1 = s.submit(bad, 5000);
  assert.equal(s.submit(s.problem.answer, 5000 + 100).result, 'locked');
  const w2 = s.submit(bad, 5000 + w1.lock + 2500);
  assert.equal(w2.lock, MQ.LOCK.second);
  assert.equal(w2.hintLevel, 2);
});

test('fast repeated guessing triggers the slow-down lock', () => {
  const s = newSession();
  const bad = s.problem.answer + 1;
  const w1 = s.submit(bad, 500); // < FAST_MS after the problem appeared
  assert.equal(w1.slow, false);
  const w2 = s.submit(bad, 500 + w1.lock + 300);
  assert.equal(w2.slow, true);
  assert.equal(w2.lock, MQ.LOCK.slow);
});

test('third miss reveals, re-asks once 3 problems later, and the re-ask is not scored', () => {
  const s = newSession();
  const first = s.problem;
  let at = 10000;
  let r;
  for (let i = 0; i < 3; i++) {
    r = s.submit(first.answer + 1, at);
    at += 5000;
  }
  assert.equal(r.result, 'failed');
  assert.equal(s.queue.length, 11);
  assert.equal(s.queue[4].key, first.key);
  assert.equal(s.queue[4].reask, true);
  assert.equal(s.submit(first.answer, at).result, 'locked'); // solved problems take no more answers
  while (s.next(at)) {
    at += 5000;
    s.submit(s.problem.answer, at);
  }
  const sum = s.summary();
  assert.equal(sum.total, 10);
  assert.equal(sum.clean, 9);
  assert.equal(sum.stars, 3);
  assert.deepEqual(sum.missed.map((p) => p.key), [first.key]);
  assert.equal(sum.cleanKeys.length, 9);
});

test('leaving early counts the problem she was stuck on as missed', () => {
  const s = newSession();
  s.submit(s.problem.answer, 5000);
  s.next(6000);
  const stuck = s.problem;
  s.submit(stuck.answer + 1, 9000);
  const sum = s.abandonSummary();
  assert.equal(sum.total, 2);
  assert.equal(sum.clean, 1);
  assert.deepEqual(sum.missed.map((p) => p.key), [stuck.key]);

  const fresh = newSession();
  fresh.submit(fresh.problem.answer, 5000);
  fresh.next(6000); // next problem shown but untouched: not a miss
  assert.equal(fresh.abandonSummary().total, 1);
  fresh.hint(); // opening help without answering is a sign of being stuck
  assert.equal(fresh.abandonSummary().missed.length, 1);
});

test('a failed re-ask is not queued again', () => {
  const s = newSession({ len: 2 });
  const fail = () => {
    for (let i = 0; i < 3; i++) s.submit(-1, 100000 * (i + 1) + s.i * 1e6);
  };
  fail();
  s.next(1);
  s.submit(s.problem.answer, 2e6);
  s.next(1);
  assert.equal(s.problem.reask, true);
  fail();
  assert.equal(s.queue.length, 3);
});
