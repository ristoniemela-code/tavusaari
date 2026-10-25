// Kuuntele ja löydä: peli sanoo äänteen/tavun, lapsi napauttaa oikean pallon.

import { h, disp, sleep, praise, flash } from '../app.js';
import * as audio from '../audio.js';
import * as progress from '../progress.js';
import { itemPool, makeOptions } from '../content.js';

export const listenMode = {
  id: 'listen',
  icon: '👂',
  title: 'Kuuntele ja löydä',
  instr: 'in:mode_listen',
  tasks: 6,

  task(env) {
    const { ctx, stage } = env;
    const pool = itemPool(env.letters);
    const target = progress.pickTarget(pool, 'listen', env.recent);
    env.recent.push(target.text);
    const score = progress.itemScore(target.text, 'listen');
    const options = makeOptions(target.text, pool.map((p) => p.text), env.letters, score, progress.optionCount(score));
    const playTarget = () => audio.say('it:' + target.text);

    let wrongs = 0;
    let busy = false;

    return new Promise((resolve) => {
      const ear = h('button', { class: 'ear-btn', 'aria-label': 'Kuuntele uudestaan', onclick: () => { audio.stop(); flash(ear, 'wiggle'); playTarget(); } }, '🔊');
      const balloons = options.map((text, i) => {
        const b = h('button', { class: 'balloon b' + (i % 4), style: { animationDelay: (i * -0.7) + 's' }, onclick: () => choose(b, text) },
          h('span', { class: 'balloon-text' }, disp(text)));
        return b;
      });
      stage.append(h('div', { class: 'listen' }, ear, h('div', { class: 'balloons' }, ...balloons)));

      async function choose(b, text) {
        if (busy || b.classList.contains('gone')) return;
        busy = true;
        audio.stop();
        if (text === target.text) {
          b.classList.add('pop');
          audio.sfx('pop');
          setTimeout(() => audio.sfx('correct'), 120);
          progress.recordResult(target.text, 'listen', wrongs);
          await sleep(350);
          if (!ctx.alive) return;
          await audio.say('it:' + target.text);
          if (wrongs === 0 && Math.random() < 0.5) await praise();
          await sleep(300);
          resolve({ wrongs });
          return;
        }
        wrongs++;
        progress.recordConfusion(target.text, text);
        audio.sfx('wrong');
        flash(b, 'shake');
        await audio.say('it:' + text); // lapsi kuulee, mitä valitsi
        await sleep(350);
        if (!ctx.alive) return;
        if (wrongs >= 2) b.classList.add('gone');
        if (wrongs >= 3) balloons.find((x, i) => options[i] === target.text)?.classList.add('hint');
        flash(ear, 'wiggle');
        await playTarget();
        busy = false;
      }

      (async () => {
        if (env.first) await audio.say('in:listen_intro');
        if (!ctx.alive) return;
        await sleep(200);
        flash(ear, 'wiggle');
        playTarget();
      })();
    });
  },
};
