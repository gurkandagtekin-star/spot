export function parseSpotToken(url: string) {
  const raw = String(url || '');
  const query = raw.match(/[?&]spot_token=([^&]+)/);
  if (query) return decodeURIComponent(query[1]);
  const hash = raw.match(/[#&]spot_token=([^&]+)/);
  if (hash) return decodeURIComponent(hash[1]);
  return null;
}
