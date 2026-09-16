const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { mountOAuth } = require('./oauth');
const { pickWheel, distanceMeters } = require('./play');
const { createPersist, emptyDb } = require('./persist');
const { expoTokens, sendExpoPush, rememberToken, forgetToken } = require('./push');
const { mountAdmin } = require('./admin');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

if (!process.env.FACEBOOK_APP_ID && process.env.INSTAGRAM_APP_ID) {
  process.env.FACEBOOK_APP_ID = process.env.INSTAGRAM_APP_ID;
  process.env.FACEBOOK_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
}

const PORT = Number(process.env.PORT) || 3001;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const FREE_DAILY_PINS = 2;
function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function now() {
  return Date.now();
}

async function reverseLookup(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MarkDate/1.0',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return { placeName: '', area: '' };
    const data = await res.json();
    const a = data.address || {};
    const placeName =
      a.amenity ||
      a.road ||
      a.neighbourhood ||
      a.suburb ||
      a.quarter ||
      a.village ||
      a.town ||
      data.name ||
      '';
    const area =
      a.suburb ||
      a.neighbourhood ||
      a.city_district ||
      a.quarter ||
      a.town ||
      a.village ||
      a.city ||
      '';
    return { placeName: String(placeName || ''), area: String(area || '') };
  } catch {
    return { placeName: '', area: '' };
  }
}

async function reverseGeocode(lat, lng) {
  return (await reverseLookup(lat, lng)).placeName;
}

function isProUser(user) {
  return Boolean(user && user.proUntil && user.proUntil > now());
}

function stripSeeds(db) {
  const seedIds = new Set(['ece', 'can', 'defne', 'mert']);
  db.users = (db.users || []).filter(
    (u) => !seedIds.has(u.id) && !String(u.instagramId || '').startsWith('seed_'),
  );
  const keep = new Set(db.users.map((u) => u.id));
  db.pins = (db.pins || []).filter((p) => keep.has(p.authorId) && !String(p.id).startsWith('pin_ece') && !['pin_can', 'pin_defne', 'pin_mert'].includes(p.id));
  db.requests = (db.requests || []).filter(
    (r) => keep.has(r.fromId) && db.pins.some((p) => p.id === r.pinId),
  );
  db.chats = (db.chats || []).filter((c) =>
    c.memberIds.every((id) => keep.has(id)),
  );
  db.reports = db.reports || [];
  db.checkins = db.checkins || [];
  db.safeShares = db.safeShares || [];
  db.igTickets = db.igTickets || {};
  return db;
}

const persist = createPersist(stripSeeds);
const db = emptyDb();

function save(current) {
  persist.save(current);
}

function prune(db) {
  const t = now();
  const dying = db.pins.filter((p) => p.expiresAt <= t);
  dying.forEach((pin) => {
    db.chats.forEach((c) => {
      if (c.pinId !== pin.id) return;
      if (!c.closesAt || c.closesAt > t) {
        const members = c.memberIds.map((id) => userById(db, id));
        const pro = members.some((u) => isProUser(u));
        c.closesAt = pro ? t + 24 * 60 * 60 * 1000 : t;
      }
    });
  });
  db.pins = db.pins.filter((p) => p.expiresAt > t);
  db.chats = db.chats.filter((c) => !c.closesAt || c.closesAt > t);
}

function livePins(db) {
  prune(db);
  return db.pins.filter((p) => p.expiresAt > now());
}

function userById(db, id) {
  return db.users.find((u) => u.id === id);
}

function weekLeaders(db) {
  const since = now() - 7 * 24 * 60 * 60 * 1000;
  const scores = {};
  for (const c of db.checkins || []) {
    if (!c.happened || c.at < since) continue;
    const host = c.pinAuthorId;
    if (!host) continue;
    scores[host] = (scores[host] || 0) + 1;
  }
  return new Set(
    Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .filter(([, n]) => n >= 1)
      .map(([id]) => id),
  );
}

function isQuiet(db, userId) {
  const since = now() - 14 * 24 * 60 * 60 * 1000;
  const nos = (db.checkins || []).filter(
    (c) => c.otherId === userId && c.happened === false && c.at > since,
  ).length;
  return nos >= 3;
}

function refreshBadges(db, userId) {
  const user = userById(db, userId);
  if (!user) return;
  const mine = (db.checkins || []).filter((c) => c.fromId === userId && c.happened);
  const guest = mine.filter((c) => c.pinAuthorId !== userId);
  const kinds = new Set(mine.map((c) => c.pinKind).filter(Boolean));
  const dakik = mine.filter((c) => c.near).length;
  const badges = [];
  if (guest.filter((c) => c.lastMinute).length >= 3) badges.push('kurtarici');
  if (mine.length >= 5 && kinds.size >= 2) badges.push('kelebek');
  if (dakik >= 2) badges.push('dakik');
  user.badges = badges;
}

function activeSafeShare(db, userId) {
  const t = now();
  db.safeShares = (db.safeShares || []).filter((s) => s.expiresAt > t);
  const share = db.safeShares.find((s) => s.userId === userId);
  if (!share) return null;
  return {
    token: share.token,
    expiresAt: share.expiresAt,
    url: `${publicUrl()}/safe/${share.token}`,
  };
}

function decorateChat(db, chat, userId) {
  const pin = db.pins.find((p) => p.id === chat.pinId);
  const mine = (db.checkins || []).find(
    (x) => x.chatId === chat.id && x.fromId === userId,
  );
  const start = pin?.meetAt || chat.messages?.[0]?.at || now();
  const due = start + 15 * 60 * 1000;
  return {
    ...chat,
    myCheckin: mine ? Boolean(mine.happened) : null,
    needsCheckin: !mine && now() >= due,
  };
}

function decoratePin(db, pin, leaders) {
  const author = userById(db, pin.authorId);
  return {
    ...pin,
    meetAt: pin.meetAt || pin.createdAt,
    placeName: pin.placeName || '',
    area: pin.area || '',
    featured: Boolean(pin.featured),
    socialLeader: Boolean(leaders && leaders.has(pin.authorId)),
    badges: author?.badges || [],
    coming: db.requests.filter((r) => r.pinId === pin.id && r.status === 'accepted')
      .length,
  };
}

function publicUrl() {
  return String(process.env.API_PUBLIC_URL || 'http://127.0.0.1:3001').replace(
    /\/$/,
    '',
  );
}

function absPhoto(url) {
  if (!url) return '';
  if (String(url).startsWith('http')) return url;
  return `${publicUrl()}${url.startsWith('/') ? url : `/${url}`}`;
}

function blockedPair(db, a, b) {
  const ua = userById(db, a);
  const ub = userById(db, b);
  return (
    (ua?.blockedIds || []).includes(b) || (ub?.blockedIds || []).includes(a)
  );
}

function normalizeHandle(raw) {
  const h = String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (!h) return '';
  if (!/^[a-z0-9._]{1,30}$/.test(h)) return null;
  return h;
}

function closePin(db, pin) {
  const t = now();
  db.pins = db.pins.filter((p) => p.id !== pin.id);
  db.requests = db.requests.filter((r) => r.pinId !== pin.id);
  db.chats.forEach((c) => {
    if (c.pinId === pin.id) c.closesAt = t;
  });
}

function publicProfile(user, extra = {}) {
  if (!user) return user;
  const leaders = extra.leaders || new Set();
  const self = Boolean(extra.self);
  return {
    id: user.id,
    name: user.name,
    instagram: user.instagram || '',
    instagramVerified: Boolean(user.instagramId && user.instagram),
    bio: user.bio,
    interests: user.interests || [],
    email: self ? user.email : undefined,
    photoUrl: absPhoto(user.photoUrl || ''),
    isPro: isProUser(user),
    onboarded: Boolean(user.onboarded),
    badges: user.badges || [],
    socialLeader: leaders.has(user.id),
    safeShare: self && extra.db ? activeSafeShare(extra.db, user.id) : null,
  };
}

function snapshotFor(db, userId) {
  prune(db);
  const leaders = weekLeaders(db);
  const blocked = (otherId) => blockedPair(db, userId, otherId);
  const hiddenPin = (otherId) =>
    blocked(otherId) || (otherId !== userId && isQuiet(db, otherId));
  return {
    me: publicProfile(userById(db, userId), { self: true, leaders, db }),
    profiles: db.users
      .filter((u) => u.id === userId || !blocked(u.id))
      .map((u) => publicProfile(u, { leaders, db })),
    blocked: (userById(db, userId)?.blockedIds || [])
      .map((id) => {
        const u = userById(db, id);
        return u
          ? publicProfile(u, { leaders, db })
          : {
              id,
              name: 'Silinmiş hesap',
              instagram: '',
              bio: '',
              interests: [],
              photoUrl: '',
              badges: [],
            };
      })
      .filter(Boolean),
    pins: livePins(db)
      .filter((p) => p.authorId === userId || !hiddenPin(p.authorId))
      .map((p) => decoratePin(db, p, leaders)),
    requests: db.requests.filter((r) => {
      const pin = db.pins.find((p) => p.id === r.pinId);
      if (!pin) return false;
      if (hiddenPin(r.fromId) || hiddenPin(pin.authorId)) return false;
      return r.fromId === userId || pin.authorId === userId;
    }),
    chats: db.chats
      .filter((c) => {
        if (!c.memberIds.includes(userId)) return false;
        if (c.closesAt && c.closesAt <= now()) return false;
        const other = c.memberIds.find((id) => id !== userId);
        return !other || !blockedPair(db, userId, other);
      })
      .map((c) => decorateChat(db, c, userId)),
  };
}

function pinsUsedToday(db, userId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  return db.pins.filter((p) => p.authorId === userId && p.createdAt >= startMs)
    .length;
}

function corsOrigin() {
  const raw = String(process.env.CORS_ORIGINS || '*').trim();
  if (!raw || raw === '*') return true;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
if (process.env.TRUST_PROXY !== '0') {
  app.set('trust proxy', 1);
}
app.use((req, res, next) => {
  if (process.env.FORCE_HTTPS !== '1') return next();
  if (req.path === '/health') return next();
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || '');
  if (proto.split(',')[0].trim() === 'https') return next();
  const host = req.headers.host;
  if (!host) return next();
  return res.redirect(301, `https://${host}${req.originalUrl}`);
});
app.use(cors({ origin: corsOrigin() }));
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    persist: persist.kind,
    publicUrl: publicUrl(),
  });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: corsOrigin() } });

mountOAuth(app, { db, save, uid, snapshotFor });
mountAdmin(app, { db, save });

function emitSnapshot(userId) {
  const snap = snapshotFor(db, userId);
  io.to(`user:${userId}`).emit('snapshot', snap);
}

function emitNotice(userId, notice) {
  io.to(`user:${userId}`).emit('notice', notice);
  const user = userById(db, userId);
  const tokens = expoTokens(user);
  if (tokens.length) void sendExpoPush(tokens, notice);
}

function emitAllRelated(userIds) {
  [...new Set(userIds.filter(Boolean))].forEach(emitSnapshot);
}

function tooMany(req, action, max, windowMs) {
  const key = `${req.userId}:${action}`;
  const t = now();
  const prev = (tooMany.buckets.get(key) || []).filter((x) => t - x < windowMs);
  if (prev.length >= max) {
    req.resStatus = 429;
    return true;
  }
  prev.push(t);
  tooMany.buckets.set(key, prev);
  return false;
}
tooMany.buckets = new Map();

function rateLimited(res, msg) {
  return res.status(429).json({ error: msg || 'Biraz yavaş. Az sonra tekrar dene.' });
}

function purgeUser(db, userId) {
  Object.entries(db.tokens || {}).forEach(([tok, id]) => {
    if (id === userId) delete db.tokens[tok];
  });
  db.pins = (db.pins || []).filter((p) => p.authorId !== userId);
  db.requests = (db.requests || []).filter((r) => r.fromId !== userId);
  (db.chats || []).forEach((c) => {
    if (!(c.memberIds || []).includes(userId)) return;
    c.closesAt = now();
    c.messages = (c.messages || []).map((m) =>
      m.fromId === userId ? { ...m, fromId: 'system', text: 'Bu hesap silindi.' } : m,
    );
    c.memberIds = c.memberIds.filter((id) => id !== userId);
  });
  (db.users || []).forEach((u) => {
    u.blockedIds = (u.blockedIds || []).filter((id) => id !== userId);
  });
  db.users = (db.users || []).filter((u) => u.id !== userId);
  db.checkins = (db.checkins || []).filter((c) => c.fromId !== userId);
  db.safeShares = (db.safeShares || []).filter((s) => s.userId !== userId);
  try {
    for (const ext of ['jpg', 'png', 'webp']) {
      const file = path.join(UPLOAD_DIR, `${userId}.${ext}`);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  } catch {
    /* ignore */
  }
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = db.tokens[token];
  if (!userId) return res.status(401).json({ error: 'Giriş yapman gerekiyor.' });
  req.userId = userId;
  req.token = token;
  next();
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const userId = token ? db.tokens[token] : null;
  if (!userId) return next(new Error('unauthorized'));
  socket.userId = userId;
  next();
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);
  socket.emit('snapshot', snapshotFor(db, socket.userId));
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/auth/logout', auth, (req, res) => {
  delete db.tokens[req.token];
  save(db);
  res.json({ ok: true });
});

app.post('/me/push-token', auth, (req, res) => {
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json({ error: 'Profil yok.' });
  if (!rememberToken(user, req.body?.token)) {
    return res.status(400).json({ error: 'Geçerli bir Expo push token değil.' });
  }
  save(db);
  res.json({ ok: true });
});

app.delete('/me/push-token', auth, (req, res) => {
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json({ error: 'Profil yok.' });
  forgetToken(user, req.body?.token);
  save(db);
  res.json({ ok: true });
});

app.get('/snapshot', auth, (req, res) => {
  res.json(snapshotFor(db, req.userId));
});

app.patch('/me', auth, (req, res) => {
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json({ error: 'Profil yok.' });
  if (typeof req.body.name === 'string' && req.body.name.trim().length >= 2) {
    user.name = req.body.name.trim();
  }
  if (typeof req.body.bio === 'string') user.bio = req.body.bio.trim();
  if (Object.prototype.hasOwnProperty.call(req.body, 'instagram')) {
    const handle = normalizeHandle(req.body.instagram);
    if (handle === null) {
      return res.status(400).json({
        error: 'Kullanıcı adı 1–30 karakter, harf, rakam, nokta veya alt çizgi.',
      });
    }
    if (handle) {
      const taken = db.users.find(
        (u) => u.id !== user.id && String(u.instagram || '').toLowerCase() === handle,
      );
      if (taken) {
        return res.status(400).json({ error: 'Bu kullanıcı adı alınmış.' });
      }
    }
    user.instagram = handle;
    user.instagramId = '';
  }
  if (req.body.onboarded === true) {
    user.onboarded = true;
    user.acceptedAgeAt = user.acceptedAgeAt || now();
  }
  save(db);
  emitSnapshot(req.userId);
  res.json(snapshotFor(db, req.userId));
});

app.delete('/me', auth, (req, res) => {
  const related = new Set([req.userId]);
  (db.chats || []).forEach((c) => {
    if ((c.memberIds || []).includes(req.userId)) {
      c.memberIds.forEach((id) => related.add(id));
    }
  });
  (db.pins || [])
    .filter((p) => p.authorId === req.userId)
    .forEach((p) => related.add(p.authorId));
  purgeUser(db, req.userId);
  save(db);
  related.forEach((id) => {
    if (id !== req.userId) emitSnapshot(id);
  });
  res.json({ ok: true });
});

app.delete('/me/instagram', auth, (req, res) => {
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json({ error: 'Profil yok.' });
  user.instagram = '';
  user.instagramId = '';
  save(db);
  emitSnapshot(req.userId);
  res.json(snapshotFor(db, req.userId));
});

app.post('/me/photo', auth, (req, res) => {
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json({ error: 'Profil yok.' });
  if (tooMany(req, 'photo', 12, 60 * 60 * 1000)) {
    return rateLimited(res, 'Fotoğraf limiti doldu. Biraz sonra dene.');
  }
  const raw = String(req.body?.dataUrl || '');
  const match = raw.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
  if (!match) {
    return res.status(400).json({ error: 'Geçerli bir fotoğraf seç.' });
  }
  const ext = match[1].toLowerCase() === 'png' ? 'png' : 'jpg';
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 4.5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Fotoğraf çok büyük.' });
  }
  const file = `${user.id}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
  user.photoUrl = `/uploads/${file}?v=${Date.now()}`;
  save(db);
  emitSnapshot(req.userId);
  res.json(snapshotFor(db, req.userId));
});

app.post('/me/pro', auth, (req, res) => {
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json({ error: 'Profil yok.' });
  const plan = req.body?.plan === 'monthly' ? 'monthly' : 'yearly';
  const days = plan === 'monthly' ? 30 : 365;
  user.proPlan = plan;
  user.proUntil = now() + days * 24 * 60 * 60 * 1000;
  save(db);
  emitSnapshot(req.userId);
  res.json(snapshotFor(db, req.userId));
});

app.get('/geo/reverse', auth, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Konum alınamadı.' });
  }
  const geo = await reverseLookup(lat, lng);
  res.json(geo);
});

const PLACE_EMOJI = {
  cafe: '☕',
  restaurant: '🍽️',
  bar: '🍷',
  pub: '🍺',
  fast_food: '🍔',
  ice_cream: '🍦',
  park: '🌳',
  garden: '🌿',
  playground: '🛝',
  pitch: '⚽',
  picnic_site: '🧺',
  cinema: '🎬',
  theatre: '🎭',
  nightclub: '🌙',
  arts_centre: '🎨',
  museum: '🏛️',
  attraction: '✨',
  gallery: '🖼️',
  library: '📚',
};

const PLACE_LABEL = {
  cafe: 'Kafe',
  restaurant: 'Restoran',
  bar: 'Bar',
  pub: 'Pub',
  fast_food: 'Fast food',
  ice_cream: 'Dondurma',
  park: 'Park',
  garden: 'Bahçe',
  playground: 'Oyun alanı',
  pitch: 'Saha',
  picnic_site: 'Piknik',
  cinema: 'Sinema',
  theatre: 'Tiyatro',
  nightclub: 'Gece',
  arts_centre: 'Sanat',
  museum: 'Müze',
  attraction: 'Gezilecek yer',
  gallery: 'Galeri',
  library: 'Kütüphane',
};

const placeCache = new Map();
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function placeCoords(el) {
  if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

async function fetchOverpass(url, query) {
  const overpass = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'MarkDate/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!overpass.ok) throw new Error(`overpass ${overpass.status}`);
  return overpass.json();
}

async function lookupNearbyPlaces(lat, lng) {
  const key = `${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const hit = placeCache.get(key);
  if (hit && Date.now() - hit.at < 8 * 60 * 1000) return hit.places;

  const query = `[out:json][timeout:20];
(
  nwr["amenity"~"^(cafe|restaurant|bar|pub|fast_food|ice_cream|cinema|theatre|nightclub|arts_centre|library)$"](around:1100,${lat},${lng});
  nwr["leisure"~"^(park|garden|playground|pitch|picnic_site)$"](around:1100,${lat},${lng});
  nwr["tourism"~"^(attraction|museum|gallery)$"](around:1100,${lat},${lng});
);
out center 90;`;

  let data = { elements: [] };
  for (const url of OVERPASS_URLS) {
    try {
      data = await fetchOverpass(url, query);
      if (Array.isArray(data.elements) && data.elements.length) break;
    } catch {
      /* diğer ayna */
    }
  }

  const places = (data.elements || [])
    .map((n) => {
      const coords = placeCoords(n);
      if (!coords) return null;
      const tags = n.tags || {};
      const kind = tags.amenity || tags.leisure || tags.tourism || 'place';
      const name = String(tags.name || tags['name:tr'] || '').trim();
      return {
        id: `osm_${n.type}_${n.id}`,
        lat: coords.lat,
        lng: coords.lng,
        name: name || PLACE_LABEL[kind] || 'Mekan',
        kind,
        emoji: PLACE_EMOJI[kind] || '📍',
        named: Boolean(name),
      };
    })
    .filter(Boolean)
    .filter((p, i, all) => {
      const near = all.findIndex(
        (x) => Math.abs(x.lat - p.lat) < 0.00012 && Math.abs(x.lng - p.lng) < 0.00012,
      );
      return near === i;
    })
    .sort((a, b) => Number(b.named) - Number(a.named))
    .slice(0, 70)
    .map(({ named, ...p }) => p);

  placeCache.set(key, { at: Date.now(), places });
  return places;
}

app.get('/geo/places', auth, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Konum alınamadı.' });
  }
  try {
    res.json({ places: await lookupNearbyPlaces(lat, lng) });
  } catch {
    res.json({ places: [] });
  }
});

app.post('/pins', auth, async (req, res) => {
  if (tooMany(req, 'pin', 8, 60 * 60 * 1000)) {
    return rateLimited(res, 'Bir saatte en fazla 8 mark. Biraz bekle.');
  }
  const text = String(req.body?.text || '').trim();
  const kind = req.body?.kind === 'activity' ? 'activity' : 'hangout';
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (text.length < 8) {
    return res.status(400).json({ error: 'Ne yapmak istediğini bir cümleyle yaz.' });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Konum alınamadı.' });
  }
  const me = userById(db, req.userId);
  if (!isProUser(me) && pinsUsedToday(db, req.userId) >= FREE_DAILY_PINS) {
    return res.status(400).json({
      error: 'Günlük ücretsiz hakkın doldu (2/gün). Pro ile sınırsız mark.',
    });
  }
  const t = now();
  const meetAtRaw = Number(req.body?.meetAt);
  const meetAt = Number.isFinite(meetAtRaw) && meetAtRaw > t - 60000 ? meetAtRaw : t;
  const givenPlace = String(req.body?.placeName || '').trim();
  const geo = await reverseLookup(lat, lng);
  const placeName = givenPlace || geo.placeName;
  const featured = Boolean(req.body?.featured) && isProUser(me);
  const pin = {
    id: uid('pin'),
    authorId: req.userId,
    text,
    kind,
    lat,
    lng,
    createdAt: t,
    meetAt,
    placeName,
    area: geo.area,
    featured,
    expiresAt: Math.max(t + 30 * 60 * 1000, meetAt + TWO_HOURS_MS),
  };
  db.pins.unshift(pin);
  save(db);
  db.users.forEach((u) => emitSnapshot(u.id));
  res.json(snapshotFor(db, req.userId));
});

app.delete('/pins/:id', auth, (req, res) => {
  prune(db);
  const pin = db.pins.find((p) => p.id === req.params.id);
  if (!pin) return res.status(404).json({ error: 'Bu mark yok.' });
  if (pin.authorId !== req.userId) {
    return res.status(403).json({ error: 'Sadece kendi mark’ını kapatabilirsin.' });
  }
  const watchers = [
    pin.authorId,
    ...db.requests.filter((r) => r.pinId === pin.id).map((r) => r.fromId),
    ...db.chats.filter((c) => c.pinId === pin.id).flatMap((c) => c.memberIds),
  ];
  closePin(db, pin);
  save(db);
  emitAllRelated(watchers);
  res.json(snapshotFor(db, req.userId));
});

app.post('/pins/:id/join', auth, (req, res) => {
  if (tooMany(req, 'join', 20, 10 * 60 * 1000)) {
    return rateLimited(res, 'Çok sık istek gönderdin. Biraz sonra dene.');
  }
  prune(db);
  const pin = db.pins.find((p) => p.id === req.params.id && p.expiresAt > now());
  if (!pin) return res.status(404).json({ error: 'Bu mark artık yok.' });
  if (pin.authorId === req.userId) {
    return res.status(400).json({ error: 'Kendi mark’ına istek gönderemezsin.' });
  }
  if (blockedPair(db, req.userId, pin.authorId)) {
    return res.status(400).json({ error: 'Bu kişiyle eşleşme kapalı.' });
  }
  const existing = db.requests.find(
    (r) => r.pinId === pin.id && r.fromId === req.userId && r.status !== 'declined',
  );
  if (existing?.status === 'pending') {
    return res.status(400).json({ error: 'İstek zaten gönderildi, onay bekleniyor.' });
  }
  if (existing?.status === 'accepted') {
    return res.status(400).json({ error: 'Zaten eşleştiniz.' });
  }
  db.requests.unshift({
    id: uid('req'),
    pinId: pin.id,
    fromId: req.userId,
    status: 'pending',
    createdAt: now(),
  });
  save(db);
  emitAllRelated([req.userId, pin.authorId]);
  const from = userById(db, req.userId);
  emitNotice(pin.authorId, {
    id: uid('note'),
    type: 'join',
    title: `${from?.name || 'Biri'} selam attı`,
    body: pin.placeName ? `${pin.placeName} · ${pin.text}` : pin.text,
    pinId: pin.id,
  });
  res.json(snapshotFor(db, req.userId));
});

app.post('/requests/:id/decide', auth, (req, res) => {
  const accept = Boolean(req.body?.accept);
  const request = db.requests.find((r) => r.id === req.params.id);
  if (!request || request.status !== 'pending') {
    return res.status(404).json({ error: 'İstek yok.' });
  }
  const pin = db.pins.find((p) => p.id === request.pinId);
  if (!pin || pin.authorId !== req.userId) {
    return res.status(403).json({ error: 'Bu istek sana ait değil.' });
  }
  if (!accept) {
    request.status = 'declined';
    save(db);
    emitAllRelated([req.userId, request.fromId]);
    return res.json({ chatId: null, snapshot: snapshotFor(db, req.userId) });
  }
  request.status = 'accepted';
  const from = userById(db, request.fromId);
  const host = userById(db, req.userId);
  const existingChat = db.chats.find(
    (c) =>
      c.pinId === pin.id &&
      c.memberIds.includes(req.userId) &&
      c.memberIds.includes(request.fromId) &&
      (!c.closesAt || c.closesAt > now()),
  );
  if (existingChat) {
    save(db);
    emitAllRelated([req.userId, request.fromId]);
    emitNotice(request.fromId, {
      id: uid('note'),
      type: 'accepted',
      title: `${host?.name || 'Biri'} onayladı`,
      body: 'Sohbet açıldı. Kısa konuşun, yüz yüze tanışın.',
      chatId: existingChat.id,
      pinId: pin.id,
    });
    return res.json({
      chatId: existingChat.id,
      snapshot: snapshotFor(db, req.userId),
    });
  }
  const extra = isProUser(from) || isProUser(host) ? 24 * 60 * 60 * 1000 : 0;
  const chat = {
    id: uid('chat'),
    pinId: pin.id,
    memberIds: [req.userId, request.fromId],
    closesAt: pin.expiresAt + extra,
    messages: [
      {
        id: uid('msg'),
        fromId: 'system',
        text: `${from?.name || 'Biri'} ile eşleştiniz. Kısa konuşun, yüz yüze tanışın. Sohbet mark bitince kapanır.`,
        at: now(),
      },
    ],
  };
  db.chats.unshift(chat);
  save(db);
  emitAllRelated([req.userId, request.fromId]);
  emitNotice(request.fromId, {
    id: uid('note'),
    type: 'accepted',
    title: `${host?.name || 'Biri'} onayladı`,
    body: 'Sohbet açıldı. Kısa konuşun, yüz yüze tanışın.',
    chatId: chat.id,
    pinId: pin.id,
  });
  res.json({ chatId: chat.id, snapshot: snapshotFor(db, req.userId) });
});

app.post('/chats/:id/messages', auth, (req, res) => {
  if (tooMany(req, 'msg', 40, 60 * 1000)) {
    return rateLimited(res, 'Çok hızlı yazıyorsun. Bir dakika bekle.');
  }
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Boş mesaj.' });
  const chat = db.chats.find((c) => c.id === req.params.id);
  if (!chat || !chat.memberIds.includes(req.userId)) {
    return res.status(404).json({ error: 'Sohbet yok.' });
  }
  if (chat.closesAt && chat.closesAt <= now()) {
    return res.status(400).json({ error: 'Bu sohbet kapandı.' });
  }
  chat.messages.push({
    id: uid('msg'),
    fromId: req.userId,
    text,
    at: now(),
  });
  save(db);
  emitAllRelated(chat.memberIds);
  const from = userById(db, req.userId);
  const preview = text.length > 90 ? `${text.slice(0, 87)}…` : text;
  chat.memberIds
    .filter((id) => id !== req.userId)
    .forEach((id) => {
      emitNotice(id, {
        id: uid('note'),
        type: 'message',
        title: from?.name || 'Yeni mesaj',
        body: preview,
        chatId: chat.id,
        pinId: chat.pinId,
      });
    });
  res.json(snapshotFor(db, req.userId));
});

function chatOwned(req, res) {
  const chat = db.chats.find((c) => c.id === req.params.id);
  if (!chat || !chat.memberIds.includes(req.userId)) {
    res.status(404).json({ error: 'Sohbet yok.' });
    return null;
  }
  if (chat.closesAt && chat.closesAt <= now()) {
    res.status(400).json({ error: 'Bu sohbet kapandı.' });
    return null;
  }
  return chat;
}

app.post('/chats/:id/spin', auth, (req, res) => {
  const chat = chatOwned(req, res);
  if (!chat) return;
  if (chat.lastSpinAt && now() - chat.lastSpinAt < 90 * 1000) {
    return res.status(400).json({ error: 'Biraz sonra tekrar çevir.' });
  }
  const pin = db.pins.find((p) => p.id === chat.pinId);
  chat.lastSpinAt = now();
  chat.messages.push({
    id: uid('msg'),
    fromId: 'system',
    text: `Çark: ${pickWheel(pin)}`,
    at: now(),
  });
  save(db);
  emitAllRelated(chat.memberIds);
  res.json(snapshotFor(db, req.userId));
});

app.post('/chats/:id/checkin', auth, (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.id);
  if (!chat || !chat.memberIds.includes(req.userId)) {
    return res.status(404).json({ error: 'Sohbet yok.' });
  }
  if ((db.checkins || []).some((c) => c.chatId === chat.id && c.fromId === req.userId)) {
    return res.status(400).json({ error: 'Bu buluşmayı zaten işaretledin.' });
  }
  const happened = Boolean(req.body?.happened);
  const pin = db.pins.find((p) => p.id === chat.pinId);
  const otherId = chat.memberIds.find((id) => id !== req.userId);
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const near =
    pin && Number.isFinite(lat)
      ? distanceMeters({ lat, lng }, { lat: pin.lat, lng: pin.lng }) < 350
      : false;
  const reqRow = db.requests.find(
    (r) =>
      r.pinId === chat.pinId &&
      r.status === 'accepted' &&
      (r.fromId === req.userId || r.fromId === otherId),
  );
  const lastMinute = Boolean(
    reqRow?.createdAt &&
      pin?.meetAt &&
      pin.meetAt - reqRow.createdAt < 45 * 60 * 1000 &&
      pin.authorId !== req.userId,
  );
  db.checkins = db.checkins || [];
  db.checkins.unshift({
    id: uid('chk'),
    chatId: chat.id,
    pinId: chat.pinId,
    pinAuthorId: pin?.authorId || '',
    pinKind: pin?.kind || 'hangout',
    fromId: req.userId,
    otherId: otherId || '',
    happened,
    near,
    lastMinute,
    at: now(),
  });
  refreshBadges(db, req.userId);
  if (otherId) refreshBadges(db, otherId);
  save(db);
  emitAllRelated(chat.memberIds);
  res.json(snapshotFor(db, req.userId));
});

app.post('/chats/:id/safe-share', auth, (req, res) => {
  const chat = chatOwned(req, res);
  if (!chat) return;
  const me = userById(db, req.userId);
  const pin = db.pins.find((p) => p.id === chat.pinId);
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  db.safeShares = (db.safeShares || []).filter(
    (s) => s.userId !== req.userId && s.expiresAt > now(),
  );
  const share = {
    token: crypto.randomBytes(12).toString('hex'),
    userId: req.userId,
    chatId: chat.id,
    pinId: chat.pinId,
    name: me?.name || 'Birisi',
    placeName: pin?.placeName || '',
    lat: Number.isFinite(lat) ? lat : pin?.lat,
    lng: Number.isFinite(lng) ? lng : pin?.lng,
    expiresAt: Math.min(chat.closesAt || now() + TWO_HOURS_MS, now() + TWO_HOURS_MS),
  };
  db.safeShares.unshift(share);
  save(db);
  emitSnapshot(req.userId);
  res.json({
    snapshot: snapshotFor(db, req.userId),
    shareUrl: `${publicUrl()}/safe/${share.token}`,
  });
});

app.delete('/chats/:id/safe-share', auth, (req, res) => {
  db.safeShares = (db.safeShares || []).filter((s) => s.userId !== req.userId);
  save(db);
  emitSnapshot(req.userId);
  res.json(snapshotFor(db, req.userId));
});

app.post('/safe/:token/ping', auth, (req, res) => {
  const share = (db.safeShares || []).find(
    (s) => s.token === req.params.token && s.userId === req.userId && s.expiresAt > now(),
  );
  if (!share) return res.status(404).json({ error: 'Paylaşım yok.' });
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    share.lat = lat;
    share.lng = lng;
    save(db);
  }
  res.json({ ok: true });
});

app.get('/safe/:token', (req, res) => {
  const share = (db.safeShares || []).find(
    (s) => s.token === req.params.token && s.expiresAt > now(),
  );
  if (!share) {
    return res
      .status(404)
      .type('html')
      .send(
        '<!doctype html><meta charset="utf-8"><title>Mark Date</title><p>Bu konum paylaşımı kapandı.</p>',
      );
  }
  const name = String(share.name || '').replace(/[<>]/g, '');
  const place = String(share.placeName || '').replace(/[<>]/g, '');
  const lat = Number(share.lat);
  const lng = Number(share.lng);
  const map =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
      : 'https://www.openstreetmap.org/';
  res.type('html').send(`<!doctype html>
<html lang="tr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Mark Date · güvenli konum</title>
<style>
  body{font-family:system-ui,sans-serif;background:#F6F0E6;color:#1F1A17;margin:0;padding:24px;line-height:1.45}
  .card{background:#FFFCF7;border:1px solid #E8DCCE;border-radius:18px;padding:20px;max-width:420px}
  a{color:#E35D4A;font-weight:700}
  .meta{color:#7A7168}
</style></head>
<body>
  <div class="card">
    <p class="meta">Mark Date güvenli paylaşım</p>
    <h1>${name} bir buluşmada</h1>
    <p>${place ? place + ' · ' : ''}Konum yaklaşık 2 saat görünür. Karşı taraf görmez; sadece bu linke sahip olan görür.</p>
    <p><a href="${map}">Haritada aç</a></p>
    <p class="meta">Bu sayfayı 20 sn’de bir yenile, konum güncellenir.</p>
  </div>
  <script>setTimeout(function(){location.reload()},20000)</script>
</body></html>`);
});

app.post('/users/:id/block', auth, (req, res) => {
  const me = userById(db, req.userId);
  const otherId = String(req.params.id);
  if (!me || otherId === req.userId) {
    return res.status(400).json({ error: 'Engellenemedi.' });
  }
  me.blockedIds = Array.from(new Set([...(me.blockedIds || []), otherId]));
  db.chats.forEach((c) => {
    if (c.memberIds.includes(req.userId) && c.memberIds.includes(otherId)) {
      c.closesAt = now();
    }
  });
  save(db);
  emitAllRelated([req.userId, otherId]);
  res.json(snapshotFor(db, req.userId));
});

app.delete('/users/:id/block', auth, (req, res) => {
  const me = userById(db, req.userId);
  const otherId = String(req.params.id);
  if (!me) return res.status(404).json({ error: 'Profil yok.' });
  me.blockedIds = (me.blockedIds || []).filter((id) => id !== otherId);
  save(db);
  emitAllRelated([req.userId, otherId]);
  res.json(snapshotFor(db, req.userId));
});

app.post('/users/:id/report', auth, (req, res) => {
  if (tooMany(req, 'report', 8, 60 * 60 * 1000)) {
    return rateLimited(res, 'Şikayet limiti doldu. Bir saat sonra dene.');
  }
  const otherId = String(req.params.id);
  const reason = String(req.body?.reason || 'other').slice(0, 80);
  db.reports = db.reports || [];
  const recent = db.reports.find(
    (r) =>
      r.fromId === req.userId &&
      r.targetId === otherId &&
      now() - r.at < 30 * 60 * 1000,
  );
  if (recent) {
    return res.status(400).json({ error: 'Bu kişiyi az önce şikayet ettin.' });
  }
  db.reports.unshift({
    id: uid('rep'),
    fromId: req.userId,
    targetId: otherId,
    pinId: req.body?.pinId || null,
    reason,
    at: now(),
    status: 'open',
  });
  if (db.reports.length > 400) db.reports = db.reports.slice(0, 400);
  save(db);
  res.json({ ok: true });
});

setInterval(() => prune(db), 30_000);

async function main() {
  const loaded = await persist.load();
  Object.assign(db, loaded);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Mark Date API ${publicUrl()}  persist=${persist.kind}`);
  });
}

function shutdown() {
  persist
    .flush()
    .catch(() => {})
    .finally(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
