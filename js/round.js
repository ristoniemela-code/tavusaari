// Kierros: 4–6 tehtävää peräkkäin, edistymispisteet ylhäällä, lopuksi palkinto.

import { go, h, iconButton, screens, root, sleep } from './app.js';
import * as progress from './progress.js';

export async function runRound(ctx, mode, opts = {}) {
  const dots = h('div', { class: 'dots' });
  const extra = h('div', { class: 'topbar-extra' });
  const stage = h('div', { class: 'stage' });
  root.append(
    h('div', { class: 'screen round mode-' + mode.id },
      h('div', { class: 'topbar' }, iconButton('🏠', 'Kotiin', () => go(screens.home)), dots, extra),
      stage),
  );

  const env = { ctx, mode, stage, extra, opts, letters: progress.unlockedLetters(), recent: [], first: true, total: mode.tasks || 6 };
  if (mode.setup) await mode.setup(env);
  if (!ctx.alive) return;

  const dotEls = Array.from({ length: env.total }, () => h('span', { class: 'dot' }));
  dots.replaceChildren(...dotEls);

  for (let i = 0; i < env.total; i++) {
    if (!ctx.alive) return;
    dotEls[i].classList.add('now');
    stage.replaceChildren();
    const res = await mode.task(env, i);
    if (!ctx.alive) return;
    dotEls[i].classList.remove('now');
    dotEls[i].classList.add(res && res.wrongs === 0 ? 'star' : 'done');
    env.first = false;
    await sleep(350);
  }
  if (ctx.alive) go(screens.reward, mode, opts);
}
