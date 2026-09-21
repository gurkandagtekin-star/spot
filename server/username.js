const crypto = require('crypto');

function normalizeUsername(raw) {
  const h = String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (!h) return '';
  if (!/^[a-z0-9._]{2,30}$/.test(h)) return null;
  return h;
}

function slugBase(source) {
  const email = String(source.email || '');
  const prefix = email.split('@')[0] || '';
  const name = String(source.name || source.firstName || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  let s = (prefix || name || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 20);
  if (!s) s = 'user';
  if (!/^[a-z]/.test(s)) s = `u_${s}`.slice(0, 20);
  return s;
}

function usernameTaken(db, username, exceptId) {
  const key = String(username || '').toLowerCase();
  if (!key) return false;
  return (db.users || []).some(
    (u) => u.id !== exceptId && String(u.username || '').toLowerCase() === key,
  );
}

function uniqueUsername(db, base, exceptId) {
  const root = slugBase({ name: base, email: base.includes('@') ? base : '' });
  let candidate = root;
  if (!usernameTaken(db, candidate, exceptId)) return candidate;
  for (let i = 0; i < 40; i += 1) {
    const n = 100 + crypto.randomInt(900);
    const suffix = `_${n}`;
    candidate = `${root.slice(0, Math.max(2, 30 - suffix.length))}${suffix}`;
    if (!usernameTaken(db, candidate, exceptId)) return candidate;
  }
  return `user_${crypto.randomBytes(4).toString('hex')}`;
}

function assignUsername(db, user, hint) {
  if (user.username && !usernameTaken(db, user.username, user.id)) {
    user.username = String(user.username).toLowerCase();
    return user.username;
  }
  const fromHint = normalizeUsername(hint || user.instagram || '');
  user.username = uniqueUsername(
    db,
    fromHint || slugBase(user),
    user.id,
  );
  return user.username;
}

function migrateUsers(db) {
  db.users = db.users || [];
  for (const user of db.users) {
    assignUsername(db, user, user.username || user.instagram);
    delete user.instagram;
    delete user.instagramId;
    delete user.instagramVerified;
  }
  db.igTickets = {};
  return db;
}

module.exports = {
  normalizeUsername,
  slugBase,
  usernameTaken,
  uniqueUsername,
  assignUsername,
  migrateUsers,
};
