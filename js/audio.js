// Äänimoottori: aikuisen äänitykset (Web Audio) ja varalla puhesynteesi (fi-FI).
// Kaikki toisto kulkee say()-funktion kautta, ja stop() keskeyttää kaiken.

import { normalizeKey, soundText } from './content.js';
import * as db from './db.js';

let ctx = null;
let generation = 0;
let currentSource = null;
const buffers = new Map(); // avain -> AudioBuffer
const recorded = new Set(); // avaimet, joille on äänitys
const opts = { rate: 0.85, voiceURI: '' };

export function configure({ rate, voiceURI } = {}) {
  if (rate) opts.rate = rate;
  if (voiceURI !== undefined) opts.voiceURI = voiceURI;
}

export async function init() {
  for (const k of await db.listSoundKeys()) recorded.add(k);
  if ('speechSynthesis' in window) {
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices());
  }
}

// iOS vaatii, että ääni avataan käyttäjän kosketuksesta.
export function unlock() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  } catch { /* ei ääntä tässä selaimessa */ }
}

export function stop() {
  generation++;
  try { currentSource?.stop(); } catch { /* jo pysähtynyt */ }
  currentSource = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export const hasRecording = (key) => recorded.has(normalizeKey(key));

export function finnishVoices() {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('fi'));
}

function pickVoice() {
  const fi = finnishVoices();
  return fi.find((v) => v.voiceURI === opts.voiceURI) || fi.find((v) => v.localService) || fi[0] || null;
}

export function speak(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || !text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fi-FI';
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = opts.rate;
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    const timer = setTimeout(finish, 1500 + text.length * 350);
    speechSynthesis.speak(u);
  });
}

function decode(arrayBuffer) {
  return new Promise((resolve, reject) => ctx.decodeAudioData(arrayBuffer.slice(0), resolve, reject));
}

// Leikkaa hiljaisuuden alusta ja lopusta, jotta toisto alkaa heti.
function trim(buf) {
  const data = buf.getChannelData(0);
  const thr = 0.025;
  let start = 0, end = data.length - 1;
  while (start < end && Math.abs(data[start]) < thr) start++;
  while (end > start && Math.abs(data[end]) < thr) end--;
  start = Math.max(0, start - Math.floor(buf.sampleRate * 0.04));
  end = Math.min(data.length, end + Math.floor(buf.sampleRate * 0.12));
  if (end - start < buf.sampleRate * 0.05) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, end - start, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(start, end), c);
  return out;
}

async function loadBuffer(key) {
  if (!recorded.has(key) || !ctx) return null;
  if (buffers.has(key)) return buffers.get(key);
  const rec = await db.getSound(key);
  if (!rec) return null;
  try {
    const buf = trim(await decode(rec.data));
    buffers.set(key, buf);
    return buf;
  } catch {
    return null;
  }
}

function playBuffer(buf) {
  return new Promise((resolve) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = () => resolve();
    currentSource = src;
    src.start();
  });
}

// Soittaa äänen avaimella. tts: true pakottaa puhesynteesin, jotta vaihtoehdot
// kuulostavat samalta äänitysten puuttuessa.
export async function say(key, { tts = false } = {}) {
  const k = normalizeKey(key);
  const gen = generation;
  const buf = tts ? null : await loadBuffer(k);
  if (gen !== generation) return false;
  if (buf) await playBuffer(buf);
  else await speak(soundText(k));
  return gen === generation;
}

// Soittaa avaimet peräkkäin; palauttaa false, jos keskeytettiin.
export async function sequence(keys, gap = 250, sayOpts) {
  const gen = generation;
  for (const k of keys) {
    if (gen !== generation) return false;
    await say(k, sayOpts);
    await new Promise((r) => setTimeout(r, gap));
  }
  return gen === generation;
}

// --- Äänitehosteet (syntetisoitu) ---

export function sfx(name) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const tone = (freq, start, dur, type = 'sine', vol = 0.18, freqEnd = null) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0 + start);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + start + dur);
    g.gain.setValueAtTime(0.0001, t0 + start);
    g.gain.exponentialRampToValueAtTime(vol, t0 + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + start);
    o.stop(t0 + start + dur + 0.05);
  };
  if (name === 'correct') { tone(660, 0, 0.18); tone(880, 0.12, 0.3); }
  else if (name === 'wrong') tone(260, 0, 0.3, 'triangle', 0.12, 200);
  else if (name === 'pop') tone(420, 0, 0.12, 'sine', 0.2, 900);
  else if (name === 'tick') tone(1200, 0, 0.05, 'square', 0.04);
  else if (name === 'choo') { tone(300, 0, 0.25, 'sawtooth', 0.05, 260); tone(360, 0.25, 0.3, 'sawtooth', 0.05, 300); }
  else if (name === 'fanfare') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.35, 'triangle', 0.15));
}

// --- Äänitys ---

export const canRecord = () =>
  !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && 'MediaRecorder' in window && window.isSecureContext;

export async function startRecording({ maxMs = 4000, onLevel } = {}) {
  unlock();
  stop();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  let raf = 0;
  let source = null;
  if (onLevel && ctx) {
    source = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    source.connect(an);
    const arr = new Uint8Array(an.fftSize);
    const loop = () => {
      an.getByteTimeDomainData(arr);
      let m = 0;
      for (const v of arr) m = Math.max(m, Math.abs(v - 128));
      onLevel(m / 128);
      raf = requestAnimationFrame(loop);
    };
    loop();
  }

  const done = new Promise((resolve) => {
    rec.onstop = async () => {
      cancelAnimationFrame(raf);
      source?.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
      resolve({ data: await blob.arrayBuffer(), mime: blob.type });
    };
  });
  rec.start();
  const timer = setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, maxMs);
  return {
    done,
    stop() {
      clearTimeout(timer);
      if (rec.state !== 'inactive') rec.stop();
      return done;
    },
  };
}

export async function playData(arrayBuffer) {
  unlock();
  try {
    const buf = trim(await decode(arrayBuffer));
    await playBuffer(buf);
  } catch { /* ei voitu toistaa */ }
}

export async function saveRecording(key, data, mime) {
  const k = normalizeKey(key);
  await db.putSound(k, data, mime);
  recorded.add(k);
  buffers.delete(k);
}

export async function deleteRecording(key) {
  const k = normalizeKey(key);
  await db.deleteSound(k);
  recorded.delete(k);
  buffers.delete(k);
}
