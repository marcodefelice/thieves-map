import { listRss } from '../../../../lib/rss-api.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) { return listRss(request, true); }
