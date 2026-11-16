import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, validEndpoint } from '../lib/push.mjs';
import { createReportStore } from '../lib/db.mjs';
import { createClient } from '@libsql/client';

test('distance calculation and push endpoint allowlist', () => {
  assert.equal(distanceKm({lat:45,lng:9},{lat:45,lng:9}), 0);
  assert.ok(distanceKm({lat:45,lng:9},{lat:45.1,lng:9}) > 10);
  assert.equal(validEndpoint('https://fcm.googleapis.com/fcm/send/abc'), true);
  assert.equal(validEndpoint('https://web.push.apple.com/abc'), true);
  assert.equal(validEndpoint('https://fcm.googleapis.com.attacker.example/abc'), false);
  assert.equal(validEndpoint('http://fcm.googleapis.com/abc'), false);
});
test('subscription can be created, updated and removed', async () => {
  const store = createReportStore(createClient({ url: 'file::memory:' }));
  const item = { endpoint: 'https://fcm.googleapis.com/fcm/send/example', keys: { p256dh:'key', auth:'auth' }, lat:45, lng:9, radius:5, language:'it' };
  await store.saveSubscription(item);
  await store.saveSubscription({ ...item, radius: 10 });
  let rows = await store.listSubscriptions();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].radius, 10);
  await store.deleteSubscription(item.endpoint);
  rows = await store.listSubscriptions();
  assert.equal(rows.length, 0);
  store.close();
});
