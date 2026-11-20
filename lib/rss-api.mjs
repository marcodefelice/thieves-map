import { after } from 'next/server';
import { dispatchTelegramReport } from './telegram.mjs';
import { allowedBrowserOrigin } from './client.mjs';
import { getReportStore } from './db.mjs';
import { currentModerator, adminCountry, validAdminToken } from './moderator-auth.mjs';
import { reverseGeocode } from './reverse-geocode.mjs';
import { validateReport } from './validation.mjs';

async function identity(request, admin) {
  if (admin) return validAdminToken(request) ? { country: adminCountry(), nickname: 'Punto Sicuro', id: null } : null;
  return currentModerator(request);
}
export async function listRss(request, admin = false) {
  const user = await identity(request, admin);
  if (!user) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const page = Number(new URL(request.url).searchParams.get('page') || '1');
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) return Response.json({ error: 'Pagina non valida.' }, { status: 400 });
  return Response.json(await getReportStore().listRssDrafts({ country: user.country, scopeType: user.scopeType, scopeValue: user.scopeValue, page }), { headers: { 'Cache-Control': 'no-store' } });
}
export async function resolveRss(request, params, admin = false) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  const user = await identity(request, admin);
  if (!user) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({ error: 'Bozza non valida.' }, { status: 400 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Dati non validi.' }, { status: 400 }); }
  if (!body || !['approve', 'reject'].includes(body.action)) return Response.json({ error: 'Azione non valida.' }, { status: 400 });
  let report;
  if (body.action === 'approve') {
    report = { lat: body.lat, lng: body.lng, occurredAt: body.occurredAt, category: body.category, notes: body.notes, publicPlaceConfirmed: body.publicPlaceConfirmed };
    if (!['theft', 'crime', 'degradation'].includes(report.category) || typeof report.notes !== 'string' || !report.notes.trim()) return Response.json({ error: 'Tipologia o descrizione non valida.' }, { status: 400 });
    const error = validateReport(report);
    if (error) return Response.json({ error }, { status: 400 });
    if (body.reviewConfirmed !== true) return Response.json({ error: 'Conferma di aver verificato fonte, data, testo e posizione.' }, { status: 400 });
    let place;
    try { place = await reverseGeocode(report); } catch { return Response.json({ error: 'Impossibile verificare il territorio. Riprova più tardi.' }, { status: 503 }); }
    const area = user.scopeType === 'province' ? place.province : place.municipality;
    if (place.country !== user.country || (user.scopeType && (!area || area !== user.scopeValue))) return Response.json({ error: 'Il punto selezionato è fuori dal tuo ambito.' }, { status: 403 });
    report = { ...report, municipality: place.municipality, province: place.province };
  }
  const ok = await getReportStore().resolveRssDraft({ id: Number(id), country: user.country, scopeType: user.scopeType, scopeValue: user.scopeValue, moderatorId: user.id, nickname: user.nickname, createdAt: new Date().toISOString(), action: body.action, report, returnId: true });
  if (!ok) return Response.json({ error: 'Bozza già gestita o fuori dal tuo ambito.' }, { status: 409 });
  if (body.action === 'approve') after(() => dispatchTelegramReport(ok));
  return Response.json({ ok: true });
}
