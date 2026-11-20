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
    assert.equal(await store.submit({ ...report, lat: 42 }), false);
    assert.equal(await store.submit({ ...report, createdAt: '2026-11-18T12:15:00.000Z' }), true);
    assert.equal((await store.list()).length, 3);
    store.close();
  });
}
test.after(() => rmSync(dir, { recursive: true, force: true }));
test('uses the stored country for exact coastal locations that cannot be matched', async () => {
  const client = createClient({ url: 'file::memory:' });
  const store = createReportStore(client);
  for (const [index, [lat, lng]] of [[40.8279, 14.22], [40.8235, 14.2902], [40.8333, 14.2393]].entries()) {
    await store.submit({ lat, lng, occurredAt: now, createdAt: now, clientHash: `coast-${index}`, country: 'IT', category: 'degradation' });
  }
  await store.submit({ lat: 0, lng: -140, occurredAt: now, createdAt: now, clientHash: 'unknown', country: 'UN', category: 'crime' });
  await store.submit({ lat: 0, lng: -140, occurredAt: now, createdAt: now, clientHash: 'approximate', country: 'IT', category: 'theft' });
  await store.submit({ lat: 40.7128, lng: -74.006, occurredAt: now, createdAt: now, clientHash: 'matched', country: 'IT', category: 'crime' });
  const rows = await store.list();
  const country = id => rows.find(row => Number(row.id) === id).country;
  assert.deepEqual([1, 2, 3].map(country), ['IT', 'IT', 'IT']);
  assert.equal(country(4), null);
  assert.equal(country(5), null);
  assert.equal(country(6), 'US');
  store.close();
});
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
  assert.equal((await store.list('author'))[0].sameNetwork, 1);
  assert.equal((await store.list('other'))[0].sameNetwork, 0);
  assert.equal(await store.confirm({ reportId: row.id, clientHash: 'author', createdAt: now }), false);
  assert.equal(await store.confirm({ reportId: row.id, clientHash: 'other', createdAt: now }), true);
  assert.equal((await store.list('other'))[0].alreadyConfirmed, 1);
  assert.equal((await store.list('third'))[0].alreadyConfirmed, 0);
  assert.equal(await store.confirm({ reportId: row.id, clientHash: 'other', createdAt: now, kind: 'dispute' }), false);
  assert.equal(await store.confirm({ reportId: row.id, clientHash: 'disputer', createdAt: now, kind: 'dispute' }), true);
  assert.equal((await store.list())[0].disputes, 1);
  assert.equal(await store.confirm({ reportId: row.id, clientHash: 'third', createdAt: now }), true);
  assert.equal((await store.list())[0].confirmations, 2);
  assert.equal(await store.confirm({ reportId: 999, clientHash: 'other', createdAt: now }), false);
  store.close();
});
test('new crime and urban decay reports expose precise coordinates; old rows remain approximate', async () => {
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
  assert.equal(crime.locationPrecision,'exact');
  assert.equal(crime.lat,report.lat);
  const raw=await client.execute('SELECT lat, lng FROM reports WHERE id = 1');
  assert.equal(raw.rows[0].lat,report.lat);
  assert.equal(raw.rows[0].lng,report.lng);
  store.close();
});
