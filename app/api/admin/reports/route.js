import { allowedBrowserOrigin } from '../../../../lib/client.mjs';
import { getReportStore } from '../../../../lib/db.mjs';
import { adminCountry, validAdminToken } from '../../../../lib/moderator-auth.mjs';
import { reverseGeocode } from '../../../../lib/reverse-geocode.mjs';
import { validateAdminReport } from '../../../../lib/validation.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!validAdminToken(request)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const page = Number(new URL(request.url).searchParams.get('page') || '1');
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) return Response.json({ error: 'Pagina non valida.' }, { status: 400 });
  return Response.json(await getReportStore().listReportsForModeration({ country: adminCountry(), page }), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  if (!validAdminToken(request)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return Response.json({ error: 'Formato non valido.' }, { status: 415 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Dati non validi.' }, { status: 400 }); }
  const error = validateAdminReport(body);
  if (error) return Response.json({ error }, { status: 400 });
  let place;
  try { place = await reverseGeocode(body); }
  catch { return Response.json({ error: 'Impossibile verificare l’indirizzo. Riprova più tardi.' }, { status: 503 }); }
  if (place.country !== adminCountry()) return Response.json({ error: 'Puoi inserire soltanto punti in Italia.' }, { status: 403 });
  const id = await getReportStore().submitAdminReport({ ...body, country: place.country, municipality: place.municipality, province: place.province, nickname: 'Punto Sicuro', createdAt: new Date().toISOString() });
  return Response.json({ ok: true, id }, { status: 201 });
}
