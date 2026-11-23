'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, SCRIPTS } = require('./_load');

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

test('index.html loads every script in js/ and each one exists', () => {
  const onDisk = walk(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map(rel).sort();
  assert.deepEqual([...SCRIPTS].sort(), onDisk);
  assert.equal(SCRIPTS[0], 'js/core.js');
  assert.equal(SCRIPTS[SCRIPTS.length - 1], 'js/app.js');
});

test('the game references no outside servers (no CDN, fonts, analytics)', () => {
  const files = ['index.html', 'manifest.webmanifest', ...walk(path.join(ROOT, 'js')).map(rel), ...walk(path.join(ROOT, 'css')).map(rel)];
  for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/https?:\/\//.test(text), `${f} contains an external URL`);
    assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/.test(text), `${f} makes network calls`);
  }
});

test('the manifest points at icons that exist', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  for (const icon of m.icons) assert.ok(fs.existsSync(path.join(ROOT, icon.src)), icon.src);
  assert.ok(fs.existsSync(path.join(ROOT, 'icons/icon-180.png')));
});
