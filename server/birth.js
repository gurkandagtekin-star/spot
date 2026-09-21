function pad2(n) {
  return String(n).padStart(2, '0');
}

function parseBirthDate(raw) {
  const hit = String(raw || '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!hit) return null;
  const y = Number(hit[1]);
  const m = Number(hit[2]);
  const d = Number(hit[3]);
  if (y < 1920 || y > new Date().getFullYear()) return null;
  if (m < 1 || m > 12) return null;
  const dim = new Date(y, m, 0).getDate();
  if (d < 1 || d > dim) return null;
  const born = new Date(y, m - 1, d);
  if (Number.isNaN(born.getTime()) || born > new Date()) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function ageFromBirthDate(iso) {
  const parsed = parseBirthDate(iso);
  if (!parsed) return null;
  const [ys, ms, ds] = parsed.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) {
    age -= 1;
  }
  return age;
}

module.exports = { parseBirthDate, ageFromBirthDate };
