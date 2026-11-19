import { allowedBrowserOrigin } from '../../../../lib/client.mjs';
import { getReportStore } from '../../../../lib/db.mjs';
import { adminCountry, validAdminToken } from '../../../../lib/moderator-auth.mjs';
import { officialAreas } from '../../../../lib/official-areas.mjs';
import { reverseGeocode } from '../../../../lib/reverse-geocode.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// This endpoint deliberately receives no report data.  It can only import the
// reviewed catalogue above, and only from the private administrator session.
export async function POST(request) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  if (!validAdminToken(request)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const createdAt = new Date().toISOString();
  const store = getReportStore();
  const resolvedAreas = [];
  // Resolve every point before any database write.  A transient geocoder
  // failure therefore cannot turn a single import into a partial catalogue.
  for (const area of officialAreas) {
    let place;
    try { place = await reverseGeocode(area); }
    catch { return Response.json({ error: 'Impossibile verificare gli indirizzi dei punti ufficiali. Nessun punto è stato importato.' }, { status: 503 }); }
    if (place.country !== adminCountry()) return Response.json({ error: 'Il catalogo contiene un punto fuori dal Paese dell’amministratore. Nessun punto è stato importato.' }, { status: 409 });
    resolvedAreas.push({ ...area, country: place.country, municipality: place.municipality, province: place.province });
  }
  const imported = [];
  const skipped = [];
  for (const area of resolvedAreas) {
    const result = await store.importOfficialArea({ ...area, occurredAt: createdAt, createdAt });
    (result.imported ? imported : skipped).push(area.key);
  }
  return Response.json({ ok: true, imported, skipped });
}
