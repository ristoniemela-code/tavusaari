// Isojen kirjainten vedot. Koordinaatit 0–100: yläviiva y=10, keskiviiva y=50, perusviiva y=90.
// Jokainen veto on pistelista piirtosuunnassa; vetojärjestys on listan järjestys.
// HUOM: tarkista vetojärjestykset Opetushallituksen kirjainmalleista ennen julkaisua.

const STEPS = 40;

function line(x1, y1, x2, y2) {
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS;
    return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
  });
}

// Kaari asteina; y kasvaa alaspäin, joten kulma 90° on alhaalla.
function arc(cx, cy, rx, ry, a0, a1) {
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const a = ((a0 + (a1 - a0) * (i / STEPS)) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

function bezier(p0, p1, p2, p3) {
  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const t = i / STEPS, u = 1 - t;
    return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
  });
}

const join = (...parts) => parts.reduce((acc, p) => acc.concat(acc.length ? p.slice(1) : p), []);

export const STROKES = {
  a: [line(50, 10, 16, 90), line(50, 10, 84, 90), line(29, 60, 71, 60)],
  i: [line(50, 10, 50, 90)],
  u: [join(line(22, 10, 22, 62), arc(50, 62, 28, 28, 180, 0), line(78, 62, 78, 10))],
  o: [arc(50, 50, 34, 40, -90, -450)],
  e: [line(28, 10, 28, 90), line(28, 10, 74, 10), line(28, 50, 66, 50), line(28, 90, 74, 90)],
  s: [join(bezier([74, 22], [68, 6], [28, 6], [27, 28]), bezier([27, 28], [26, 46], [74, 46], [74, 68]), bezier([74, 68], [74, 94], [28, 96], [24, 76]))],
  l: [join(line(30, 10, 30, 90), line(30, 90, 74, 90))],
  m: [line(16, 10, 16, 90), join(line(16, 10, 50, 62), line(50, 62, 84, 10), line(84, 10, 84, 90))],
};

// --- Geometria ---

export function pathLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

export function resample(pts, n) {
  if (pts.length < 2) return Array(n).fill(pts[0] || [0, 0]);
  const total = pathLength(pts);
  const step = total / (n - 1);
  const out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length && out.length < n; i++) {
    let [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    let d = Math.hypot(x - px, y - py);
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d;
      const q = [px + (x - px) * t, py + (y - py) * t];
      out.push(q);
      d -= step - acc;
      [px, py] = q;
      acc = 0;
    }
    acc += d;
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
}

const minDist = (p, pts) => pts.reduce((m, q) => Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])), Infinity);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Vertaa käyttäjän vetoa mallivetoon. tol = sallittu poikkeama (yksiköissä).
export function matchStroke(user, ref, tol) {
  const N = 48;
  const u = resample(user, N);
  const r = resample(ref, N);
  const meanDev = u.reduce((s, p) => s + minDist(p, r), 0) / N;
  const coverage = r.filter((p) => minDist(p, u) < tol).length / N;
  const startOk = dist(u[0], r[0]) < tol * 1.6;
  const endOk = dist(u[N - 1], r[N - 1]) < tol * 1.6;
  // Suunta: vedon neljännekset osuvat mallin neljänneksiin.
  const dirOk = [0.25, 0.5, 0.75].filter((k) => dist(u[Math.round(k * (N - 1))], r[Math.round(k * (N - 1))]) < tol * 2.2).length >= 2;
  return { ok: meanDev < tol && coverage >= 0.8 && startOk && endOk && dirOk, meanDev, coverage, startOk, endOk, dirOk };
}
