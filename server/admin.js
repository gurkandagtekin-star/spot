function adminOk(req) {
  const key = process.env.ADMIN_KEY;
  if (!key) return false;
  const got =
    String(req.query.key || '') ||
    String(req.headers['x-admin-key'] || '');
  return got === key;
}

function mountAdmin(app, { db, save }) {
  app.get('/admin/reports', (req, res) => {
    if (!adminOk(req)) return res.status(404).json({ error: 'Yok.' });
    const rows = (db.reports || []).slice(0, 120);
    if (String(req.query.format) === 'json') {
      return res.json({ reports: rows });
    }
    const items = rows
      .map((r) => {
        const from = db.users.find((u) => u.id === r.fromId);
        const target = db.users.find((u) => u.id === r.targetId);
        return `<tr>
          <td>${esc(r.id)}</td>
          <td>${esc(from?.name || r.fromId)}</td>
          <td>${esc(target?.name || r.targetId)}</td>
          <td>${esc(r.reason)}</td>
          <td>${new Date(r.at).toLocaleString('tr-TR')}</td>
          <td>${esc(r.status || 'open')}</td>
          <td>
            <form method="post" action="/admin/reports/${encodeURIComponent(r.id)}?key=${encodeURIComponent(req.query.key)}">
              <input type="hidden" name="status" value="closed" />
              <button type="submit">Kapat</button>
            </form>
          </td>
        </tr>`;
      })
      .join('');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Şikayetler · Mark Date</title>
      <style>
        body { font-family: ui-sans-serif, system-ui, sans-serif; background:#F6F0E6; color:#1F1A17; margin:24px; }
        table { width:100%; border-collapse: collapse; background:#FFFCF7; }
        th, td { border:1px solid #E8DCCE; padding:8px 10px; text-align:left; font-size:13px; }
        th { background:#FBF6EE; }
        button { background:#E35D4A; color:#fff; border:0; border-radius:8px; padding:6px 10px; font-weight:800; cursor:pointer; }
      </style></head><body>
      <h1>Şikayet kuyruğu</h1>
      <p>${rows.length} kayıt. Kapalıları da görürsün; Kapat durumu günceller.</p>
      <table><thead><tr><th>id</th><th>Kim</th><th>Kime</th><th>Neden</th><th>Tarih</th><th>Durum</th><th></th></tr></thead>
      <tbody>${items || '<tr><td colspan="7">Boş.</td></tr>'}</tbody></table>
      </body></html>`);
  });

  app.post('/admin/reports/:id', (req, res) => {
    if (!adminOk(req)) return res.status(404).json({ error: 'Yok.' });
    const report = (db.reports || []).find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Kayıt yok.' });
    const status = String(req.body?.status || req.query.status || 'closed');
    report.status = status === 'open' ? 'open' : 'closed';
    save(db);
    if (String(req.headers.accept || '').includes('json')) {
      return res.json({ ok: true, report });
    }
    res.redirect(`/admin/reports?key=${encodeURIComponent(req.query.key || '')}`);
  });
}

function esc(v) {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

module.exports = { mountAdmin };
