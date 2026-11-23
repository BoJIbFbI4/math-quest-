'use strict';
// Loads the game scripts in index.html order (minus the DOM-only app.js), so new topic files are tested automatically.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SCRIPTS = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
for (const src of SCRIPTS) if (src !== 'js/app.js') require(path.join(ROOT, src));

module.exports = { MQ: globalThis.MQ, ROOT, SCRIPTS };
