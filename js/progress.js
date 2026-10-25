// Edistyminen ja harjoitusmoottori. Tila tallennetaan laitteelle (localStorage).

import { LETTERS, START_UNLOCKED } from './content.js';

const STORAGE_KEY = 'tavusaari:v1';
export const XP_TARGET = 10; // oikeita ensiyrityksiä per kirjain ennen seuraavan avaamista
export const DRAW_FREE = 3; // piirtotaso, joka vaaditaan (3 = piirsi itse mallin vierestä)

export const STICKERS = ['🐳', '🦄', '🐞', '🌈', '🚀', '🍓', '🦋', '🐢', '🌻', '🐙', '🦖', '🍦', '⭐', '🐧', '🎈', '🍉', '🦒', '🐝', '🌙', '🚲', '🐠', '🍄', '🦜', '🎪'];

function defaults() {
  return {
    unlocked: START_UNLOCKED,
    items: {}, // teksti -> { taito: { s: pisteet, n: yrityksiä } }
    xp: {}, // kirjain -> xp
    draw: {}, // kirjain -> korkein läpäisty piirtotaso
    confusions: {}, // "kohde|valittu" -> lukumäärä
    stickers: [],
    rounds: 0,
    flags: {},
    settings: { letterCase: 'upper', mic: false, rate: 0.85, voiceURI: '', unlockAll: false },
  };
}

function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const s = JSON.parse(raw);
    return { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) }, flags: { ...(s.flags || {}) } };
  } catch {
    return base;
  }
}

export const state = load();

export function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* tallennus ei käytössä */ }
}

export function reset() {
  const keepSettings = state.settings;
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, defaults(), { settings: keepSettings });
  save();
}

export const unlockedCount = () => (state.settings.unlockAll ? LETTERS.length : state.unlocked);
export const unlockedLetters = () => LETTERS.slice(0, unlockedCount()).map((l) => l.ch);

// Kirjaimet, joita juuri nyt harjoitellaan (uusimmat).
export function newestLetters() {
  if (state.unlocked <= START_UNLOCKED) return LETTERS.slice(0, START_UNLOCKED).map((l) => l.ch);
  return [LETTERS[state.unlocked - 1].ch];
}

export const xp = (ch) => state.xp[ch] || 0;
export const drawLevel = (ch) => state.draw[ch] || 0;
export const letterDone = (ch) => xp(ch) >= XP_TARGET && drawLevel(ch) >= DRAW_FREE;

export function itemScore(text, skill) {
  return state.items[text]?.[skill]?.s ?? 0;
}

// Kirjaa yhden tehtävän tuloksen. wrongs = väärät yritykset ennen oikeaa.
export function recordResult(text, skill, wrongs) {
  const it = (state.items[text] ||= {});
  const sk = (it[skill] ||= { s: 0, n: 0 });
  sk.n++;
  sk.s = Math.max(0, Math.min(100, sk.s + (wrongs === 0 ? 20 : 5 - 10 * Math.min(wrongs, 2))));
  if (wrongs === 0) for (const ch of new Set(text)) state.xp[ch] = (state.xp[ch] || 0) + 1;
  save();
}

export function recordConfusion(target, chosen) {
  const k = target + '|' + chosen;
  state.confusions[k] = (state.confusions[k] || 0) + 1;
  save();
}

export function recordDraw(ch, level) {
  state.draw[ch] = Math.max(drawLevel(ch), level);
  save();
}

export function canUnlockNext() {
  return state.unlocked < LETTERS.length && newestLetters().every(letterDone);
}

export function unlockNext() {
  state.unlocked = Math.min(LETTERS.length, state.unlocked + 1);
  save();
  return LETTERS[state.unlocked - 1];
}

export function addSticker() {
  const s = STICKERS[Math.floor(Math.random() * STICKERS.length)];
  state.stickers.push(s);
  state.rounds++;
  save();
  return s;
}

// Valitsee harjoiteltavan kohteen: heikosti osatut ja uusimpien kirjainten
// kohteet painottuvat, juuri nähdyt vältetään.
export function pickTarget(pool, skill, recent = []) {
  const newest = new Set(newestLetters());
  const weights = pool.map((it) => {
    let w = 110 - itemScore(it.text, skill);
    if (it.letters.some((ch) => newest.has(ch))) w *= 3;
    if (recent.includes(it.text)) w *= 0.05;
    if (it.type === 'W') w *= 0.6;
    return w;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// Vaihtoehtojen määrä osaamisen mukaan.
export function optionCount(score, min = 2, max = 4) {
  const n = score < 35 ? 2 : score < 70 ? 3 : 4;
  return Math.max(min, Math.min(max, n));
}

export function topConfusions(limit = 8) {
  return Object.entries(state.confusions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, n]) => ({ target: k.split('|')[0], chosen: k.split('|')[1], n }));
}

export function weakestItems(limit = 8) {
  const rows = [];
  for (const [text, skills] of Object.entries(state.items)) {
    for (const [skill, v] of Object.entries(skills)) if (v.n >= 2) rows.push({ text, skill, s: v.s, n: v.n });
  }
  return rows.sort((a, b) => a.s - b.s).slice(0, limit);
}
