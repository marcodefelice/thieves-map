import { randomUUID, timingSafeEqual } from 'node:crypto';
import { getReportStore } from './db.mjs';
import { blueskyLogin, putBlueskyPost } from './bluesky.mjs';
import { reportDate, reportLabel, reportSummary, reportUrl, reportVerification, storedArea } from './publication-feed.mjs';
import { shareableReport } from './report-share.mjs';

export async function runBlueskyCron({ store, identifier, password, login = blueskyLogin, post = putBlueskyPost, now = Date.now() }) {
  const owner = randomUUID();
  if (!await store.acquireBlueskyLock({ owner, now: new Date(now).toISOString(), expiresAt: new Date(now + 180_000).toISOString() })) return { skipped: 'already_running' };
  try {
    if (await store.initializeBluesky(new Date(now).toISOString())) return { initialized: true, published: 0 };
    const ids = await store.listBlueskyPending(10);
    let session, published = 0, skipped = 0;
    for (const id of ids) {
      const report = await store.sharedReport(id);
      if (!report || !report.verifiedAt || !shareableReport(report, now)) {
        await store.markBlueskyProcessed(id, new Date().toISOString());
        skipped++;
        continue;
      }
      if (!session) session = await login(identifier, password);
      await post(session, { id: String(id), url: reportUrl(report), title: `${reportLabel(report)} · ${storedArea(report)}`, description: `${reportVerification(report)}. Data indicata: ${reportDate(report)}. ${reportSummary(report)}` });
      await store.markBlueskyProcessed(id, new Date().toISOString());
      published++;
    }
    return { published, skipped };
  } finally { await store.releaseBlueskyLock(owner); }
}

export async function handleBlueskyCron(request) {
  const secret = process.env.CRON_SECRET;
  const expected = secret ? Buffer.from(`Bearer ${secret}`) : Buffer.alloc(0);
  const actual = Buffer.from(request.headers.get('authorization') || '');
  if (!expected.length || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const identifier = process.env.BLUESKY_IDENTIFIER?.trim(), password = process.env.BLUESKY_APP_PASSWORD?.trim();
  if (!identifier || !password) return Response.json({ error: 'Bluesky non configurato.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try {
    const result = await runBlueskyCron({ store: getReportStore(), identifier, password });
    console.log('Bluesky cron:', JSON.stringify(result));
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Bluesky cron failed. Check configuration and service availability.');
    return Response.json({ error: 'Pubblicazione non riuscita: controlla configurazione e log.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
