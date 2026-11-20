import { handleRssCron } from '../../../../../lib/rss-cron.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 240;

export async function GET(request, { params }) {
  const { category } = await params;
  return handleRssCron(request, category);
}
