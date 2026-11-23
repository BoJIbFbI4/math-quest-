'use strict';
// Screens and input. All game rules live in session.js / store.js; this file only draws and wires events.
(function (g) {
  const MQ = g.MQ;
  const doc = g.document;
  const app = doc.getElementById('app');
  const esc = MQ.esc;
  const $ = (sel) => doc.querySelector(sel);
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const now = () => g.performance.now();
  const MAX_DIGITS = 4; // same for every problem, so the box length never hints at the answer
  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  const LOGO_COLORS = ['#ef5b4c', '#f59a00', '#23a565', '#2f6fde', '#9b51e0', '#ff5fa2'];

  // Each topic's world: what floats across its sky, and its badge on the home card. Topics without one use "home".
  const WORLDS = {
    home: { float: ['🦋', '🌸', '⭐', '🌼', '🫧', '🦋', '🌷', '✨'] },
    add: { badge: '🌸', float: ['🌸', '🌼', '🦋', '🌷', '🐝', '🌸', '🌼', '🦋'] },
    sub: { badge: '🐠', float: ['🫧', '🐠', '🫧', '🐟', '🫧', '🐠', '🫧', '🐚'] },
    missing: { badge: '🍄', float: ['🍃', '🍄', '🦔', '🍂', '🍃', '🐿️', '🍃', '🍄'] },
    place: { badge: '🧁', float: ['🍬', '🧁', '🍭', '🍩', '🍬', '🧁', '🍭', '⭐'] },
    mul: { badge: '🪐', float: ['⭐', '🪐', '✨', '🚀', '⭐', '🌟', '✨', '🛸'] },
    story: { badge: '🎈', float: ['🎈', '🦋', '🎈', '🌈', '🎈', '🦋', '🎈', '✨'] },
    stickers: { float: ['⭐', '✨', '💖', '🌟', '⭐', '✨', '💖', '🌟'] },
    parent: { float: [] },
  };
  const SWIMMERS = ['🐠', '🐟'];
  // x: % from left, s: px size, t: seconds per trip, dl: start offset (negative = already on screen), y: swim height vh
  const FLOAT_SLOTS = [
    { x: 6, s: 30, t: 26, dl: -3, y: 9 },
    { x: 18, s: 24, t: 31, dl: -17, y: 14 },
    { x: 31, s: 34, t: 23, dl: -9, y: 6 },
    { x: 45, s: 26, t: 34, dl: -25, y: 18 },
    { x: 58, s: 30, t: 28, dl: -5, y: 11 },
    { x: 70, s: 22, t: 36, dl: -20, y: 4 },
    { x: 82, s: 32, t: 25, dl: -13, y: 15 },
    { x: 93, s: 24, t: 30, dl: -28, y: 8 },
  ];
  let theme = '';

  let S = MQ.store.load();
  let t = MQ.i18n(S.lang, S.gender);
  let view = { name: 'home' };
  let session = null;
  let typed = '';
  let busy = false;
  let revealed = false;
  let timers = [];
  let gate = null;
  let parentNote = { id: '', text: '', bad: false };
  let resetArmed = false;

  const later = (fn, ms) => timers.push(g.setTimeout(fn, ms));
  const clearTimers = () => {
    timers.forEach((id) => g.clearTimeout(id));
    timers = [];
  };
  const save = () => MQ.store.save(S);

  function applySettings() {
    t = MQ.i18n(S.lang, S.gender);
    MQ.sfx.enabled = S.settings.sound;
    doc.documentElement.lang = S.lang;
    doc.title = t('app.title');
  }

  // ---------- text helpers ----------
  const slot = () => `<span id="slot" class="slot${typed ? '' : ' empty'}">${esc(typed)}</span>`;

  function tok(x, mode, answer) {
    if (x === '?') {
      if (mode === 'q') return slot();
      return mode === 'reveal' ? `<b class="ans">${answer}</b>` : '<span class="qm">?</span>';
    }
    if (typeof x === 'number') return `<span class="num">${x}</span>`;
    if (x && typeof x === 'object') {
      const p = x.n === '?' && mode === 'reveal' ? { ...x, n: answer } : x;
      return `<span class="w">${esc(t('w.' + x.w, p))}</span>`;
    }
    return `<span class="op">${esc(t.op(x))}</span>`;
  }
  const lineHTML = (tokens, mode, answer) => tokens.map((x) => tok(x, mode, answer)).join('');
  const plainLine = (tokens) =>
    tokens.map((x) => (x === '?' ? '?' : typeof x === 'number' ? x : typeof x === 'object' ? t('w.' + x.w, x) : t.op(x))).join(' ');

  function storyText(p) {
    const L = t.L;
    const d = p.q.d;
    return L.story[d.tpl]({ a: d.a, b: d.b, name: L.names[d.ni], name2: L.names[d.n2], item: L.items[d.ii] });
  }
  function questionText(p) {
    if (p.q.kind === 'eq') return plainLine(p.q.parts);
    if (p.q.kind === 'story') return storyText(p);
    return t(p.q.key, p.q.p);
  }
  function speechText(p) {
    if (p.q.kind !== 'eq') return questionText(p);
    return p.q.parts.map((x) => (typeof x === 'number' ? x : t.L.say[x] || x)).join(' ');
  }

  function questionHTML(p, reveal) {
    const q = p.q;
    const ans = reveal ? `<span class="slot ans">${p.answer}</span>` : slot();
    if (q.kind === 'eq') return `<div class="eq">${q.parts.map((x) => (x === '?' ? ans : tok(x, 'hint'))).join('')}</div>`;
    const pic = q.showViz ? `<div class="q-viz">${MQ.viz.render(p.viz, t)}</div>` : '';
    return `<p class="qtext">${esc(questionText(p))}</p>${pic}<div class="ansrow">${ans}</div>`;
  }

  const maxHint = (p) => (p.q.showViz ? 1 : p.steps && p.steps.length ? 2 : 1);

  function helpHTML(p, level, reveal) {
    const out = [];
    const vizInQ = !!p.q.showViz;
    if (!vizInQ && (reveal || level >= 1)) {
      out.push(`<div class="help-viz"><div class="help-title">${esc(t('fb.picture'))}</div>${MQ.viz.render(p.viz, t)}</div>`);
    }
    if ((reveal || level >= (vizInQ ? 1 : 2)) && p.steps && p.steps.length) {
      const steps = p.steps.map((s) => `<div class="step">${lineHTML(s, reveal ? 'reveal' : 'hint', p.answer)}</div>`).join('');
      out.push(`<div class="help-steps"><div class="help-title">${esc(t('fb.steps'))}</div>${steps}</div>`);
    }
    if (reveal) out.push(`<div class="reveal-actions"><button class="btn3d big-btn go" data-act="next">${esc(t('fb.gotIt'))} →</button></div>`);
    return out.join('');
  }

  const stars = (n, of = 3) => `<b>${'★'.repeat(n)}</b>${'★'.repeat(of - n)}`;
  const topicStars = (id) => {
    let s = 0;
    for (let l = 1; l <= MQ.LEVELS; l++) s += (S.levels[`${id}:${l}`] || { best: 0 }).best;
    return s;
  };
  const topicReview = (id) => {
    let n = 0;
    for (let l = 1; l <= MQ.LEVELS; l++) n += MQ.store.levelStatus(S, id, l).toReview;
    return n;
  };
  const padHTML = () =>
    `<div class="pad" id="pad">${KEYS.map((k) => {
      const label = k === 'del' ? '⌫' : k === 'ok' ? '✓' : k;
      const aria = k === 'del' ? ` aria-label="${esc(t('play.erase'))}"` : k === 'ok' ? ` aria-label="${esc(t('play.check'))}"` : '';
      return `<button class="btn3d key ${k}" data-act="key" data-v="${k}"${aria}>${label}</button>`;
    }).join('')}</div>`;

  // ---------- views ----------
  const VIEWS = {
    home() {
      const hello = S.name ? t('home.helloName', { name: esc(S.name) }) : t('home.hello');
      const owned = MQ.store.stickers(S.stars).length;
      return `<div class="screen home">
        <header class="top">
          <div class="langs">${MQ.LANG_CODES.map(
            (c) => `<button class="btn3d lang-btn${c === S.lang ? ' on' : ''}" data-act="lang" data-v="${c}" aria-label="${esc(MQ.langs[c].name)}">${c.toUpperCase()}</button>`
          ).join('')}</div>
          <button class="btn3d icon-btn" data-act="gate" aria-label="${esc(t('home.parents'))}">⚙️</button>
        </header>
        <h1 class="logo" aria-label="${esc(t('app.title'))}">${Array.from(t('app.title'))
          .map((ch, i) => (ch === ' ' ? '<span class="gap"></span>' : `<span style="--i:${i};--lc:${LOGO_COLORS[i % LOGO_COLORS.length]}">${esc(ch)}</span>`))
          .join('')}</h1>
        <div class="hero">
          <button class="buddy big" data-act="stickers" aria-label="${esc(t('home.stickers'))}">${S.buddy}</button>
          <div class="bubble">${hello}</div>
        </div>
        <h2 class="pick">${esc(t('home.pick'))}</h2>
        <div class="topics">${MQ.topics
          .map(
            (tp, i) => `<button class="btn3d topic" style="--hue:${tp.hue};--i:${i}" data-act="topic" data-v="${tp.id}">
              ${WORLDS[tp.id] && WORLDS[tp.id].badge ? `<span class="t-world" aria-hidden="true">${WORLDS[tp.id].badge}</span>` : ''}
              <span class="t-icon">${tp.icon}</span>
              <span class="t-name">${esc(t('topic.' + tp.id))}</span>
              <span class="t-stars"><b>★</b> ${topicStars(tp.id)} / ${MQ.LEVELS * 3}${topicReview(tp.id) ? ` <span class="t-review">🔁 ${topicReview(tp.id)}</span>` : ''}</span>
            </button>`
          )
          .join('')}</div>
        <div class="home-foot"><button class="btn3d big-btn" data-act="stickers">🎁 ${esc(t('home.stickers'))} · ${owned} / ${MQ.STICKERS.length}</button></div>
      </div>`;
    },

    levels() {
      const tp = MQ.topicById[view.topic];
      let nodes = '';
      // The level to play next: the first open one without ★★ yet.
      let next = 0;
      for (let n = 1; n <= MQ.LEVELS && !next; n++) {
        if (MQ.store.unlocked(S, tp.id, n) && (S.levels[`${tp.id}:${n}`] || { best: 0 }).best < 2) next = n;
      }
      for (let n = 1; n <= MQ.LEVELS; n++) {
        const open = MQ.store.unlocked(S, tp.id, n);
        const best = (S.levels[`${tp.id}:${n}`] || { best: 0 }).best;
        const st = MQ.store.levelStatus(S, tp.id, n);
        const badge = st.toReview ? `<span class="lvl-badge" aria-label="${esc(t('levels.toReview', { n: st.toReview }))}">🔁 ${st.toReview}</span>` : '';
        nodes += `<button class="btn3d lvl${open ? '' : ' locked'}${st.struggling ? ' practice' : ''}${n === next ? ' next' : ''}" style="--hue:${tp.hue}" data-act="level" data-v="${n}" aria-label="${esc(t('levels.level', { n }))}">
          ${n === next ? '<span class="lvl-here" aria-hidden="true">👇</span>' : ''}
          ${badge}
          <span class="lvl-n">${open ? n : '🔒'}</span>
          <span class="lvl-stars">${stars(best)}</span>
          <span class="lvl-d">${esc(t(`lvl.${tp.id}.${n}`))}</span>
          ${st.struggling ? `<span class="lvl-tag">${esc(t('levels.practice'))}</span>` : ''}
        </button>`;
      }
      return `<div class="screen levels">
        <header class="top">
          <button class="btn3d back" data-act="home" aria-label="${esc(t('play.back'))}">←</button>
          <h1>${tp.icon} ${esc(t('topic.' + tp.id))}</h1>
          <span class="icon-btn"></span>
        </header>
        <p class="sub">${esc(t('levels.pick'))}</p>
        <div class="path">${nodes}</div>
        <div class="buddy-row"><span class="buddy" id="buddy">${S.buddy}</span><div class="bubble" id="bubble"></div></div>
      </div>`;
    },

    play() {
      const p = session.problem;
      const tp = MQ.topicById[view.topic];
      return `<div class="screen play" style="--hue:${tp.hue}">
        <header class="top">
          <button class="btn3d back" data-act="quit" aria-label="${esc(t('play.back'))}">←</button>
          <div class="dots" id="dots">${dotsHTML()}</div>
          <div class="streak${session.streak >= 2 ? ' on' : ''}" id="streak">🔥 ${session.streak}</div>
        </header>
        <div class="play-main">
          <section class="stage">
            <div class="card q-card">
              <div class="buddy-row"><span class="buddy" id="buddy">${S.buddy}</span><div class="bubble" id="bubble"></div>
                ${MQ.canSpeak() ? `<button class="btn3d read" data-act="read" aria-label="${esc(t('play.read'))}">🔊</button>` : ''}</div>
              <div class="question" id="question">${questionHTML(p, false)}</div>
            </div>
            <div class="card help" id="help"></div>
          </section>
          <section class="controls">
            ${padHTML()}
            <div class="lockbar" id="lockbar"><i></i></div>
            <button class="btn3d hint-btn" data-act="hint" id="hintBtn">💡 ${esc(t('play.help'))}</button>
          </section>
        </div>
        <div class="praise" id="praise"></div>
      </div>`;
    },

    end() {
      const { sum, res, level } = view;
      const tp = MQ.topicById[view.topic];
      const nextOpen = level < MQ.LEVELS && MQ.store.unlocked(S, tp.id, level + 1);
      const starRow = [1, 2, 3].map((i) => `<span class="star${i <= sum.stars ? ' on' : ''}" style="--d:${i * 0.25}s">★</span>`).join('');
      return `<div class="screen end">
        <div class="card end-card">
          <span class="buddy end-buddy${sum.stars >= 2 ? ' party' : ''}">${S.buddy}</span>
          <div class="end-stars">${sum.stars ? '<div class="burst" aria-hidden="true"></div>' : ''}${starRow}</div>
          <h1>${esc(t('end.title.' + sum.stars))}</h1>
          ${sum.stars === 0 ? `<p>${esc(t('end.sub.0'))}</p>` : ''}
          <p>${esc(t('end.clean', { n: sum.clean, total: sum.total }))}</p>
          ${res.unlockedNext ? `<p class="end-unlock">🔓 ${esc(t('end.unlocked', { n: level + 1 }))}</p>` : ''}
          ${res.newStickers.length ? `<div class="end-sticker"><div class="label">${esc(t('end.newSticker'))}</div><div class="sticker-pop">${res.newStickers.join(' ')}</div></div>` : ''}
          <div class="end-actions">
            <button class="btn3d big-btn" data-act="again">↻ ${esc(t('end.again'))}</button>
            ${nextOpen ? `<button class="btn3d big-btn go" data-act="nextLevel">${esc(t('end.next'))} →</button>` : ''}
            <button class="btn3d big-btn ghost" data-act="home">🏠 ${esc(t('end.home'))}</button>
          </div>
        </div>
      </div>`;
    },

    stickers() {
      const owned = MQ.store.stickers(S.stars);
      const toNext = MQ.store.starsToNext(S.stars);
      const cells = MQ.STICKERS.map((e, i) =>
        i < owned.length
          ? `<button class="btn3d sticker${e === S.buddy ? ' on' : ''}" data-act="buddy" data-v="${e}">${e}</button>`
          : '<span class="sticker locked">?</span>'
      ).join('');
      return `<div class="screen stickers">
        <header class="top">
          <button class="btn3d back" data-act="home" aria-label="${esc(t('play.back'))}">←</button>
          <h1>🎁 ${esc(t('stickers.title'))}</h1>
          <span class="icon-btn"></span>
        </header>
        <p class="sticker-info">${esc(toNext ? t('stickers.next', { n: toNext }) : t('stickers.all'))} · ${esc(t('stickers.pick'))}</p>
        <div class="sticker-grid">${cells}</div>
      </div>`;
    },

    gate() {
      const body =
        gate.step === 1
          ? `<p>${esc(t('parent.hold'))}</p>
             <button class="btn3d big-btn hold-btn" id="holdBtn"><i></i><span>🔒 ${esc(t('parent.title'))}</span></button>`
          : `<p>${esc(t('parent.gate', { a: gate.a, b: gate.b }))}</p>
             <div class="ansrow">${slot()}</div>
             ${padHTML()}
             <p class="note bad" id="gateNote"></p>`;
      return `<div class="screen">
        <header class="top">
          <button class="btn3d back" data-act="home" aria-label="${esc(t('play.back'))}">←</button>
          <h1>${esc(t('parent.title'))}</h1>
          <span class="icon-btn"></span>
        </header>
        <div class="gate"><div class="card gate-card">${body}</div></div>
      </div>`;
    },

    parent() {
      const st = S.settings;
      const note = (id) => (parentNote.id === id ? `<p class="note${parentNote.bad ? ' bad' : ''}">${esc(parentNote.text)}</p>` : '');
      let rows = '';
      for (const tp of MQ.topics) {
        for (let l = 1; l <= MQ.LEVELS; l++) {
          const r = S.levels[`${tp.id}:${l}`];
          if (!r) continue;
          const acc = r.total ? Math.round((100 * r.clean) / r.total) : 0;
          const st = MQ.store.levelStatus(S, tp.id, l);
          rows += `<tr${st.struggling ? ' class="struggling"' : ''}><td>${tp.icon} ${esc(t('topic.' + tp.id))}</td><td>${l}</td><td class="st">${stars(r.best)}</td><td>${r.plays}</td><td>${acc}%</td><td>${st.toReview || ''}</td></tr>`;
        }
      }
      let trouble = '';
      for (const tp of MQ.topics) {
        for (let l = 1; l <= MQ.LEVELS; l++) {
          const list = S.review[`${tp.id}:${l}`];
          if (!list || !list.length) continue;
          const items = list.slice(-8).reverse().map((p) => `<li>${esc(questionText(p))} → <b>${p.answer}</b></li>`).join('');
          trouble += `<div><h3>${tp.icon} ${esc(t('topic.' + tp.id))} · ${esc(t('levels.level', { n: l }))}</h3><ul>${items}</ul></div>`;
        }
      }
      const opt = (v, cur, label) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
      return `<div class="screen parent">
        <header class="top">
          <span class="icon-btn"></span>
          <h1>⚙️ ${esc(t('parent.title'))}</h1>
          <button class="btn3d small-btn" data-act="home">${esc(t('parent.close'))}</button>
        </header>
        <div class="card">
          <label class="field" for="p-name">${esc(t('parent.name'))}<input type="text" id="p-name" maxlength="24" value="${esc(S.name)}" autocomplete="off" autocapitalize="words" spellcheck="false"></label>
          <div class="field"><span>${esc(t('parent.gender'))}</span><div class="radios">
            <label><input type="radio" name="p-gender" id="p-gender-f" value="f"${S.gender === 'f' ? ' checked' : ''}>${esc(t('parent.girl'))}</label>
            <label><input type="radio" name="p-gender" id="p-gender-m" value="m"${S.gender === 'm' ? ' checked' : ''}>${esc(t('parent.boy'))}</label>
          </div></div>
          <label class="field" for="p-lang">${esc(t('parent.lang'))}<select id="p-lang">${MQ.LANG_CODES.map((c) => opt(c, S.lang, MQ.langs[c].name)).join('')}</select></label>
          <label class="field" for="p-round">${esc(t('parent.round'))}<select id="p-round">${MQ.ROUND_LENGTHS.map((n) => opt(String(n), String(st.roundLen), String(n))).join('')}</select></label>
          <label class="field" for="p-sound">${esc(t('parent.sound'))}<input type="checkbox" id="p-sound"${st.sound ? ' checked' : ''}></label>
          <label class="field" for="p-speech">${esc(t('parent.speech'))}<input type="checkbox" id="p-speech"${st.speech ? ' checked' : ''}></label>
          <label class="field" for="p-unlock">${esc(t('parent.unlock'))}<input type="checkbox" id="p-unlock"${st.unlockAll ? ' checked' : ''}></label>
        </div>
        <div class="card">
          <h2>${esc(t('parent.stats'))}</h2>
          <p class="hint">${esc(t('parent.stars', { n: S.stars }))}</p>
          ${rows ? `<div class="table-wrap"><table class="stats"><tr><th></th><th>${esc(t('parent.level'))}</th><th>${esc(t('parent.best'))}</th><th>${esc(t('parent.plays'))}</th><th>${esc(t('parent.acc'))}</th><th>🔁 ${esc(t('parent.review'))}</th></tr>${rows}</table></div>` : `<p class="hint">${esc(t('parent.noStats'))}</p>`}
        </div>
        <div class="card">
          <h2>${esc(t('parent.trouble'))}</h2>
          <p class="hint">${esc(t('parent.troubleHint'))}</p>
          <div class="trouble">${trouble || `<p class="hint">${esc(t('parent.none'))}</p>`}</div>
        </div>
        <div class="card">
          <h2>${esc(t('parent.backup'))}</h2>
          <p class="hint">${esc(t('parent.backupHint'))}</p>
          <textarea id="p-code" readonly>${esc(MQ.store.exportCode(S))}</textarea>
          <div class="row-btns"><button class="btn3d small-btn" data-act="copyCode">📋 ${esc(t('parent.copy'))}</button></div>
          ${note('copy')}
          <textarea id="p-restore" placeholder="…"></textarea>
          <div class="row-btns"><button class="btn3d small-btn" data-act="restore">${esc(t('parent.restore'))}</button></div>
          ${note('restore')}
        </div>
        <div class="card">
          <div class="row-btns"><button class="btn3d small-btn danger${resetArmed ? ' armed' : ''}" data-act="reset">${esc(resetArmed ? t('parent.resetConfirm') : t('parent.reset'))}</button></div>
          ${note('reset')}
        </div>
      </div>`;
    },
  };

  function applyTheme() {
    const name = view.name;
    const next =
      name === 'home' || name === 'stickers'
        ? name
        : name === 'gate' || name === 'parent'
          ? 'parent'
          : WORLDS[view.topic]
            ? view.topic
            : 'home';
    if (next === theme) return;
    theme = next;
    doc.body.dataset.theme = next;
    const list = WORLDS[next].float;
    $('#floaters').innerHTML = list.length
      ? FLOAT_SLOTS.map((f, i) => {
          const e = list[i % list.length];
          const cls = SWIMMERS.includes(e) ? ' class="swim"' : '';
          return `<span${cls} style="--x:${f.x}%;--s:${f.s}px;--t:${f.t}s;--dl:${f.dl}s;--y:${f.y}vh">${e}</span>`;
        }).join('')
      : '';
  }

  function render() {
    applyTheme();
    app.innerHTML = VIEWS[view.name]();
    app.dataset.view = view.name;
    if (view.name === 'play') updateHelp();
    if (view.name === 'gate' && gate.step === 1) wireHold();
  }

  function go(name, extra = {}) {
    clearTimers();
    MQ.clearConfetti();
    if (name !== 'parent') {
      resetArmed = false;
      parentNote = { id: '', text: '', bad: false };
    }
    view = { ...extra, name };
    render();
    g.scrollTo(0, 0);
  }

  // ---------- play ----------
  const dotsHTML = () =>
    session.queue
      .map((p, i) => `<span class="dot-p${session.marks[i] ? ' ' + session.marks[i] : ''}${i === session.i ? ' cur' : ''}${p.reask ? ' re' : ''}"></span>`)
      .join('');

  function say(text, mood, anim = mood) {
    const b = $('#bubble');
    const buddy = $('#buddy');
    if (b) {
      b.textContent = text;
      b.className = 'bubble' + (mood ? ' ' + mood : '');
    }
    if (buddy && anim) {
      buddy.classList.remove('happy', 'think', 'dance');
      void buddy.offsetWidth;
      buddy.classList.add(anim);
      // Back to the idle bob once the reaction is over.
      buddy.addEventListener('animationend', () => buddy.classList.remove(anim), { once: true });
    }
  }

  function updateSlot() {
    const el = $('#slot');
    if (!el) return;
    el.textContent = typed;
    el.className = 'slot' + (typed ? '' : ' empty');
  }

  function updateHelp() {
    const p = session.problem;
    const el = $('#help');
    const html = helpHTML(p, session.hintLevel, revealed);
    el.innerHTML = html;
    el.classList.toggle('open', !!html);
    const btn = $('#hintBtn');
    const max = maxHint(p);
    btn.disabled = revealed || session.solved || session.hintLevel >= max;
    btn.innerHTML = `💡 ${esc(session.hintLevel >= 1 && session.hintLevel < max ? t('play.moreHelp') : t('play.help'))}`;
    const last = $('.help-steps') && el.lastElementChild; // steps, or the "Got it" button under them
    if (last && last.scrollIntoView) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function lockPad(ms) {
    busy = true;
    const pad = $('#pad');
    const bar = $('#lockbar i');
    pad.classList.add('locked');
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';
    void bar.offsetWidth;
    bar.style.transition = `transform ${ms}ms linear`;
    bar.style.transform = 'scaleX(0)';
    later(() => {
      busy = false;
      pad.classList.remove('locked');
    }, ms);
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  function burst(text) {
    const el = $('#praise');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  // Review items replay verbatim from storage; one that cannot render is skipped so the round still starts.
  function renders(p) {
    try {
      questionHTML(p, false);
      helpHTML(p, 2, true);
      return true;
    } catch (e) {
      return false;
    }
  }

  function startRound(topicId, level) {
    session = new MQ.Session({
      topic: MQ.topicById[topicId],
      level,
      len: S.settings.roundLen,
      review: (S.review[`${topicId}:${level}`] || []).filter(renders),
      seed: (Math.random() * 4294967296) >>> 0,
      now: now(),
    });
    typed = '';
    busy = false;
    revealed = false;
    go('play', { topic: topicId, level });
    if (S.settings.speech) later(() => MQ.speak(speechText(session.problem), t.L.speech), 400);
  }

  function press(k) {
    if (view.name === 'gate') return gatePress(k);
    if (view.name !== 'play' || !session || busy || session.solved) return;
    if (k === 'ok') return submit();
    if (k === 'del') typed = typed.slice(0, -1);
    else if (typed.length < MAX_DIGITS) typed = typed === '0' ? k : typed + k;
    updateSlot();
  }

  function submit() {
    if (!typed) {
      say(t('fb.empty'), 'think');
      return;
    }
    const r = session.submit(parseInt(typed, 10), now());
    if (r.result === 'correct') onCorrect(r);
    else if (r.result === 'wrong') onWrong(r);
    else if (r.result === 'failed') onFailed(r);
  }

  function onCorrect(r) {
    busy = true;
    const el = $('#slot');
    el.classList.add('right');
    const praise = rand(t.list(r.attempt === 1 ? 'praise' : 'praiseAfter'));
    say(praise, 'happy', r.streak >= 3 ? 'dance' : 'happy');
    burst(r.streak === 3 || r.streak === 5 ? t('streak.' + r.streak) : praise);
    MQ.sfx.play(r.streak >= 3 ? 'streak' : 'correct');
    const [x, y] = centerOf(el);
    MQ.confetti(x, y, r.streak >= 3 ? 130 : 70);
    MQ.sparkle(x, y, r.streak >= 3 ? 14 : 9);
    $('#dots').innerHTML = dotsHTML();
    const dot = $('#dots .dot-p.cur');
    if (r.clean) MQ.flyStar(el, dot, () => dot && dot.classList.add('pop'));
    const st = $('#streak');
    st.textContent = `🔥 ${session.streak}`;
    st.classList.toggle('on', session.streak >= 2);
    $('#hintBtn').disabled = true;
    $('#pad').classList.add('locked');
    later(advance, 1500);
  }

  function onWrong(r) {
    MQ.sfx.play('wrong');
    const el = $('#slot');
    el.classList.add('wrong');
    const card = $('.q-card');
    card.classList.remove('wobble');
    void card.offsetWidth;
    card.classList.add('wobble');
    const msg = r.slow ? t('fb.slow') : rand(t.list('notYet'));
    say(r.tip ? `${msg} ${t(r.tip)}` : msg, 'think');
    lockPad(r.lock);
    later(() => {
      typed = '';
      updateSlot();
    }, 650);
    $('#streak').classList.remove('on');
    updateHelp();
  }

  function onFailed(r) {
    busy = true;
    revealed = true;
    $('#pad').classList.add('locked');
    typed = '';
    MQ.sfx.play('reveal');
    $('#question').innerHTML = questionHTML(session.problem, true);
    say(r.tip ? `${t('fb.reveal')} ${t(r.tip)}` : t('fb.reveal'), 'think');
    $('#dots').innerHTML = dotsHTML();
    updateHelp();
  }

  function advance() {
    clearTimers();
    if (!session.next(now())) return finishRound();
    typed = '';
    busy = false;
    revealed = false;
    render();
    if (session.problem.reask) say(t('fb.reask'), 'think');
    if (S.settings.speech) MQ.speak(speechText(session.problem), t.L.speech);
  }

  function finishRound() {
    const sum = session.summary();
    const res = MQ.store.applyRound(S, view.topic, view.level, sum, Date.now());
    save();
    go('end', { topic: view.topic, level: view.level, sum, res });
    MQ.sfx.play('win');
    if (sum.stars) later(() => MQ.confetti(g.innerWidth / 2, g.innerHeight * 0.3, 160), 350);
    if (res.newStickers.length) later(() => MQ.sfx.play('sticker'), 1100);
  }

  // ---------- grown-ups gate ----------
  function wireHold() {
    const btn = $('#holdBtn');
    let timer = 0;
    const cancel = () => {
      g.clearTimeout(timer);
      btn.classList.remove('holding');
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('holding');
      timer = g.setTimeout(() => {
        gate = { step: 2, a: 12 + Math.floor(Math.random() * 18), b: 3 + Math.floor(Math.random() * 7) };
        typed = '';
        render();
      }, 2000);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, cancel));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function gatePress(k) {
    if (gate.step !== 2 || busy) return;
    if (k === 'del') typed = typed.slice(0, -1);
    else if (k !== 'ok') {
      if (typed.length < MAX_DIGITS) typed += k;
    } else if (parseInt(typed, 10) === gate.a * gate.b) {
      typed = '';
      return go('parent');
    } else {
      busy = true;
      $('#gateNote').textContent = t('parent.wrong');
      later(() => {
        busy = false;
        typed = '';
        go('home');
      }, 1600);
    }
    updateSlot();
  }

  // ---------- actions ----------
  const ACT = {
    lang(v) {
      if (!MQ.LANG_CODES.includes(v)) return;
      S.lang = v;
      save();
      applySettings();
      render();
    },
    topic: (v) => go('levels', { topic: v }),
    home: () => go('home'),
    level(v) {
      const n = Number(v);
      if (!MQ.store.unlocked(S, view.topic, n)) {
        say(t('levels.locked', { n: n - 1 }), 'think');
        MQ.sfx.play('wrong');
        return;
      }
      startRound(view.topic, n);
    },
    quit() {
      if (session && !session.finished && MQ.store.applyPartial(S, view.topic, view.level, session.abandonSummary(), Date.now())) save();
      session = null;
      go('levels', { topic: view.topic });
    },
    key: (v) => press(v),
    hint() {
      if (!session || session.solved || session.hintLevel >= maxHint(session.problem)) return;
      session.hint();
      updateHelp();
    },
    read: () => session && MQ.speak(speechText(session.problem), t.L.speech),
    next() {
      if (revealed) advance();
    },
    again: () => startRound(view.topic, view.level),
    nextLevel: () => startRound(view.topic, view.level + 1),
    stickers: () => go('stickers'),
    buddy(v) {
      if (!MQ.store.stickers(S.stars).includes(v)) return;
      S.buddy = v;
      save();
      MQ.sfx.play('sticker');
      render();
    },
    gate() {
      gate = { step: 1 };
      typed = '';
      busy = false;
      go('gate');
    },
    copyCode() {
      const ta = $('#p-code');
      ta.value = MQ.store.exportCode(S); // the name field saves without re-rendering, so refresh first
      const done = () => {
        parentNote = { id: 'copy', text: t('parent.copied'), bad: false };
        render();
      };
      const fallback = () => {
        ta.focus();
        ta.select();
        try {
          doc.execCommand('copy');
        } catch (e) {
          /* the code stays selected for a manual copy */
        }
        done();
      };
      if (g.navigator.clipboard && g.navigator.clipboard.writeText) g.navigator.clipboard.writeText(ta.value).then(done, fallback);
      else fallback();
    },
    restore() {
      const next = MQ.store.importCode($('#p-restore').value);
      if (!next) {
        parentNote = { id: 'restore', text: t('parent.restoreBad'), bad: true };
      } else {
        S = next;
        save();
        applySettings();
        parentNote = { id: 'restore', text: t('parent.restoreOk'), bad: false };
      }
      render();
    },
    reset() {
      if (!resetArmed) {
        resetArmed = true;
        parentNote = { id: '', text: '', bad: false };
      } else {
        MQ.store.resetProgress(S);
        save();
        resetArmed = false;
        parentNote = { id: 'reset', text: t('parent.resetDone'), bad: false };
      }
      render();
    },
  };

  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    MQ.sfx.unlock();
    if (b.dataset.act !== 'key' || view.name === 'play') MQ.sfx.play('tap');
    const fn = ACT[b.dataset.act];
    if (fn) fn(b.dataset.v, b);
  });

  // Parent-zone form controls save immediately; the name field is not re-rendered so it keeps focus.
  app.addEventListener('input', (e) => {
    if (e.target.id === 'p-name') {
      S.name = e.target.value.slice(0, 24);
      save();
    }
  });
  app.addEventListener('change', (e) => {
    const el = e.target;
    if (el.name === 'p-gender') S.gender = el.value === 'm' ? 'm' : 'f';
    else if (el.id === 'p-lang' && MQ.LANG_CODES.includes(el.value)) S.lang = el.value;
    else if (el.id === 'p-round') S.settings.roundLen = Number(el.value);
    else if (el.id === 'p-sound') S.settings.sound = el.checked;
    else if (el.id === 'p-speech') S.settings.speech = el.checked;
    else if (el.id === 'p-unlock') S.settings.unlockAll = el.checked;
    else return;
    save();
    applySettings();
    render();
  });

  doc.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (view.name !== 'play' && view.name !== 'gate') return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') {
      e.preventDefault();
      press('del');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (revealed) advance();
      else press('ok');
    }
  });

  // iOS Safari ignores user-scalable=no; block pinch so a stray two-finger touch doesn't zoom the game.
  doc.addEventListener('gesturestart', (e) => e.preventDefault());

  if (g.navigator.storage && g.navigator.storage.persist) g.navigator.storage.persist().catch(() => {});

  applySettings();
  render();
})(globalThis);
