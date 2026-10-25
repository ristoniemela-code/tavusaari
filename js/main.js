// Käynnistys ja päänäkymät: kartta, palkinto, tarrakirja ja uuden kirjaimen esittely.

import { go, h, iconButton, root, screens, sleep, disp } from './app.js';
import * as audio from './audio.js';
import * as progress from './progress.js';
import { LETTERS } from './content.js';
import { runRound } from './round.js';
import { listenMode } from './modes/listen.js';
import { sayMode } from './modes/say.js';
import { blendMode } from './modes/blend.js';
import { drawMode } from './modes/draw.js';
import { parentGate, parentScreen } from './parent.js';

const MODES = [listenMode, sayMode, blendMode, drawMode];

function home(ctx) {
  const unlocked = progress.unlockedCount();
  const newest = new Set(progress.newestLetters());

  const stones = LETTERS.map((l, i) => {
    if (i >= unlocked) {
      return h('div', { class: 'stone locked', 'aria-label': 'Lukittu' }, h('span', { class: 'stone-letter' }, '?'));
    }
    const pct = Math.min(1, progress.xp(l.ch) / progress.XP_TARGET) * 0.7 + Math.min(1, progress.drawLevel(l.ch) / progress.DRAW_FREE) * 0.3;
    const el = h('button', {
      class: 'stone' + (newest.has(l.ch) && !progress.state.settings.unlockAll ? ' newest' : '') + (progress.letterDone(l.ch) ? ' done' : ''),
      style: { '--pct': Math.round(pct * 100) + '%' },
      'aria-label': 'Kirjain ' + l.ch,
      onclick: async () => {
        el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
        await audio.sequence(['ph:' + l.ch, 'st:' + l.ch], 200);
      },
    },
    h('span', { class: 'stone-hero' }, l.hero),
    h('span', { class: 'stone-letter' }, disp(l.ch)),
    progress.letterDone(l.ch) ? h('span', { class: 'stone-star' }, '⭐') : null);
    return el;
  });

  const modeCards = MODES.map((m) =>
    h('button', { class: 'mode-card mc-' + m.id, onclick: () => go(screens.round, m) },
      h('span', { class: 'mode-icon' }, m.icon),
      h('span', { class: 'mode-title' }, m.title)));

  root.append(h('div', { class: 'screen home' },
    h('div', { class: 'home-top' },
      h('h1', { class: 'logo' }, 'Tavusaari'),
      h('div', { class: 'home-actions' },
        h('button', { class: 'sticker-btn', onclick: () => go(screens.stickers), 'aria-label': 'Tarrakirja' }, '📒', h('span', {}, progress.state.stickers.length)),
        iconButton('⚙️', 'Aikuisille', () => go(screens.parentGate), 'small'))),
    h('div', { class: 'map' }, h('div', { class: 'sea-path' }), ...stones),
    h('div', { class: 'modes' }, ...modeCards)));
}

async function reward(ctx, mode, opts) {
  const sticker = progress.addSticker();
  const unlockReady = progress.canUnlockNext();
  const next = () => (unlockReady ? go(screens.unlock) : go(screens.home));
  root.append(h('div', { class: 'screen reward' },
    h('div', { class: 'reward-star' }, '⭐'),
    h('div', { class: 'reward-sticker' }, sticker),
    h('p', { class: 'reward-text' }, 'Sait tarran!'),
    h('div', { class: 'reward-buttons' },
      h('button', { class: 'big-btn ghost', onclick: () => go(screens.round, mode, opts) }, '🔁'),
      h('button', { class: 'big-btn', onclick: next }, unlockReady ? '🎁' : '▶'))));
  audio.sfx('fanfare');
  await sleep(500);
  if (ctx.alive) audio.say('in:round_done');
}

async function unlock(ctx) {
  const letter = progress.unlockNext();
  root.append(h('div', { class: 'screen unlock' },
    h('p', { class: 'unlock-title' }, 'Uusi kirjain!'),
    h('div', { class: 'unlock-hero' }, letter.hero),
    h('div', { class: 'unlock-letter' }, letter.ch.toUpperCase(), ' ', letter.ch),
    h('button', { class: 'big-btn', onclick: () => go(screens.home) }, '▶')));
  audio.sfx('fanfare');
  await sleep(700);
  if (ctx.alive) await audio.sequence(['in:new_letter', 'ph:' + letter.ch, 'st:' + letter.ch], 400);
}

function stickers() {
  const counts = new Map();
  for (const s of progress.state.stickers) counts.set(s, (counts.get(s) || 0) + 1);
  root.append(h('div', { class: 'screen stickers' },
    h('div', { class: 'topbar' }, iconButton('🏠', 'Kotiin', () => go(screens.home)), h('h2', {}, 'Tarrakirja')),
    h('div', { class: 'sticker-grid' },
      counts.size === 0 ? h('p', { class: 'muted' }, 'Pelaa kierros, niin saat ensimmäisen tarran!') : null,
      ...progress.STICKERS.map((s) =>
        h('div', { class: 'sticker' + (counts.has(s) ? '' : ' empty') }, counts.has(s) ? s : '',
          counts.get(s) > 1 ? h('span', { class: 'sticker-count' }, '×' + counts.get(s)) : null)))));
}

Object.assign(screens, {
  home,
  reward,
  unlock,
  stickers,
  round: runRound,
  parentGate,
  parent: parentScreen,
});

// Ääni avataan ensimmäisestä kosketuksesta (iOS-vaatimus).
window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
document.addEventListener('contextmenu', (e) => e.preventDefault());

async function start() {
  audio.configure(progress.state.settings);
  await audio.init();
  go(screens.home);
}
start();

// Service worker: offline-käyttö. Paikallisessa kehityksessä vain ?sw=1:llä,
// ettei välimuisti piilota muutoksia.
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!isLocal || location.search.includes('sw=1'))) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
