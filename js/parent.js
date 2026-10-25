// Aikuisten osio: portti, edistyminen, asetukset ja äänitystyökalu.

import { go, h, iconButton, root, screens, disp } from './app.js';
import * as audio from './audio.js';
import * as progress from './progress.js';
import { LETTERS, keyLabel, recordableGroups } from './content.js';

// Portti: kertolasku, jota pieni lapsi ei yleensä osaa.
export function parentGate() {
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  let input = '';
  const display = h('div', { class: 'gate-input' }, '');
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, 'OK'].map((k) =>
    h('button', { class: 'key', onclick: () => press(k) }, String(k)));
  function press(k) {
    if (k === '⌫') input = input.slice(0, -1);
    else if (k === 'OK') {
      if (Number(input) === a * b) return go(screens.parent, 'progress');
      input = '';
      display.classList.add('shake');
      setTimeout(() => display.classList.remove('shake'), 500);
    } else if (input.length < 3) input += k;
    display.textContent = input;
  }
  root.append(h('div', { class: 'screen gate' },
    h('div', { class: 'topbar' }, iconButton('🏠', 'Kotiin', () => go(screens.home))),
    h('div', { class: 'gate-box' },
      h('p', {}, 'Aikuisille'),
      h('p', { class: 'gate-q' }, `${a} × ${b} = ?`),
      display,
      h('div', { class: 'keypad' }, ...keys))));
}

export function parentScreen(ctx, tab = 'progress') {
  const tabs = [
    ['progress', 'Edistyminen'],
    ['settings', 'Asetukset'],
    ['record', 'Äänitykset'],
  ];
  const body = h('div', { class: 'parent-body' });
  root.append(h('div', { class: 'screen parent' },
    h('div', { class: 'topbar' },
      iconButton('🏠', 'Kotiin', () => go(screens.home)),
      h('div', { class: 'tabs' }, ...tabs.map(([id, label]) =>
        h('button', { class: 'tab' + (id === tab ? ' on' : ''), onclick: () => go(screens.parent, id) }, label)))),
    body));
  if (tab === 'progress') progressTab(body);
  if (tab === 'settings') settingsTab(body);
  if (tab === 'record') recordTab(body, ctx);
}

function progressTab(body) {
  const unlocked = progress.unlockedCount();
  const rows = LETTERS.map((l, i) => h('tr', { class: i < unlocked ? '' : 'muted' },
    h('td', {}, l.hero, ' ', h('b', {}, l.ch.toUpperCase())),
    h('td', {}, i < unlocked ? 'auki' : 'lukossa'),
    h('td', {}, h('div', { class: 'bar' }, h('span', { style: { width: Math.min(100, (progress.xp(l.ch) / progress.XP_TARGET) * 100) + '%' } })), ` ${progress.xp(l.ch)} / ${progress.XP_TARGET}`),
    h('td', {}, ['–', 'jäljitys', 'ohut jäljitys', 'itse', 'muistista'][progress.drawLevel(l.ch)]),
    h('td', {}, progress.letterDone(l.ch) ? '⭐' : '')));

  const skillName = { listen: 'Kuuntele', say: 'Sano oikein', blend: 'Tavupaja' };
  const conf = progress.topConfusions();
  const weak = progress.weakestItems();

  body.append(
    h('section', { class: 'card' },
      h('h3', {}, 'Kirjaimet'),
      h('p', { class: 'muted' }, `Seuraava kirjain avautuu, kun uusimmissa kirjaimissa on ${progress.XP_TARGET} oikeaa ensiyritystä ja kirjain on piirretty itse mallin vierestä. Kierroksia pelattu: ${progress.state.rounds}.`),
      h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Kirjain'), h('th', {}, 'Tila'), h('th', {}, 'Lukeminen'), h('th', {}, 'Piirtäminen'), h('th', {}, ''))),
        h('tbody', {}, ...rows))),
    h('section', { class: 'card' },
      h('h3', {}, 'Sekoittuvat parit'),
      conf.length
        ? h('ul', { class: 'list' }, ...conf.map((c) => h('li', {}, h('b', {}, disp(c.target)), ' → valitsi ', h('b', {}, disp(c.chosen)), ` (${c.n}×)`)))
        : h('p', { class: 'muted' }, 'Ei vielä virheitä.')),
    h('section', { class: 'card' },
      h('h3', {}, 'Vaikeimmat'),
      weak.length
        ? h('ul', { class: 'list' }, ...weak.map((w) => h('li', {}, h('b', {}, disp(w.text)), ` – ${skillName[w.skill] || w.skill}: ${w.s}/100 (${w.n} yritystä)`)))
        : h('p', { class: 'muted' }, 'Tiedot kertyvät pelatessa.')));
}

function settingsTab(body) {
  const s = progress.state.settings;
  const apply = () => { progress.save(); audio.configure(s); };

  const toggle = (label, hint, key, onLabel, offLabel) => {
    const btn = h('button', { class: 'toggle' + (s[key] ? ' on' : ''), onclick: () => { s[key] = !s[key]; apply(); go(screens.parent, 'settings'); } }, s[key] ? onLabel : offLabel);
    return h('div', { class: 'setting' }, h('div', {}, h('b', {}, label), hint ? h('p', { class: 'muted' }, hint) : null), btn);
  };

  const caseBtn = h('button', {
    class: 'toggle on',
    onclick: () => { s.letterCase = s.letterCase === 'upper' ? 'lower' : 'upper'; apply(); go(screens.parent, 'settings'); },
  }, s.letterCase === 'upper' ? 'ISOT' : 'pienet');

  const voices = audio.finnishVoices();
  const voiceSel = h('select', { onchange: (e) => { s.voiceURI = e.target.value; apply(); } },
    h('option', { value: '' }, 'Automaattinen'),
    ...voices.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === s.voiceURI }, v.name)));
  const rate = h('input', { type: 'range', min: '0.6', max: '1.1', step: '0.05', value: String(s.rate), oninput: (e) => { s.rate = Number(e.target.value); apply(); } });

  body.append(
    h('section', { class: 'card' },
      h('div', { class: 'setting' }, h('div', {}, h('b', {}, 'Kirjainkoko'), h('p', { class: 'muted' }, 'Lukutehtävien kirjaimet. Piirtäminen harjoittelee isoja kirjaimia.')), caseBtn),
      toggle('Sano sinä -mikrofoni', 'Sano oikein -moodissa lapsi voi sanoa tavun ääneen ja kuulla itsensä. Vaatii HTTPS-osoitteen ja mikrofoniluvan.', 'mic', 'Päällä', 'Pois'),
      toggle('Avaa kaikki kirjaimet', 'Testaukseen tai jos lapsi osaa jo kirjaimet.', 'unlockAll', 'Päällä', 'Pois')),
    h('section', { class: 'card' },
      h('h3', {}, 'Puhesynteesi'),
      h('p', { class: 'muted' }, voices.length
        ? 'Käytetään äänille, joita ei ole äänitetty. Yksittäiset äänteet kannattaa äänittää itse.'
        : 'Laitteesta ei löytynyt suomenkielistä puheääntä. Asenna se (iPad: Asetukset → Käyttöapu → Puhuttu sisältö → Äänet → Suomi) tai äänitä äänet itse.'),
      h('div', { class: 'setting' }, h('b', {}, 'Ääni'), voiceSel),
      h('div', { class: 'setting' }, h('b', {}, 'Nopeus'), rate),
      h('button', { class: 'btn', onclick: () => audio.sequence(['it:sa', 'it:lumi', 'in:praise1']) }, '▶ Testaa')),
    h('section', { class: 'card' },
      h('h3', {}, 'Nollaa'),
      h('button', { class: 'btn danger', onclick: () => { if (confirm('Nollataanko kaikki edistyminen ja tarrat? Äänitykset säilyvät.')) { progress.reset(); go(screens.parent, 'settings'); } } }, 'Nollaa edistyminen')));
}

function recordTab(body, ctx) {
  const groups = recordableGroups();
  const allKeys = groups.flatMap((g) => g.keys);
  const counter = h('span', {});
  const updateCounter = () => { counter.textContent = `${allKeys.filter((k) => audio.hasRecording(k)).length} / ${allKeys.length} äänitetty`; };
  let active = null; // { key, rec, row }

  const canRec = audio.canRecord();
  body.append(h('section', { class: 'card' },
    h('h3', {}, 'Äänitä pelin äänet ', counter),
    h('p', { class: 'muted' }, 'Ihmisen ääni on lapselle paras malli. Äänitä hiljaisessa paikassa, noin 20 cm päästä. Napauta ⏺, sano ääni ja napauta ⏹ (pysähtyy itsestään 4 sekunnin jälkeen). Hiljaisuus leikataan automaattisesti. Puuttuvat äänet sanotaan puhesynteesillä.'),
    canRec ? null : h('p', { class: 'warn' }, 'Äänitys ei ole käytettävissä tässä osoitteessa. Mikrofoni vaatii HTTPS-yhteyden (tai localhostin).')));

  function row(key) {
    const status = h('span', { class: 'rec-status' });
    const recBtn = h('button', { class: 'rbtn rec', disabled: !canRec, onclick: () => toggleRec() }, '⏺');
    const delBtn = h('button', { class: 'rbtn', onclick: async () => { await audio.deleteRecording(key); refresh(); } }, '🗑');
    const playBtn = h('button', { class: 'rbtn', onclick: () => { audio.stop(); audio.say(key); } }, '▶');
    const el = h('div', { class: 'rec-row' }, status, h('span', { class: 'rec-label' }, keyLabel(key)), playBtn, recBtn, delBtn);

    function refresh() {
      const has = audio.hasRecording(key);
      status.textContent = has ? '●' : '○';
      status.className = 'rec-status' + (has ? ' has' : '');
      delBtn.disabled = !has;
      updateCounter();
    }

    async function toggleRec() {
      if (active && active.key === key) {
        recBtn.textContent = '…';
        const cur = active;
        active = null;
        const { data, mime } = await cur.rec.stop();
        await audio.saveRecording(key, data, mime);
        recBtn.textContent = '⏺';
        el.classList.remove('recording');
        refresh();
        if (ctx.alive) audio.say(key);
        return;
      }
      if (active) return;
      try {
        el.classList.add('recording');
        recBtn.textContent = '⏹';
        const rec = await audio.startRecording({ maxMs: 4000 });
        active = { key, rec };
        rec.done.then(async (res) => {
          if (active && active.key === key) { // pysähtyi itsestään
            active = null;
            await audio.saveRecording(key, res.data, res.mime);
            recBtn.textContent = '⏺';
            el.classList.remove('recording');
            refresh();
          }
        });
      } catch {
        el.classList.remove('recording');
        recBtn.textContent = '⏺';
        alert('Mikrofonia ei saatu käyttöön. Tarkista lupa selaimen asetuksista.');
      }
    }

    refresh();
    return el;
  }

  for (const g of groups) {
    body.append(h('section', { class: 'card' },
      h('h3', {}, g.title),
      g.hint ? h('p', { class: 'muted' }, g.hint) : null,
      h('div', { class: 'rec-list' }, ...g.keys.map(row))));
  }
  updateCounter();
}
