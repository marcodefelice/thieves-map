import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { createReportStore } from '../lib/db.mjs';
import { handleBlueskyCron, runBlueskyCron } from '../lib/bluesky-cron.mjs';

const now = Date.now();
const iso = new Date(now).toISOString();
const report = { lat: 45.1, lng: 9.1, occurredAt: iso, createdAt: iso, country: 'IT', municipality: 'Milano', category: 'theft' };

test('Vercel cron initializes existing verified pins and retries later approved pins exactly once', async () => {
  const store = createReportStore(createClient({ url: 'file::memory:' }));
  try {
    await store.submitAdminReport(report);
    let posts = 0;
    const login = async () => ({ did: 'did:test', accessJwt: 'token' });
    const post = async () => { posts++; };
    assert.deepEqual(await runBlueskyCron({ store, identifier: 'test', password: 'test', now, login, post }), { initialized: true, published: 0 });
    const id = await store.submitAdminReport({ ...report, createdAt: new Date(now + 1).toISOString() });
    await assert.rejects(runBlueskyCron({ store, identifier: 'test', password: 'test', now: now + 2, login, post: async () => { throw new Error('offline'); } }));
    assert.deepEqual(await store.listBlueskyPending(), [id]);
    assert.deepEqual(await runBlueskyCron({ store, identifier: 'test', password: 'test', now: now + 3, login, post }), { published: 1, skipped: 0 });
    assert.equal(posts, 1);
    assert.deepEqual(await runBlueskyCron({ store, identifier: 'test', password: 'test', now: now + 4, login, post }), { published: 0, skipped: 0 });
  } finally { store.close(); }
});

test('Vercel cron locks overlapping jobs and expires abandoned leases', async () => {
  const store = createReportStore(createClient({ url: 'file::memory:' }));
  try {
    assert.equal(await store.acquireBlueskyLock({ owner: 'a', now: iso, expiresAt: new Date(now + 1000).toISOString() }), true);
    assert.equal((await runBlueskyCron({ store, identifier: 'test', password: 'test', now })).skipped, 'already_running');
    assert.equal(await store.acquireBlueskyLock({ owner: 'b', now: new Date(now + 1000).toISOString(), expiresAt: new Date(now + 2000).toISOString() }), true);
    await store.releaseBlueskyLock('a');
    assert.equal(await store.acquireBlueskyLock({ owner: 'c', now: new Date(now + 1001).toISOString(), expiresAt: new Date(now + 3000).toISOString() }), false);
  } finally { store.close(); }
});

test('Vercel cron refuses missing or wrong authorization before touching the database', async () => {
  const original = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = 'a-secret';
    assert.equal((await handleBlueskyCron(new Request('https://example.test', { headers: { authorization: 'Bearer wrong' } }))).status, 401);
    delete process.env.CRON_SECRET;
    assert.equal((await handleBlueskyCron(new Request('https://example.test'))).status, 401);
  } finally { if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original; }
});
