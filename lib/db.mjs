import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { approximateLocation } from './location.mjs';
import { countryForLocation } from './countries.mjs';

const schema = [
  'CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, lat REAL NOT NULL, lng REAL NOT NULL, occurred_at TEXT NOT NULL, created_at TEXT NOT NULL, client_hash TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS reports_created ON reports(created_at)',
  'CREATE INDEX IF NOT EXISTS reports_client ON reports(client_hash, created_at)',
  'CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, radius REAL NOT NULL, language TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS report_confirmations (report_id INTEGER NOT NULL, client_hash TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (report_id, client_hash))',
  'CREATE INDEX IF NOT EXISTS confirmations_client ON report_confirmations(client_hash, created_at)',
];

// Check limits and insert in one SQL statement, so concurrent requests cannot
// both pass a separate check before writing.
const insertSql = `INSERT INTO reports (lat, lng, occurred_at, created_at, client_hash, category, notes, location_precision, indirect)
  SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
  WHERE (SELECT count(*) FROM reports WHERE client_hash = ? AND created_at > ?) < 1`;

export function createReportStore(client) {
  let ready;
  async function initialize() {
    if (!ready) ready = (async () => {
      for (const sql of schema) await client.execute({ sql, args: [] });
      const columns = await client.execute({ sql: 'PRAGMA table_info(reports)', args: [] });
      for (const [name, definition] of [['category', "TEXT NOT NULL DEFAULT 'theft'"], ['notes', "TEXT NOT NULL DEFAULT ''"], ['location_precision', "TEXT NOT NULL DEFAULT 'approximate'"], ['indirect', 'INTEGER NOT NULL DEFAULT 0']]) {
        if (!columns.rows.some(column => column.name === name)) {
          try { await client.execute({ sql: `ALTER TABLE reports ADD COLUMN ${name} ${definition}`, args: [] }); }
          catch (error) { if (!/duplicate column name/i.test(String(error.message))) throw error; }
        }
      }
      const voteColumns = await client.execute({ sql: 'PRAGMA table_info(report_confirmations)', args: [] });
      if (!voteColumns.rows.some(column => column.name === 'kind')) {
        try { await client.execute({ sql: "ALTER TABLE report_confirmations ADD COLUMN kind TEXT NOT NULL DEFAULT 'confirm'", args: [] }); }
        catch (error) { if (!/duplicate column name/i.test(String(error.message))) throw error; }
      }
    })().catch(error => { ready = undefined; throw error; });
    return ready;
  }
  return {
    async list(viewerHash = null) {
      await initialize();
      const result = await client.execute({ sql: `SELECT r.id, r.lat, r.lng, r.occurred_at as occurredAt, r.category, r.notes, r.location_precision as locationPrecision, r.indirect, (SELECT COUNT(*) FROM report_confirmations c WHERE c.report_id = r.id AND c.kind = 'confirm') AS confirmations, (SELECT COUNT(*) FROM report_confirmations c WHERE c.report_id = r.id AND c.kind = 'dispute') AS disputes, CASE WHEN r.client_hash = ? THEN 1 ELSE 0 END AS sameNetwork, EXISTS(SELECT 1 FROM report_confirmations c WHERE c.report_id = r.id AND c.client_hash = ?) AS alreadyConfirmed FROM reports r ORDER BY r.occurred_at DESC`, args: [viewerHash, viewerHash] });
      // Older records may still contain precise coordinates in the database.
      return result.rows.map(row => { const exact = ['degradation', 'crime'].includes(row.category) && row.locationPrecision === 'exact'; const location = exact ? { lat: row.lat, lng: row.lng } : approximateLocation(row); return { ...row, locationPrecision: exact ? 'exact' : 'approximate', ...location, country: countryForLocation(location) }; });
    },
    async submit({ lat, lng, occurredAt, createdAt, clientHash, category = 'theft', notes = '', indirect = false }) {
      await initialize();
      const exact = ['degradation', 'crime'].includes(category);
      const location = exact ? { lat, lng } : approximateLocation({ lat, lng });
      const args = [location.lat, location.lng, occurredAt, createdAt, clientHash, category, notes.trim(), exact ? 'exact' : 'approximate', indirect ? 1 : 0, clientHash, new Date(Date.parse(createdAt) - 900_000).toISOString()];
      const result = await client.execute({ sql: insertSql, args });
      return result.rowsAffected === 1;
    },
    async confirm({ reportId, clientHash, createdAt, kind = 'confirm' }) {
      await initialize();
      if (!['confirm', 'dispute'].includes(kind)) return false;
      const result = await client.execute({ sql: `INSERT INTO report_confirmations (report_id, client_hash, created_at, kind)
        SELECT id, ?, ?, ? FROM reports WHERE id = ? AND client_hash <> ?
        AND (SELECT count(*) FROM report_confirmations WHERE client_hash = ? AND created_at > ?) < 30
        ON CONFLICT(report_id, client_hash) DO NOTHING`, args: [clientHash, createdAt, kind, reportId, clientHash, clientHash, new Date(Date.parse(createdAt) - 3600_000).toISOString()] });
      return result.rowsAffected === 1;
    },
    async saveSubscription({ endpoint, keys, lat, lng, radius, language }) {
      await initialize();
      await client.execute({ sql: 'INSERT INTO push_subscriptions (endpoint, p256dh, auth, lat, lng, radius, language) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth, lat=excluded.lat, lng=excluded.lng, radius=excluded.radius, language=excluded.language', args: [endpoint, keys.p256dh, keys.auth, lat, lng, radius, language] });
    },
    async deleteSubscription(endpoint) {
      await initialize();
      await client.execute({ sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?', args: [endpoint] });
    },
    async listSubscriptions() {
      await initialize();
      return (await client.execute({ sql: 'SELECT endpoint, p256dh, auth, lat, lng, radius, language FROM push_subscriptions', args: [] })).rows;
    },
    close() { client.close(); },
  };
}

function makeStore() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (url || authToken) {
    if (!url || !authToken) throw new Error('Set both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to use Turso.');
    if (!/^libsql:\/\//.test(url) && !/^https:\/\//.test(url)) throw new Error('TURSO_DATABASE_URL must start with libsql:// or https://.');
    return createReportStore(createClient({ url, authToken }));
  }
  if (process.env.VERCEL) throw new Error('Turso credentials are required on Vercel; local SQLite is not persistent there.');
  const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  mkdirSync(dir, { recursive: true });
  return createReportStore(createClient({ url: pathToFileURL(path.join(dir, 'reports.sqlite')).href }));
}

export function getReportStore() {
  if (!globalThis.__reportStore) globalThis.__reportStore = makeStore();
  return globalThis.__reportStore;
}
