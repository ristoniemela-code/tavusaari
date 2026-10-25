// Tavupaja: lapsi kuulee tavun, rakentaa sen kirjainvaunuista ja ajaa junan.
// Juna "lausuu" vaunut venyttäen ja yhdistää ne: "ssss… aaaa… sa!"

import { h, disp, sleep, praise, flash } from '../app.js';
import * as audio from '../audio.js';
import * as progress from '../progress.js';
import { itemPool, isVowel } from '../content.js';

const SLOTS = 3;

// Veturi piirrettynä (emoji osoittaa eri laitteilla eri suuntiin). Keula vasemmalla.
const ENGINE_SVG = `<svg viewBox="0 0 120 100" aria-hidden="true">
  <rect x="14" y="8" width="22" height="8" rx="3" fill="#37474f"/>
  <rect x="18" y="14" width="14" height="22" fill="#455a64"/>
  <rect x="8" y="34" width="66" height="34" rx="10" fill="#ff7a59"/>
  <rect x="30" y="34" width="5" height="34" fill="#e4572e"/>
  <rect x="52" y="34" width="5" height="34" fill="#e4572e"/>
  <rect x="66" y="8" width="50" height="10" rx="4" fill="#37474f"/>
  <rect x="70" y="16" width="42" height="52" rx="6" fill="#e4572e"/>
  <rect x="80" y="24" width="22" height="18" rx="4" fill="#bfe8ff"/>
  <polygon points="8,66 0,86 22,86 22,66" fill="#37474f"/>
  <circle cx="34" cy="80" r="12" fill="#37474f"/><circle cx="34" cy="80" r="5" fill="#90a4ae"/>
  <circle cx="64" cy="80" r="12" fill="#37474f"/><circle cx="64" cy="80" r="5" fill="#90a4ae"/>
  <circle cx="98" cy="82" r="10" fill="#37474f"/><circle cx="98" cy="82" r="4" fill="#90a4ae"/>
</svg>`;

export const blendMode = {
  id: 'blend',
  icon: '🚂',
  title: 'Tavupaja',
  instr: 'in:mode_blend',
  tasks: 6,

  async task(env, index) {
    if (index === 0 && !progress.state.flags.blendFree) {
      await buildTrain(env, null);
      progress.state.flags.blendFree = true;
      progress.save();
      if (!env.ctx.alive) return;
      env.stage.replaceChildren();
      env.first = false;
    }
    const pool = itemPool(env.letters).filter((it) => it.type !== 'W' && it.text.length >= 2 && it.text.length <= SLOTS);
    const target = progress.pickTarget(pool, 'blend', env.recent);
    env.recent.push(target.text);
    return buildTrain(env, target);
  },
};

// target = null → vapaa kokeilu
function buildTrain(env, target) {
  const { ctx, stage } = env;
  const wagons = Array(SLOTS).fill(null);
  let wrongs = 0;
  let busy = false;

  return new Promise((resolve) => {
    const ear = h('button', { class: 'ear-btn small', 'aria-label': 'Kuuntele', onclick: () => { audio.stop(); playTarget(); } }, '🔊');
    const slotEls = wagons.map((_, i) => h('button', { class: 'wagon empty', onclick: () => removeAt(i) }));
    const engine = h('button', { class: 'engine', 'aria-label': 'Aja', onclick: () => drive() });
    engine.innerHTML = ENGINE_SVG;
    const track = h('div', { class: 'track' }, engine, ...slotEls);
    const result = h('div', { class: 'blend-result' });
    const letters = [...env.letters].sort((a, b) => Number(isVowel(a)) - Number(isVowel(b)));
    const tiles = letters.map((ch) =>
      h('div', { class: 'tile ' + (isVowel(ch) ? 'vowel' : 'cons'), 'data-ch': ch }, disp(ch)));
    const palette = h('div', { class: 'palette' }, ...tiles);
    const header = target
      ? h('div', { class: 'blend-head' }, ear)
      : h('div', { class: 'blend-head' }, h('button', { class: 'big-btn', onclick: () => finish() }, 'Valmis ▶'));
    stage.append(h('div', { class: 'blend' }, header, result, h('div', { class: 'rail' }, track), palette));

    const playTarget = () => audio.sequence(['in:blend_task', 'it:' + target.text], 150);

    function render() {
      slotEls.forEach((el, i) => {
        const ch = wagons[i];
        el.className = 'wagon ' + (ch ? (isVowel(ch) ? 'vowel' : 'cons') : 'empty');
        el.textContent = ch ? disp(ch) : '';
        if (!ch && target && wrongs >= 2 && target.text[i]) {
          el.append(h('span', { class: 'ghost' }, disp(target.text[i])));
        }
      });
      engine.classList.toggle('ready', wagons.some(Boolean));
    }

    function addLetter(ch) {
      if (busy) return;
      const i = wagons.indexOf(null);
      if (i < 0) { flash(track, 'shake'); return; }
      wagons[i] = ch;
      audio.sfx('tick');
      render();
      flash(slotEls[i], 'drop', 400);
    }

    function removeAt(i) {
      if (busy || !wagons[i]) return;
      audio.stop();
      audio.say('ph:' + wagons[i]);
      wagons.splice(i, 1);
      wagons.push(null);
      render();
    }

    async function drive() {
      const built = wagons.filter(Boolean).join('');
      if (busy || !built) return;
      busy = true;
      audio.stop();
      audio.sfx('choo');
      track.classList.add('moving');
      await sleep(500);
      // Venytetyt äänteet peräkkäin, sitten koko tavu.
      for (let i = 0; i < SLOTS; i++) {
        if (!wagons[i] || !ctx.alive) continue;
        slotEls[i].classList.add('lit');
        await audio.say('st:' + wagons[i]);
        slotEls[i].classList.remove('lit');
      }
      track.classList.remove('moving');
      if (!ctx.alive) return;
      result.textContent = disp(built);
      flash(result, 'pulse', 800);
      await audio.say('it:' + built);
      if (!ctx.alive) return;

      if (!target) { busy = false; return; }
      if (built === target.text) {
        audio.sfx('correct');
        result.classList.add('good');
        progress.recordResult(target.text, 'blend', wrongs);
        if (wrongs === 0) await praise();
        await sleep(500);
        resolve({ wrongs });
        return;
      }
      wrongs++;
      progress.recordConfusion(target.text, built);
      audio.sfx('wrong');
      await sleep(400);
      await audio.say('in:try_again');
      await playTarget();
      if (wrongs >= 2) { wagons.fill(null); }
      result.textContent = '';
      render();
      busy = false;
    }

    function finish() {
      audio.stop();
      resolve(null);
    }

    // Raahaus (ja napautus) kirjainlaatoista junaan.
    palette.addEventListener('pointerdown', (e) => {
      const tile = e.target.closest('.tile');
      if (!tile || busy) return;
      e.preventDefault();
      const ch = tile.dataset.ch;
      audio.stop();
      audio.say('ph:' + ch);
      const start = { x: e.clientX, y: e.clientY };
      const ghost = h('div', { class: tile.className + ' dragging' }, tile.textContent);
      let moved = false;
      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 12) {
          moved = true;
          document.body.append(ghost);
        }
        if (moved) {
          ghost.style.left = ev.clientX + 'px';
          ghost.style.top = ev.clientY + 'px';
        }
      };
      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        ghost.remove();
        if (!moved) return addLetter(ch);
        const r = track.getBoundingClientRect();
        const pad = 60;
        if (ev.clientX > r.left - pad && ev.clientX < r.right + pad && ev.clientY > r.top - pad && ev.clientY < r.bottom + pad) addLetter(ch);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });

    render();
    (async () => {
      if (!target) {
        await audio.say('in:blend_free');
        return;
      }
      await sleep(200);
      if (ctx.alive) playTarget();
    })();
  });
}
