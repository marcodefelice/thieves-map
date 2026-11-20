import { dispatchTelegramReport } from '../../../../lib/telegram.mjs';
import { allowedBrowserOrigin } from '../../../../lib/client.mjs';
import { getReportStore } from '../../../../lib/db.mjs';
import { currentModerator } from '../../../../lib/moderator-auth.mjs';
import { reverseGeocode } from '../../../../lib/reverse-geocode.mjs';
import { validateModeratorHomeReport } from '../../../../lib/validation.mjs';
import { approximateLocation } from '../../../../lib/location.mjs';
import { notifyNearby } from '../../../../lib/push.mjs';
import { after } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return Response.json({ error: 'Formato non valido.' }, { status: 415 });
  const moderator = await currentModerator(request);
  if (!moderator) return Response.json({ error: 'Sessione scaduta. Accedi di nuovo come moderatore.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Dati non validi.' }, { status: 400 }); }
  const error = validateModeratorHomeReport(body);
  if (error) return Response.json({ error }, { status: 400 });
  let place;
  try { place = await reverseGeocode(body); }
  catch { return Response.json({ error: 'Impossibile verificare il territorio della segnalazione. Riprova più tardi.' }, { status: 503 }); }
  const scopeValue = moderator.scopeType === 'province' ? place.province : place.municipality;
  if (place.country !== moderator.country || !scopeValue || scopeValue !== moderator.scopeValue) return Response.json({ error: `Puoi pubblicare soltanto nel tuo ${moderator.scopeType === 'province' ? 'ambito provinciale' : 'Comune'} assegnato.` }, { status: 403 });
  const id = await getReportStore().submitModerated({ ...body, recordKind: 'report', moderatorId: moderator.id, verifiedByNickname: moderator.nickname, country: place.country, municipality: place.municipality, province: place.province, createdAt: new Date().toISOString() });
  after(async () => { await Promise.all([dispatchTelegramReport(id), notifyNearby({ ...body, ...approximateLocation(body) }).catch(error => console.error('Push dispatch failed:', error.message))]); });
  return Response.json({ ok: true, id }, { status: 201 });
}
