import { getReportStore } from '../../lib/db.mjs';
import { rssXml } from '../../lib/publication-feed.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  const reports = await getReportStore().listPublicFeed();
  return new Response(rssXml(reports), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
