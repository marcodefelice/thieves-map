import { allowedBrowserOrigin } from '../../../../lib/client.mjs';
import { getReportStore } from '../../../../lib/db.mjs';
import { currentModerator } from '../../../../lib/moderator-auth.mjs';
import { validateModeratorReport } from '../../../../lib/validation.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!(await currentModerator(request))) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  return Response.json({ reports: await getReportStore().listReportsForModeration() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  const moderator = await currentModerator(request);
  if (!moderator) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Dati non validi.' }, { status: 400 }); }
  const error = validateModeratorReport(body);
  if (error) return Response.json({ error }, { status: 400 });
  const id = await getReportStore().submitModerated({ ...body, moderatorId: moderator.id, createdAt: new Date().toISOString() });
  return Response.json({ ok: true, id }, { status: 201 });
}
