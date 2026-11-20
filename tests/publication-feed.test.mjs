import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { createClient } from '@libsql/client';
import { createReportStore } from '../lib/db.mjs';
import { rssXml } from '../lib/publication-feed.mjs';
import { publishTelegramReport } from '../lib/telegram.mjs';

const now = Date.now();
const base = { id: 3, lat: 45.1, lng: 9.1, country: 'IT', municipality: 'Milano', category: 'theft', recordKind: 'report', occurredAt: new Date(now).toISOString(), createdAt: new Date(now).toISOString(), verifiedAt: new Date(now).toISOString(), verifiedByNickname: 'Mod', notes: 'Visto <qualcosa> & avvisati' };

test('RSS emits valid escaped XML and excludes expired reports', () => {
  const xml = rssXml([base, { ...base, id: 4, occurredAt: new Date(now - 40 * 86400_000).toISOString() }, { ...base, id: 5, verifiedAt: null, verifiedByNickname: '' }], now);
  assert.equal(XMLValidator.validate(xml), true);
  const channel = new XMLParser().parse(xml).rss.channel;
  assert.equal(channel.item.title, 'Furto o tentata effrazione · Milano');
  assert.match(channel.item.description, /Visto <qualcosa> & avvisati/);
  assert.match(channel.item.description, /Verificata da un moderatore/);
  assert.match(channel.item.link, /\/s\/3$/);
});

test('feed store excludes archived reports and returns only public coordinates', async () => {
  const client = createClient({ url: 'file::memory:' });
  const store = createReportStore(client);
  const id = await store.submit({ ...base, clientHash: 'one', returnId: true });
  assert.equal(id, 1);
  await store.submit({ ...base, clientHash: 'two', returnId: true });
  await client.execute("UPDATE reports SET verified_at = '2026-01-01T00:00:00.000Z', verified_by_name = 'Mod' WHERE id = 1");
  await client.execute("UPDATE reports SET status = 'archived', verified_at = '2026-01-01T00:00:00.000Z' WHERE id = 2");
  await store.submit({ ...base, clientHash: 'three', returnId: true });
  const rows = await store.listPublicFeed();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, id);
  assert.deepEqual([rows[0].lat, rows[0].lng], [(await store.list())[0].lat, (await store.list())[0].lng]);
  store.close();
});

test('Telegram sends plain-text public report to the configured channel and applies the municipality filter', async () => {
  const saved = { fetch: globalThis.fetch, store: globalThis.__reportStore, token: process.env.TELEGRAM_BOT_TOKEN, chat: process.env.TELEGRAM_CHAT_ID, area: process.env.TELEGRAM_MUNICIPALITY };
  const sent = [];
  try {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'; process.env.TELEGRAM_CHAT_ID = '@test_channel'; process.env.TELEGRAM_MUNICIPALITY = 'Milano';
    globalThis.__reportStore = { sharedReport: async id => id === 3 ? { ...base, verifiedByNickname: "" } : null };
    globalThis.fetch = async (url, options) => {
      if (String(url).includes('nominatim')) return { ok: true, json: async () => ({ address: { city: 'Milano' } }) };
      sent.push({ url: String(url), payload: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ ok: true }) };
    };
    assert.equal(await publishTelegramReport(3), true);
    assert.equal(sent[0].payload.chat_id, '@test_channel');
    assert.match(sent[0].payload.text, /Zona: Milano/);
    assert.match(sent[0].payload.text, /non verificata/);
    assert.match(sent[0].payload.text, /\/s\/3$/);
    assert.equal(sent[0].payload.parse_mode, undefined);
    process.env.TELEGRAM_MUNICIPALITY = 'Roma';
    assert.equal(await publishTelegramReport(3), false);
    assert.equal(sent.length, 1);
    assert.equal(await publishTelegramReport(99), false);
  } finally {
    globalThis.fetch = saved.fetch; globalThis.__reportStore = saved.store;
    for (const [key, value] of Object.entries({ TELEGRAM_BOT_TOKEN: saved.token, TELEGRAM_CHAT_ID: saved.chat, TELEGRAM_MUNICIPALITY: saved.area })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
