import { getReportStore } from '../../../../lib/db.mjs';
import { adminCountry, validAdminToken } from '../../../../lib/moderator-auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!validAdminToken(request)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const page = Number(new URL(request.url).searchParams.get('page') || '1');
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) return Response.json({ error: 'Pagina non valida.' }, { status: 400 });
  return Response.json(await getReportStore().listReportsForModeration({ country: adminCountry(), page }), { headers: { 'Cache-Control': 'no-store' } });
}
