import { allowedBrowserOrigin } from '../../../../lib/client.mjs';
import { getReportStore } from '../../../../lib/db.mjs';
import { currentModerator } from '../../../../lib/moderator-auth.mjs';
import { reverseGeocode } from '../../../../lib/reverse-geocode.mjs';
import { validateModeratorReport } from '../../../../lib/validation.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const moderator = await currentModerator(request);
  if (!moderator) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const page = Number(new URL(request.url).searchParams.get('page') || '1');
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) return Response.json({ error: 'Pagina non valida.' }, { status: 400 });
  return Response.json(await getReportStore().listReportsForModeration({ country: moderator.country, scopeType: moderator.scopeType, scopeValue: moderator.scopeValue, page }), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  const moderator = await currentModerator(request);
  if (!moderator) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Dati non validi.' }, { status: 400 }); }
  const error = validateModeratorReport(body);
  if (error) return Response.json({ error }, { status: 400 });
  let place;
  try { place = await reverseGeocode(body); }
  catch { return Response.json({ error: 'Impossibile verificare il territorio della segnalazione. Riprova più tardi.' }, { status: 503 }); }
  const scopeValue = moderator.scopeType === 'province' ? place.province : place.municipality;
  if (place.country !== moderator.country || !scopeValue || scopeValue !== moderator.scopeValue) return Response.json({ error: `Puoi pubblicare soltanto nel tuo ${moderator.scopeType === 'province' ? 'ambito provinciale' : 'Comune'} assegnato.` }, { status: 403 });
  const id = await getReportStore().submitModerated({ ...body, moderatorId: moderator.id, country: place.country, municipality: place.municipality, province: place.province, createdAt: new Date().toISOString() });
  return Response.json({ ok: true, id }, { status: 201 });
}
