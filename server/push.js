const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function expoTokens(user) {
  return (user?.expoPushTokens || []).filter((t) =>
    String(t).startsWith('ExponentPushToken['),
  );
}

async function sendExpoPush(tokens, notice) {
  const unique = [...new Set(tokens)].slice(0, 8);
  if (!unique.length) return;
  const messages = unique.map((to) => ({
    to,
    title: notice.title,
    body: notice.body,
    sound: 'default',
    channelId: 'mark-date',
    data: {
      type: notice.type || '',
      chatId: notice.chatId || '',
      pinId: notice.pinId || '',
    },
  }));
  const headers = {
    Accept: 'application/json',
    'Accept-encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Expo push:', res.status, text.slice(0, 200));
    }
  } catch (err) {
    console.error('Expo push:', err instanceof Error ? err.message : err);
  }
}

function rememberToken(user, token) {
  const t = String(token || '').trim();
  if (!t.startsWith('ExponentPushToken[')) return false;
  user.expoPushTokens = Array.from(
    new Set([...(user.expoPushTokens || []), t]),
  ).slice(-5);
  return true;
}

function forgetToken(user, token) {
  const t = String(token || '').trim();
  user.expoPushTokens = (user.expoPushTokens || []).filter((x) => x !== t);
}

module.exports = { expoTokens, sendExpoPush, rememberToken, forgetToken };
