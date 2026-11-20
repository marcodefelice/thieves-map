import { after } from 'next/server';
import { dispatchTelegramReport } from '../../../../../../lib/telegram.mjs';
import { allowedBrowserOrigin } from '../../../../../../lib/client.mjs';
import { getReportStore } from '../../../../../../lib/db.mjs';
import { currentModerator } from '../../../../../../lib/moderator-auth.mjs';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  const moderator = await currentModerator(request);
  if (!moderator) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({ error: 'Segnalazione non valida.' }, { status: 400 });
  if (!(await getReportStore().verifyReport({ reportId: Number(id), moderatorId: moderator.id, nickname: moderator.nickname, country: moderator.country, scopeType: moderator.scopeType, scopeValue: moderator.scopeValue, createdAt: new Date().toISOString() }))) return Response.json({ error: 'Segnalazione già verificata, archiviata, creata da te o fuori dal tuo ambito.' }, { status: 409 });
  after(() => dispatchTelegramReport(Number(id), { verification: true }));
  return Response.json({ ok: true, verifiedByNickname: moderator.nickname });
}
