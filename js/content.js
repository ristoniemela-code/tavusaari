// Pelin sisältö: kirjaimet, tavut, sanat ja ohjeet.
// Kaikki sisältö suodatetaan avattujen kirjainten mukaan, joten lapsi näkee
// vain sellaista, minkä hän pystyy jo lukemaan.

export const LETTERS = [
  { ch: 'a', kind: 'v', hero: '🐒', heroName: 'Apina' },
  { ch: 'i', kind: 'v', hero: '🐭', heroName: 'Hiiri' },
  { ch: 'u', kind: 'v', hero: '🦉', heroName: 'Pöllö' },
  { ch: 'o', kind: 'v', hero: '🐿️', heroName: 'Orava' },
  { ch: 'e', kind: 'v', hero: '🐌', heroName: 'Etana' },
  { ch: 's', kind: 'c', hero: '🐍', heroName: 'Käärme' },
  { ch: 'l', kind: 'c', hero: '🦁', heroName: 'Leijona' },
  { ch: 'm', kind: 'c', hero: '🐮', heroName: 'Lehmä' },
];

// Ensimmäinen saari avaa kolme vokaalia kerralla, jotta tehtäviin riittää vaihtoehtoja.
export const START_UNLOCKED = 3;

const VOWEL_SET = new Set('aeiouyäö');
export const isVowel = (ch) => VOWEL_SET.has(ch);

const DIPHTHONGS = ['ai', 'ei', 'oi', 'ui', 'au', 'eu', 'iu', 'ou', 'ie', 'uo', 'yi', 'äi', 'öi', 'ey', 'äy', 'öy', 'yö'];

// Sanat, jotka voi lukea kirjaimilla a i u o e s l m. Emoji toimii kuvana.
export const WORDS = [
  { w: 'suu', e: '👄', syl: ['suu'] },
  { w: 'maa', e: '🌍', syl: ['maa'] },
  { w: 'luu', e: '🦴', syl: ['luu'] },
  { w: 'moi', e: '👋', syl: ['moi'] },
  { w: 'mies', e: '👨', syl: ['mies'] },
  { w: 'ilo', e: '😊', syl: ['i', 'lo'] },
  { w: 'emu', e: '🐦', syl: ['e', 'mu'] },
  { w: 'lumi', e: '❄️', syl: ['lu', 'mi'] },
  { w: 'sumu', e: '🌫️', syl: ['su', 'mu'] },
  { w: 'lasi', e: '🥛', syl: ['la', 'si'] },
  { w: 'loma', e: '🏖️', syl: ['lo', 'ma'] },
  { w: 'mela', e: '🛶', syl: ['me', 'la'] },
  { w: 'aamu', e: '🌅', syl: ['aa', 'mu'] },
  { w: 'alus', e: '🚢', syl: ['a', 'lus'] },
  { w: 'ilma', e: '💨', syl: ['il', 'ma'] },
  { w: 'laulu', e: '🎵', syl: ['lau', 'lu'] },
  { w: 'laama', e: '🦙', syl: ['laa', 'ma'] },
  { w: 'sello', e: '🎻', syl: ['sel', 'lo'] },
  { w: 'solmu', e: '🪢', syl: ['sol', 'mu'] },
  { w: 'mummo', e: '👵', syl: ['mum', 'mo'] },
  { w: 'lammas', e: '🐑', syl: ['lam', 'mas'] },
  { w: 'museo', e: '🏛️', syl: ['mu', 'se', 'o'] },
  { w: 'salama', e: '⚡', syl: ['sa', 'la', 'ma'] },
];

// Tavutyypit vaikeusjärjestyksessä (ks. SUUNNITTELU.md).
export const TYPE_LEVEL = { V: 1, VV: 2, VD: 3, KV: 4, KVV: 5, W: 7 };

function buildItems() {
  const V = LETTERS.filter((l) => l.kind === 'v').map((l) => l.ch);
  const C = LETTERS.filter((l) => l.kind === 'c').map((l) => l.ch);
  const known = new Set(LETTERS.map((l) => l.ch));
  const items = [];
  const add = (text, type, extra = {}) => {
    const old = items.find((it) => it.text === text);
    if (old) return Object.assign(old, extra); // esim. "suu" on sekä tavu että sana
    items.push({ text, type, level: TYPE_LEVEL[type], letters: [...new Set(text)], ...extra });
  };

  for (const v of V) add(v, 'V');
  for (const v of V) add(v + v, 'VV');
  const diph = DIPHTHONGS.filter((d) => [...d].every((ch) => known.has(ch)));
  for (const d of diph) add(d, 'VD');
  for (const c of C) for (const v of V) add(c + v, 'KV');
  for (const c of C) {
    for (const v of V) add(c + v + v, 'KVV');
    for (const d of diph) add(c + d, 'KVV');
  }
  for (const word of WORDS) {
    if ([...word.w].every((ch) => known.has(ch))) add(word.w, 'W', { emoji: word.e, syl: word.syl });
  }
  return items;
}

export const ITEMS = buildItems();
export const ITEM_BY_TEXT = new Map(ITEMS.map((it) => [it.text, it]));

export function itemPool(letters, types = null) {
  const set = new Set(letters);
  return ITEMS.filter((it) => it.letters.every((ch) => set.has(ch)) && (!types || types.includes(it.type)));
}

// --- Äänet ---
// Avaimet: ph:<äänne>  st:<venytetty äänne>  it:<tavu tai sana>  in:<ohje>
// Jos aikuinen on äänittänyt avaimen, käytetään äänitystä, muuten puhesynteesiä.

export const INSTR = {
  mode_listen: 'Kuuntele ja löydä.',
  mode_say: 'Sano oikein.',
  mode_blend: 'Tavupaja.',
  mode_draw: 'Piirrä kirjain.',
  listen_intro: 'Kuuntele, ja etsi oikea pallo.',
  say_intro: 'Katso tavua. Kuuntele eläimiä. Kuka sanoi sen oikein?',
  say_you: 'Sano sinä!',
  say_listen: 'Kuuntele itseäsi.',
  blend_free: 'Kokeile! Laita kirjaimia junaan, ja paina veturia.',
  blend_task: 'Tee tavu',
  draw_watch: 'Katso, miten kirjain piirretään.',
  draw_trace: 'Nyt sinä! Seuraa viivaa.',
  draw_free: 'Piirrä kirjain itse.',
  draw_memory: 'Piirrä kirjain muistista.',
  try_again: 'Yritä uudestaan.',
  praise1: 'Hienoa!',
  praise2: 'Oikein!',
  praise3: 'Mahtavaa!',
  praise4: 'Hyvä sinä!',
  round_done: 'Hienosti tehty! Saat tarran.',
  new_letter: 'Uusi kirjain!',
};

export const PRAISE_KEYS = ['in:praise1', 'in:praise2', 'in:praise3', 'in:praise4'];

export function normalizeKey(key) {
  // Yksittäinen vokaali tavuna on sama ääni kuin äänne.
  if (key.startsWith('it:') && key.length === 4) return 'ph:' + key.slice(3);
  return key;
}

export function soundText(key) {
  const i = key.indexOf(':');
  const ns = key.slice(0, i);
  const val = key.slice(i + 1);
  if (ns === 'ph') return isVowel(val) ? val : val.repeat(3);
  if (ns === 'st') return val.repeat(4);
  if (ns === 'in') return INSTR[val] ?? val;
  return val;
}

// Aikuisten äänitystyökalun lista.
export function recordableGroups() {
  const letters = LETTERS.map((l) => l.ch);
  const syll = ITEMS.filter((it) => it.type !== 'V' && it.type !== 'W');
  return [
    { title: 'Äänteet', hint: 'Sano äänne, ei kirjaimen nimeä: "sss", ei "äs".', keys: letters.map((c) => 'ph:' + c) },
    { title: 'Venytetyt äänteet', hint: 'Venytä noin sekunnin ajan: "ssss", "aaaa". Käytetään Tavupajassa.', keys: letters.map((c) => 'st:' + c) },
    { title: 'Tavut', hint: 'Selkeästi ja luonnollisesti.', keys: syll.map((it) => 'it:' + it.text) },
    { title: 'Sanat', hint: '', keys: ITEMS.filter((it) => it.type === 'W').map((it) => 'it:' + it.text) },
    { title: 'Ohjeet ja kehut', hint: '', keys: Object.keys(INSTR).map((k) => 'in:' + k) },
  ];
}

export function keyLabel(key) {
  const i = key.indexOf(':');
  const ns = key.slice(0, i);
  const val = key.slice(i + 1);
  if (ns === 'ph') return val.toUpperCase();
  if (ns === 'st') return val.toUpperCase() + ' (venytetty)';
  if (ns === 'in') return INSTR[val] ?? val;
  return val;
}

// --- Harhautusvaihtoehdot ---

export function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function plausible(text) {
  if (!text) return false;
  for (let i = 0; i + 2 < text.length; i++) {
    const a = isVowel(text[i]), b = isVowel(text[i + 1]), c = isVowel(text[i + 2]);
    if (a === b && b === c) return false; // ei kolmea vokaalia tai konsonanttia peräkkäin
  }
  // Tavun alussa ei kahta konsonanttia.
  if (text.length > 1 && !isVowel(text[0]) && !isVowel(text[1])) return false;
  return true;
}

// Lähes samanlaiset muodot: yksi äänne vaihdettu, vokaali pidennetty tai lyhennetty.
export function nearVariants(text, letters) {
  const V = letters.filter(isVowel);
  const C = letters.filter((c) => !isVowel(c));
  const out = new Set();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const same = ch === text[i + 1] || ch === text[i - 1];
    for (const r of isVowel(ch) ? V : C) {
      if (r === ch) continue;
      // Pitkä äänne vaihdetaan kokonaan (aa → ii), ei puoliksi (aa → ai on oma muotonsa).
      if (same && ch === text[i + 1]) out.add(text.slice(0, i) + r + r + text.slice(i + 2));
      else if (!same) out.add(text.slice(0, i) + r + text.slice(i + 1));
    }
    if (isVowel(ch) && !same) out.add(text.slice(0, i + 1) + ch + text.slice(i + 1));
    if (ch === text[i + 1]) out.add(text.slice(0, i) + text.slice(i + 1));
  }
  out.delete(text);
  return [...out].filter(plausible);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// score 0–100: mitä paremmin lapsi osaa kohteen, sitä samankaltaisempia vaihtoehdot ovat.
export function makeOptions(target, poolTexts, letters, score, count, { prefer = null } = {}) {
  const order = (list) => (prefer ? [...list.filter(prefer), ...list.filter((t) => !prefer(t))] : list);
  const near = order(shuffle(nearVariants(target, letters)));
  // Vaihtoehdot ovat suunnilleen samanpituisia, jottei pituus paljasta oikeaa.
  const similar = poolTexts.filter((t) => t !== target && Math.abs(t.length - target.length) <= 1);
  const far = order(shuffle(similar.filter((t) => levenshtein(t, target) >= 2)));
  const mid = order(shuffle(similar.filter((t) => levenshtein(t, target) === 1)));
  const any = order(shuffle(poolTexts.filter((t) => t !== target)));
  let seq;
  if (score < 35) seq = [...far, ...mid, ...near, ...any];
  else if (score < 70) seq = [...near.slice(0, 1), ...far, ...mid, ...near, ...any];
  else seq = [...near, ...far, ...any];
  const chosen = [];
  for (const t of seq) {
    if (chosen.length >= count - 1) break;
    if (t !== target && !chosen.includes(t)) chosen.push(t);
  }
  return shuffle([target, ...chosen]);
}
