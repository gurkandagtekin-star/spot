const fs = require('fs');
const os = require('os');
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
const { mountAdmin, adminOk } = require('./admin');
const { fail, tError } = require('./i18n');
const {
  normalizeUsername,
  usernameTaken,
  assignUsername,
  migrateUsers,
} = require('./username');
const { seedPlaces } = require('./places');
const { parseBirthDate, ageFromBirthDate } = require('./birth');

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
const PRO_DAILY_PINS = 12;
const FREE_AD_MARKS = 2;
const PRO_PIN_MS = 16 * 60 * 60 * 1000;
const PRO_CHAT_MS = 24 * 60 * 60 * 1000;
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

function dayStartMs(ts = now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function syncAdMarks(user) {
  if (!user) return 0;
  const start = dayStartMs();
  if (user.adMarksDay !== start) {
    user.adMarksToday = 0;
    user.adMarksDay = start;
  }
  return Number(user.adMarksToday) || 0;
}

function dailyPinCap(user) {
  if (isProUser(user)) return PRO_DAILY_PINS;
  return FREE_DAILY_PINS + Math.min(FREE_AD_MARKS, syncAdMarks(user));
}

function stripSeeds(db) {
  const seedIds = new Set(['ece', 'can', 'defne', 'mert']);
  db.users = (db.users || []).filter(
    (u) => !seedIds.has(u.id),
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
  db.blocks = (db.blocks || []).filter(
    (b) => keep.has(b.blockerId) && keep.has(b.blockedId),
  );
  db.checkins = db.checkins || [];
  db.safeShares = db.safeShares || [];
  db.igTickets = db.igTickets || {};
  db.follows = (db.follows || []).filter(
    (f) => keep.has(f.followerId) && keep.has(f.followingId),
  );
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
  dying.forEach((pin) => upsertWallMark(db, pin));
  db.pins = db.pins.filter((p) => p.expiresAt > t);
  db.chats = db.chats.filter((c) => !c.closesAt || c.closesAt > t);
}

function wallCard(pin) {
  return {
    id: pin.id,
    text: pinVisibleText(pin.text),
    kind: pin.kind === 'activity' || pin.kind === 'chat' ? pin.kind : 'hangout',
    placeName: pin.kind === 'chat' ? '' : pin.area || pin.placeName || '',
    createdAt: pin.createdAt,
    anonymous: Boolean(pin.anonymous),
    live: pin.expiresAt > now() && !pin.retiredAt,
    photoUrl: pin.photoUrl || '',
  };
}

function wallMoments(db, user, self) {
  const marks = (user.wallMarks || []).filter((m) => self || !m.anonymous);
  const out = [];
  const seen = new Set();
  for (const m of marks) {
    const title = String(m.placeName || '').trim() || (m.kind === 'chat' ? 'Sohbet' : 'An');
    const key = `${title}:${m.photoUrl || ''}`;
    if (seen.has(key) && out.length >= 3) continue;
    seen.add(key);
    const pin = (db.pins || []).find((p) => p.id === m.id);
    out.push({
      id: m.id,
      title,
      photoUrl: absPhoto(m.photoUrl || pin?.photoUrl || ''),
      createdAt: m.createdAt,
    });
    if (out.length >= 12) break;
  }
  return out;
}

function wallReviews(db, userId) {
  return (db.checkins || [])
    .filter(
      (c) =>
        c.happened &&
        (c.fromId === userId || c.otherId === userId || c.pinAuthorId === userId),
    )
    .slice(0, 24)
    .map((c) => {
      const pin = (db.pins || []).find((p) => p.id === c.pinId);
      return {
        id: c.id,
        text:
          c.fromId === userId
            ? 'Buluşmayı teyit etti.'
            : 'Teyitli bir sokak buluşması.',
        placeName: pin?.placeName || pin?.area || '',
        at: c.at,
      };
    });
}

function upsertWallMark(db, pin) {
  const user = userById(db, pin.authorId);
  if (!user) return;
  const card = wallCard(pin);
  user.wallMarks = [card, ...(user.wallMarks || []).filter((m) => m.id !== pin.id)].slice(
    0,
    24,
  );
}

function meetCount(db, userId) {
  return (db.checkins || []).filter((c) => c.fromId === userId && c.happened).length;
}

function followEdge(db, followerId, followingId) {
  return (db.follows || []).find(
    (f) => f.followerId === followerId && f.followingId === followingId,
  );
}

function followStats(db, userId) {
  const rows = db.follows || [];
  return {
    followers: rows.filter((f) => f.followingId === userId).length,
    following: rows.filter((f) => f.followerId === userId).length,
  };
}

function dropFollowsBetween(db, a, b) {
  db.follows = (db.follows || []).filter(
    (f) =>
      !(
        (f.followerId === a && f.followingId === b) ||
        (f.followerId === b && f.followingId === a)
      ),
  );
}

function userLabel(user) {
  return String(user?.firstName || user?.name || 'Biri').trim() || 'Biri';
}

function livePins(db) {
  prune(db);
  return db.pins.filter((p) => p.expiresAt > now() && !p.retiredAt);
}

function pinsForUser(db, userId) {
  prune(db);
  const live = livePins(db);
  const kept = db.pins.filter(
    (p) =>
      p.retiredAt &&
      (p.authorId === userId ||
        db.chats.some((c) => c.pinId === p.id && c.memberIds.includes(userId))),
  );
  const byId = new Map();
  for (const pin of [...live, ...kept]) byId.set(pin.id, pin);
  return [...byId.values()];
}

function pinVisibleText(raw) {
  let text = String(raw || '');
  const photoAt = text.indexOf('[[PIN_PHOTO]]');
  if (photoAt >= 0) text = text.slice(0, photoAt);
  return text.replace(/\n?\[\[SEATS\]\](2|3|4)/g, '').replace(/\n?\[\[ANON\]\]/g, '').trim();
}

function pinCapacity(pin) {
  const n = Number(pin?.capacity);
  return n === 2 || n === 3 || n === 4 ? n : 0;
}

function pinFilled(db, pin) {
  const coming = db.requests.filter(
    (r) => r.pinId === pin.id && r.status === 'accepted',
  ).length;
  return 1 + coming;
}

function retirePin(db, pin) {
  if (pin.retiredAt) return;
  pin.retiredAt = now();
  db.requests.forEach((r) => {
    if (r.pinId === pin.id && r.status === 'pending') r.status = 'declined';
  });
  upsertWallMark(db, pin);
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
    messages: (chat.messages || []).map((m) => ({
      ...m,
      imageUrl: m.imageUrl ? absPhoto(m.imageUrl) : undefined,
    })),
    myCheckin: mine ? Boolean(mine.happened) : null,
    needsCheckin: Boolean(pin) && pin.id !== 'dm' && !mine && now() >= due,
  };
}

function decoratePin(db, pin, leaders) {
  const author = userById(db, pin.authorId);
  const mark = '[[PIN_PHOTO]]';
  const rawText = String(pin.text || '');
  const photoAt = rawText.indexOf(mark);
  const embedded = photoAt >= 0 ? rawText.slice(photoAt + mark.length).trim() : '';
  const photo = pin.photoUrl || embedded;
  return {
    ...pin,
    text: pinVisibleText(rawText),
    meetAt: pin.meetAt || pin.createdAt,
    placeName: pin.placeName || '',
    area: pin.area || '',
    featured: Boolean(pin.featured),
    socialLeader: Boolean(leaders && leaders.has(pin.authorId)),
    badges: author?.badges || [],
    coming: db.requests.filter((r) => r.pinId === pin.id && r.status === 'accepted')
      .length,
    capacity: pinCapacity(pin) || undefined,
    anonymous: Boolean(pin.anonymous),
    photoUrl: photo ? absPhoto(photo) : '',
  };
}

function lanIpv4() {
  const nets = os.networkInterfaces();
  const found = [];
  Object.values(nets || {}).forEach((addrs) => {
    (addrs || []).forEach((a) => {
      const v4 = a.family === 'IPv4' || a.family === 4;
      if (!v4 || a.internal) return;
      if (String(a.address).startsWith('169.254.')) return;
      found.push(a.address);
    });
  });
  return (
    found.find((ip) => ip.startsWith('192.168.')) ||
    found.find((ip) => ip.startsWith('10.')) ||
    found.find((ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) ||
    found[0] ||
    ''
  );
}

function publicUrl() {
  const env = String(process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
  const loopback = !env || /127\.0\.0\.1|localhost/i.test(env);
  if (!loopback) return env;
  const lan = lanIpv4();
  if (lan) return `http://${lan}:3001`;
  return env || 'http://127.0.0.1:3001';
}

function absPhoto(url) {
  if (!url) return '';
  const value = String(url);
  if (value.startsWith('data:')) return value;
  const base = publicUrl();
  if (value.startsWith('http')) {
    try {
      const u = new URL(value);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
        const pub = new URL(base);
        u.protocol = pub.protocol;
        u.host = pub.host;
        return u.toString();
      }
    } catch {
      return value;
    }
    return value;
  }
  return `${base}${value.startsWith('/') ? value : `/${value}`}`;
}

function wallPostPublic(db, post, viewerId) {
  if (!post?.id) return null;
  if (viewerId && post.fromId && blockedPair(db, viewerId, post.fromId)) return null;
  const from = userById(db, post.fromId);
  return {
    id: post.id,
    fromId: post.fromId || post.userId || '',
    fromName: post.fromName || post.userName || (from ? userLabel(from) : 'Biri'),
    fromPhoto: absPhoto(post.fromPhoto || post.userAvatar || from?.photoUrl || ''),
    text: String(post.text || '').slice(0, 280),
    createdAt: Number(post.createdAt) || 0,
    likeCount: Number(post.likeCount) || 0,
  };
}

function wallPostsFor(db, user, viewerId) {
  return (user?.wallPosts || [])
    .map((p) => wallPostPublic(db, p, viewerId))
    .filter(Boolean)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 40);
}

function saveWallNote(owner, author, text) {
  const name = userLabel(author);
  const post = {
    id: uid('post'),
    authorId: author.id,
    targetUserId: owner.id,
    fromId: author.id,
    userId: author.id,
    fromName: name,
    userName: name,
    fromPhoto: author.photoUrl || '',
    userAvatar: author.photoUrl || '',
    text,
    createdAt: now(),
  };
  owner.wallPosts = [post, ...(owner.wallPosts || [])].slice(0, 80);
  return post;
}

function blockedPair(db, a, b) {
  if (!a || !b || a === b) return false;
  const rows = db.blocks || [];
  if (
    rows.some(
      (x) =>
        (x.blockerId === a && x.blockedId === b) ||
        (x.blockerId === b && x.blockedId === a),
    )
  ) {
    return true;
  }
  const ua = userById(db, a);
  const ub = userById(db, b);
  return (
    (ua?.blockedIds || []).includes(b) || (ub?.blockedIds || []).includes(a)
  );
}

function migrateBlocks(db) {
  db.blocks = db.blocks || [];
  db.reports = db.reports || [];
  const keyOf = (a, b) => `${a}:${b}`;
  const seen = new Set(
    db.blocks
      .filter((b) => b?.blockerId && b?.blockedId)
      .map((b) => keyOf(b.blockerId, b.blockedId)),
  );
  (db.users || []).forEach((u) => {
    (u.blockedIds || []).forEach((id) => {
      if (!id || seen.has(keyOf(u.id, id))) return;
      db.blocks.push({
        blockerId: u.id,
        blockedId: id,
        createdAt: now(),
      });
      seen.add(keyOf(u.id, id));
    });
  });
  const byUser = {};
  db.blocks.forEach((b) => {
    if (!b?.blockerId || !b?.blockedId) return;
    byUser[b.blockerId] = byUser[b.blockerId] || [];
    byUser[b.blockerId].push(b.blockedId);
  });
  (db.users || []).forEach((u) => {
    u.blockedIds = Array.from(new Set(byUser[u.id] || []));
  });
}

function addBlock(db, blockerId, blockedId) {
  db.blocks = db.blocks || [];
  const exists = db.blocks.some(
    (b) => b.blockerId === blockerId && b.blockedId === blockedId,
  );
  if (!exists) {
    db.blocks.push({
      blockerId,
      blockedId,
      createdAt: now(),
    });
  }
  const me = userById(db, blockerId);
  if (me) {
    me.blockedIds = Array.from(new Set([...(me.blockedIds || []), blockedId]));
  }
}

function removeBlock(db, blockerId, blockedId) {
  db.blocks = (db.blocks || []).filter(
    (b) => !(b.blockerId === blockerId && b.blockedId === blockedId),
  );
  const me = userById(db, blockerId);
  if (me) {
    me.blockedIds = (me.blockedIds || []).filter((id) => id !== blockedId);
  }
}

function closePin(db, pin) {
  const t = now();
  db.pins = db.pins.filter((p) => p.id !== pin.id);
  db.requests = db.requests.filter((r) => r.pinId !== pin.id);
  db.chats.forEach((c) => {
    if (c.pinId === pin.id) c.closesAt = t;
  });
}

function stripPhotoKey(url) {
  return String(url || '').split('?')[0];
}

function albumPhotos(user) {
  const list = [];
  const seen = new Set();
  const add = (raw) => {
    const uri = String(raw || '').trim();
    if (!uri) return;
    const key = stripPhotoKey(uri);
    if (seen.has(key)) return;
    seen.add(key);
    list.push(uri);
  };
  (Array.isArray(user?.photos) ? user.photos : []).forEach(add);
  add(user?.photoUrl);
  return list.slice(0, 6);
}

function publicProfile(user, extra = {}) {
  if (!user) return user;
  const leaders = extra.leaders || new Set();
  const self = Boolean(extra.self);
  return {
    id: user.id,
    name: user.name,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    age: ageFromBirthDate(user.birthDate) || (user.age > 0 ? user.age : undefined),
    birthDate: extra.self && user.birthDate ? user.birthDate : undefined,
    gender: user.gender || undefined,
    username: user.username || '',
    displayName: user.name,
    avatarUrl: absPhoto(user.photoUrl || ''),
    bio: user.bio,
    interests: user.interests || [],
    email: self ? user.email : undefined,
    photoUrl: absPhoto(user.photoUrl || ''),
    photos: albumPhotos(user).map((u) => absPhoto(u)),
    isPro: isProUser(user),
    adMarksToday: self ? syncAdMarks(user) : undefined,
    dailyPinLimit: self ? dailyPinCap(user) : undefined,
    onboarded: Boolean(user.onboarded),
    badges: user.badges || [],
    socialLeader: leaders.has(user.id),
    stats: extra.db
      ? {
          marks: Math.max(
            Number(user.markCount) || 0,
            (self
              ? user.wallMarks || []
              : (user.wallMarks || []).filter((m) => !m.anonymous)
            ).length,
          ),
          meets: meetCount(extra.db, user.id),
          ...followStats(extra.db, user.id),
        }
      : user.stats,
    followingIds: self
      ? (extra.db?.follows || [])
          .filter((f) => f.followerId === user.id)
          .map((f) => f.followingId)
      : undefined,
    wallMarks: (user.wallMarks || [])
      .filter((m) => self || !m.anonymous)
      .map((m) => ({ ...m, photoUrl: absPhoto(m.photoUrl || '') })),
    moments: extra.db ? wallMoments(extra.db, user, self) : [],
    reviews: extra.db ? wallReviews(extra.db, user.id) : [],
    wallPosts: extra.db ? wallPostsFor(extra.db, user, extra.viewerId) : (user.wallPosts || []).slice(0, 40),
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
    me: publicProfile(userById(db, userId), { self: true, leaders, db, viewerId: userId }),
    profiles: db.users
      .filter((u) => u.id === userId || !blocked(u.id))
      .map((u) => publicProfile(u, { leaders, db, viewerId: userId })),
    blocked: (userById(db, userId)?.blockedIds || [])
      .map((id) => {
        const u = userById(db, id);
        return u
          ? publicProfile(u, { leaders, db })
          : {
              id,
              name: 'Silinmiş hesap',
              username: '',
              displayName: 'Silinmiş hesap',
              avatarUrl: '',
              bio: '',
              interests: [],
              photoUrl: '',
              badges: [],
            };
      })
      .filter(Boolean),
    pins: pinsForUser(db, userId)
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
        if ((c.hiddenIds || []).includes(userId)) return false;
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
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, 'uploads')),
);
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

function emitWallToViewers(ownerId) {
  (db.users || []).forEach((u) => {
    if (!u?.id) return;
    if (u.id !== ownerId && blockedPair(db, u.id, ownerId)) return;
    emitSnapshot(u.id);
  });
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

function rateLimited(req, res, msg) {
  return res.status(429).json(fail(req, msg || 'Biraz yavaş. Az sonra tekrar dene.'));
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
  db.blocks = (db.blocks || []).filter(
    (b) => b.blockerId !== userId && b.blockedId !== userId,
  );
  (db.users || []).forEach((u) => {
    u.blockedIds = (u.blockedIds || []).filter((id) => id !== userId);
  });
  db.follows = (db.follows || []).filter(
    (f) => f.followerId !== userId && f.followingId !== userId,
  );
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
  if (!userId) return res.status(401).json(fail(req, 'Giriş yapman gerekiyor.'));
  req.userId = userId;
  req.token = token;
  next();
}

function maybeAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  req.userId = token ? db.tokens[token] || null : null;
  next();
}

function sendWallPosts(req, res) {
  const wallId = String(req.params.id || req.params.userId || '');
  const owner = userById(db, wallId);
  if (!owner) return res.status(404).json(fail(req, 'Profil yok.'));
  if (req.userId && blockedPair(db, req.userId, wallId)) {
    return res.status(400).json(fail(req, 'Bu duvar görünmüyor.'));
  }
  res.json({ posts: wallPostsFor(db, owner, req.userId) });
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
  if (!user) return res.status(404).json(fail(req, 'Profil yok.'));
  if (!rememberToken(user, req.body?.token)) {
    return res.status(400).json(fail(req, 'Geçerli bir Expo push token değil.'));
  }
  save(db);
  res.json({ ok: true });
});

app.delete('/me/push-token', auth, (req, res) => {
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json(fail(req, 'Profil yok.'));
  forgetToken(user, req.body?.token);
  save(db);
  res.json({ ok: true });
});

app.get('/snapshot', auth, (req, res) => {
  res.json(snapshotFor(db, req.userId));
});

app.patch('/me', auth, (req, res) => {
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json(fail(req, 'Profil yok.'));
  if (typeof req.body.firstName === 'string') {
    user.firstName = req.body.firstName.trim().slice(0, 40);
  }
  if (typeof req.body.lastName === 'string') {
    user.lastName = req.body.lastName.trim().slice(0, 40);
  }
  const composed = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (composed.length >= 2) {
    user.name = composed;
  } else if (typeof req.body.name === 'string' && req.body.name.trim().length >= 2) {
    user.name = req.body.name.trim();
  }
  if (req.body.birthDate != null && req.body.birthDate !== '') {
    const iso = parseBirthDate(req.body.birthDate);
    if (!iso) {
      return res.status(400).json(fail(req, 'Geçerli bir doğum tarihi yaz.'));
    }
    const years = ageFromBirthDate(iso);
    if (years == null || years < 18 || years > 99) {
      return res.status(400).json(fail(req, 'Devam etmek için 18 yaşından büyük olmalısın.'));
    }
    user.birthDate = iso;
    user.age = years;
  } else if (!user.birthDate && req.body.age != null && req.body.age !== '') {
    const age = parseInt(String(req.body.age), 10);
    if (!Number.isInteger(age) || age < 18 || age > 99) {
      return res.status(400).json(fail(req, 'Yaş 18–99 arasında olmalı.'));
    }
    user.age = age;
  }
  if (typeof req.body.gender === 'string' && req.body.gender) {
    const g = req.body.gender;
    if (!['woman', 'man', 'other', 'unspecified'].includes(g)) {
      return res.status(400).json(fail(req, 'Cinsiyet geçersiz.'));
    }
    user.gender = g;
  }
  if (typeof req.body.bio === 'string') user.bio = req.body.bio.trim();
  if (Object.prototype.hasOwnProperty.call(req.body, 'username')) {
    const handle = normalizeUsername(req.body.username);
    if (!handle) {
      return res.status(400).json(
        fail(req, 'Kullanıcı adı 2–30 karakter, harf, rakam, nokta veya alt çizgi.'),
      );
    }
    if (usernameTaken(db, handle, user.id)) {
      return res.status(400).json(fail(req, 'Username zaten alınmış'));
    }
    user.username = handle;
  }
  if (Array.isArray(req.body.interests)) {
    user.interests = req.body.interests
      .map((id) => String(id || '').trim().slice(0, 24))
      .filter(Boolean)
      .slice(0, 8);
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

app.delete('/me/instagram', auth, (_req, res) => {
  res.status(410).json(fail(req, 'Instagram bağlantısı kaldırıldı.'));
});

function searchDirectory(req, res) {
  const q = String(req.query.q || '').trim();
  if (q.length < 1) return res.json({ users: [] });
  const needle = q.toLocaleLowerCase('tr-TR');
  const users = (db.users || [])
    .filter((u) => {
      if (u.id === req.userId) return false;
      if (blockedPair(db, req.userId, u.id)) return false;
      const username = String(u.username || '').toLocaleLowerCase('tr-TR');
      const display = [u.name, u.firstName, u.lastName, u.displayName, u.fullName]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR');
      return username.includes(needle) || display.includes(needle);
    })
    .slice(0, 30)
    .map((u) => ({
      id: u.id,
      username: u.username || '',
      displayName: u.name || '',
      avatarUrl: absPhoto(u.photoUrl || ''),
      profileImage: absPhoto(u.photoUrl || ''),
    }));
  res.json({ users });
}

app.get('/api/users/search', auth, searchDirectory);
app.get('/users/search', auth, searchDirectory);
app.get('/api/search', auth, searchDirectory);

function appendProfilePhoto(user, dataUrl) {
  const raw = String(dataUrl || '');
  const match = raw.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
  if (!match) return { error: 'Geçerli bir fotoğraf seç.' };
  const ext = match[1].toLowerCase() === 'png' ? 'png' : 'jpg';
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 4.5 * 1024 * 1024) return { error: 'Fotoğraf çok büyük.' };
  const album = albumPhotos(user);
  if (album.length >= 6) return { error: 'En fazla 6 fotoğraf ekleyebilirsin.' };
  const file = `${user.id}_${uid('ph')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
  const url = `/uploads/${file}?v=${Date.now()}`;
  user.photos = [url, ...album.filter((u) => stripPhotoKey(u) !== stripPhotoKey(url))].slice(
    0,
    6,
  );
  user.photoUrl = user.photos[0];
  return { url };
}

app.post('/me/photo', auth, (req, res) => {
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json(fail(req, 'Profil yok.'));
  if (tooMany(req, 'photo', 12, 60 * 60 * 1000)) {
    return rateLimited(req, res, 'Fotoğraf limiti doldu. Biraz sonra dene.');
  }
  const saved = appendProfilePhoto(user, req.body?.dataUrl);
  if (saved.error) return res.status(400).json(fail(req, saved.error));
  save(db);
  emitSnapshot(req.userId);
  res.json(snapshotFor(db, req.userId));
});

app.post('/me/photos', auth, (req, res) => {
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json(fail(req, 'Profil yok.'));
  if (tooMany(req, 'photo', 12, 60 * 60 * 1000)) {
    return rateLimited(req, res, 'Fotoğraf limiti doldu. Biraz sonra dene.');
  }
  const list = Array.isArray(req.body?.dataUrls)
    ? req.body.dataUrls
    : [req.body?.dataUrl];
  if (!list.length) {
    return res.status(400).json(fail(req, 'Geçerli bir fotoğraf seç.'));
  }
  for (const item of list) {
    const saved = appendProfilePhoto(user, item);
    if (saved.error) return res.status(400).json(fail(req, saved.error));
  }
  save(db);
  emitSnapshot(req.userId);
  res.json(snapshotFor(db, req.userId));
});

app.post('/me/pro', auth, (req, res) => {
  if (!adminOk(req)) {
    return res.status(404).json(fail(req, 'Yok.'));
  }
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json(fail(req, 'Profil yok.'));
  const plan = req.body?.plan === 'monthly' ? 'monthly' : 'yearly';
  const days = plan === 'monthly' ? 30 : 365;
  user.proPlan = plan;
  user.proUntil = now() + days * 24 * 60 * 60 * 1000;
  save(db);
  emitSnapshot(req.userId);
  res.json(snapshotFor(db, req.userId));
});

app.post('/me/ad-mark', auth, (req, res) => {
  const user = userById(db, req.userId);
  if (!user) return res.status(404).json(fail(req, 'Profil yok.'));
  if (isProUser(user)) {
    return res.status(400).json(fail(req, 'Pro’da reklam hakkı yok.'));
  }
  if (tooMany(req, 'admark', 8, 60 * 60 * 1000)) {
    return rateLimited(req, res, 'Reklam hakkı biraz sonra.');
  }
  const used = syncAdMarks(user);
  if (used >= FREE_AD_MARKS) {
    return res.status(400).json(fail(req, 'Bugünkü reklam hakların doldu (+2).'));
  }
  user.adMarksToday = used + 1;
  user.adMarksDay = dayStartMs();
  save(db);
  emitSnapshot(req.userId);
  res.json(snapshotFor(db, req.userId));
});

app.get('/geo/reverse', auth, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json(fail(req, 'Konum alınamadı.'));
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
  supermarket: '🛒',
  convenience: '🏪',
  bakery: '🥐',
  mall: '🏬',
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
  supermarket: 'Market',
  convenience: 'Market',
  bakery: 'Fırın',
  mall: 'AVM',
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
  nwr["shop"~"^(supermarket|convenience|bakery|mall)$"](around:1100,${lat},${lng});
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
      const kind = tags.amenity || tags.leisure || tags.tourism || tags.shop || 'place';
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
    return res.status(400).json(fail(req, 'Konum alınamadı.'));
  }
  try {
    res.json({ places: await lookupNearbyPlaces(lat, lng) });
  } catch {
    res.json({ places: [] });
  }
});

app.post('/pins', auth, async (req, res) => {
  if (tooMany(req, 'pin', 20, 60 * 60 * 1000)) {
    return rateLimited(req, res, 'Bir saatte en fazla 20 mark. Biraz bekle.');
  }
  const kind =
    req.body?.kind === 'activity'
      ? 'activity'
      : req.body?.kind === 'chat'
        ? 'chat'
        : 'hangout';
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json(fail(req, 'Konum alınamadı.'));
  }
  const me = userById(db, req.userId);
  if (!me) return res.status(404).json(fail(req, 'Profil yok.'));
  const cap = dailyPinCap(me);
  if (pinsUsedToday(db, req.userId) >= cap) {
    return res.status(400).json(
      fail(
        req,
        isProUser(me)
          ? 'Günlük Pro hakkın doldu (12/gün).'
          : 'Günlük hakkın doldu. Reklam izleyerek +2 mark daha açabilirsin.',
      ),
    );
  }
  if (kind === 'chat' && !isProUser(me)) {
    return res.status(400).json(fail(req, 'Sohbet noktası Pro’ya özel.'));
  }
  const t = now();
  const meetAtRaw = Number(req.body?.meetAt);
  const meetAt =
    kind === 'chat'
      ? t
      : Number.isFinite(meetAtRaw) && meetAtRaw > t - 60000
        ? meetAtRaw
        : t;
  const givenPlace = String(req.body?.placeName || '').trim();
  const geo = await reverseLookup(lat, lng);
  const placeName =
    kind === 'chat'
      ? geo.area || 'Yakınında'
      : givenPlace || geo.placeName;
  const featured = Boolean(req.body?.featured) && isProUser(me);
  let text = String(req.body?.text || '').trim();
  const PHOTO_MARK = '[[PIN_PHOTO]]';
  const SEATS_MARK = '[[SEATS]]';
  const photoAt = text.indexOf(PHOTO_MARK);
  let rawPhoto = String(req.body?.photoUrl || req.body?.dataUrl || '').replace(/\s/g, '');
  if (photoAt >= 0) {
    const embedded = text.slice(photoAt + PHOTO_MARK.length).trim();
    text = text.slice(0, photoAt).trim();
    if (!rawPhoto) rawPhoto = embedded;
  }
  let capacity = Number(req.body?.capacity);
  const seatHit = text.match(/\[\[SEATS\]\](2|3|4)/);
  if (seatHit) {
    capacity = Number(seatHit[1]);
    text = text.replace(/\n?\[\[SEATS\]\](2|3|4)/g, '').trim();
  }
  if (capacity !== 2 && capacity !== 3 && capacity !== 4) capacity = 0;
  let anonymous =
    isProUser(me) && (Boolean(req.body?.anonymous) || text.includes('[[ANON]]'));
  text = text.replace(/\n?\[\[ANON\]\]/g, '').trim();
  if (text.length < 8) {
    return res.status(400).json(fail(req, 'Ne yapmak istediğini bir cümleyle yaz.'));
  }
  let photoUrl = '';
  if (rawPhoto) {
    const match = rawPhoto.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/i);
    const payload = match ? match[1] : '';
    if (payload) {
      const buf = Buffer.from(payload, 'base64');
      if (buf.length && buf.length <= 4.5 * 1024 * 1024) {
        const file = `pin_${uid('img')}.jpg`;
        fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
        photoUrl = `/uploads/${file}`;
      }
    } else if (rawPhoto.startsWith('/uploads/')) {
      photoUrl = rawPhoto;
    }
  }
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
    photoUrl,
    capacity: capacity || undefined,
    anonymous: anonymous || undefined,
    expiresAt: Math.max(
      t + 30 * 60 * 1000,
      meetAt + (isProUser(me) ? PRO_PIN_MS : TWO_HOURS_MS),
    ),
  };
  db.pins.unshift(pin);
  const author = userById(db, req.userId);
  if (author) author.markCount = (Number(author.markCount) || 0) + 1;
  upsertWallMark(db, pin);
  save(db);
  db.users.forEach((u) => emitSnapshot(u.id));
  if (author && !pin.anonymous) {
    const body = pin.placeName
      ? `${pin.placeName} · ${pinVisibleText(pin.text)}`
      : pinVisibleText(pin.text);
    (db.follows || [])
      .filter(
        (f) =>
          f.followingId === author.id &&
          f.notifyMarks !== false &&
          !blockedPair(db, f.followerId, author.id),
      )
      .forEach((f) => {
        emitNotice(f.followerId, {
          id: uid('note'),
          type: 'follow_mark',
          title: `${userLabel(author)} radarında yeni mark`,
          body,
          pinId: pin.id,
        });
      });
  }
  res.json(snapshotFor(db, req.userId));
});

app.delete('/pins/:id', auth, (req, res) => {
  prune(db);
  const pin = db.pins.find((p) => p.id === req.params.id);
  if (!pin) return res.status(404).json(fail(req, 'Bu mark yok.'));
  if (pin.authorId !== req.userId) {
    return res.status(403).json(fail(req, 'Sadece kendi mark’ını kapatabilirsin.'));
  }
  const watchers = [
    pin.authorId,
    ...db.requests.filter((r) => r.pinId === pin.id).map((r) => r.fromId),
    ...db.chats.filter((c) => c.pinId === pin.id).flatMap((c) => c.memberIds),
  ];
  closePin(db, pin);
  upsertWallMark(db, pin);
  save(db);
  emitAllRelated(watchers);
  res.json(snapshotFor(db, req.userId));
});

app.post('/pins/:id/join', auth, (req, res) => {
  if (tooMany(req, 'join', 20, 10 * 60 * 1000)) {
    return rateLimited(req, res, 'Çok sık istek gönderdin. Biraz sonra dene.');
  }
  prune(db);
  const pin = db.pins.find((p) => p.id === req.params.id && p.expiresAt > now() && !p.retiredAt);
  if (!pin) return res.status(404).json(fail(req, 'Bu mark artık yok.'));
  if (pin.authorId === req.userId) {
    return res.status(400).json(fail(req, 'Kendi mark’ına istek gönderemezsin.'));
  }
  if (blockedPair(db, req.userId, pin.authorId)) {
    return res.status(400).json(fail(req, 'Bu kişiyle eşleşme kapalı.'));
  }
  const existing = db.requests.find(
    (r) => r.pinId === pin.id && r.fromId === req.userId && r.status !== 'declined',
  );
  if (existing?.status === 'pending') {
    return res.status(400).json(fail(req, 'İstek zaten gönderildi, onay bekleniyor.'));
  }
  if (existing?.status === 'accepted') {
    return res.status(400).json(fail(req, 'Zaten eşleştiniz.'));
  }
  const cap = pinCapacity(pin);
  if (cap && pinFilled(db, pin) >= cap) {
    return res.status(400).json(fail(req, 'Kadro doldu.'));
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
    body: pin.placeName
      ? `${pin.placeName} · ${pinVisibleText(pin.text)}`
      : pinVisibleText(pin.text),
    pinId: pin.id,
  });
  res.json(snapshotFor(db, req.userId));
});

app.post('/requests/:id/decide', auth, (req, res) => {
  const accept = Boolean(req.body?.accept);
  const request = db.requests.find((r) => r.id === req.params.id);
  if (!request || request.status !== 'pending') {
    return res.status(404).json(fail(req, 'İstek yok.'));
  }
  const pin = db.pins.find((p) => p.id === request.pinId);
  if (!pin || pin.authorId !== req.userId) {
    return res.status(403).json(fail(req, 'Bu istek sana ait değil.'));
  }
  if (!accept) {
    request.status = 'declined';
    save(db);
    emitAllRelated([req.userId, request.fromId]);
    return res.json({ chatId: null, snapshot: snapshotFor(db, req.userId) });
  }
  const cap = pinCapacity(pin);
  if (cap && pinFilled(db, pin) >= cap) {
    request.status = 'declined';
    save(db);
    emitAllRelated([req.userId, request.fromId]);
    return res.status(400).json(fail(req, 'Kadro doldu.'));
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
  let chatId = existingChat?.id || null;
  if (!existingChat) {
    const extraChat = isProUser(from) || isProUser(host) ? PRO_CHAT_MS : 0;
    const chat = {
      id: uid('chat'),
      pinId: pin.id,
      memberIds: [req.userId, request.fromId],
      closesAt: extraChat ? now() + extraChat : pin.expiresAt,
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
    chatId = chat.id;
  }
  const filled = cap && pinFilled(db, pin) >= cap;
  if (filled) retirePin(db, pin);
  save(db);
  if (filled) {
    db.users.forEach((u) => emitSnapshot(u.id));
  } else {
    emitAllRelated([req.userId, request.fromId]);
  }
  emitNotice(request.fromId, {
    id: uid('note'),
    type: 'accepted',
    title: pin.anonymous ? 'Sohbet açıldı' : `${host?.name || 'Biri'} onayladı`,
    body: 'Sohbet açıldı. Kısa konuşun, yüz yüze tanışın.',
    chatId,
    pinId: pin.id,
  });
  if (filled) {
    const crew = [
      pin.authorId,
      ...db.requests
        .filter((r) => r.pinId === pin.id && r.status === 'accepted')
        .map((r) => r.fromId),
    ];
    crew.forEach((uidUser) => {
      emitNotice(uidUser, {
        id: uid('note'),
        type: 'filled',
        title: 'Kadro tamam',
        body: 'Mark haritadan kalktı. Sohbet sizde.',
        chatId: chatId || undefined,
        pinId: pin.id,
      });
    });
  }
  res.json({ chatId, filled: Boolean(filled), snapshot: snapshotFor(db, req.userId) });
});

app.delete('/requests/:id', auth, (req, res) => {
  const request = db.requests.find((r) => r.id === req.params.id);
  if (!request || request.status !== 'pending') {
    return res.status(404).json(fail(req, 'İstek yok.'));
  }
  if (request.fromId !== req.userId) {
    return res.status(403).json(fail(req, 'Bu isteği sen göndermedin.'));
  }
  const pin = db.pins.find((p) => p.id === request.pinId);
  db.requests = db.requests.filter((r) => r.id !== request.id);
  save(db);
  emitAllRelated([req.userId, pin?.authorId].filter(Boolean));
  res.json(snapshotFor(db, req.userId));
});

app.delete('/chats/:id', auth, (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.id);
  if (!chat || !(chat.memberIds || []).includes(req.userId)) {
    return res.status(404).json(fail(req, 'Sohbet yok.'));
  }
  chat.hiddenIds = Array.from(new Set([...(chat.hiddenIds || []), req.userId]));
  save(db);
  emitSnapshot(req.userId);
  res.json(snapshotFor(db, req.userId));
});

app.post('/chats/:id/messages', auth, (req, res) => {
  if (tooMany(req, 'msg', 40, 60 * 1000)) {
    return rateLimited(req, res, 'Çok hızlı yazıyorsun. Bir dakika bekle.');
  }
  let text = String(req.body?.text || '').trim();
  let raw = String(req.body?.dataUrl || req.body?.img || '').replace(/\s/g, '');
  if (!raw && /^data:image\//i.test(text)) {
    raw = text.replace(/\s/g, '');
    text = '📷 Fotoğraf';
  }
  let imageUrl = '';
  if (raw) {
    const match = raw.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/i);
    const payload = match ? match[1] : /^[A-Za-z0-9+/=]+$/.test(raw) ? raw : '';
    if (!payload) {
      return res.status(400).json(fail(req, 'Geçerli bir fotoğraf seç.'));
    }
    const buf = Buffer.from(payload, 'base64');
    if (!buf.length) {
      return res.status(400).json(fail(req, 'Fotoğraf okunamadı.'));
    }
    if (buf.length > 4.5 * 1024 * 1024) {
      return res.status(400).json(fail(req, 'Fotoğraf çok büyük.'));
    }
    const file = `chat_${uid('img')}.jpg`;
    fs.writeFileSync(path.join(UPLOAD_DIR, file), buf);
    imageUrl = `/uploads/${file}`;
  }
  if (!text && !imageUrl) return res.status(400).json(fail(req, 'Boş mesaj.'));
  const chat = db.chats.find((c) => c.id === req.params.id);
  if (!chat || !chat.memberIds.includes(req.userId)) {
    return res.status(404).json(fail(req, 'Sohbet yok.'));
  }
  if (chat.closesAt && chat.closesAt <= now()) {
    return res.status(400).json(fail(req, 'Bu sohbet kapandı.'));
  }
  chat.messages.push({
    id: uid('msg'),
    fromId: req.userId,
    text: text || (imageUrl ? '📷 Fotoğraf' : ''),
    imageUrl: imageUrl || undefined,
    at: now(),
  });
  save(db);
  emitAllRelated(chat.memberIds);
  const from = userById(db, req.userId);
  const preview = imageUrl
    ? '📷 Fotoğraf'
    : text.length > 90
      ? `${text.slice(0, 87)}…`
      : text;
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
    res.status(404).json(fail(req, 'Sohbet yok.'));
    return null;
  }
  if (chat.closesAt && chat.closesAt <= now()) {
    res.status(400).json(fail(req, 'Bu sohbet kapandı.'));
    return null;
  }
  return chat;
}

app.post('/chats/:id/spin', auth, (req, res) => {
  const chat = chatOwned(req, res);
  if (!chat) return;
  if (chat.lastSpinAt && now() - chat.lastSpinAt < 90 * 1000) {
    return res.status(400).json(fail(req, 'Biraz sonra tekrar çevir.'));
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
    return res.status(404).json(fail(req, 'Sohbet yok.'));
  }
  if ((db.checkins || []).some((c) => c.chatId === chat.id && c.fromId === req.userId)) {
    return res.status(400).json(fail(req, 'Bu buluşmayı zaten işaretledin.'));
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
  if (!share) return res.status(404).json(fail(req, 'Paylaşım yok.'));
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
  body{font-family:system-ui,sans-serif;background:#0A0A0A;color:#F5F5F5;margin:0;padding:24px;line-height:1.45}
  .card{background:#121212;border:1px solid #2A2A2A;border-radius:18px;padding:20px;max-width:420px}
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

app.get('/users/:id/wall-posts', maybeAuth, sendWallPosts);
app.get('/api/wall/:userId', maybeAuth, sendWallPosts);

app.post('/api/wall', auth, (req, res) => {
  if (tooMany(req, 'wall', 20, 10 * 60 * 1000)) {
    return rateLimited(req, res, 'Çok sık not. Biraz sonra dene.');
  }
  const authorId = String(req.body?.authorId || req.userId);
  const targetUserId = String(req.body?.targetUserId || req.body?.userId || req.userId);
  if (authorId !== req.userId) {
    return res.status(403).json(fail(req, 'Not başkası adına yazılamaz.'));
  }
  if (targetUserId !== req.userId) {
    return res.status(403).json(fail(req, 'Duvara yalnızca sahibi yazabilir.'));
  }
  const owner = userById(db, targetUserId);
  const me = userById(db, req.userId);
  if (!owner || !me) return res.status(404).json(fail(req, 'Profil yok.'));
  const text = String(req.body?.text || '').trim().slice(0, 280);
  if (text.length < 2) {
    return res.status(400).json(fail(req, 'Bir cümle yaz.'));
  }
  saveWallNote(owner, me, text);
  save(db);
  emitWallToViewers(targetUserId);
  res.json({
    posts: wallPostsFor(db, owner, req.userId),
    ...snapshotFor(db, req.userId),
  });
});

app.post('/users/:id/wall-posts', auth, (req, res) => {
  if (tooMany(req, 'wall', 20, 10 * 60 * 1000)) {
    return rateLimited(req, res, 'Çok sık not. Biraz sonra dene.');
  }
  const wallId = String(req.params.id);
  if (wallId !== req.userId) {
    return res.status(403).json(fail(req, 'Duvara yalnızca sahibi yazabilir.'));
  }
  const owner = userById(db, wallId);
  const me = userById(db, req.userId);
  if (!owner || !me) return res.status(404).json(fail(req, 'Profil yok.'));
  const text = String(req.body?.text || '').trim().slice(0, 280);
  if (text.length < 2) {
    return res.status(400).json(fail(req, 'Bir cümle yaz.'));
  }
  saveWallNote(owner, me, text);
  save(db);
  emitWallToViewers(wallId);
  res.json(snapshotFor(db, req.userId));
});

app.delete('/users/:id/wall-posts/:postId', auth, (req, res) => {
  const wallId = String(req.params.id);
  const owner = userById(db, wallId);
  if (!owner) return res.status(404).json(fail(req, 'Profil yok.'));
  const post = (owner.wallPosts || []).find((p) => p.id === req.params.postId);
  if (!post) return res.status(404).json(fail(req, 'Not yok.'));
  if (post.fromId !== req.userId && wallId !== req.userId) {
    return res.status(403).json(fail(req, 'Bu notu silemezsin.'));
  }
  owner.wallPosts = (owner.wallPosts || []).filter((p) => p.id !== req.params.postId);
  save(db);
  emitWallToViewers(wallId);
  res.json(snapshotFor(db, req.userId));
});

app.post('/users/:id/follow', auth, (req, res) => {
  if (tooMany(req, 'follow', 40, 10 * 60 * 1000)) {
    return rateLimited(req, res, 'Çok hızlı takip. Biraz sonra dene.');
  }
  const otherId = String(req.params.id);
  const me = userById(db, req.userId);
  const other = userById(db, otherId);
  if (!me || !other) return res.status(404).json(fail(req, 'Profil yok.'));
  if (otherId === req.userId) {
    return res.status(400).json(fail(req, 'Kendini takip edemezsin.'));
  }
  if (blockedPair(db, req.userId, otherId)) {
    return res.status(400).json(fail(req, 'Bu kişiyle takip kapalı.'));
  }
  db.follows = db.follows || [];
  if (!followEdge(db, req.userId, otherId)) {
    db.follows.push({
      followerId: req.userId,
      followingId: otherId,
      createdAt: now(),
      notifyMarks: true,
    });
    save(db);
    emitAllRelated([req.userId, otherId]);
  }
  res.json(snapshotFor(db, req.userId));
});

app.delete('/users/:id/follow', auth, (req, res) => {
  const otherId = String(req.params.id);
  const me = userById(db, req.userId);
  if (!me) return res.status(404).json(fail(req, 'Profil yok.'));
  const before = (db.follows || []).length;
  db.follows = (db.follows || []).filter(
    (f) => !(f.followerId === req.userId && f.followingId === otherId),
  );
  if (db.follows.length !== before) {
    save(db);
    emitAllRelated([req.userId, otherId]);
  }
  res.json(snapshotFor(db, req.userId));
});

app.post('/users/:id/hello', auth, (req, res) => {
  try {
    if (tooMany(req, 'hello', 20, 10 * 60 * 1000)) {
      return rateLimited(req, res, 'Çok sık selam. Biraz sonra dene.');
    }
    const otherId = String(req.params.id);
    const me = userById(db, req.userId);
    const other = userById(db, otherId);
    if (!me || !other) return res.status(404).json(fail(req, 'Profil yok.'));
    if (otherId === req.userId) {
      return res.status(400).json(fail(req, 'Kendine selam atamazsın.'));
    }
    if (blockedPair(db, req.userId, otherId)) {
      return res.status(400).json(fail(req, 'Bu kişiyle sohbet kapalı.'));
    }
    const t = now();
    const existing = (db.chats || []).find(
      (c) =>
        (c.memberIds || []).includes(req.userId) &&
        (c.memberIds || []).includes(otherId) &&
        c.pinId === 'dm' &&
        !(c.hiddenIds || []).includes(req.userId) &&
        (!c.closesAt || c.closesAt > t),
    );
    if (existing) {
      existing.hiddenIds = (existing.hiddenIds || []).filter((id) => id !== req.userId);
      save(db);
      emitAllRelated([req.userId, otherId]);
      return res.json({ chatId: existing.id, snapshot: snapshotFor(db, req.userId) });
    }
    const chat = {
      id: uid('chat'),
      pinId: 'dm',
      memberIds: [req.userId, otherId],
      closesAt: t + 48 * 60 * 60 * 1000,
      messages: [
        {
          id: uid('msg'),
          fromId: 'system',
          text: `${me.name || 'Biri'} selam attı. Kısa yazın, yüz yüze tanışın.`,
          at: t,
        },
      ],
    };
    db.chats = db.chats || [];
    db.chats.unshift(chat);
    save(db);
    emitAllRelated([req.userId, otherId]);
    emitNotice(otherId, {
      id: uid('note'),
      type: 'message',
      title: `${me.name || 'Biri'} selam attı`,
      body: 'Sohbet açıldı.',
      chatId: chat.id,
    });
    return res.json({ chatId: chat.id, snapshot: snapshotFor(db, req.userId) });
  } catch (err) {
    console.error('hello', err);
    return res.status(500).json(fail(req, 'Selam açılamadı.'));
  }
});

app.post('/users/:id/block', auth, (req, res) => {
  const me = userById(db, req.userId);
  const otherId = String(req.params.id);
  if (!me || otherId === req.userId) {
    return res.status(400).json(fail(req, 'Engellenemedi.'));
  }
  addBlock(db, req.userId, otherId);
  dropFollowsBetween(db, req.userId, otherId);
  db.chats.forEach((c) => {
    if (c.memberIds.includes(req.userId) && c.memberIds.includes(otherId)) {
      c.closesAt = now();
    }
  });
  db.requests = (db.requests || []).filter((r) => {
    if (r.fromId === otherId) return false;
    const pin = (db.pins || []).find((p) => p.id === r.pinId);
    if (pin && pin.authorId === otherId) return false;
    return true;
  });
  save(db);
  emitAllRelated([req.userId, otherId]);
  res.json(snapshotFor(db, req.userId));
});

app.delete('/users/:id/block', auth, (req, res) => {
  const me = userById(db, req.userId);
  const otherId = String(req.params.id);
  if (!me) return res.status(404).json(fail(req, 'Profil yok.'));
  removeBlock(db, req.userId, otherId);
  save(db);
  emitAllRelated([req.userId, otherId]);
  res.json(snapshotFor(db, req.userId));
});

app.post('/users/:id/report', auth, (req, res) => {
  if (tooMany(req, 'report', 8, 60 * 60 * 1000)) {
    return rateLimited(req, res, 'Şikayet limiti doldu. Bir saat sonra dene.');
  }
  const otherId = String(req.params.id);
  const other = userById(db, otherId);
  if (!other || otherId === req.userId) {
    return res.status(404).json(fail(req, 'Profil yok.'));
  }
  const reason = String(req.body?.reason || 'other').slice(0, 80);
  db.reports = db.reports || [];
  const recent = db.reports.find(
    (r) =>
      r.fromId === req.userId &&
      r.targetId === otherId &&
      now() - r.at < 30 * 60 * 1000,
  );
  if (recent) {
    return res.status(400).json(fail(req, 'Bu kişiyi az önce şikayet ettin.'));
  }
  db.reports.unshift({
    id: uid('rep'),
    fromId: req.userId,
    reporterId: req.userId,
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
  migrateUsers(db);
  migrateBlocks(db);
  (db.users || []).forEach((u) => {
    assignUsername(db, u);
    const years = ageFromBirthDate(u.birthDate);
    if (years != null) u.age = years;
  });
  seedPlaces(db);
  save(db);
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
