import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createClient } from '@libsql/client';
import { createReportStore } from '../lib/db.mjs';
import { parseRss } from '../lib/rss-parser.mjs';
import { fetchRss, rssConfig } from '../lib/rss-fetch.mjs';

const createdAt = '2026-11-20T10:00:00.000Z';
const makeDraft = (source, municipality, province) => ({ source, title: 'Furto', publishedAt: createdAt, occurredAt: null, category: 'theft', notes: 'Un furto segnalato dalla stampa.', locationLabel: `Centro, ${municipality}`, lat: 45.8, lng: 8.8, country: 'IT', municipality, province, createdAt });

test('RSS drafts remain private, are scoped, deduplicated and published only once with audit', async () => {
  const store = createReportStore(createClient({ url: 'file::memory:' }));
  try {
    const draft = makeDraft('https://example.test/1', 'Varese', 'Varese');
    assert.equal(await store.addRssDraft(draft), true);
    assert.equal(await store.addRssDraft(draft), false);
    await store.addRssDraft(makeDraft('https://example.test/2', 'Busto Arsizio', 'Varese'));
    await store.addRssDraft(makeDraft('https://example.test/3', 'Milano', 'Milano'));
    assert.equal((await store.list()).length, 0);
    assert.equal((await store.listRssDrafts({ country: 'IT' })).total, 3);
    const varese = await store.listRssDrafts({ country: 'IT', scopeType: 'province', scopeValue: 'varese' });
    assert.equal(varese.total, 2);
    const city = await store.listRssDrafts({ country: 'IT', scopeType: 'municipality', scopeValue: 'varese' });
    assert.equal(city.total, 1);
    const id = city.drafts[0].id;
    const report = { ...draft, occurredAt: '2026-11-19T09:00:00.000Z' };
    const action = { id, country: 'IT', scopeType: 'province', scopeValue: 'varese', moderatorId: 7, nickname: 'Anna', createdAt, action: 'approve', report };
    assert.equal(await store.resolveRssDraft({ ...action, scopeValue: 'milano' }), false);
    assert.equal(await store.resolveRssDraft(action), true);
    assert.equal(await store.resolveRssDraft(action), false);
    const [published] = await store.list();
    assert.equal(published.source, draft.source);
    assert.equal(published.occurredAt, report.occurredAt);
    assert.equal(published.verifiedByNickname, 'Anna');
    assert.equal(published.indirect, 1);
    assert.notEqual(published.lat, draft.lat);
    assert.equal((await store.listModerationAudit({ targetType: 'rss_draft', targetId: id }))[0].action, 'rss_approved');
    const other = (await store.listRssDrafts({ country: 'IT', scopeType: 'province', scopeValue: 'varese' })).drafts[0];
    assert.equal(await store.resolveRssDraft({ ...action, id: other.id, action: 'reject' }), true);
    assert.equal((await store.list()).length, 1);
  } finally { store.close(); }
});

test('RSS parser accepts RSS and Atom, and rejects external entities', () => {
  const rss = parseRss(Buffer.from('<rss><channel><item><title>Furto</title><link>https://example.test/a</link><description><![CDATA[Notizia]]></description></item></channel></rss>'));
  assert.equal(rss[0].description, 'Notizia');
  const atom = parseRss(Buffer.from('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Furto</title><link href="https://example.test/b"/><published>2026-11-20T09:00:00Z</published></entry></feed>'));
  assert.equal(atom[0].link, 'https://example.test/b');
  assert.throws(() => parseRss(Buffer.from('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss>&x;</rss>')));
  assert.throws(() => parseRss(Buffer.from('<rss><item></rss>')));
});

test('fetcher imports a filtered article without treating publication as event time', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'rss-test-'));
  try {
    const result = spawnSync(process.execPath, ['--import', './tests/fixtures/rss-fetch-mock.mjs', 'scripts/fetch-rss.mjs'], { encoding: 'utf8', env: { ...process.env, VERCEL: '', TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '', DATA_DIR: dir, RSS_FEEDS: 'https://feed.example/rss', RSS_LLM_ENDPOINT: 'https://llm.example/chat', RSS_LLM_MODEL: 'gpt-6-luna', RSS_GEOCODER_URL: 'https://geo.example/search', RSS_GEOCODER_API_KEY: 'secret-test', GEOCODER_USER_AGENT: 'Test/1.0 (test@example.test)' } });
    assert.equal(result.status, 0, result.stderr);
    const store = createReportStore(createClient({ url: `file:${join(dir, 'reports.sqlite')}` }));
    try {
      const queue = await store.listRssDrafts({ country: 'IT', scopeType: 'province', scopeValue: 'varese' });
      assert.equal(queue.total, 1);
      assert.equal(queue.drafts[0].occurredAt, null);
      assert.ok(queue.drafts[0].publishedAt);
      assert.equal((await store.list()).length, 0);
    } finally { store.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test('quota reservation counts attempts, enforces rolling and per-minute limits and controls retries', async () => {
  const store = createReportStore(createClient({ url: 'file::memory:' }));
  const base = Date.parse('2026-11-20T10:00:00.000Z');
  const at = delta => new Date(base + delta).toISOString();
  try {
    const owner = 'one';
    assert.equal(await store.acquireRssLock({ owner, now: at(0), expiresAt: at(70000) }), true);
    assert.equal(await store.acquireRssLock({ owner: 'two', now: at(1000), expiresAt: at(71000) }), false);
    await store.releaseRssLock('two');
    assert.equal(await store.acquireRssLock({ owner: 'two', now: at(1000), expiresAt: at(71000) }), false);
    await store.releaseRssLock(owner);
    assert.equal(await store.acquireRssLock({ owner: 'two', now: at(1000), expiresAt: at(71000) }), true);
    await store.releaseRssLock('two');
    for (let i = 0; i < 15; i++) assert.equal(await store.reserveRssAttempt({ source: `https://news.test/${i}`, now: at(0) }), true);
    assert.equal(await store.reserveRssAttempt({ source: 'https://news.test/blocked', now: at(1000) }), false);
    assert.equal(await store.reserveRssAttempt({ source: 'https://news.test/0', now: at(61000) }), false);
    for (let i = 15; i < 40; i++) assert.equal(await store.reserveRssAttempt({ source: `https://news.test/${i}`, now: at(61000 + (i - 15) * 5000) }), true);
    assert.equal(await store.reserveRssAttempt({ source: 'https://news.test/over', now: at(210000) }), false);
    assert.equal(await store.reserveRssAttempt({ source: 'https://news.test/0', now: at(86400_001) }), true);
    assert.equal(await store.reserveRssAttempt({ source: 'https://news.test/0', now: at(2 * 86400_000 + 2) }), false);
  } finally { store.close(); }
});

test('cron configuration fails closed for paid models and missing credentials', () => {
  const env = { RSS_FEEDS: 'https://feed.test/rss', RSS_LLM_ENDPOINT: 'https://openrouter.ai/api/v1/chat/completions', RSS_LLM_MODEL: 'openrouter/free', RSS_LLM_API_KEY: 'test', RSS_GEOCODER_URL: 'https://geo.test', GEOCODER_USER_AGENT: 'Test' };
  assert.equal(rssConfig(env, { freeOnly: true }).model, 'openrouter/free');
  assert.throws(() => rssConfig({ ...env, RSS_LLM_MODEL: 'openai/paid' }, { freeOnly: true }));
  assert.throws(() => rssConfig({ ...env, RSS_LLM_API_KEY: '' }, { freeOnly: true }));
  assert.throws(() => rssConfig({ ...env, RSS_LLM_ENDPOINT: 'https://other.test' }, { freeOnly: true }));
});

test('cron rejects absent or invalid secrets before reading configuration or accessing the store', async () => {
  const { handleRssCron } = await import('../lib/rss-cron.mjs');
  const previous = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await handleRssCron(new Request('https://example.test/api/cron/rss'))).status, 401);
    process.env.CRON_SECRET = 'a-long-test-secret';
    assert.equal((await handleRssCron(new Request('https://example.test/api/cron/rss', { headers: { authorization: 'Bearer wrong' } }))).status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});


test('feed and article failures do not prevent other feeds being scanned', async () => {
  const store = createReportStore(createClient({ url: 'file::memory:' }));
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const calls = [], errors = [];
  const feeds = ['https://a.test/rss', 'https://b.test/rss', 'https://broken.test/rss'];
  const offset = Math.floor(Date.now() / 86400_000) % feeds.length;
  // Arrange the rotated sequence so the first source has two articles.
  const configuredFeeds = [...feeds.slice(feeds.length - offset), ...feeds.slice(0, feeds.length - offset)];
  const item = (title, path) => `<item><title>${title}</title><link>https://news.test/${path}</link><pubDate>${new Date().toUTCString()}</pubDate></item>`;
  globalThis.fetch = async (url, options = {}) => {
    url = String(url);
    if (url === 'https://broken.test/rss') throw new Error('feed unavailable');
    if (url === 'https://a.test/rss') return new Response(`<rss><channel>${item('Furto A1', 'a1')}${item('Furto A2', 'a2')}</channel></rss>`);
    if (url === 'https://b.test/rss') return new Response(`<rss><channel>${item('Furto B1', 'b1')}</channel></rss>`);
    if (url === 'https://llm.test/chat') {
      const title = JSON.parse(JSON.parse(options.body).messages[1].content).titolo;
      calls.push(title);
      if (title === 'Furto A1') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      return Response.json({ choices: [{ message: { content: JSON.stringify({ categoria: 'theft', 'città': 'Varese', via_o_zona: 'Centro', riassunto_neutro: 'Segnalazione riportata dalla stampa.', data_evento: null }) } }] });
    }
    if (url.startsWith('https://geo.test/search?')) return Response.json([{ lat: '45.818', lon: '8.825', address: { country_code: 'it', city: 'Varese', province: 'Varese' } }]);
    throw new Error(`Unexpected request ${url}`);
  };
  console.error = (...values) => errors.push(values.join(' '));
  try {
    const result = await fetchRss({ store, config: { feeds: configuredFeeds, endpoint: 'https://llm.test/chat', model: 'test', geocoder: 'https://geo.test/search', userAgent: 'Test' } });
    assert.deepEqual(calls, ['Furto A1', 'Furto B1', 'Furto A2']);
    assert.equal(result.added, 2);
    assert.equal(result.failures, 2);
    assert.equal((await store.listRssDrafts({ country: 'IT' })).total, 2);
    assert.ok(errors.some(message => message.includes('a.test, AI') && message.includes('timeout')));
    assert.ok(errors.some(message => message.includes('broken.test')));
  } finally { globalThis.fetch = originalFetch; console.error = originalError; store.close(); }
});
