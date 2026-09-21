export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function birthDateFromParts(day: string, month: string, year: string) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
  if (y < 1920 || y > new Date().getFullYear()) return null;
  if (m < 1 || m > 12) return null;
  const dim = new Date(y, m, 0).getDate();
  if (d < 1 || d > dim) return null;
  const born = new Date(y, m - 1, d);
  if (Number.isNaN(born.getTime()) || born > new Date()) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function ageFromBirthDate(iso?: string | null) {
  const raw = String(iso || '').trim();
  const hit = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!hit) return null;
  const y = Number(hit[1]);
  const m = Number(hit[2]);
  const d = Number(hit[3]);
  const fromParts = birthDateFromParts(String(d), String(m), String(y));
  if (!fromParts) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

export function partsFromBirthDate(iso?: string | null) {
  const hit = String(iso || '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!hit) return { day: '', month: '', year: '' };
  return { year: hit[1], month: hit[2], day: hit[3] };
}
