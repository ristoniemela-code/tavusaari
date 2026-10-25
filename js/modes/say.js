// Sano oikein: ruudulla on tavu tai sana, eläimet sanovat kukin yhden vaihtoehdon.
// Lapsi napauttaa eläintä, joka sanoi ruudun tavun oikein.
// Lopuksi (jos mikrofoni on sallittu) lapsi sanoo tavun itse ja kuulee itsensä mallin rinnalla.

import { h, disp, sleep, praise, flash } from '../app.js';
import * as audio from '../audio.js';
import * as progress from '../progress.js';
import { itemPool, makeOptions, shuffle } from '../content.js';

const CHARACTERS = ['🐸', '🦊', '🐻', '🐰', '🐼', '🐨'];

export const sayMode = {
  id: 'say',
  icon: '🗣️',
  title: 'Sano oikein',
  instr: 'in:mode_say',
  tasks: 6,

  task(env) {
    const { ctx, stage } = env;
    const pool = itemPool(env.letters);
    const target = progress.pickTarget(pool, 'say', env.recent);
    env.recent.push(target.text);
    const score = progress.itemScore(target.text, 'say');

    // Jos kohteelle on äänitys, suositaan vaihtoehtoja, joille myös on äänitys.
    // Jos kaikille ei löydy, kaikki sanotaan puhesynteesillä, jottei oikea erotu äänestä.
    const targetRec = audio.hasRecording('it:' + target.text);
    const options = makeOptions(target.text, pool.map((p) => p.text), env.letters, score, progress.optionCount(score, 3, 4),
      { prefer: targetRec ? (t) => audio.hasRecording('it:' + t) : null });
    const sayOpts = { tts: !options.every((t) => audio.hasRecording('it:' + t)) };
    const sayOption = (t) => audio.say('it:' + t, sayOpts);

    const chars = shuffle(CHARACTERS).slice(0, options.length);
    let wrongs = 0;
    let ready = false; // valinta sallitaan, kun kaikki on kuultu kerran
    const heard = new Set();
    let busy = false;
    let playToken = 0;

    return new Promise((resolve) => {
      const card = h('div', { class: 'say-card' + (target.type === 'W' ? ' word' : '') }, disp(target.text));
      const replay = h('button', { class: 'icon-btn', 'aria-label': 'Kuuntele kaikki uudestaan', onclick: () => playAll() }, '🔁');
      const cols = options.map((text, i) => {
        const body = h('button', { class: 'critter', 'aria-label': 'Valitse', onclick: () => choose(i) }, chars[i]);
        const spk = h('button', { class: 'critter-spk', 'aria-label': 'Kuuntele', onclick: () => listenOne(i) }, '🔊');
        return { text, body, col: h('div', { class: 'critter-col' }, body, spk) };
      });
      const row = h('div', { class: 'critters' }, ...cols.map((c) => c.col));
      const panel = h('div', { class: 'say' }, h('div', { class: 'say-top' }, card, replay), row);
      stage.append(panel);

      async function talk(i) {
        const c = cols[i];
        c.body.classList.add('talk');
        const finished = await sayOption(c.text);
        c.body.classList.remove('talk');
        if (finished) heard.add(i);
        if (!ready && cols.every((x, j) => heard.has(j) || x.col.classList.contains('gone'))) {
          ready = true;
          row.classList.add('ready');
        }
      }

      async function playAll() {
        const my = ++playToken;
        audio.stop();
        cols.forEach((c) => c.body.classList.remove('talk'));
        await sleep(150);
        for (let i = 0; i < cols.length; i++) {
          if (my !== playToken || !ctx.alive) return;
          if (cols[i].col.classList.contains('gone')) continue;
          await talk(i);
          await sleep(450);
        }
      }

      async function listenOne(i) {
        if (busy || cols[i].col.classList.contains('gone')) return;
        ++playToken;
        audio.stop();
        cols.forEach((c) => c.body.classList.remove('talk'));
        await sleep(50);
        await talk(i);
      }

      async function choose(i) {
        if (!ready || busy || cols[i].col.classList.contains('gone')) {
          if (!ready) listenOne(i);
          return;
        }
        busy = true;
        ++playToken;
        audio.stop();
        const c = cols[i];
        if (c.text === target.text) {
          c.body.classList.add('dance');
          card.classList.add('good');
          audio.sfx('correct');
          progress.recordResult(target.text, 'say', wrongs);
          await sleep(400);
          if (!ctx.alive) return;
          await sayOption(target.text);
          if (wrongs === 0) await praise();
          if (!ctx.alive) return;
          if (progress.state.settings.mic && audio.canRecord()) await sayYourself(env, panel, target.text, sayOpts);
          await sleep(300);
          resolve({ wrongs });
          return;
        }
        wrongs++;
        progress.recordConfusion(target.text, c.text);
        audio.sfx('wrong');
        flash(c.body, 'shake');
        await sleep(300);
        await talk(i); // "minä sanoin tämän"
        if (!ctx.alive) return;
        if (wrongs >= 2) c.col.classList.add('gone');
        if (wrongs >= 3) cols.find((x) => x.text === target.text).body.classList.add('hint');
        busy = false;
      }

      (async () => {
        if (env.first) await audio.say('in:say_intro');
        if (!ctx.alive) return;
        flash(card, 'pulse', 800);
        await sleep(500);
        playAll();
      })();
    });
  },
};

// "Sano sinä!": nauhoittaa lapsen äänen ja soittaa sen mallin kanssa. Ei arvostelua.
function sayYourself(env, panel, text, sayOpts) {
  const { ctx } = env;
  return new Promise((resolve) => {
    const ring = h('div', { class: 'mic-ring' });
    const mic = h('button', { class: 'mic-btn', 'aria-label': 'Äänitä', onclick: () => record() }, ring, '🎤');
    const actions = h('div', { class: 'mic-actions' });
    const overlay = h('div', { class: 'mic-overlay' },
      h('div', { class: 'say-card small' }, disp(text)),
      mic,
      actions,
      h('button', { class: 'skip-btn', 'aria-label': 'Ohita', onclick: () => done() }, '⏭'));
    panel.append(overlay);
    let recording = false;

    function done() {
      overlay.remove();
      resolve();
    }

    async function record() {
      if (recording) return;
      recording = true;
      actions.replaceChildren();
      mic.classList.add('rec');
      try {
        const r = await audio.startRecording({
          maxMs: 2500,
          onLevel: (lv) => ring.style.setProperty('--lv', Math.min(1, lv * 3).toFixed(2)),
        });
        const { data } = await r.done;
        mic.classList.remove('rec');
        if (!ctx.alive) return;
        await audio.playData(data); // lapsen oma ääni
        await sleep(400);
        await audio.say('it:' + text, sayOpts); // malli
        actions.replaceChildren(
          h('button', { class: 'big-btn ghost', 'aria-label': 'Uudestaan', onclick: () => record() }, '🔁'),
          h('button', { class: 'big-btn', 'aria-label': 'Valmis', onclick: () => done() }, '👍'));
      } catch {
        mic.classList.remove('rec');
        done(); // ei mikrofonilupaa: jatketaan ilman
      }
      recording = false;
    }

    (async () => {
      await audio.say('in:say_you');
      if (ctx.alive) flash(mic, 'pulse', 800);
    })();
  });
}
