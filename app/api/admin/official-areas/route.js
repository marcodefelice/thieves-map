import { allowedBrowserOrigin } from '../../../../lib/client.mjs';
import { getReportStore } from '../../../../lib/db.mjs';
import { adminCountry, validAdminToken } from '../../../../lib/moderator-auth.mjs';
import { officialAreas } from '../../../../lib/official-areas.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// This endpoint deliberately receives no report data.  It can only import the
// reviewed catalogue above, and only from the private administrator session.
export async function POST(request) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  if (!validAdminToken(request)) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  const createdAt = new Date().toISOString();
  const store = getReportStore();
  // The catalogue is closed and reviewed in source control. Keeping the
  // country in it makes the all-or-nothing import independent of Nominatim,
  // which is rate-limited and should not be used as a bulk verification API.
  if (officialAreas.some((area) => area.country !== adminCountry())) {
    return Response.json({ error: 'Il catalogo contiene un punto fuori dal Paese dell’amministratore. Nessun punto è stato importato.' }, { status: 409 });
  }
  const imported = [];
  const skipped = [];
  for (const area of officialAreas) {
    const result = await store.importOfficialArea({ ...area, occurredAt: createdAt, createdAt });
    (result.imported ? imported : skipped).push(area.key);
  }
  return Response.json({ ok: true, imported, skipped });
}
