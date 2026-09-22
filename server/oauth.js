const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');

const { assignUsername } = require('./username');
const { fail, tError } = require('./i18n');

function htmlPage({ title, inner }) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      font-family: ui-sans-serif, system-ui, Segoe UI, sans-serif;
      background: #0A0A0A; color: #F5F5F5;
    }
    .card {
      width: 100%; max-width: 440px; background: #121212;
      border-radius: 28px; padding: 28px 24px 24px; margin: 16px;
      border: 1px solid #2A2A2A;
    }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { color: rgba(255,255,255,0.62); line-height: 1.5; margin: 0 0 14px; font-size: 14px; }
    code, .uri {
      display: block; background: #1A1A1A; border: 1px solid #2A2A2A; border-radius: 12px;
      padding: 10px 12px; font-size: 12px; word-break: break-all; margin: 8px 0 16px;
    }
    .brand { font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #FF5E97; margin-bottom: 10px; }
    ol { color: #F5F5F5; padding-left: 18px; margin: 0 0 8px; }
    li { margin-bottom: 8px; line-height: 1.4; font-size: 14px; }
    label { display: block; font-weight: 700; font-size: 13px; margin: 10px 0 6px; }
    input {
      width: 100%; padding: 11px 12px; border-radius: 12px; border: 1px solid #E8DCCE;
      font-size: 14px; background: #fff;
    }
    button.primary {
      width: 100%; margin-top: 8px; background: #C13584; color: #fff; border: 0;
      border-radius: 14px; padding: 14px; font-weight: 800; cursor: pointer; font-size: 15px;
    }
  </style>
</head>
<body><div class="card">${inner}</div></body>
</html>`;
}

function sanitizeRedirect(redirect) {
  const raw = String(redirect || 'http://localhost:8081').trim();
  if (/^(markdate|exp|exp\+[\w.-]+):/i.test(raw)) return raw.replace(/'/g, '');
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return raw.replace(/'/g, '');
    }
  } catch {
    /* ignore */
  }
  return 'http://localhost:8081';
}

function isNativeAppRedirect(redirect) {
  return /^(markdate|exp|exp\+[\w.-]+):/i.test(String(redirect || ''));
}

function finishRedirect(token, redirect) {
  const safeRedirect = sanitizeRedirect(redirect);
  const sep = safeRedirect.includes('?') ? '&' : '?';
  const dest = `${safeRedirect}${sep}spot_token=${encodeURIComponent(token)}`;
  const native = isNativeAppRedirect(safeRedirect);
  const href = dest.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mark Date</title></head>
<body style="font-family:sans-serif;background:#0A0A0A;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
<div style="text-align:center;padding:24px;max-width:360px;">
<p style="font-weight:800;color:#1F1A17;">Giriş tamam.</p>
<p style="color:#7A7168;font-size:14px;line-height:1.45;">Uygulama kendiliğinden açılmazsa aşağıdaki bağlantıya bas.</p>
<p><a href="${href}" style="display:inline-block;background:#E35D4A;color:#fff;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:999px;">Uygulamaya dön</a></p>
</div>
<script>
  var token = ${JSON.stringify(token)};
  var dest = ${JSON.stringify(dest)};
  var native = ${native ? 'true' : 'false'};
  var payload = { type: 'SPOT_AUTH', token: token };
  if (!native && window.opener) {
    window.opener.postMessage(payload, '*');
    window.close();
  } else {
    location.replace(dest);
  }
</script>
</body></html>`;
}

function googleReady() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function instagramReady() {
  return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
}

function facebookReady() {
  return Boolean(
    (process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID) &&
      (process.env.FACEBOOK_APP_SECRET || process.env.INSTAGRAM_APP_SECRET),
  );
}

function igBindReady() {
  return instagramReady() || facebookReady();
}

function metaAppId() {
  return process.env.FACEBOOK_APP_ID || process.env.INSTAGRAM_APP_ID || '';
}

function metaAppSecret() {
  return process.env.FACEBOOK_APP_SECRET || process.env.INSTAGRAM_APP_SECRET || '';
}

function instagramAppId() {
  return process.env.INSTAGRAM_APP_ID || process.env.FACEBOOK_APP_ID || '';
}

function instagramAppSecret() {
  return process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
}

function publicBase(req) {
  const host = String(req.get?.('host') || req.headers.host || '')
    .split(',')[0]
    .trim();
  const loopback = (value) => {
    try {
      const u = new URL(value.includes('://') ? value : `http://${value}`);
      return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    } catch {
      return /localhost|127\.0\.0\.1/i.test(String(value || ''));
    }
  };
  if (host && !loopback(host)) {
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
      .split(',')[0]
      .trim();
    return `${proto}://${host}`;
  }
  const env = String(process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
  if (env && !loopback(env)) return env;
  if (host) {
    const proto = String(req.protocol || 'http').split(',')[0].trim();
    return `${proto}://${host}`;
  }
  return env || 'http://127.0.0.1:3001';
}

function callbackUrl(req, path) {
  return `${publicBase(req)}${path}`;
}

function googleRedirectForClient(req) {
  const fromClient = String(req.query.redirect_uri || req.query.redirect || '').trim();
  if (/^markdate:/i.test(fromClient)) return fromClient;
  try {
    const u = new URL(fromClient);
    if (u.protocol === 'https:' && /auth\.expo\.io$/i.test(u.hostname)) {
      return fromClient.replace(/\/$/, '');
    }
  } catch {
    /* sunucu callback */
  }
  return callbackUrl(req, '/auth/google/callback');
}

function issueToken(db, save, userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.tokens[token] = userId;
  save(db);
  return token;
}

function tokenForUser(db, save, userId) {
  const hit = Object.entries(db.tokens || {}).find(([, id]) => id === userId);
  if (hit) return hit[0];
  return issueToken(db, save, userId);
}

function pruneIgTickets(db) {
  const t = Date.now();
  db.igTickets = db.igTickets || {};
  for (const [k, v] of Object.entries(db.igTickets)) {
    if (!v || t - v.at > 15 * 60 * 1000) delete db.igTickets[k];
  }
}

function finishBindScript(token, redirect) {
  const safeRedirect = String(redirect || 'http://localhost:8081').replace(/'/g, '');
  const sep = safeRedirect.includes('?') ? '&' : '?';
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Mark Date</title></head>
<body style="font-family:sans-serif;background:#0A0A0A;display:flex;align-items:center;justify-content:center;height:100vh;">
<p>Instagram bağlandı. Bu pencere kapanabilir.</p>
<script>
  var token = ${JSON.stringify(token)};
  var payload = { type: 'SPOT_AUTH', token: token, bound: 'instagram' };
  if (window.opener) {
    window.opener.postMessage(payload, '*');
    window.close();
  } else {
    location.replace(${JSON.stringify(safeRedirect)} + ${JSON.stringify(sep)} + 'spot_token=' + encodeURIComponent(token));
  }
</script>
</body></html>`;
}

async function exchangeInstagramCode(code, redirectUri) {
  const payload = {
    client_id: instagramAppId(),
    client_secret: instagramAppSecret(),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  };
  const urls = [
    'https://api.instagram.com/oauth/access_token',
    'https://graph.instagram.com/oauth/access_token',
  ];
  let lastErr = 'Instagram token alınamadı.';
  for (const url of urls) {
    const tokenRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    const access =
      tokenJson.access_token || tokenJson.data?.[0]?.access_token;
    const igUserId = tokenJson.user_id || tokenJson.data?.[0]?.user_id;
    if (tokenRes.ok && access) return { access, igUserId, raw: tokenJson };
    lastErr =
      tokenJson.error_message ||
      tokenJson.error?.message ||
      lastErr;
  }
  throw new Error(lastErr);
}

async function fetchInstagramProfile(access, igUserId) {
  const urls = [
    `https://graph.instagram.com/me?fields=id,user_id,username,name,account_type&access_token=${encodeURIComponent(access)}`,
    `https://graph.instagram.com/v21.0/me?fields=id,user_id,username,name,account_type&access_token=${encodeURIComponent(access)}`,
  ];
  for (const url of urls) {
    const meRes = await fetch(url);
    const ig = await meRes.json().catch(() => ({}));
    if (meRes.ok && (ig.username || ig.id || ig.user_id)) {
      ig.id = String(ig.user_id || ig.id || igUserId || '');
      ig.username = String(ig.username || '').replace(/^@/, '');
      return ig;
    }
  }
  throw new Error('Instagram profili okunamadı. Tekrar dene.');
}

async function exchangeFacebookCode(code, redirectUri) {
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  url.searchParams.set('client_id', metaAppId());
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('client_secret', metaAppSecret());
  url.searchParams.set('code', code);
  const tokenRes = await fetch(url);
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error?.message || 'Facebook token alınamadı.');
  }
  return tokenJson.access_token;
}

async function fetchInstagramViaFacebook(access) {
  const token = encodeURIComponent(access);
  const urls = [
    `https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account{id,username,name}&access_token=${token}`,
    `https://graph.facebook.com/v21.0/me?fields=name,instagram_business_account{id,username,name},accounts{name,instagram_business_account{id,username,name}}&access_token=${token}`,
  ];
  const found = [];
  const push = (ig) => {
    if (ig?.id) found.push(ig);
  };
  let lastErr = '';
  for (const url of urls) {
    const json = await fetch(url).then((r) => r.json()).catch(() => ({}));
    if (json.error) {
      lastErr = json.error.message || lastErr;
      continue;
    }
    push(json.instagram_business_account);
    for (const page of json.data || json.accounts?.data || []) {
      push(page.instagram_business_account);
    }
  }
  const ig = found[0];
  if (!ig) {
    throw new Error(lastErr || 'Instagram hesabı Facebook üzerinden gelmedi.');
  }
  if (!ig.username && ig.id) {
    const extra = await fetch(
      `https://graph.facebook.com/v21.0/${ig.id}?fields=username,name&access_token=${token}`,
    ).then((r) => r.json());
    if (extra.username) ig.username = extra.username;
    if (extra.name) ig.name = extra.name;
  }
  return {
    id: String(ig.id),
    username: String(ig.username || '').replace(/^@/, ''),
    name: ig.name,
  };
}

function encodeState(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function facebookLoginUrl(cb, stateObj) {
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', metaAppId());
  url.searchParams.set('redirect_uri', cb);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('display', 'popup');
  url.searchParams.set(
    'scope',
    'public_profile,email,instagram_basic,pages_show_list,pages_read_engagement',
  );
  url.searchParams.set(
    'extras',
    JSON.stringify({ setup: { channel: 'IG_API_ONBOARDING' } }),
  );
  url.searchParams.set('state', encodeState({ ...stateObj, via: 'facebook' }));
  return url.toString();
}

function instagramLoginUrl(cb, stateObj) {
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', instagramAppId());
  url.searchParams.set('redirect_uri', cb);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'instagram_business_basic');
  url.searchParams.set('enable_fb_login', '0');
  url.searchParams.set('state', encodeState({ ...stateObj, via: 'instagram' }));
  return url.toString();
}

function isPrivateHostname(hostname) {
  const h = String(hostname || '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  if (!h || h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') {
    return false;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

function needsGoogleDeviceParams(redirectUri) {
  try {
    const u = new URL(redirectUri);
    if (u.protocol === 'exp:' || u.protocol === 'exps:') return true;
    return isPrivateHostname(u.hostname);
  } catch {
    return false;
  }
}

function googleDeviceParams(redirectUri, req) {
  const deviceId = String(req?.query?.device_id || req?.body?.device_id || '').trim();
  const deviceName = String(req?.query?.device_name || req?.body?.device_name || '').trim();
  if (!needsGoogleDeviceParams(redirectUri) && !deviceId) return null;
  return {
    device_id:
      deviceId ||
      crypto.createHash('sha256').update(`markdate:${redirectUri}`).digest('hex').slice(0, 32),
    device_name: (deviceName || 'Mark Date').slice(0, 64),
  };
}

function applyGoogleDeviceParams(url, redirectUri, req) {
  const extras = googleDeviceParams(redirectUri, req);
  if (!extras) return;
  url.searchParams.set('device_id', extras.device_id);
  url.searchParams.set('device_name', extras.device_name);
}

function parseState(raw) {
  try {
    return JSON.parse(Buffer.from(String(raw || ''), 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

function isLoopback(req) {
  const host = String(req.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

function upsertEnv(pairs) {
  const envPath = path.join(__dirname, '..', '.env');
  let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  for (const [key, value] of Object.entries(pairs)) {
    if (!value) continue;
    process.env[key] = value;
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(text)) text = text.replace(re, line);
    else text = `${text.replace(/\s*$/, '')}\n${line}\n`;
  }
  fs.writeFileSync(envPath, text);
}

function setupPage(kind, callback, extra = {}) {
  if (kind === 'google') {
    return htmlPage({
      title: 'Google kurulumu · Mark Date',
      inner: `
        <div class="brand">Mark Date</div>
        <h1>Google ile kayıt henüz açık değil</h1>
        <p>Kimse e-posta veya Instagram adı yazarak giremez. Hesap, Google’ın doğruladığı kimlikten oluşur.</p>
        <ol>
          <li>Google Cloud’da bir OAuth 2.0 Client ID oluştur (Web uygulaması).</li>
          <li>Yetkili yönlendirme URI’sine şunu ekle:</li>
        </ol>
        <div class="uri">${callback}</div>
        <p>Proje köküne <code>.env</code> koy:</p>
        <div class="uri">GOOGLE_CLIENT_ID=...\nGOOGLE_CLIENT_SECRET=...\nAPI_PUBLIC_URL=${callback.replace('/auth/google/callback', '')}</div>
        <p>API’yi yeniden başlat, sonra “Google ile kaydol / giriş”e bas.</p>`,
    });
  }
  const ticket = String(extra.ticket || '');
  const redirect = String(extra.redirect || 'http://localhost:8081');
  return htmlPage({
    title: 'Instagram kurulumu · Mark Date',
    inner: `
      <div class="brand">Mark Date</div>
      <h1>Instagram’ı bağla</h1>
      <p>Kullanıcı adı yazılmaz. Consumer Facebook uygulamasının App ID / Secret’i yeter. Token saklamayız, yalnızca doğrulanmış @ad kalır.</p>
      <ol>
        <li>developers.facebook.com → Tüketici uygulaması → Ayarlar → Temel: App ID ve App Secret.</li>
        <li>Facebook Login → Valid OAuth Redirect URI:</li>
      </ol>
      <div class="uri">${callback}</div>
      <p>Kişisel hesap da bağlanır: Instagram’da ücretsiz İçerik üretici (creator) yeter, @adın aynı kalır. Facebook Login onboarding’i de bunu açar.</p>
      <form method="post" action="/auth/instagram/configure">
        <input type="hidden" name="ticket" value="${ticket}" />
        <input type="hidden" name="redirect" value="${redirect.replace(/"/g, '')}" />
        <label>Facebook App ID</label>
        <input name="facebook_app_id" autocomplete="off" required />
        <label>App Secret</label>
        <input name="facebook_app_secret" type="password" autocomplete="off" required />
        <button class="primary" type="submit">Kaydet, Instagram’a bağla</button>
      </form>
      <p>Bu form yalnızca bu bilgisayardan (localhost) çalışır. HTTPS gerekirse <code>API_PUBLIC_URL</code>’i tunnel adresine çevir.</p>`,
  });
}

function failPage(message, extra = {}) {
  const retry = extra.retry
    ? `<p><a href="${extra.retry}" style="color:#C13584;font-weight:800">Instagram ile dene</a></p>`
    : '';
  return htmlPage({
    title: 'Giriş olmadı · Mark Date',
    inner: `<div class="brand">Mark Date</div><h1>Giriş tamamlanamadı</h1><p>${message}</p>${retry}`,
  });
}

function upsertGoogleUser(db, uid, profile) {
  const googleId = String(profile.sub);
  let user = db.users.find((u) => u.googleId === googleId);
  if (!user && profile.email) {
    user = db.users.find(
      (u) => u.email && u.email.toLowerCase() === profile.email.toLowerCase(),
    );
  }
  if (!user) {
    user = {
      id: uid('usr'),
      name: profile.name || profile.email || 'Google kullanıcısı',
      firstName: '',
      lastName: '',
      age: 0,
      birthDate: '',
      gender: '',
      email: profile.email || '',
      googleId,
      photoUrl: profile.picture || '',
      bio: 'Yüz yüze tanışmayı seviyorum.',
      interests: [],
      onboarded: false,
      badges: [],
    };
    assignUsername(db, user);
    db.users.push(user);
    return { user, created: true };
  }
  user.googleId = googleId;
  user.email = profile.email || user.email;
  if (profile.name && !user.firstName) user.name = profile.name;
  if (profile.picture) user.photoUrl = profile.picture;
  assignUsername(db, user);
  return { user, created: false };
}

async function googleProfileFromIdToken(idToken) {
  const meRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  const profile = await meRes.json();
  if (!meRes.ok || !profile.sub) {
    throw new Error('Google profili okunamadı.');
  }
  const aud = String(profile.aud || '');
  const allowed = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (!allowed.length || !allowed.includes(aud)) {
    throw new Error('Google istemcisi eşleşmedi.');
  }
  return profile;
}

async function exchangeGoogleCode(code, redirectUri, codeVerifier) {
  const body = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  };
  if (codeVerifier) body.code_verifier = codeVerifier;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !(tokenJson.access_token || tokenJson.id_token)) {
    throw new Error(tokenJson.error_description || 'Google token alınamadı.');
  }
  if (tokenJson.id_token) {
    try {
      return await googleProfileFromIdToken(tokenJson.id_token);
    } catch {
      /* userinfo */
    }
  }
  if (!tokenJson.access_token) {
    throw new Error('Google token alınamadı.');
  }
  const meRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profile = await meRes.json();
  if (!meRes.ok || !profile.sub) {
    throw new Error('Google profili okunamadı.');
  }
  return profile;
}

function attachInstagram(db, user, ig) {
  const instagramId = String(ig.id);
  const handle = String(ig.username || '')
    .replace(/^@/, '')
    .trim()
    .toLowerCase();
  const taken = db.users.find(
    (u) =>
      u.id !== user.id &&
      ((u.instagramId && u.instagramId === instagramId) ||
        (handle && u.instagram === handle && u.instagramId)),
  );
  if (taken) {
    throw new Error('Bu Instagram hesabı başka bir Mark Date hesabına bağlı.');
  }
  user.instagramId = instagramId;
  user.instagram = handle;
  if (ig.name && !user.googleId) user.name = ig.name;
}

function mountOAuth(app, { db, save, uid }) {
  async function finishGoogleNative(req, res) {
    const idToken = String(req.body?.idToken || req.body?.id_token || '').trim();
    const code = String(req.body?.code || '').trim();
    const redirectUri = String(req.body?.redirectUri || req.body?.redirect_uri || '').trim();
    const codeVerifier = String(req.body?.codeVerifier || req.body?.code_verifier || '').trim();
    if (idToken) {
      if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(400).json(fail(req, 'Google ayarlı değil.'));
      }
    } else if (!googleReady()) {
      return res.status(400).json(fail(req, 'Google ayarlı değil.'));
    }
    try {
      let profile;
      if (idToken) {
        profile = await googleProfileFromIdToken(idToken);
      } else if (code && redirectUri) {
        profile = await exchangeGoogleCode(code, redirectUri, codeVerifier);
      } else {
        return res.status(400).json(fail(req, 'Google onayı alınamadı.'));
      }
      const { user } = upsertGoogleUser(db, uid, profile);
      res.json({ token: issueToken(db, save, user.id) });
    } catch (err) {
      res.status(400).json({
        error: tError(req, err instanceof Error ? err.message : 'Google girişi başarısız.'),
      });
    }
  }

  app.get('/auth/providers', (_req, res) => {
    res.json({
      google: googleReady(),
      googleClientId: googleReady() ? String(process.env.GOOGLE_CLIENT_ID || '') : '',
      instagram: false,
    });
  });

  app.post('/auth/instagram/ticket', (_req, res) => {
    res.status(410).json(fail(req, 'Instagram bağlantısı kaldırıldı.'));
  });

  app.post('/auth/instagram/configure', (_req, res) => {
    res.status(410).json(fail(req, 'Instagram bağlantısı kaldırıldı.'));
  });

  app.get('/auth/google/start', (req, res) => {
    const redirect = String(
      req.query.redirect || req.query.redirect_uri || 'http://localhost:8081',
    );
    const cb = googleRedirectForClient(req);
    if (!googleReady()) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(setupPage('google', callbackUrl(req, '/auth/google/callback')));
    }
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', cb);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('prompt', 'select_account');
    url.searchParams.set(
      'state',
      Buffer.from(JSON.stringify({ redirect })).toString('base64url'),
    );
    res.redirect(url.toString());
  });

  app.get('/auth/google/callback', async (req, res) => {
    const state = parseState(req.query.state);
    const redirect = state.redirect || 'http://localhost:8081';
    const code = String(req.query.code || '');
    if (!code || !googleReady()) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(400).send(failPage('Google onayı alınamadı.'));
    }
    try {
      const cb = callbackUrl(req, '/auth/google/callback');
      const profile = await exchangeGoogleCode(code, cb);
      const { user } = upsertGoogleUser(db, uid, profile);
      const token = issueToken(db, save, user.id);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(finishRedirect(token, redirect));
    } catch (err) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res
        .status(400)
        .send(failPage(err instanceof Error ? err.message : 'Google girişi başarısız.'));
    }
  });

  app.post('/auth/google', finishGoogleNative);
  app.post('/auth/google/native', finishGoogleNative);

  app.get('/auth/instagram/start', (_req, res) => {
    res.status(410).json(fail(req, 'Instagram bağlantısı kaldırıldı.'));
  });

  app.get('/auth/instagram/callback', (_req, res) => {
    res.status(410).json(fail(req, 'Instagram bağlantısı kaldırıldı.'));
  });
}

module.exports = { mountOAuth, issueToken, googleReady, instagramReady, facebookReady };
