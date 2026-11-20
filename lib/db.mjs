import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { approximateLocation, normalizeAdministrativeArea } from './location.mjs';
import { countryForLocation } from './countries.mjs';

const schema = [
  "CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, lat REAL NOT NULL, lng REAL NOT NULL, occurred_at TEXT NOT NULL, created_at TEXT NOT NULL, client_hash TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'theft', notes TEXT NOT NULL DEFAULT '', location_precision TEXT NOT NULL DEFAULT 'approximate', indirect INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT '', record_kind TEXT NOT NULL DEFAULT 'report', official_key TEXT NOT NULL DEFAULT '', moderator_id INTEGER, status TEXT NOT NULL DEFAULT 'active', country TEXT NOT NULL DEFAULT 'ZZ', municipality TEXT NOT NULL DEFAULT '', province TEXT NOT NULL DEFAULT '', verified_by_name TEXT NOT NULL DEFAULT '', verified_by_moderator_id INTEGER, verified_at TEXT)",
  'CREATE INDEX IF NOT EXISTS reports_created ON reports(created_at)',
  'CREATE INDEX IF NOT EXISTS reports_client ON reports(client_hash, created_at)',
  'CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, radius REAL NOT NULL, language TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS report_confirmations (report_id INTEGER NOT NULL, client_hash TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (report_id, client_hash))',
  'CREATE INDEX IF NOT EXISTS confirmations_client ON report_confirmations(client_hash, created_at)',
  "CREATE TABLE IF NOT EXISTS moderator_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT NOT NULL COLLATE NOCASE UNIQUE, email TEXT NOT NULL COLLATE NOCASE UNIQUE, area TEXT NOT NULL, address TEXT NOT NULL, country TEXT NOT NULL DEFAULT 'IT', scope_type TEXT NOT NULL DEFAULT 'municipality', scope_value TEXT NOT NULL DEFAULT '', note TEXT NOT NULL, applicant_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', password_hash TEXT, activation_token_hash TEXT, activation_expires_at TEXT, created_at TEXT NOT NULL, approved_at TEXT, suspended_at TEXT)",
  'CREATE INDEX IF NOT EXISTS moderator_applications_status ON moderator_applications(country, status, created_at)',
  'CREATE INDEX IF NOT EXISTS moderator_applications_client ON moderator_applications(applicant_hash, created_at)',
  'CREATE TABLE IF NOT EXISTS moderator_sessions (session_hash TEXT PRIMARY KEY, moderator_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS moderator_sessions_moderator ON moderator_sessions(moderator_id, expires_at)',
  'CREATE TABLE IF NOT EXISTS moderator_login_attempts (client_hash TEXT NOT NULL, identity_hash TEXT NOT NULL, created_at TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS moderator_login_attempts_limit ON moderator_login_attempts(client_hash, identity_hash, created_at)',
  "CREATE TABLE IF NOT EXISTS moderation_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, moderator_id INTEGER, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, details TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)",
  'CREATE INDEX IF NOT EXISTS moderation_audit_target ON moderation_audit(target_type, target_id, created_at)',
  "CREATE TABLE IF NOT EXISTS rss_drafts (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL UNIQUE, title TEXT NOT NULL, published_at TEXT, occurred_at TEXT, category TEXT NOT NULL, notes TEXT NOT NULL, location_label TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, country TEXT NOT NULL, municipality TEXT NOT NULL, province TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft_rss', report_id INTEGER)",
  "CREATE TABLE IF NOT EXISTS rss_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, attempted_at TEXT NOT NULL)",
  'CREATE INDEX IF NOT EXISTS rss_attempts_time ON rss_attempts(attempted_at)',
  'CREATE INDEX IF NOT EXISTS rss_attempts_source ON rss_attempts(source, attempted_at)',
  "CREATE TABLE IF NOT EXISTS rss_job_lock (name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at TEXT NOT NULL)",
  'CREATE INDEX IF NOT EXISTS rss_drafts_scope ON rss_drafts(status, country, province, municipality, created_at)',
  'CREATE TABLE IF NOT EXISTS report_addresses (report_id INTEGER PRIMARY KEY, address TEXT NOT NULL, created_at TEXT NOT NULL)',
];

// Check limits and insert in one SQL statement, so concurrent requests cannot
// both pass a separate check before writing.
const insertSql = `INSERT INTO reports (lat, lng, occurred_at, created_at, client_hash, category, notes, location_precision, indirect, country)
  SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  WHERE (SELECT count(*) FROM reports WHERE client_hash = ? AND created_at > ?) < 1`;

export function createReportStore(client) {
  let ready;
  async function initialize() {
    if (!ready) ready = (async () => {
      for (const sql of schema) await client.execute({ sql, args: [] });
      const columns = await client.execute({ sql: 'PRAGMA table_info(reports)', args: [] });
      let reportCountryAdded = false;
      for (const [name, definition] of [['category', "TEXT NOT NULL DEFAULT 'theft'"], ['notes', "TEXT NOT NULL DEFAULT ''"], ['location_precision', "TEXT NOT NULL DEFAULT 'approximate'"], ['indirect', 'INTEGER NOT NULL DEFAULT 0'], ['source', "TEXT NOT NULL DEFAULT ''"], ['record_kind', "TEXT NOT NULL DEFAULT 'report'"], ['official_key', "TEXT NOT NULL DEFAULT ''"], ['moderator_id', 'INTEGER'], ['status', "TEXT NOT NULL DEFAULT 'active'"], ['country', "TEXT NOT NULL DEFAULT 'ZZ'"], ['municipality', "TEXT NOT NULL DEFAULT ''"], ['province', "TEXT NOT NULL DEFAULT ''"], ['verified_by_name', "TEXT NOT NULL DEFAULT ''"], ['verified_by_moderator_id', 'INTEGER'], ['verified_at', 'TEXT']]) {
        if (!columns.rows.some(column => column.name === name)) {
          try { await client.execute({ sql: `ALTER TABLE reports ADD COLUMN ${name} ${definition}`, args: [] }); }
          catch (error) { if (!/duplicate column name/i.test(String(error.message))) throw error; }
          if (name === 'country') reportCountryAdded = true;
        }
      }
      if (reportCountryAdded) {
        const existingReports = await client.execute({ sql: "SELECT id, lat, lng FROM reports WHERE country = 'ZZ'", args: [] });
        for (const row of existingReports.rows) await client.execute({ sql: 'UPDATE reports SET country = ? WHERE id = ?', args: [countryForLocation(row) || 'UN', row.id] });
      }
      await client.execute({ sql: "CREATE UNIQUE INDEX IF NOT EXISTS reports_official_key ON reports(official_key) WHERE official_key <> ''", args: [] });
      const applicationColumns = await client.execute({ sql: 'PRAGMA table_info(moderator_applications)', args: [] });
      for (const [name, definition] of [['address', "TEXT NOT NULL DEFAULT ''"], ['country', "TEXT NOT NULL DEFAULT 'IT'"], ['scope_type', "TEXT NOT NULL DEFAULT 'municipality'"], ['scope_value', "TEXT NOT NULL DEFAULT ''"]]) {
        if (!applicationColumns.rows.some(column => column.name === name)) {
          try { await client.execute({ sql: `ALTER TABLE moderator_applications ADD COLUMN ${name} ${definition}`, args: [] }); }
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
      const result = await client.execute({ sql: `SELECT r.id, r.lat, r.lng, r.occurred_at as occurredAt, r.category, r.notes, r.location_precision as locationPrecision, r.indirect, r.source, r.record_kind AS recordKind, r.verified_by_name AS verifiedByNickname, r.verified_at AS verifiedAt, m.nickname AS moderatorNickname, (SELECT COUNT(*) FROM report_confirmations c WHERE c.report_id = r.id AND c.kind = 'confirm') AS confirmations, (SELECT COUNT(*) FROM report_confirmations c WHERE c.report_id = r.id AND c.kind = 'dispute') AS disputes, CASE WHEN r.client_hash = ? THEN 1 ELSE 0 END AS sameNetwork, EXISTS(SELECT 1 FROM report_confirmations c WHERE c.report_id = r.id AND c.client_hash = ?) AS alreadyConfirmed FROM reports r LEFT JOIN moderator_applications m ON m.id = r.moderator_id WHERE r.status = 'active' ORDER BY r.occurred_at DESC`, args: [viewerHash, viewerHash] });
      // Older records may still contain precise coordinates in the database.
      return result.rows.map(row => { const exact = ['degradation', 'crime'].includes(row.category) && row.locationPrecision === 'exact'; const location = exact ? { lat: row.lat, lng: row.lng } : approximateLocation(row); return { ...row, locationPrecision: exact ? 'exact' : 'approximate', ...location, country: countryForLocation(location) }; });
    },
    async submit({ lat, lng, occurredAt, createdAt, clientHash, country, category = 'theft', notes = '', indirect = false }) {
      await initialize();
      const exact = ['degradation', 'crime'].includes(category);
      const location = exact ? { lat, lng } : approximateLocation({ lat, lng });
      const args = [location.lat, location.lng, occurredAt, createdAt, clientHash, category, notes.trim(), exact ? 'exact' : 'approximate', indirect ? 1 : 0, country || countryForLocation(location) || 'UN', clientHash, new Date(Date.parse(createdAt) - 900_000).toISOString()];
      const result = await client.execute({ sql: insertSql, args });
      return result.rowsAffected === 1;
    },
    async submitModerated({ lat, lng, occurredAt, createdAt, moderatorId, country, municipality = '', province = '', category = 'theft', notes = '', indirect = false, source = '', recordKind = 'report', verifiedByNickname = '' }) {
      await initialize();
      const exact = ['degradation', 'crime'].includes(category);
      const location = exact ? { lat, lng } : approximateLocation({ lat, lng });
      const result = await client.execute({ sql: `INSERT INTO reports (lat, lng, occurred_at, created_at, client_hash, category, notes, location_precision, indirect, source, record_kind, moderator_id, status, country, municipality, province, verified_by_name, verified_by_moderator_id, verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?) RETURNING id`, args: [location.lat, location.lng, occurredAt, createdAt, `moderator:${moderatorId}`, category, notes.trim(), exact ? 'exact' : 'approximate', indirect ? 1 : 0, source.trim(), recordKind, moderatorId, country || countryForLocation(location) || 'UN', normalizeAdministrativeArea(municipality), normalizeAdministrativeArea(province), verifiedByNickname, verifiedByNickname ? moderatorId : null, verifiedByNickname ? createdAt : null] });
      const id = Number(result.rows[0]?.id);
      if (!Number.isSafeInteger(id)) throw new Error('Could not create moderated report.');
      await client.execute({ sql: "INSERT INTO moderation_audit (moderator_id, action, target_type, target_id, details, created_at) VALUES (?, 'report_created', 'report', ?, ?, ?)", args: [moderatorId, id, recordKind === 'official_event' ? 'official_event' : '', createdAt] });
      if (verifiedByNickname) await client.execute({ sql: "INSERT INTO moderation_audit (moderator_id, action, target_type, target_id, details, created_at) VALUES (?, 'report_verified', 'report', ?, ?, ?)", args: [moderatorId, id, verifiedByNickname, createdAt] });
      return id;
    },
    async submitAdminReport({ lat, lng, occurredAt, createdAt, country, municipality = '', province = '', category = 'theft', notes = '', indirect = false, source = '', nickname = 'Punto Sicuro', recordKind = 'report' }) {
      await initialize();
      const exact = ['degradation', 'crime'].includes(category);
      const location = exact ? { lat, lng } : approximateLocation({ lat, lng });
      const result = await client.execute({ sql: `INSERT INTO reports (lat, lng, occurred_at, created_at, client_hash, category, notes, location_precision, indirect, source, record_kind, status, country, municipality, province, verified_by_name, verified_at)
        VALUES (?, ?, ?, ?, 'admin', ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?) RETURNING id`, args: [location.lat, location.lng, occurredAt, createdAt, category, notes.trim(), exact ? 'exact' : 'approximate', indirect ? 1 : 0, source.trim(), recordKind, country || countryForLocation(location) || 'UN', normalizeAdministrativeArea(municipality), normalizeAdministrativeArea(province), nickname, createdAt] });
      const id = Number(result.rows[0]?.id);
      if (!Number.isSafeInteger(id)) throw new Error('Could not create admin report.');
      await client.execute({ sql: "INSERT INTO moderation_audit (action, target_type, target_id, details, created_at) VALUES ('report_created', 'report', ?, ?, ?)", args: [id, recordKind === 'official_event' ? 'admin:official_event' : 'admin', createdAt] });
      await client.execute({ sql: "INSERT INTO moderation_audit (action, target_type, target_id, details, created_at) VALUES ('report_verified', 'report', ?, ?, ?)", args: [id, nickname, createdAt] });
      return id;
    },
    async importOfficialArea({ key, lat, lng, occurredAt, createdAt, country, municipality = '', province = '', notes, source, nickname = 'Punto Sicuro' }) {
      await initialize();
      const result = await client.execute({ sql: `INSERT INTO reports (lat, lng, occurred_at, created_at, client_hash, category, notes, location_precision, indirect, source, official_key, status, country, municipality, province, verified_by_name, verified_at)
        SELECT ?, ?, ?, ?, 'admin', 'degradation', ?, 'exact', 0, ?, ?, 'active', ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM reports WHERE official_key = ?)
        RETURNING id`, args: [lat, lng, occurredAt, createdAt, notes.trim(), source.trim(), key, country || countryForLocation({ lat, lng }) || 'UN', normalizeAdministrativeArea(municipality), normalizeAdministrativeArea(province), nickname, createdAt, key] });
      const id = Number(result.rows[0]?.id);
      if (!Number.isSafeInteger(id)) return { imported: false, id: null };
      await client.execute({ sql: "INSERT INTO moderation_audit (action, target_type, target_id, details, created_at) VALUES ('report_created', 'report', ?, 'official_import', ?)", args: [id, createdAt] });
      await client.execute({ sql: "INSERT INTO moderation_audit (action, target_type, target_id, details, created_at) VALUES ('report_verified', 'report', ?, ?, ?)", args: [id, nickname, createdAt] });
      return { imported: true, id };
    },
    async acquireRssLock({ owner, now, expiresAt }) {
      await initialize();
      const result = await client.execute({ sql: `INSERT INTO rss_job_lock (name, owner, expires_at) VALUES ('fetch', ?, ?)
        ON CONFLICT(name) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at WHERE rss_job_lock.expires_at <= ?`, args: [owner, expiresAt, now] });
      if (result.rowsAffected === 1) await client.execute({ sql: 'DELETE FROM rss_attempts WHERE attempted_at <= ?', args: [new Date(Date.parse(now) - 30 * 86400_000).toISOString()] });
      return result.rowsAffected === 1;
    },
    async releaseRssLock(owner) {
      await initialize();
      await client.execute({ sql: "DELETE FROM rss_job_lock WHERE name = 'fetch' AND owner = ?", args: [owner] });
    },
    async canAttemptRssSource({ source, now }) {
      await initialize();
      const ago = ms => new Date(Date.parse(now) - ms).toISOString();
      const row = (await client.execute({ sql: `SELECT NOT EXISTS (SELECT 1 FROM rss_drafts WHERE source = ?)
        AND (SELECT COUNT(*) FROM rss_attempts WHERE source = ? AND attempted_at > ?) < 2
        AND NOT EXISTS (SELECT 1 FROM rss_attempts WHERE source = ? AND attempted_at > ?) AS eligible`,
        args: [source, source, ago(30 * 86400_000), source, ago(24 * 3600_000)] })).rows[0];
      return Boolean(row?.eligible);
    },
    async reserveRssAttempt({ source, now }) {
      await initialize();
      const ago = ms => new Date(Date.parse(now) - ms).toISOString();
      // Reserve before each outbound request; failures and timeouts count too.
      const result = await client.execute({ sql: `INSERT INTO rss_attempts (source, attempted_at)
        SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM rss_drafts WHERE source = ?)
        AND (SELECT COUNT(*) FROM rss_attempts WHERE attempted_at > ?) < 40
        AND (SELECT COUNT(*) FROM rss_attempts WHERE attempted_at > ?) < 15
        AND (SELECT COUNT(*) FROM rss_attempts WHERE source = ? AND attempted_at > ?) < 2
        AND NOT EXISTS (SELECT 1 FROM rss_attempts WHERE source = ? AND attempted_at > ?)`,
        args: [source, now, source, ago(24 * 3600_000), ago(60_000), source, ago(30 * 86400_000), source, ago(24 * 3600_000)] });
      return result.rowsAffected === 1;
    },
    async hasRssSource(source) {
      await initialize();
      return Boolean((await client.execute({ sql: 'SELECT 1 FROM rss_drafts WHERE source = ?', args: [source] })).rows.length);
    },
    async addRssDraft(draft) {
      await initialize();
      const result = await client.execute({ sql: `INSERT INTO rss_drafts (source, title, published_at, occurred_at, category, notes, location_label, lat, lng, country, municipality, province, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source) DO NOTHING`, args: [draft.source, draft.title, draft.publishedAt || null, draft.occurredAt || null, draft.category, draft.notes, draft.locationLabel, draft.lat, draft.lng, draft.country, normalizeAdministrativeArea(draft.municipality), normalizeAdministrativeArea(draft.province), draft.createdAt] });
      return result.rowsAffected === 1;
    },
    async listRssDrafts({ country, scopeType = null, scopeValue = null, page = 1, pageSize = 25 }) {
      await initialize();
      const column = scopeType === 'province' ? 'province' : scopeType === 'municipality' ? 'municipality' : null;
      const where = `status = 'draft_rss' AND country = ?${column ? ` AND ${column} = ?` : ''}`;
      const args = column ? [country, scopeValue] : [country];
      const [count, rows] = await Promise.all([
        client.execute({ sql: `SELECT count(*) AS total FROM rss_drafts WHERE ${where}`, args }),
        client.execute({ sql: `SELECT id, source, title, published_at AS publishedAt, occurred_at AS occurredAt, category, notes, location_label AS locationLabel, lat, lng, municipality, province FROM rss_drafts WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, args: [...args, pageSize, (page - 1) * pageSize] }),
      ]);
      return { drafts: rows.rows, total: Number(count.rows[0].total), page, pageSize };
    },
    async resolveRssDraft({ id, country, scopeType = null, scopeValue = null, moderatorId = null, nickname, createdAt, action, report }) {
      await initialize();
      const column = scopeType === 'province' ? 'province' : scopeType === 'municipality' ? 'municipality' : null;
      const tx = await client.transaction('write');
      try {
        const result = await tx.execute({ sql: `UPDATE rss_drafts SET status = ? WHERE id = ? AND status = 'draft_rss' AND country = ?${column ? ` AND ${column} = ?` : ''} RETURNING source`, args: [action === 'approve' ? 'published' : 'rejected', id, country, ...(column ? [scopeValue] : [])] });
        if (!result.rows.length) { await tx.rollback(); return false; }
        if (action === 'approve') {
          const exact = ['crime', 'degradation'].includes(report.category);
          const location = exact ? report : approximateLocation(report);
          const inserted = await tx.execute({ sql: `INSERT INTO reports (lat, lng, occurred_at, created_at, client_hash, category, notes, location_precision, indirect, source, moderator_id, status, country, municipality, province, verified_by_name, verified_by_moderator_id, verified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'active', ?, ?, ?, ?, ?, ?) RETURNING id`, args: [location.lat, location.lng, report.occurredAt, createdAt, moderatorId ? `moderator:${moderatorId}` : 'admin', report.category, report.notes.trim(), exact ? 'exact' : 'approximate', result.rows[0].source, moderatorId, country, normalizeAdministrativeArea(report.municipality), normalizeAdministrativeArea(report.province), nickname, moderatorId, createdAt] });
          const reportId = Number(inserted.rows[0].id);
          await tx.execute({ sql: 'UPDATE rss_drafts SET report_id = ? WHERE id = ?', args: [reportId, id] });
          await tx.execute({ sql: "INSERT INTO moderation_audit (moderator_id, action, target_type, target_id, details, created_at) VALUES (?, 'report_created', 'report', ?, 'rss', ?)", args: [moderatorId, reportId, createdAt] });
        }
        await tx.execute({ sql: "INSERT INTO moderation_audit (moderator_id, action, target_type, target_id, details, created_at) VALUES (?, ?, 'rss_draft', ?, ?, ?)", args: [moderatorId, action === 'approve' ? 'rss_approved' : 'rss_rejected', id, nickname, createdAt] });
        await tx.commit();
        return true;
      } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
    },
    async archiveReport({ reportId, moderatorId, country, scopeType, scopeValue, createdAt }) {
      await initialize();
      const column = scopeType === 'province' ? 'province' : 'municipality';
      const result = await client.execute({ sql: `UPDATE reports SET status = 'archived' WHERE id = ? AND country = ? AND ${column} = ? AND status = 'active'`, args: [reportId, country, scopeValue] });
      if (result.rowsAffected !== 1) return false;
      await client.execute({ sql: "INSERT INTO moderation_audit (moderator_id, action, target_type, target_id, created_at) VALUES (?, 'report_archived', 'report', ?, ?)", args: [moderatorId, reportId, createdAt] });
      return true;
    },
    async archiveReportAsAdmin({ reportId, country, createdAt }) {
      await initialize();
      const result = await client.execute({ sql: "UPDATE reports SET status = 'archived' WHERE id = ? AND country = ? AND status = 'active'", args: [reportId, country] });
      if (result.rowsAffected !== 1) return false;
      await client.execute({ sql: "INSERT INTO moderation_audit (action, target_type, target_id, details, created_at) VALUES ('report_archived', 'report', ?, 'admin', ?)", args: [reportId, createdAt] });
      return true;
    },
    async verifyReport({ reportId, moderatorId, nickname, country, scopeType, scopeValue, createdAt }) {
      await initialize();
      const column = scopeType === 'province' ? 'province' : 'municipality';
      const result = await client.execute({ sql: `UPDATE reports SET verified_by_name = ?, verified_by_moderator_id = ?, verified_at = ?
        WHERE id = ? AND country = ? AND ${column} = ? AND status = 'active' AND verified_at IS NULL
        AND (moderator_id IS NULL OR moderator_id <> ?)`, args: [nickname, moderatorId, createdAt, reportId, country, scopeValue, moderatorId] });
      if (result.rowsAffected !== 1) return false;
      await client.execute({ sql: "INSERT INTO moderation_audit (moderator_id, action, target_type, target_id, details, created_at) VALUES (?, 'report_verified', 'report', ?, ?, ?)", args: [moderatorId, reportId, nickname, createdAt] });
      return true;
    },
    async verifyReportAsAdmin({ reportId, country, nickname, createdAt }) {
      await initialize();
      const result = await client.execute({ sql: "UPDATE reports SET verified_by_name = ?, verified_by_moderator_id = NULL, verified_at = ? WHERE id = ? AND country = ? AND status = 'active' AND verified_at IS NULL", args: [nickname, createdAt, reportId, country] });
      if (result.rowsAffected !== 1) return false;
      await client.execute({ sql: "INSERT INTO moderation_audit (action, target_type, target_id, details, created_at) VALUES ('report_verified', 'report', ?, ?, ?)", args: [reportId, nickname, createdAt] });
      return true;
    },
    async listReportsForModeration({ country, page = 1, pageSize = 25, scopeType = null, scopeValue = null }) {
      await initialize();
      const offset = (page - 1) * pageSize;
      const column = scopeType === 'province' ? 'province' : scopeType === 'municipality' ? 'municipality' : null;
      const where = column ? `r.country = ? AND r.${column} = ?` : 'r.country = ?';
      const args = column ? [country, scopeValue] : [country];
      const [count, rows] = await Promise.all([
        client.execute({ sql: `SELECT count(*) AS total FROM reports r WHERE ${where}`, args }),
        client.execute({ sql: `SELECT r.id, r.lat, r.lng, r.occurred_at AS occurredAt, r.category, r.notes, r.source, r.record_kind AS recordKind, r.status, r.country, r.moderator_id AS moderatorId, r.verified_by_name AS verifiedByNickname, r.verified_at AS verifiedAt, r.location_precision AS locationPrecision,
          m.nickname AS moderatorNickname FROM reports r LEFT JOIN moderator_applications m ON m.id = r.moderator_id WHERE ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, args: [...args, pageSize, offset] }),
      ]);
      return { reports: rows.rows, total: Number(count.rows[0]?.total || 0), page, pageSize };
    },
    async reportAddress({ reportId, country }) {
      await initialize();
      const report = (await client.execute({ sql: 'SELECT id, lat, lng, location_precision AS locationPrecision FROM reports WHERE id = ? AND country = ?', args: [reportId, country] })).rows[0] || null;
      if (!report) return null;
      const cached = (await client.execute({ sql: 'SELECT address FROM report_addresses WHERE report_id = ?', args: [reportId] })).rows[0];
      return cached ? { ...report, address: cached.address, cached: true } : report;
    },
    async saveReportAddress({ reportId, address, createdAt }) {
      await initialize();
      await client.execute({ sql: 'INSERT INTO report_addresses (report_id, address, created_at) VALUES (?, ?, ?) ON CONFLICT(report_id) DO UPDATE SET address = excluded.address, created_at = excluded.created_at', args: [reportId, address, createdAt] });
    },
    async saveReportAdministrativeArea({ reportId, municipality, province }) {
      await initialize();
      await client.execute({ sql: 'UPDATE reports SET municipality = ?, province = ? WHERE id = ?', args: [normalizeAdministrativeArea(municipality), normalizeAdministrativeArea(province), reportId] });
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
    async createModeratorApplication({ nickname, email, area, address, country, scopeType, note, applicantHash, createdAt }) {
      await initialize();
      const result = await client.execute({ sql: `INSERT INTO moderator_applications (nickname, email, area, address, country, scope_type, scope_value, note, applicant_hash, created_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM moderator_applications WHERE applicant_hash = ? AND created_at > ?) < 3`, args: [nickname.trim(), email.trim().toLowerCase(), area.trim(), address.trim(), country, scopeType, normalizeAdministrativeArea(area), note.trim(), applicantHash, createdAt, applicantHash, new Date(Date.parse(createdAt) - 24 * 3600_000).toISOString()] });
      return result.rowsAffected === 1;
    },
    async listModeratorApplications({ country }) {
      await initialize();
      return (await client.execute({ sql: 'SELECT id, nickname, email, area, address, country, scope_type AS scopeType, scope_value AS scopeValue, note, status, created_at AS createdAt, approved_at AS approvedAt, suspended_at AS suspendedAt FROM moderator_applications WHERE country = ? ORDER BY CASE status WHEN \'pending\' THEN 0 WHEN \'moderator\' THEN 1 ELSE 2 END, created_at DESC', args: [country] })).rows;
    },
    async beginModeratorApproval({ id, country, tokenHash, expiresAt }) {
      await initialize();
      const result = await client.execute({ sql: "UPDATE moderator_applications SET activation_token_hash = ?, activation_expires_at = ? WHERE id = ? AND country = ? AND status = 'pending'", args: [tokenHash, expiresAt, id, country] });
      if (result.rowsAffected !== 1) return null;
      return (await client.execute({ sql: 'SELECT email, nickname FROM moderator_applications WHERE id = ?', args: [id] })).rows[0] || null;
    },
    async approveModerator({ id, country, tokenHash, createdAt }) {
      await initialize();
      const result = await client.execute({ sql: "UPDATE moderator_applications SET status = 'moderator', approved_at = ? WHERE id = ? AND country = ? AND status = 'pending' AND activation_token_hash = ?", args: [createdAt, id, country, tokenHash] });
      if (result.rowsAffected !== 1) return false;
      await client.execute({ sql: "INSERT INTO moderation_audit (action, target_type, target_id, details, created_at) VALUES ('moderator_approved', 'moderator', ?, 'admin', ?)", args: [id, createdAt] });
      return true;
    },
    async suspendModerator({ id, country, createdAt }) {
      await initialize();
      const result = await client.execute({ sql: "UPDATE moderator_applications SET status = 'suspended', suspended_at = ?, activation_token_hash = NULL, activation_expires_at = NULL WHERE id = ? AND country = ? AND status = 'moderator'", args: [createdAt, id, country] });
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
      return (await client.execute({ sql: `SELECT m.id, m.nickname, m.area, m.country, m.scope_type AS scopeType, m.scope_value AS scopeValue FROM moderator_sessions s JOIN moderator_applications m ON m.id = s.moderator_id
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
