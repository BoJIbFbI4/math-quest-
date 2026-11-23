'use strict';
// Classic script (no modules) so the game also runs from a double-clicked file:// page.
(function (g) {
  const MQ = (g.MQ = g.MQ || {});
  MQ.LEVELS = 5;
  MQ.LANG_CODES = ['ru', 'en', 'it'];

  MQ.topics = [];
  MQ.topicById = {};
  MQ.topic = (def) => {
    MQ.topics.push(def);
    MQ.topicById[def.id] = def;
  };

  MQ.langs = {};
  MQ.addLang = (pack) => {
    MQ.langs[pack.code] = pack;
  };

  // mulberry32: tiny seeded PRNG so tests can replay any round.
  MQ.rng = (seed) => {
    let s = seed >>> 0;
    const r = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let x = s;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    return r;
  };

  MQ.esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // Translator bound to a language and the child's grammatical gender (ru/it praise agrees with it).
  MQ.i18n = (code, gender) => {
    const L = MQ.langs[code] || MQ.langs.en;
    const EN = MQ.langs.en;
    const ctx = { g: gender === 'm' ? 'm' : 'f', L };
    const t = (key, p = {}) => {
      let v = L.t[key];
      if (v === undefined && EN) v = EN.t[key];
      if (v === undefined) return key;
      if (v && typeof v === 'object') v = v[ctx.g];
      if (typeof v === 'function') return v(p, ctx);
      return String(v).replace(/\{(\w+)\}/g, (_, k) => (p[k] === undefined ? '' : p[k]));
    };
    t.L = L;
    t.code = L.code;
    t.g = ctx.g;
    t.op = (o) => (L.ops[o] === undefined ? o : L.ops[o]);
    t.list = (key) => {
      const v = L.lists[key];
      return Array.isArray(v) ? v : v[ctx.g];
    };
    return t;
  };

  // Plural picker shared by language packs; n === '?' (a blank in a hint) uses the "many" form.
  MQ.plural = (code) => {
    const rules = new Intl.PluralRules(code);
    return (n, forms) => {
      if (typeof n !== 'number') return forms.many || forms.other;
      return forms[rules.select(n)] || forms.other || forms.many;
    };
  };

  // Checks that a step/equation line is arithmetically true once '?' is replaced (used by tests).
  MQ.evalLine = (tokens, answer) => {
    const vals = tokens.map((x) => (x === '?' ? answer : x));
    const eq = vals.indexOf('=');
    if (eq < 0 || vals.some((x) => typeof x === 'object')) return null;
    const calc = (arr) => {
      let acc = arr[0];
      for (let i = 1; i < arr.length; i += 2) {
        const op = arr[i];
        const n = arr[i + 1];
        if (op === '+') acc += n;
        else if (op === '-') acc -= n;
        else if (op === '*') acc *= n;
        else if (op === '/') acc /= n;
        else return NaN;
      }
      return acc;
    };
    return calc(vals.slice(0, eq)) === calc(vals.slice(eq + 1));
  };
})(globalThis);
