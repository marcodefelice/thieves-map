import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { approximateLocation } from './location.mjs';
import { countryForLocation } from './countries.mjs';

const schema = [
  "CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, lat REAL NOT NULL, lng REAL NOT NULL, occurred_at TEXT NOT NULL, created_at TEXT NOT NULL, client_hash TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'theft', notes TEXT NOT NULL DEFAULT '', location_precision TEXT NOT NULL DEFAULT 'approximate', indirect INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT '', moderator_id INTEGER, status TEXT NOT NULL DEFAULT 'active')",
  'CREATE INDEX IF NOT EXISTS reports_created ON reports(created_at)',
  'CREATE INDEX IF NOT EXISTS reports_client ON reports(client_hash, created_at)',
  'CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, radius REAL NOT NULL, language TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS report_confirmations (report_id INTEGER NOT NULL, client_hash TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (report_id, client_hash))',
  'CREATE INDEX IF NOT EXISTS confirmations_client ON report_confirmations(client_hash, created_at)',
  "CREATE TABLE IF NOT EXISTS moderator_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT NOT NULL COLLATE NOCASE UNIQUE, email TEXT NOT NULL COLLATE NOCASE UNIQUE, area TEXT NOT NULL, note TEXT NOT NULL, applicant_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', password_hash TEXT, activation_token_hash TEXT, activation_expires_at TEXT, created_at TEXT NOT NULL, approved_at TEXT, suspended_at TEXT)",
  'CREATE INDEX IF NOT EXISTS moderator_applications_status ON moderator_applications(status, created_at)',
  'CREATE INDEX IF NOT EXISTS moderator_applications_client ON moderator_applications(applicant_hash, created_at)',
  'CREATE TABLE IF NOT EXISTS moderator_sessions (session_hash TEXT PRIMARY KEY, moderator_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS moderator_sessions_moderator ON moderator_sessions(moderator_id, expires_at)',
  'CREATE TABLE IF NOT EXISTS moderator_login_attempts (client_hash TEXT NOT NULL, identity_hash TEXT NOT NULL, created_at TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS moderator_login_attempts_limit ON moderator_login_attempts(client_hash, identity_hash, created_at)',
  "CREATE TABLE IF NOT EXISTS moderation_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, moderator_id INTEGER, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, details TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)",
  'CREATE INDEX IF NOT EXISTS moderation_audit_target ON moderation_audit(target_type, target_id, created_at)',
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
      for (const [name, definition] of [['category', "TEXT NOT NULL DEFAULT 'theft'"], ['notes', "TEXT NOT NULL DEFAULT ''"], ['location_precision', "TEXT NOT NULL DEFAULT 'approximate'"], ['indirect', 'INTEGER NOT NULL DEFAULT 0'], ['source', "TEXT NOT NULL DEFAULT ''"], ['moderator_id', 'INTEGER'], ['status', "TEXT NOT NULL DEFAULT 'active'"]]) {
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
      const result = await client.execute({ sql: `SELECT r.id, r.lat, r.lng, r.occurred_at as occurredAt, r.category, r.notes, r.location_precision as locationPrecision, r.indirect, r.source, m.nickname AS moderatorNickname, (SELECT COUNT(*) FROM report_confirmations c WHERE c.report_id = r.id AND c.kind = 'confirm') AS confirmations, (SELECT COUNT(*) FROM report_confirmations c WHERE c.report_id = r.id AND c.kind = 'dispute') AS disputes, CASE WHEN r.client_hash = ? THEN 1 ELSE 0 END AS sameNetwork, EXISTS(SELECT 1 FROM report_confirmations c WHERE c.report_id = r.id AND c.client_hash = ?) AS alreadyConfirmed FROM reports r LEFT JOIN moderator_applications m ON m.id = r.moderator_id WHERE r.status = 'active' ORDER BY r.occurred_at DESC`, args: [viewerHash, viewerHash] });
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
    async submitModerated({ lat, lng, occurredAt, createdAt, moderatorId, category = 'theft', notes = '', indirect = false, source }) {
      await initialize();
      const exact = ['degradation', 'crime'].includes(category);
      const location = exact ? { lat, lng } : approximateLocation({ lat, lng });
      const result = await client.execute({ sql: `INSERT INTO reports (lat, lng, occurred_at, created_at, client_hash, category, notes, location_precision, indirect, source, moderator_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active') RETURNING id`, args: [location.lat, location.lng, occurredAt, createdAt, `moderator:${moderatorId}`, category, notes.trim(), exact ? 'exact' : 'approximate', indirect ? 1 : 0, source.trim(), moderatorId] });
      const id = Number(result.rows[0]?.id);
      if (!Number.isSafeInteger(id)) throw new Error('Could not create moderated report.');
      await client.execute({ sql: "INSERT INTO moderation_audit (moderator_id, action, target_type, target_id, created_at) VALUES (?, 'report_created', 'report', ?, ?)", args: [moderatorId, id, createdAt] });
      return id;
    },
    async archiveReport({ reportId, moderatorId, createdAt }) {
      await initialize();
      const result = await client.execute({ sql: "UPDATE reports SET status = 'archived' WHERE id = ? AND status = 'active'", args: [reportId] });
      if (result.rowsAffected !== 1) return false;
      await client.execute({ sql: "INSERT INTO moderation_audit (moderator_id, action, target_type, target_id, created_at) VALUES (?, 'report_archived', 'report', ?, ?)", args: [moderatorId, reportId, createdAt] });
      return true;
    },
    async archiveReportAsAdmin({ reportId, createdAt }) {
      await initialize();
      const result = await client.execute({ sql: "UPDATE reports SET status = 'archived' WHERE id = ? AND status = 'active'", args: [reportId] });
      if (result.rowsAffected !== 1) return false;
      await client.execute({ sql: "INSERT INTO moderation_audit (action, target_type, target_id, details, created_at) VALUES ('report_archived', 'report', ?, 'admin', ?)", args: [reportId, createdAt] });
      return true;
    },
    async listReportsForModeration() {
      await initialize();
      return (await client.execute({ sql: `SELECT r.id, r.lat, r.lng, r.occurred_at AS occurredAt, r.category, r.notes, r.source, r.status,
        m.nickname AS moderatorNickname FROM reports r LEFT JOIN moderator_applications m ON m.id = r.moderator_id ORDER BY r.created_at DESC`, args: [] })).rows;
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
    async createModeratorApplication({ nickname, email, area, note, applicantHash, createdAt }) {
      await initialize();
      const result = await client.execute({ sql: `INSERT INTO moderator_applications (nickname, email, area, note, applicant_hash, created_at)
        SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM moderator_applications WHERE applicant_hash = ? AND created_at > ?) < 3`, args: [nickname.trim(), email.trim().toLowerCase(), area.trim(), note.trim(), applicantHash, createdAt, applicantHash, new Date(Date.parse(createdAt) - 24 * 3600_000).toISOString()] });
      return result.rowsAffected === 1;
    },
    async listModeratorApplications() {
      await initialize();
      return (await client.execute({ sql: 'SELECT id, nickname, email, area, note, status, created_at AS createdAt, approved_at AS approvedAt, suspended_at AS suspendedAt FROM moderator_applications ORDER BY CASE status WHEN \'pending\' THEN 0 WHEN \'moderator\' THEN 1 ELSE 2 END, created_at DESC', args: [] })).rows;
    },
    async beginModeratorApproval({ id, tokenHash, expiresAt }) {
      await initialize();
      const result = await client.execute({ sql: "UPDATE moderator_applications SET activation_token_hash = ?, activation_expires_at = ? WHERE id = ? AND status = 'pending'", args: [tokenHash, expiresAt, id] });
      if (result.rowsAffected !== 1) return null;
      return (await client.execute({ sql: 'SELECT email, nickname FROM moderator_applications WHERE id = ?', args: [id] })).rows[0] || null;
    },
    async approveModerator({ id, tokenHash, createdAt }) {
      await initialize();
      const result = await client.execute({ sql: "UPDATE moderator_applications SET status = 'moderator', approved_at = ? WHERE id = ? AND status = 'pending' AND activation_token_hash = ?", args: [createdAt, id, tokenHash] });
      if (result.rowsAffected !== 1) return false;
      await client.execute({ sql: "INSERT INTO moderation_audit (action, target_type, target_id, details, created_at) VALUES ('moderator_approved', 'moderator', ?, 'admin', ?)", args: [id, createdAt] });
      return true;
    },
    async suspendModerator({ id, createdAt }) {
      await initialize();
      const result = await client.execute({ sql: "UPDATE moderator_applications SET status = 'suspended', suspended_at = ?, activation_token_hash = NULL, activation_expires_at = NULL WHERE id = ? AND status = 'moderator'", args: [createdAt, id] });
      if (result.rowsAffected !== 1) return false;
      await client.execute({ sql: 'DELETE FROM moderator_sessions WHERE moderator_id = ?', args: [id] });
      await client.execute({ sql: "INSERT INTO moderation_audit (action, target_type, target_id, details, created_at) VALUES ('moderator_suspended', 'moderator', ?, 'admin', ?)", args: [id, createdAt] });
      return true;
    },
    async activateModerator({ tokenHash, passwordHash, now }) {
      await initialize();
      const result = await client.execute({ sql: `UPDATE moderator_applications SET password_hash = ?, activation_token_hash = NULL, activation_expires_at = NULL
        WHERE activation_token_hash = ? AND status = 'moderator' AND activation_expires_at > ? AND password_hash IS NULL`, args: [passwordHash, tokenHash, now] });
      return result.rowsAffected === 1;
    },
    async moderatorForLogin({ email, now }) {
      await initialize();
      return (await client.execute({ sql: "SELECT id, nickname, password_hash AS passwordHash FROM moderator_applications WHERE email = ? AND status = 'moderator' AND password_hash IS NOT NULL", args: [email.trim().toLowerCase()] })).rows[0] || null;
    },
    async createModeratorSession({ sessionHash, moderatorId, expiresAt, createdAt }) {
      await initialize();
      await client.execute({ sql: 'DELETE FROM moderator_sessions WHERE expires_at <= ?', args: [createdAt] });
      await client.execute({ sql: 'INSERT INTO moderator_sessions (session_hash, moderator_id, expires_at, created_at) VALUES (?, ?, ?, ?)', args: [sessionHash, moderatorId, expiresAt, createdAt] });
    },
    async moderatorForSession({ sessionHash, now }) {
      await initialize();
      return (await client.execute({ sql: `SELECT m.id, m.nickname, m.area FROM moderator_sessions s JOIN moderator_applications m ON m.id = s.moderator_id
        WHERE s.session_hash = ? AND s.expires_at > ? AND m.status = 'moderator'`, args: [sessionHash, now] })).rows[0] || null;
    },
    async deleteModeratorSession(sessionHash) {
      await initialize();
      await client.execute({ sql: 'DELETE FROM moderator_sessions WHERE session_hash = ?', args: [sessionHash] });
    },
    async recordModeratorLoginAttempt({ clientHash, identityHash, createdAt }) {
      await initialize();
      const windowStart = new Date(Date.parse(createdAt) - 15 * 60_000).toISOString();
      const result = await client.execute({ sql: `INSERT INTO moderator_login_attempts (client_hash, identity_hash, created_at)
        SELECT ?, ?, ? WHERE (SELECT count(*) FROM moderator_login_attempts WHERE client_hash = ? AND identity_hash = ? AND created_at > ?) < 8
        AND (SELECT count(*) FROM moderator_login_attempts WHERE client_hash = ? AND created_at > ?) < 30`, args: [clientHash, identityHash, createdAt, clientHash, identityHash, windowStart, clientHash, windowStart] });
      return result.rowsAffected === 1;
    },
    async clearModeratorLoginAttempts({ clientHash, identityHash }) {
      await initialize();
      await client.execute({ sql: 'DELETE FROM moderator_login_attempts WHERE client_hash = ? AND identity_hash = ?', args: [clientHash, identityHash] });
    },
    async listModerationAudit({ targetType, targetId }) {
      await initialize();
      return (await client.execute({ sql: 'SELECT action, moderator_id AS moderatorId, details, created_at AS createdAt FROM moderation_audit WHERE target_type = ? AND target_id = ? ORDER BY created_at DESC', args: [targetType, targetId] })).rows;
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
