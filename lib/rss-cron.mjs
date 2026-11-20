import { timingSafeEqual } from 'node:crypto';
import { getReportStore } from './db.mjs';
import { fetchRss, rssConfig } from './rss-fetch.mjs';

export async function handleRssCron(request) {
  const secret = process.env.CRON_SECRET;
  const expected = secret ? Buffer.from(`Bearer ${secret}`) : Buffer.alloc(0);
  const actual = Buffer.from(request.headers.get('authorization') || '');
  if (!expected.length || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  try {
    const result = await fetchRss({ store: getReportStore(), config: rssConfig(process.env, { freeOnly: true }) });
    console.log('RSS cron:', JSON.stringify(result));
    return Response.json(result, { status: result.failures ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('RSS cron failed:', error.message);
    return Response.json({ error: 'Importazione non riuscita: controlla configurazione e log.' }, { status: 503 });
  }
}
