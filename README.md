# Math Quest

A maths trainer for a 2nd grader. She types every answer on a big number pad: there is no multiple choice, help shows pictures instead of answers, and right answers get confetti, praise and stars. 6 topics × 5 levels, in Russian, English and Italian. It runs on a Mac and an iPad.

Plain HTML, CSS and JavaScript with **no third-party code**: no npm packages, CDN, web fonts or analytics. Sounds are synthesised, and pictures are drawn in SVG.

## Play on the Mac

Double-click `index.html`, or run a local server:

```bash
./serve.sh
```

Then open http://localhost:8080.

## Play on the iPad

1. On the Mac, run `./serve.sh`. It prints the iPad address, for example `http://your-mac-name.local:8080`. The first time, macOS may ask to allow incoming connections for Python; click Allow.
2. On the iPad (same Wi-Fi), open that address in Safari.
3. Tap Share → **Add to Home Screen**, and from then on open it **only from that icon**. It runs full screen, and Safari keeps a Home Screen app's data instead of clearing it after 7 days unused. The icon has its own storage, separate from a Safari tab, so stars earned in a Safari tab don't show up in the icon.

Progress is saved on each device separately and is tied to the exact address, so always use the same `.local` name and port. The Mac must be awake and serving while she plays. To move progress between devices, use **Grown-ups → Backup code**.

`serve.sh` tells the iPad not to cache files, so after you change or add content she gets the new version on the next launch.

To have it available without the Mac, put this folder on any HTTPS static host (for example GitHub Pages).

## Grown-ups zone

Tap ⚙️ on the home screen, hold the button for 2 seconds, then answer a multiplication question. There you can:

- set the child's name and girl/boy wording (Russian and Italian praise agrees with it)
- choose the language, round length, sounds and automatic read-aloud
- unlock all levels
- see stars, accuracy per level and **trouble spots** (recently missed problems)
- copy or restore a backup code, or erase progress

## How the game teaches

- **Right on the first try** → confetti, praise for effort, a star. 3 and 5 in a row get a bigger party.
- **Wrong #1** → a countable picture of the problem (ten frames, base-ten blocks, a number line, groups) plus a tip if the mistake is a known one (forgot the carried ten, subtracted the smaller digit from the larger one, added instead of multiplying). The pad pauses for 1.5 s.
- **Wrong #2** → strategy steps that end in "?". The pad pauses for 2.5 s.
- **Wrong #3** → the worked solution. The same problem comes back 3 problems later, and is saved to come back in later rounds.
- **💡 Help** shows the same picture and steps without being wrong first. It never shows the answer, but using it means that problem earns no star.
- Two fast wrong guesses in a row → "slow down" and a 4-second pause.
- **What she struggled with is marked.** A level she has tried but never got ★★ on turns orange with "Let's practise this". A 🔁 badge on the level and topic shows how many missed problems are waiting to come back. Leaving a round early still saves its misses, including the problem she was stuck on, but earns no stars.
- **Stars** per round come from problems solved right on the first try without help: ≥ 90% ★★★, ≥ 70% ★★, ≥ 50% ★. ★★ opens the next level. Every 5 stars earned unlocks a sticker, and any sticker can be her buddy.

## Tests

```bash
node --test 'tests/*.test.js'
```

Needs Node 18 or newer, and nothing to install. The tests generate 400 problems per topic and level and check the answers, level rules, steps, and that help never prints the answer. They also cover the round engine, saving and backup codes, all three languages (same keys, Russian plurals, story grammar), and that the game makes no outside network calls.

## Adding content

**A new level rule or problem type** lives in the topic's `gen(level, rng)` in `js/topics/<topic>.js`. A problem is plain data:

```js
{
  key: '8+5',                                   // unique per problem; used for no-repeat and the review list
  q: { kind: 'eq', parts: [8, '+', 5, '=', '?'] }, // or { kind: 'text', key, p } or { kind: 'story', d }
  answer: 13,
  viz: { type: 'tenframes', a: 8, b: 5, op: '+' }, // tenframes | blocks | numberline | bar | groups | pictures
  steps: [[5, '=', 2, '+', 3], [8, '+', 2, '=', 10], [10, '+', 3, '=', '?']],
}
```

**A new topic:**

1. Copy a file in `js/topics/`, give it a new `id`, `icon` and `hue`, and write `gen` (and optionally `diagnose` for misconception tips).
2. Add its `<script>` tag in `index.html`, before `js/session.js`.
3. Add `topic.<id>` and `lvl.<id>.1` … `lvl.<id>.5` to each file in `js/i18n/`.
4. Add the level rules to `RULES` in `tests/topics.test.js`, then run the tests.

**A new language:** copy `js/i18n/en.js`, translate it, add its code to `MQ.LANG_CODES` in `js/core.js`, and add its `<script>` tag. The tests check that every key exists.

**More stickers:** append emoji to the end of `MQ.STICKERS` in `js/store.js`.

## Files

```
index.html            screens + script tags (order matters)
css/app.css           all styles
js/core.js            namespace, seeded random, translations
js/i18n/*.js          RU / EN / IT strings, praise, story templates
js/viz.js             picture models (SVG / HTML)
js/topics/*.js        one file per topic, 5 levels each
js/session.js         round rules: attempts, pauses, scoring, re-asks
js/store.js           saving, validation, backup codes, unlocks, stickers
js/fx.js              sounds, confetti, read-aloud
js/app.js             screens and input
tests/                node --test, no dependencies
docs/plan.html        research and design plan
```
