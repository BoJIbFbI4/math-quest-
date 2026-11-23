'use strict';
// Round engine: pure logic, no DOM, so it is unit-tested in Node.
(function (g) {
  const MQ = g.MQ;

  MQ.LOCK = { first: 1500, second: 2500, slow: 4000 };
  MQ.FAST_MS = 2000; // a wrong answer this soon after the pad unlocks counts as a guess
  MQ.MAX_ATTEMPTS = 3;

  MQ.starsFor = (clean, total) => {
    const r = total ? clean / total : 0;
    return r >= 0.9 ? 3 : r >= 0.7 ? 2 : r >= 0.5 ? 1 : 0;
  };

  const shuffle = (arr, rng) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  MQ.makeRound = (topic, level, len, review, rng) => {
    const out = [];
    const seen = new Set();
    const reviewCount = Math.min(review.length, 3, Math.floor(len * 0.3));
    for (const p of shuffle(review.slice(), rng).slice(0, reviewCount)) {
      out.push({ ...p, review: true });
      seen.add(p.key);
    }
    // Small levels have few distinct problems; after enough tries allow repeats rather than loop forever.
    for (let tries = 0; out.length < len; tries++) {
      const p = topic.gen(level, rng);
      if (seen.has(p.key) && tries < len * 40) continue;
      seen.add(p.key);
      out.push(p);
    }
    shuffle(out, rng);
    for (let i = 1; i < out.length; i++) {
      if (out[i].key !== out[i - 1].key) continue;
      const j = out.findIndex((p, k) => k > i && p.key !== out[i].key && (k + 1 >= out.length || out[k + 1].key !== out[i].key));
      if (j > 0) [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  MQ.Session = class Session {
    constructor({ topic, level, len = 10, review = [], seed = 1, now = 0 }) {
      this.topic = topic;
      this.level = level;
      this.rng = MQ.rng(seed);
      this.queue = MQ.makeRound(topic, level, len, review, this.rng);
      this.marks = []; // per queue index: 'clean' | 'ok' | 'miss'
      this.results = []; // counted problems only (re-asks excluded)
      this.i = 0;
      this.streak = 0;
      this.bestStreak = 0;
      this.fast = 0;
      this._reset(now);
    }

    _reset(now) {
      this.attempt = 0;
      this.hintLevel = 0;
      this.solved = false;
      this.readyAt = now;
      this.lockedUntil = 0;
    }

    get problem() {
      return this.queue[this.i];
    }

    get finished() {
      return this.i >= this.queue.length;
    }

    hint() {
      if (!this.solved) this.hintLevel = Math.min(2, this.hintLevel + 1);
      return this.hintLevel;
    }

    _record(clean, solved) {
      const p = this.problem;
      this.solved = true;
      this.marks[this.i] = clean ? 'clean' : solved ? 'ok' : 'miss';
      if (!p.reask) this.results.push({ p, clean, solved, attempts: this.attempt, hint: this.hintLevel });
    }

    submit(given, now) {
      if (this.solved || this.finished || now < this.lockedUntil) return { result: 'locked' };
      const p = this.problem;
      this.attempt++;
      if (given === p.answer) {
        const clean = this.attempt === 1 && this.hintLevel === 0;
        this.streak = clean ? this.streak + 1 : 0;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        this.fast = 0;
        this._record(clean, true);
        return { result: 'correct', clean, attempt: this.attempt, streak: this.streak };
      }
      this.streak = 0;
      this.fast = now - this.readyAt < MQ.FAST_MS ? this.fast + 1 : 0;
      const tip = this.topic.diagnose ? this.topic.diagnose(p, given) : null;
      if (this.attempt >= MQ.MAX_ATTEMPTS) {
        this._record(false, false);
        if (!p.reask) this.queue.splice(Math.min(this.i + 4, this.queue.length), 0, { ...p, reask: true });
        return { result: 'failed', attempt: this.attempt, tip };
      }
      const slow = this.fast >= 2;
      const lock = slow ? MQ.LOCK.slow : this.attempt === 1 ? MQ.LOCK.first : MQ.LOCK.second;
      this.lockedUntil = now + lock;
      this.readyAt = now + lock;
      // Wrong #1 opens the picture, wrong #2 the steps.
      this.hintLevel = Math.max(this.hintLevel, this.attempt);
      return { result: 'wrong', attempt: this.attempt, lock, slow, tip, hintLevel: this.hintLevel };
    }

    next(now) {
      if (this.finished) return false;
      this.i++;
      this._reset(now);
      return !this.finished;
    }

    summary() {
      const clean = this.results.filter((r) => r.clean).length;
      const total = this.results.length;
      return {
        clean,
        total,
        stars: MQ.starsFor(clean, total),
        bestStreak: this.bestStreak,
        missed: this.results.filter((r) => !r.clean).map((r) => r.p),
        cleanKeys: this.results.filter((r) => r.clean).map((r) => r.p.key),
      };
    }

    // For a round left early: the problem she was stuck on (wrong tries or help, not solved) counts as missed.
    abandonSummary() {
      const sum = this.summary();
      const p = this.problem;
      if (p && !p.reask && !this.solved && (this.attempt > 0 || this.hintLevel > 0)) {
        sum.missed.push(p);
        sum.total += 1;
      }
      return sum;
    }
  };
})(globalThis);
