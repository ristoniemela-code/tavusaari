// Piirrä kirjain: katso → jäljitä leveää käytävää → jäljitä ohutta → piirrä itse
// (→ myöhemmin muistista). Toimii sormella ja Apple Pencilillä.

import { go, h, screens, sleep, praise, flash, disp } from '../app.js';
import * as audio from '../audio.js';
import * as progress from '../progress.js';
import { LETTERS } from '../content.js';
import { STROKES, matchStroke, pathLength, resample } from '../letterPaths.js';

const STAGE_LEVEL = { watch: 0, wide: 1, thin: 2, free: 3, memory: 4 };
const STAGE_TOL = { watch: 10, wide: 13, thin: 9, free: 17, memory: 18 };
const INK = '#3a6ff7';

export const drawMode = {
  id: 'draw',
  icon: '✏️',
  title: 'Piirrä kirjain',
  instr: 'in:mode_draw',
  tasks: 4,

  setup(env) {
    const unlocked = env.letters;
    let ch = env.opts.letter;
    if (!ch) {
      const newest = progress.newestLetters().filter((c) => unlocked.includes(c));
      ch = [...newest, ...unlocked].find((c) => progress.drawLevel(c) < progress.DRAW_FREE)
        || unlocked.reduce((best, c) => (progress.drawLevel(c) < progress.drawLevel(best) ? c : best), unlocked[unlocked.length - 1]);
    }
    env.letter = ch;
    env.stages = progress.drawLevel(ch) >= progress.DRAW_FREE ? ['watch', 'thin', 'free', 'memory'] : ['watch', 'wide', 'thin', 'free'];
    env.total = env.stages.length;
    env.extra.replaceChildren(h('div', { class: 'letter-picker' },
      ...unlocked.map((c) => h('button', {
        class: 'pick-letter' + (c === ch ? ' on' : ''),
        'aria-label': 'Piirrä ' + c,
        onclick: () => c !== ch && go(screens.round, drawMode, { letter: c }),
      }, c.toUpperCase()))));
  },

  task(env, index) {
    return drawStage(env, env.stages[index]);
  },
};

function drawStage(env, stage) {
  const { ctx, letter } = env;
  const strokes = STROKES[letter];
  const tol = STAGE_TOL[stage];
  const hero = LETTERS.find((l) => l.ch === letter);

  return new Promise((resolve) => {
    const canvas = h('canvas', { class: 'board' });
    const modelCanvas = h('canvas', { class: 'model' });
    const modelBox = h('div', { class: 'model-box' + (stage === 'free' ? '' : ' hidden') }, modelCanvas);
    const side = h('div', { class: 'draw-side' },
      h('div', { class: 'draw-hero' }, hero.hero, h('span', {}, disp(letter))),
      h('button', { class: 'icon-btn', 'aria-label': 'Kuuntele', onclick: () => { audio.stop(); audio.sequence(['ph:' + letter, 'st:' + letter], 200); } }, '🔊'),
      stage !== 'watch' ? h('button', { class: 'icon-btn', 'aria-label': 'Näytä malli', onclick: () => showDemo() }, '👀') : null,
      modelBox);
    const goBtn = h('button', { class: 'big-btn hidden', 'aria-label': 'Minun vuoro', onclick: () => { audio.stop(); resolve({ wrongs: 0 }); } }, '✋');
    const replayBtn = h('button', { class: 'big-btn ghost hidden', 'aria-label': 'Katso uudestaan', onclick: () => watch() }, '🔁');
    if (stage === 'watch') side.append(goBtn, replayBtn);
    const boardWrap = h('div', { class: 'board-wrap' }, canvas);
    env.stage.append(h('div', { class: 'draw' }, side, boardWrap));

    const g = canvas.getContext('2d');
    let size = 0, pad = 0, scale = 1;
    const accepted = []; // { pts, idx }
    let live = null;
    let failing = null; // { pts, t0 }
    let demo = null; // { idx, t: 0..1 }
    const demoDone = new Set();
    const hintStrokes = new Set();
    const failCount = new Map();
    let totalFails = 0;
    let finished = false;
    let raf = 0;

    const remaining = () => strokes.map((_, i) => i).filter((i) => !accepted.some((a) => a.idx === i));
    const toPx = ([x, y]) => [pad + x * scale, pad + y * scale];

    function resize() {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      size = r.width;
      pad = size * 0.07;
      scale = (size - 2 * pad) / 100;
      render();
      drawModel(modelCanvas, letter);
    }

    function path(pts, width, color, dash = null) {
      if (pts.length < 2) return;
      g.save();
      g.lineWidth = width;
      g.strokeStyle = color;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      if (dash) g.setLineDash(dash);
      g.beginPath();
      pts.forEach((p, i) => { const [x, y] = toPx(p); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
      g.restore();
    }

    function startMarker(idx) {
      const s = strokes[idx];
      const [x, y] = toPx(s[0]);
      // Suuntanuoli hieman alun jälkeen.
      const a = toPx(s[Math.min(s.length - 1, 6)]);
      const b = toPx(s[Math.min(s.length - 1, 9)]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      g.save();
      g.fillStyle = '#ff9f1c';
      g.translate(b[0], b[1]);
      g.rotate(ang);
      g.beginPath();
      g.moveTo(scale * 4, 0);
      g.lineTo(-scale * 2.5, -scale * 3);
      g.lineTo(-scale * 2.5, scale * 3);
      g.closePath();
      g.fill();
      g.restore();
      g.beginPath();
      g.fillStyle = '#2bb673';
      g.arc(x, y, scale * 4.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `700 ${scale * 5.5}px ui-rounded, system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(idx + 1), x, y + scale * 0.3);
    }

    function render() {
      if (!size) return;
      g.clearRect(0, 0, size, size);
      // Viivasto kuten koulun vihossa.
      const hl = (y, dash) => path([[-4, y], [104, y]], 2, '#a9cdf0', dash);
      hl(10); hl(50, [8, 8]); hl(90);

      const guide = stage === 'wide' || stage === 'thin' || stage === 'watch';
      strokes.forEach((s, i) => {
        if (guide || hintStrokes.has(i)) {
          path(s, tol * 2 * scale, stage === 'watch' ? '#eef3fa' : '#e3ecf8');
          path(s, 2, '#9fb3cf', [6, 7]);
        }
      });
      for (const i of demoDone) path(strokes[i], scale * 4.5, '#ff9f1c');
      if (demo) {
        const s = strokes[demo.idx];
        const n = Math.max(2, Math.round(s.length * demo.t));
        path(s.slice(0, n), scale * 4.5, '#ff9f1c');
        const [x, y] = toPx(s[n - 1]);
        g.beginPath();
        g.fillStyle = '#e4572e';
        g.arc(x, y, scale * 3, 0, Math.PI * 2);
        g.fill();
      }
      for (const a of accepted) path(a.pts, scale * 4.5, INK);
      if (failing) {
        const age = (performance.now() - failing.t0) / 600;
        if (age >= 1) failing = null;
        else path(failing.pts, scale * 4.5, `rgba(228, 87, 46, ${1 - age})`);
      }
      if (live) path(live, scale * 4.5, INK);
      if ((stage === 'wide' || stage === 'thin') && !finished && !demo && !live) {
        const next = remaining()[0];
        if (next != null) startMarker(next);
      }
    }

    function loop() {
      render();
      if (ctx.alive && (demo || failing)) raf = requestAnimationFrame(loop);
      else raf = 0;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

    function animateStroke(idx, ms = 900) {
      return new Promise((done) => {
        const t0 = performance.now();
        const step = () => {
          if (!ctx.alive) return done();
          demo = { idx, t: Math.min(1, (performance.now() - t0) / ms) };
          render();
          if (demo.t < 1) requestAnimationFrame(step);
          else { demo = null; done(); }
        };
        requestAnimationFrame(step);
      });
    }

    async function watch() {
      replayBtn.classList.add('hidden');
      goBtn.classList.add('hidden');
      demoDone.clear();
      render();
      audio.say('ph:' + letter);
      for (let i = 0; i < strokes.length; i++) {
        if (!ctx.alive) return;
        await animateStroke(i);
        demoDone.add(i);
        render();
        await sleep(250);
      }
      if (!ctx.alive) return;
      replayBtn.classList.remove('hidden');
      goBtn.classList.remove('hidden');
      flash(goBtn, 'pulse', 800);
    }

    let demoBusy = false;
    async function showDemo(idx = remaining()[0] ?? 0) {
      if (demoBusy || finished) return;
      demoBusy = true;
      await animateStroke(idx, 800);
      demoBusy = false;
      render();
    }

    // --- Piirtäminen ---
    let activePointer = null;
    let penSeen = false;
    const toUnits = (e) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left - pad) / scale, (e.clientY - r.top - pad) / scale];
    };

    if (stage !== 'watch') {
      canvas.addEventListener('pointerdown', (e) => {
        if (finished || demoBusy || activePointer !== null) return;
        if (e.pointerType === 'pen') penSeen = true;
        else if (penSeen && e.pointerType === 'touch') return; // kämmen ruudulla kynän kanssa
        activePointer = e.pointerId;
        try { canvas.setPointerCapture(e.pointerId); } catch { /* ei kaapattavissa */ }
        live = [toUnits(e)];
        render();
      });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerId !== activePointer || !live) return;
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ev of evs.length ? evs : [e]) live.push(toUnits(ev));
        render();
      });
      const end = (e) => {
        if (e.pointerId !== activePointer) return;
        activePointer = null;
        const pts = live;
        live = null;
        evaluate(pts);
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
    }

    async function evaluate(pts) {
      if (!pts || pts.length < 3 || pathLength(pts) < 6) { render(); return; } // napautus
      const rem = remaining();
      const candidates = stage === 'wide' || stage === 'thin' ? [rem[0]] : rem;
      let best = null;
      for (const idx of candidates) {
        const m = matchStroke(pts, strokes[idx], tol);
        if (m.ok && (!best || m.meanDev < best.m.meanDev)) best = { idx, m };
      }
      if (best) {
        accepted.push({ pts: resample(pts, 64), idx: best.idx });
        audio.sfx('pop');
        render();
        if (remaining().length === 0) await complete();
        return;
      }
      const expected = candidates[0];
      totalFails++;
      failCount.set(expected, (failCount.get(expected) || 0) + 1);
      failing = { pts, t0: performance.now() };
      kick();
      audio.sfx('wrong');
      if (stage === 'free' && failCount.get(expected) >= 2) hintStrokes.add(expected);
      if (stage === 'memory' && totalFails >= 2) { modelBox.classList.remove('hidden'); drawModel(modelCanvas, letter); }
      if (stage === 'wide' || stage === 'thin') {
        await sleep(450);
        if (ctx.alive) await showDemo(expected);
      }
      render();
    }

    async function complete() {
      finished = true;
      progress.recordDraw(letter, STAGE_LEVEL[stage]);
      audio.sfx('correct');
      flash(canvas, 'glow', 900);
      await sleep(400);
      if (!ctx.alive) return;
      await audio.say('ph:' + letter);
      if (totalFails === 0) await praise();
      await sleep(400);
      resolve({ wrongs: totalFails });
    }

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    (async () => {
      await sleep(50);
      resize();
      if (stage === 'watch') {
        if (env.first) await audio.say('in:draw_watch');
        if (ctx.alive) watch();
      } else if (stage === 'wide') {
        await audio.say('in:draw_trace');
      } else if (stage === 'free') {
        await audio.say('in:draw_free');
      } else if (stage === 'memory') {
        await audio.say('in:draw_memory');
        if (ctx.alive) await audio.say('ph:' + letter);
      }
    })();
  });
}

// Pieni mallikuva vetojärjestyksineen.
function drawModel(canvas, letter) {
  const r = canvas.getBoundingClientRect();
  if (!r.width) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pad = r.width * 0.12;
  const sc = (r.width - 2 * pad) / 100;
  const px = ([x, y]) => [pad + x * sc, pad + y * sc];
  STROKES[letter].forEach((s, i) => {
    g.lineWidth = sc * 6;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#23395b';
    g.beginPath();
    s.forEach((p, k) => { const [x, y] = px(p); k ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
    const [x, y] = px(s[0]);
    g.fillStyle = '#2bb673';
    g.beginPath();
    g.arc(x, y, sc * 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = `700 ${sc * 9}px ui-rounded, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(i + 1), x, y + sc * 0.5);
  });
}
