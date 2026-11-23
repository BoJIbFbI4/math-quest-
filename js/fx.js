'use strict';
// Sounds are synthesised with Web Audio (no audio files); confetti is a plain canvas.
(function (g) {
  const MQ = g.MQ;
  let ctx = null;

  const audio = () => {
    const AC = g.AudioContext || g.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    // iOS starts the context suspended until a user gesture.
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  function tone(freq, at, dur, type = 'sine', vol = 0.16) {
    const c = audio();
    if (!c) return;
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const gain = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gain).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  const NOTE = { C4: 261.6, E4: 329.6, G4: 392, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880, C6: 1046.5, E6: 1318.5 };
  const SOUNDS = {
    tap: () => tone(NOTE.A5, 0, 0.05, 'triangle', 0.04),
    correct: () => [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => tone(f, i * 0.08, 0.28)),
    streak: () => [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone(f, i * 0.07, 0.3)),
    wrong: () => {
      tone(NOTE.E4, 0, 0.18, 'triangle', 0.07);
      tone(NOTE.C4, 0.14, 0.26, 'triangle', 0.07);
    },
    reveal: () => [NOTE.G4, NOTE.C5, NOTE.E5].forEach((f, i) => tone(f, i * 0.12, 0.3, 'sine', 0.08)),
    win: () => {
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone(f, i * 0.12, 0.3));
      [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f) => tone(f, 0.55, 0.7, 'sine', 0.09));
    },
    sticker: () => [NOTE.E6, NOTE.C6, NOTE.E6, NOTE.G5].forEach((f, i) => tone(f, i * 0.06, 0.18, 'triangle', 0.06)),
  };

  MQ.sfx = {
    enabled: true,
    unlock: () => {
      try {
        audio();
      } catch (e) {
        /* no audio on this device */
      }
    },
    play(name) {
      if (!this.enabled || !SOUNDS[name]) return;
      try {
        SOUNDS[name]();
      } catch (e) {
        /* audio is a nicety; never break the game for it */
      }
    },
  };

  const reducedMotion = () => g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#ef5b4c', '#f5b400', '#2bb673', '#2f80ed', '#9b51e0', '#ff8ac6'];
  let parts = [];
  let raf = 0;

  MQ.confetti = (x, y, count = 70) => {
    const cv = g.document && g.document.getElementById('fx');
    if (!cv || reducedMotion()) return;
    const dpr = g.devicePixelRatio || 1;
    if (cv.width !== g.innerWidth * dpr) {
      cv.width = g.innerWidth * dpr;
      cv.height = g.innerHeight * dpr;
    }
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 9;
      parts.push({
        x: x * dpr,
        y: y * dpr,
        vx: Math.cos(ang) * sp * dpr,
        vy: (Math.sin(ang) * sp - 7) * dpr,
        r: (5 + Math.random() * 6) * dpr,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
        c: COLORS[i % COLORS.length],
        life: 90 + Math.random() * 40,
      });
    }
    if (!raf) raf = g.requestAnimationFrame(step);
    function step() {
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      parts = parts.filter((p) => p.life > 0 && p.y < cv.height + 40);
      for (const p of parts) {
        p.vy += 0.35 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.globalAlpha = Math.min(1, p.life / 30);
        c.fillStyle = p.c;
        c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        c.restore();
      }
      raf = parts.length ? g.requestAnimationFrame(step) : 0;
      if (!raf) c.clearRect(0, 0, cv.width, cv.height);
    }
  };

  // A star flies from the answer box into the progress trail.
  MQ.flyStar = (from, to, done) => {
    const d = g.document;
    if (!from || !to || reducedMotion() || !d.body.animate) return done && done();
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const x0 = a.left + a.width / 2;
    const y0 = a.top + a.height / 2;
    const dx = b.left + b.width / 2 - x0;
    const dy = b.top + b.height / 2 - y0;
    const star = d.createElement('div');
    star.className = 'fly-star';
    star.textContent = '⭐';
    star.style.left = `${x0}px`;
    star.style.top = `${y0}px`;
    d.body.appendChild(star);
    const anim = star.animate(
      [
        { transform: 'translate(0, 0) scale(1.5) rotate(0deg)' },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) scale(1.25) rotate(180deg)`, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(.45) rotate(360deg)` },
      ],
      { duration: 800, easing: 'cubic-bezier(.45, 0, .55, 1)' }
    );
    anim.onfinish = () => {
      star.remove();
      if (done) done();
    };
  };

  MQ.sparkle = (x, y, n = 10) => {
    const d = g.document;
    if (reducedMotion() || !d.body.animate) return;
    for (let i = 0; i < n; i++) {
      const sp = d.createElement('div');
      sp.className = 'spark';
      sp.textContent = i % 3 ? '✨' : '⭐';
      sp.style.left = `${x}px`;
      sp.style.top = `${y}px`;
      d.body.appendChild(sp);
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 70 + Math.random() * 60;
      sp.animate(
        [
          { transform: 'translate(0, 0) scale(.3)', opacity: 1 },
          { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(1.1)`, opacity: 0 },
        ],
        { duration: 750, easing: 'cubic-bezier(.2, .8, .3, 1)' }
      ).onfinish = () => sp.remove();
    }
  };

  MQ.clearConfetti = () => {
    parts = [];
  };

  MQ.canSpeak = () => !!(g.speechSynthesis && g.SpeechSynthesisUtterance);
  MQ.speak = (text, langTag) => {
    if (!MQ.canSpeak()) return;
    try {
      const s = g.speechSynthesis;
      s.cancel();
      const u = new g.SpeechSynthesisUtterance(text);
      u.lang = langTag;
      const voices = s.getVoices();
      const norm = (l) => l.replace('_', '-').toLowerCase();
      const voice =
        voices.find((v) => norm(v.lang) === langTag.toLowerCase()) ||
        voices.find((v) => norm(v.lang).startsWith(langTag.slice(0, 2)));
      if (voice) u.voice = voice;
      u.rate = 0.9;
      s.speak(u);
    } catch (e) {
      /* speech is optional */
    }
  };
})(globalThis);
