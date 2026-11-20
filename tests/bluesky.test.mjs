import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { XMLValidator } from 'fast-xml-parser';
import { feedItems, blueskyPost, blueskyLogin, putBlueskyPost } from '../lib/bluesky.mjs';
import { rssXml } from '../lib/publication-feed.mjs';

const now = new Date().toISOString();
const base = { id: 1, category: 'crime', municipality: 'Milano', notes: 'Segnalazione <test> 🐾', occurredAt: now, createdAt: now, verifiedAt: now, verifiedByNickname: 'Mod' };

test('posts use UTF-8 link facets and obey the 300-grapheme limit', () => {
  const xml = rssXml([base]);
  assert.equal(XMLValidator.validate(xml), true);
  const [item] = feedItems(xml, new URL(itemOrigin()).origin);
  const post = blueskyPost({ ...item, description: '🐕‍🦺'.repeat(600) });
  assert.ok([...new Intl.Segmenter('it', { granularity: 'grapheme' }).segment(post.text)].length <= 300);
  const { byteStart, byteEnd } = post.facets[0].index;
  assert.equal(Buffer.from(post.text).subarray(byteStart, byteEnd).toString('utf8'), item.url);
  assert.throws(() => feedItems(xml, 'https://invalid.example'));
});
function itemOrigin() { return process.env.PUBLIC_ORIGIN || 'https://thievesmap.cloud'; }

test('Bluesky login and publication use the same stable record key for a retry', async () => {
  const requests = [];
  const fake = async (url, options) => { requests.push({ url, body: JSON.parse(options.body), auth: options.headers.authorization }); return Response.json(url.endsWith('createSession') ? { did: 'did:plc:test', accessJwt: 'token' } : { uri: 'at://test' }); };
  const session = await blueskyLogin('a.bsky.social', 'app-password', fake);
  const item = { id: '1', title: 'Segnalazione', description: 'Test', url: 'https://thievesmap.cloud/s/1' };
  await putBlueskyPost(session, item, fake);
  await putBlueskyPost(session, item, fake);
  assert.equal(requests[1].body.rkey, requests[2].body.rkey);
  assert.equal(requests[1].auth, 'Bearer token');
  assert.equal(requests[1].body.collection, 'app.bsky.feed.post');
});

test('worker initializes silently, posts only new items, and retries without creating a new key', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'punto-bluesky-'));
  const feed = path.join(dir, 'feed.xml'), state = path.join(dir, 'state.json'), log = path.join(dir, 'requests.jsonl');
  const env = { ...process.env, PUBLIC_ORIGIN: 'https://thievesmap.cloud', BLUESKY_IDENTIFIER: 'test.bsky.social', BLUESKY_APP_PASSWORD: 'password', BLUESKY_STATE_FILE: state, TEST_FEED_FILE: feed, TEST_REQUEST_LOG: log };
  const run = extra => spawnSync(process.execPath, ['--import', './tests/fixtures/bluesky-network-mock.mjs', './scripts/bluesky-post.mjs'], { cwd: process.cwd(), env: { ...env, ...extra }, encoding: 'utf8' });
  try {
    writeFileSync(feed, rssXml([base]));
    assert.equal(run().status, 0);
    assert.deepEqual(JSON.parse(readFileSync(state)).seen, ['1']);
    writeFileSync(feed, rssXml([{ ...base, id: 2 }, base]));
    assert.equal(run({ TEST_POST_FAIL: '1' }).status, 1);
    assert.deepEqual(JSON.parse(readFileSync(state)).seen, ['1']);
    assert.equal(run().status, 0);
    assert.equal(run().status, 0);
    const requests = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].rkey, requests[1].rkey);
    assert.deepEqual(JSON.parse(readFileSync(state)).seen, ['1', '2']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
