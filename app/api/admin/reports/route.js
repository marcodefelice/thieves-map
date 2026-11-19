import { getReportStore } from '../../../../lib/db.mjs';
import { validAdminToken } from '../../../../lib/moderator-auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!validAdminToken(request)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  return Response.json({ reports: await getReportStore().listReportsForModeration() }, { headers: { 'Cache-Control': 'no-store' } });
}
