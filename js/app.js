// Yhteiset apuvälineet: näkymien vaihto ja DOM-apurit.

import * as audio from './audio.js';
import { state } from './progress.js';
import { PRAISE_KEYS } from './content.js';

export const root = document.getElementById('app');
export const screens = {}; // täytetään main.js:ssä

let current = { alive: false };

// Vaihtaa näkymää. Edellisen näkymän ctx.alive muuttuu falseksi, jolloin sen
// odottavat ajastimet ja äänet lopettavat.
export function go(screen, ...args) {
  current.alive = false;
  audio.stop();
  const ctx = { alive: true };
  current = ctx;
  root.replaceChildren();
  screen(ctx, ...args);
}

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const praise = () => audio.say(pick(PRAISE_KEYS));

// Näyttää tekstin valitussa kirjainkoossa.
export const disp = (text) => (state.settings.letterCase === 'upper' ? text.toUpperCase() : text);

export function iconButton(icon, label, onClick, cls = '') {
  return h('button', { class: 'icon-btn ' + cls, 'aria-label': label, title: label, onclick: onClick }, icon);
}

// Lisää animaatioluokan hetkeksi.
export function flash(el, cls, ms = 600) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
