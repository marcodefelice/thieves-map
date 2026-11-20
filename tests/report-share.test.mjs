import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { createReportStore } from '../lib/db.mjs';
import { parseSharedReportId, reportShareMetadata, reportZone, shareableReport } from '../lib/report-share.mjs';

const now = Date.parse('2026-11-20T12:00:00Z');
const report = { occurredAt: '2026-11-19T12:00:00Z', category: 'theft', recordKind: 'report', lat: 45.1, lng: 9.1, country: 'IT' };

test('shared IDs are canonical positive safe integers', () => {
  assert.equal(parseSharedReportId('42'), 42);
  for (const value of ['0', '01', '-1', '1x', '9007199254740992', '1e3', '']) assert.equal(parseSharedReportId(value), null);
});

test('share previews describe the actual category, date, and verification status', () => {
  const preview = reportShareMetadata(report, 'Milano');
  assert.match(preview.title, /Furto.*Milano/);
  assert.match(preview.description, /non verificata.*19 novembre 2026/);
  assert.match(reportShareMetadata({ ...report, category: 'degradation', verifiedByNickname: 'Mod' }, 'Roma').description, /verificata da un moderatore/);
  assert.equal(shareableReport(report, now), true);
  assert.equal(shareableReport({ ...report, occurredAt: '2026-01-01T00:00:00Z' }, now), false);
  assert.equal(shareableReport({ ...report, recordKind: 'official_event', occurredAt: '2023-01-01T00:00:00Z' }, now), true);
});

test('shared report lookup excludes archived records and preserves public location privacy', async () => {
  const client = createClient({ url: 'file::memory:' });
  const store = createReportStore(client);
  await store.submit({ ...report, lat: 45.123456, lng: 9.123456, createdAt: report.occurredAt, clientHash: 'x' });
  const row = (await store.list())[0];
  assert.deepEqual([row.lat, row.lng], [(await store.sharedReport(row.id)).lat, (await store.sharedReport(row.id)).lng]);
  await client.execute({ sql: "UPDATE reports SET status = 'archived' WHERE id = ?", args: [row.id] });
  assert.equal(await store.sharedReport(row.id), null);
  store.close();
});

test('zone lookup uses public coordinates and falls back without a geocoder', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => { assert.equal(url.searchParams.get('lat'), '45.1'); assert.equal(url.searchParams.get('zoom'), '10'); return { ok: true, json: async () => ({ address: { city: 'Milano', road: 'Via privata' } }) }; };
    assert.equal(await reportZone(report), 'Milano');
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal(await reportZone(report), 'Italia');
  } finally { globalThis.fetch = original; }
});
