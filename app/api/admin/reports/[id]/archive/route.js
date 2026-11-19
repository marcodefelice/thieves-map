import { allowedBrowserOrigin } from '../../../../../../lib/client.mjs';
import { getReportStore } from '../../../../../../lib/db.mjs';
import { validAdminToken } from '../../../../../../lib/moderator-auth.mjs';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  if (!validAdminToken(request)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({ error: 'Segnalazione non valida.' }, { status: 400 });
  if (!(await getReportStore().archiveReportAsAdmin({ reportId: Number(id), createdAt: new Date().toISOString() }))) return Response.json({ error: 'Segnalazione già archiviata o non trovata.' }, { status: 409 });
  return Response.json({ ok: true });
}
