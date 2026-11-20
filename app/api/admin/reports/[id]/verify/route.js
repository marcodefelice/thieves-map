import { after } from 'next/server';
import { dispatchTelegramReport } from '../../../../../../lib/telegram.mjs';
import { allowedBrowserOrigin } from '../../../../../../lib/client.mjs';
import { getReportStore } from '../../../../../../lib/db.mjs';
import { adminCountry, validAdminToken } from '../../../../../../lib/moderator-auth.mjs';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  if (!validAdminToken(request)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({ error: 'Segnalazione non valida.' }, { status: 400 });
  if (!(await getReportStore().verifyReportAsAdmin({ reportId: Number(id), country: adminCountry(), nickname: 'Punto Sicuro', createdAt: new Date().toISOString() }))) return Response.json({ error: 'Segnalazione già verificata, archiviata o non trovata.' }, { status: 409 });
  after(() => dispatchTelegramReport(Number(id), { verification: true }));
  return Response.json({ ok: true, verifiedByNickname: 'Punto Sicuro' });
}
