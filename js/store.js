'use strict';
// Progress lives in localStorage. Every read is validated: a corrupt or foreign value falls back to defaults.
(function (g) {
  const MQ = g.MQ;
  const KEY = 'mathquest.v1';
  const REVIEW_CAP = 30;
  MQ.STARS_PER_STICKER = 5;
  MQ.ROUND_LENGTHS = [5, 10, 15, 20];

  // Order = unlock order. Append new stickers at the end so existing collections stay the same.
  MQ.STICKERS = [
    '🦉', '🐱', '🐶', '🦊', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵',
    '🐧', '🐤', '🦄', '🐝', '🦋', '🐢', '🐙', '🐬', '🐳', '🦒',
    '🦓', '🐘', '🦔', '🐿️', '🦕', '🦖', '🐞', '🌈', '⭐', '🌻',
    '🍓', '🍉', '🍩', '🧁', '🎈', '🚀', '🎨', '🏰', '👑', '💎',
  ];

  const clampInt = (v, lo, hi) => (Number.isInteger(v) ? Math.min(hi, Math.max(lo, v)) : lo);

  const guessLang = () => {
    const nav = (g.navigator && g.navigator.language) || 'en';
    const code = nav.slice(0, 2).toLowerCase();
    return MQ.LANG_CODES.includes(code) ? code : 'en';
  };

  const defaults = () => ({
    v: 1,
    lang: guessLang(),
    name: '',
    gender: 'f',
    buddy: MQ.STICKERS[0],
    settings: { sound: true, speech: false, roundLen: 10, unlockAll: false },
    levels: {},
    review: {},
    stars: 0,
  });

  const QUESTION_OK = {
    eq: (q) => Array.isArray(q.parts),
    text: (q) => typeof q.key === 'string',
    story: (q) => !!q.d && typeof q.d === 'object',
  };
  // Review problems are replayed as stored, so anything that doesn't look like a generated problem is dropped.
  const validProblem = (p) =>
    !!p &&
    typeof p === 'object' &&
    typeof p.key === 'string' &&
    Number.isInteger(p.answer) &&
    !!p.q &&
    typeof p.q === 'object' &&
    !!QUESTION_OK[p.q.kind] &&
    QUESTION_OK[p.q.kind](p.q) &&
    Array.isArray(p.steps) &&
    p.steps.every(Array.isArray) &&
    !!p.viz &&
    typeof p.viz === 'object';

  const stripFlags = (p) => {
    const { review, reask, ...rest } = p;
    return rest;
  };

  function sanitize(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return d;
    if (MQ.LANG_CODES.includes(raw.lang)) d.lang = raw.lang;
    if (typeof raw.name === 'string') d.name = raw.name.slice(0, 24);
    if (raw.gender === 'm' || raw.gender === 'f') d.gender = raw.gender;
    if (MQ.STICKERS.includes(raw.buddy)) d.buddy = raw.buddy;
    const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    for (const k of ['sound', 'speech', 'unlockAll']) if (typeof s[k] === 'boolean') d.settings[k] = s[k];
    if (MQ.ROUND_LENGTHS.includes(s.roundLen)) d.settings.roundLen = s.roundLen;
    const levelKey = /^[a-z]+:[1-5]$/;
    if (raw.levels && typeof raw.levels === 'object') {
      for (const [k, v] of Object.entries(raw.levels)) {
        if (!levelKey.test(k) || !v || typeof v !== 'object') continue;
        d.levels[k] = {
          best: clampInt(v.best, 0, 3),
          plays: clampInt(v.plays, 0, 1e7),
          clean: clampInt(v.clean, 0, 1e9),
          total: clampInt(v.total, 0, 1e9),
          last: Number.isFinite(v.last) ? v.last : 0,
        };
      }
    }
    if (raw.review && typeof raw.review === 'object') {
      for (const [k, arr] of Object.entries(raw.review)) {
        if (levelKey.test(k) && Array.isArray(arr)) d.review[k] = arr.filter(validProblem).map(stripFlags).slice(-REVIEW_CAP);
      }
    }
    d.stars = clampInt(raw.stars, 0, 1e9);
    return d;
  }

  // UTF-8 safe base64, chunked so a large review list cannot overflow the argument stack.
  const toB64 = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return g.btoa(bin);
  };
  const fromB64 = (b64) => {
    const bin = g.atob(b64.replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  const stickerCount = (stars) => Math.min(MQ.STICKERS.length, 1 + Math.floor(stars / MQ.STARS_PER_STICKER));

  MQ.store = {
    KEY,
    REVIEW_CAP,
    defaults,
    sanitize,

    load(ls = g.localStorage) {
      try {
        return sanitize(JSON.parse(ls.getItem(KEY)));
      } catch (e) {
        return defaults();
      }
    },

    save(state, ls = g.localStorage) {
      try {
        ls.setItem(KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        return false;
      }
    },

    exportCode: (state) => toB64(JSON.stringify(state)),

    importCode(code) {
      try {
        const raw = JSON.parse(fromB64(String(code).trim()));
        return raw && raw.v === 1 ? sanitize(raw) : null;
      } catch (e) {
        return null;
      }
    },

    unlocked(state, topicId, level) {
      if (level <= 1 || state.settings.unlockAll) return true;
      const prev = state.levels[`${topicId}:${level - 1}`];
      return !!prev && prev.best >= 2;
    },

    stickers: (stars) => MQ.STICKERS.slice(0, stickerCount(stars)),

    starsToNext(stars) {
      if (stickerCount(stars) >= MQ.STICKERS.length) return 0;
      return MQ.STARS_PER_STICKER - (stars % MQ.STARS_PER_STICKER);
    },

    // Accuracy, last-played time and the review list; shared by finished and abandoned rounds.
    _record(state, k, sum, now) {
      const rec = state.levels[k] || { best: 0, plays: 0, clean: 0, total: 0, last: 0 };
      rec.clean += sum.clean;
      rec.total += sum.total;
      rec.last = now;
      state.levels[k] = rec;
      const rev = (state.review[k] || []).filter((p) => !sum.cleanKeys.includes(p.key));
      for (const p of sum.missed) if (!rev.some((r) => r.key === p.key)) rev.push(stripFlags(p));
      state.review[k] = rev.slice(-REVIEW_CAP);
      return rec;
    },

    applyRound(state, topicId, level, sum, now) {
      const k = `${topicId}:${level}`;
      const nextWasOpen = level >= MQ.LEVELS || this.unlocked(state, topicId, level + 1);
      const before = stickerCount(state.stars);
      const rec = this._record(state, k, sum, now);
      rec.best = Math.max(rec.best, sum.stars);
      rec.plays += 1;
      state.stars += sum.stars;

      return {
        newStickers: MQ.STICKERS.slice(before, stickerCount(state.stars)),
        unlockedNext: !nextWasOpen && this.unlocked(state, topicId, level + 1),
      };
    },

    // A round left early keeps its misses and accuracy but earns no stars and doesn't count as played.
    applyPartial(state, topicId, level, sum, now) {
      if (!sum.total) return false;
      this._record(state, `${topicId}:${level}`, sum, now);
      return true;
    },

    // "Struggling": she has tried the level but never reached ★★.
    levelStatus(state, topicId, level) {
      const k = `${topicId}:${level}`;
      const rec = state.levels[k];
      return {
        struggling: !!rec && rec.total > 0 && rec.best < 2,
        toReview: (state.review[k] || []).length,
      };
    },

    resetProgress(state) {
      state.levels = {};
      state.review = {};
      state.stars = 0;
      state.buddy = MQ.STICKERS[0];
    },
  };
})(globalThis);
