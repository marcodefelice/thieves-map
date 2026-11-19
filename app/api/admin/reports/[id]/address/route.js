import { allowedBrowserOrigin } from '../../../../../../lib/client.mjs';
import { getReportStore } from '../../../../../../lib/db.mjs';
import { adminCountry, validAdminToken } from '../../../../../../lib/moderator-auth.mjs';
import { reverseGeocode } from '../../../../../../lib/reverse-geocode.mjs';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  if (!validAdminToken(request)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({ error: 'Segnalazione non valida.' }, { status: 400 });
  const store = getReportStore();
  const report = await store.reportAddress({ reportId: Number(id), country: adminCountry() });
  if (!report) return Response.json({ error: 'Segnalazione non trovata nel tuo paese.' }, { status: 404 });
  if (report.address) return Response.json({ address: report.address, cached: true });
  let place;
  try { place = await reverseGeocode(report); }
  catch { return Response.json({ error: 'Indirizzo temporaneamente non disponibile. Riprova più tardi.' }, { status: 503 }); }
  if (!place.address || place.country !== adminCountry()) return Response.json({ error: 'Indirizzo non disponibile per questa segnalazione.' }, { status: 422 });
  await store.saveReportAddress({ reportId: report.id, address: place.address, createdAt: new Date().toISOString() });
  await store.saveReportAdministrativeArea({ reportId: report.id, municipality: place.municipality, province: place.province });
  return Response.json({ address: place.address, cached: false });
}
