import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';
import { createReportStore, getReportStore } from '../lib/db.mjs';

const dir = mkdtempSync(path.join(tmpdir(), 'thieves-store-'));
process.env.DATA_DIR = dir;
const now = '2026-11-18T12:00:00.000Z';
for (const [name, makeStore] of [
  ['local SQLite', () => getReportStore()],
  ['libSQL client', () => createReportStore(createClient({ url: pathToFileURL(path.join(dir, 'libsql.sqlite')).href }))],
]) {
  test(`${name}: allows reports of the same event and enforces the IP limit`, async () => {
    const store = makeStore();
    const report = { lat: 41, lng: 12, occurredAt: now, createdAt: now, clientHash: 'client' };
    assert.equal(await store.submit(report), true);
    assert.equal(await store.submit({ ...report, clientHash: 'another-client' }), true);
    for (let i = 0; i < 4; i++) assert.equal(await store.submit(report), true);
    assert.equal(await store.submit({ ...report, lat: 42 }), false);
    assert.equal((await store.list()).length, 6);
    store.close();
  });
}
test.after(() => rmSync(dir, { recursive: true, force: true }));
test('upgrades existing reports without losing data and saves category and notes', async () => {
  const client = createClient({ url: 'file::memory:' });
  await client.execute("CREATE TABLE reports (id INTEGER PRIMARY KEY AUTOINCREMENT, lat REAL NOT NULL, lng REAL NOT NULL, occurred_at TEXT NOT NULL, created_at TEXT NOT NULL, client_hash TEXT NOT NULL)");
  await client.execute({sql:'INSERT INTO reports (lat,lng,occurred_at,created_at,client_hash) VALUES (?,?,?,?,?)',args:[41.9,12.5,now,now,'old']});
  const store=createReportStore(client);
  assert.equal((await store.list())[0].category,'theft');
  assert.equal((await store.list())[0].country,'IT');
  assert.equal(await store.submit({lat:42,lng:12,occurredAt:now,createdAt:now,clientHash:'new',category:'antisocial',notes:' Observation '}),true);
  const rows=await store.list();
  assert.equal(rows.find(row=>row.category==='antisocial').notes,'Observation');
  assert.equal(rows.length,2);
  store.close();
});
test('community confirmations are unique per network and cannot confirm the author', async () => {
  const store = createReportStore(createClient({ url: 'file::memory:' }));
  const report = { lat: 45.6889287, lng: 8.7212361, occurredAt: now, createdAt: now, clientHash: 'author' };
  await store.submit(report);
  const [row] = await store.list();
  assert.notEqual(row.lat, report.lat);
  assert.notEqual(row.lng, report.lng);
  assert.equal(await store.confirm({ reportId: row.id, clientHash: 'author', createdAt: now }), false);
  assert.equal(await store.confirm({ reportId: row.id, clientHash: 'other', createdAt: now }), true);
  assert.equal(await store.confirm({ reportId: row.id, clientHash: 'other', createdAt: now }), false);
  assert.equal(await store.confirm({ reportId: row.id, clientHash: 'third', createdAt: now }), true);
  assert.equal((await store.list())[0].confirmations, 2);
  assert.equal(await store.confirm({ reportId: 999, clientHash: 'other', createdAt: now }), false);
  store.close();
});
test('only new urban decay reports expose precise coordinates; old rows remain approximate', async () => {
  const client = createClient({ url: 'file::memory:' });
  await client.execute("CREATE TABLE reports (id INTEGER PRIMARY KEY AUTOINCREMENT, lat REAL NOT NULL, lng REAL NOT NULL, occurred_at TEXT NOT NULL, created_at TEXT NOT NULL, client_hash TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'theft', notes TEXT NOT NULL DEFAULT '')");
  const report = { lat: 45.6889287, lng: 8.7212361, occurredAt: now, createdAt: now };
  await client.execute({sql:'INSERT INTO reports (lat,lng,occurred_at,created_at,client_hash,category) VALUES (?,?,?,?,?,?)',args:[report.lat,report.lng,now,now,'old','degradation']});
  const store=createReportStore(client);
  await store.submit({...report,clientHash:'new',category:'degradation'});
  await store.submit({...report,clientHash:'crime',category:'crime'});
  const rows=await store.list();
  const old=rows.find(row=>row.id===1), exact=rows.find(row=>row.id===2), crime=rows.find(row=>row.id===3);
  assert.equal(old.locationPrecision,'approximate');
  assert.notEqual(old.lat,report.lat);
  assert.equal(exact.locationPrecision,'exact');
  assert.equal(exact.lat,report.lat);
  assert.equal(exact.lng,report.lng);
  assert.equal(crime.locationPrecision,'approximate');
  assert.notEqual(crime.lat,report.lat);
  const raw=await client.execute('SELECT lat, lng FROM reports WHERE id = 1');
  assert.equal(raw.rows[0].lat,report.lat);
  assert.equal(raw.rows[0].lng,report.lng);
  store.close();
});
