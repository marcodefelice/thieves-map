import { handleBlueskyCron } from '../../../../lib/bluesky-cron.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function GET(request) { return handleBlueskyCron(request); }
