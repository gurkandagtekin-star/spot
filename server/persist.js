const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function emptyDb() {
  return {
    users: [],
    pins: [],
    requests: [],
    chats: [],
    tokens: {},
    reports: [],
    blocks: [],
    checkins: [],
    safeShares: [],
    igTickets: {},
    follows: [],
    places: [],
  };
}

function mergeEmpty(raw) {
  return { ...emptyDb(), ...(raw && typeof raw === 'object' ? raw : {}) };
}

function atomicWrite(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  try {
    fs.renameSync(tmp, file);
  } catch {
    fs.copyFileSync(tmp, file);
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function readJsonFile() {
  try {
    return mergeEmpty(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch {
    return emptyDb();
  }
}

function filePersist(stripSeeds) {
  return {
    kind: 'file',
    async load() {
      const db = stripSeeds(readJsonFile());
      atomicWrite(DATA_FILE, JSON.stringify(db, null, 2));
      return db;
    },
    save(db) {
      atomicWrite(DATA_FILE, JSON.stringify(db, null, 2));
    },
    async flush() {},
  };
}

function useSsl(connectionString) {
  if (process.env.PGSSL === '0') return false;
  if (process.env.PGSSL === '1') return { rejectUnauthorized: false };
  return /localhost|127\.0\.0\.1/i.test(connectionString)
    ? false
    : { rejectUnauthorized: false };
}

function pgPersist(connectionString, stripSeeds) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString,
    ssl: useSsl(connectionString),
    max: 4,
  });
  let timer = null;
  let pending = null;
  let chain = Promise.resolve();

  async function ensure() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  async function writeNow(db) {
    await pool.query(
      `INSERT INTO app_state (id, payload)
       VALUES ('main', $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [JSON.stringify(db)],
    );
  }

  return {
    kind: 'postgres',
    async load() {
      await ensure();
      const { rows } = await pool.query(
        `SELECT payload FROM app_state WHERE id = 'main'`,
      );
      const payload = rows[0]?.payload;
      if (payload && typeof payload === 'object' && (payload.users || []).length) {
        return stripSeeds(mergeEmpty(payload));
      }
      if (payload && typeof payload === 'object' && Object.keys(payload).length > 2) {
        return stripSeeds(mergeEmpty(payload));
      }
      const fromFile = stripSeeds(readJsonFile());
      await writeNow(fromFile);
      return fromFile;
    },
    save(db) {
      pending = db;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const snap = pending;
        pending = null;
        if (!snap) return;
        chain = chain.then(() => writeNow(snap)).catch((err) => {
          console.error('Postgres yazılamadı:', err.message);
        });
      }, 120);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await chain;
      if (pending) {
        const snap = pending;
        pending = null;
        await writeNow(snap);
      }
    },
  };
}

function createPersist(stripSeeds) {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (/^postgres(ql)?:\/\//i.test(url)) {
    return pgPersist(url, stripSeeds);
  }
  return filePersist(stripSeeds);
}

module.exports = { createPersist, emptyDb, DATA_FILE };
