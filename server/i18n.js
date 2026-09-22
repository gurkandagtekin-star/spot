const EN = require('../shared/error-en.json');

function langOf(req) {
  const raw = String(
    (req && (req.headers?.['accept-language'] || req.query?.lang)) || '',
  ).toLowerCase();
  return raw.startsWith('tr') ? 'tr' : 'en';
}

function tError(req, tr) {
  const text = String(tr || '');
  if (!text) return text;
  if (langOf(req) === 'tr') return text;
  return EN[text] || text;
}

function fail(req, tr) {
  return { error: tError(req, tr) };
}

module.exports = { langOf, tError, fail, EN };
