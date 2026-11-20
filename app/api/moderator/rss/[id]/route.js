import { resolveRss } from '../../../../../lib/rss-api.mjs';
export const runtime = 'nodejs';
export async function POST(request, { params }) { return resolveRss(request, params); }
