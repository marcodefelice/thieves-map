import { timingSafeEqual } from 'node:crypto';
import { getReportStore } from './db.mjs';
import { fetchRss, rssConfig } from './rss-fetch.mjs';

const queries = {
  theft: 'furto OR furti OR effrazione OR scasso OR borseggio when:2d',
  crime: 'rapina OR truffa OR spaccio OR aggressione when:2d',
  degradation: 'vandalismo OR degrado OR danneggiamenti OR discarica OR "lampioni spenti" when:2d',
};

export function googleNewsFeeds(category) {
  const categories = category ? [category] : Object.keys(queries);
  if (categories.some(name => !Object.hasOwn(queries, name))) throw new Error('Invalid RSS category');
  return categories.map(name => {
    const url = new URL('https://news.google.com/rss/search');
    for (const [key, value] of Object.entries({ q: queries[name], hl: 'it', gl: 'IT', ceid: 'IT:it' })) url.searchParams.set(key, value);
    return url.href;
  });
}

export async function handleRssCron(request, category) {
  const secret = process.env.CRON_SECRET;
  const expected = secret ? Buffer.from(`Bearer ${secret}`) : Buffer.alloc(0);
  const actual = Buffer.from(request.headers.get('authorization') || '');
  if (!expected.length || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  if (category && !Object.hasOwn(queries, category)) return Response.json({ error: 'Categoria non valida.' }, { status: 400 });
  try {
    const config = rssConfig({ ...process.env, RSS_FEEDS: googleNewsFeeds(category).join(',') }, { freeOnly: true });
    const result = await fetchRss({ store: getReportStore(), config, maxAttempts: 13 });
    console.log('RSS cron:', JSON.stringify({ category: category || 'all', ...result }));
    return Response.json(result, { status: result.failures ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('RSS cron failed:', error.message);
    return Response.json({ error: 'Importazione non riuscita: controlla configurazione e log.' }, { status: 503 });
  }
}
