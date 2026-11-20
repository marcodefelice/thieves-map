import { createHash } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const service = 'https://bsky.social/xrpc';
const segments = text => Array.from(new Intl.Segmenter('it', { granularity: 'grapheme' }).segment(text), part => part.segment);
const tidy = value => String(value || '').replace(/\s+/gu, ' ').trim();

export function feedItems(xml, origin) {
  if (XMLValidator.validate(xml) !== true) throw new Error('Feed RSS non valido.');
  const channel = new XMLParser({ ignoreAttributes: false, processEntities: true }).parse(xml)?.rss?.channel;
  if (!channel) throw new Error('Canale RSS non valido.');
  const items = channel.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
  return items.map(item => {
    const url = new URL(String(item.link));
    const match = /^\/s\/([1-9]\d*)$/.exec(url.pathname);
    if (url.origin !== origin || url.search || url.hash || !match || !Number.isSafeInteger(Number(match[1]))) throw new Error('Link del feed non valido.');
    return { id: match[1], url: url.href, title: tidy(item.title), description: tidy(item.description) };
  });
}

export function blueskyPost(item) {
  const title = segments(item.title).slice(0, 100).join('');
  const fixed = `${title}\n\n${item.url}`;
  const budget = 300 - segments(fixed).length - 2;
  if (budget < 0) throw new Error('Link o titolo troppo lunghi.');
  const summaryParts = segments(item.description);
  const summary = budget === 0 ? '' : summaryParts.length > budget ? `${summaryParts.slice(0, budget - 1).join('')}…` : summaryParts.join('');
  const text = `${title}${summary ? `\n${summary}` : ''}\n\n${item.url}`;
  const byteStart = Buffer.byteLength(text.slice(0, text.length - item.url.length));
  return { $type: 'app.bsky.feed.post', text, createdAt: new Date().toISOString(), langs: ['it'], facets: [{ index: { byteStart, byteEnd: byteStart + Buffer.byteLength(item.url) }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: item.url }] }] };
}

async function request(method, body, token, fetcher) {
  const response = await fetcher(`${service}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Bluesky ${method}: HTTP ${response.status}`);
  return response.json();
}
export async function blueskyLogin(identifier, password, fetcher = fetch) {
  const session = await request('com.atproto.server.createSession', { identifier, password }, null, fetcher);
  if (!session.did || !session.accessJwt) throw new Error('Sessione Bluesky non valida.');
  return session;
}
export async function putBlueskyPost(session, item, fetcher = fetch) {
  // A stable key makes retries after an interrupted response target the same post.
  const rkey = `puntosicuro-${createHash('sha256').update(item.id).digest('hex').slice(0, 24)}`;
  return request('com.atproto.repo.putRecord', { repo: session.did, collection: 'app.bsky.feed.post', rkey, record: blueskyPost(item) }, session.accessJwt, fetcher);
}
