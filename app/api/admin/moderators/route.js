import { allowedBrowserOrigin } from '../../../../lib/client.mjs';
import { getReportStore } from '../../../../lib/db.mjs';
import { activationExpiry, adminCountry, hashToken, newToken, validAdminToken } from '../../../../lib/moderator-auth.mjs';
import { moderatorEmailConfigured, sendModeratorActivation } from '../../../../lib/moderator-mail.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() { return Response.json({ error: 'Non autorizzato.' }, { status: 401 }); }

export async function GET(request) {
  if (!validAdminToken(request)) return unauthorized();
  return Response.json({ applications: await getReportStore().listModeratorApplications({ country: adminCountry() }), emailConfigured: moderatorEmailConfigured() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  if (!validAdminToken(request)) return unauthorized();
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Dati non validi.' }, { status: 400 }); }
  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id < 1 || !['approve', 'suspend'].includes(body.action)) return Response.json({ error: 'Richiesta non valida.' }, { status: 400 });
  const store = getReportStore();
  const country = adminCountry();
  const now = new Date().toISOString();
  if (body.action === 'suspend') {
    if (!(await store.suspendModerator({ id, country, createdAt: now }))) return Response.json({ error: 'Il moderatore non è attivo.' }, { status: 409 });
    return Response.json({ ok: true });
  }
  if (!moderatorEmailConfigured()) return Response.json({ error: 'Configura prima l’invio email sicuro per attivare moderatori.' }, { status: 503 });
  const token = newToken();
  const tokenHash = hashToken(token);
  const candidate = await store.beginModeratorApproval({ id, country, tokenHash, expiresAt: activationExpiry() });
  if (!candidate) return Response.json({ error: 'La candidatura non è più in attesa.' }, { status: 409 });
  try {
    await sendModeratorActivation({ ...candidate, token });
  } catch (error) {
    // Keep provider diagnostics in server logs only: the browser gets a
    // generic message so SMTP details cannot be exposed to unauthenticated UI.
    console.error('Moderator activation email failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode,
      response: error?.response,
    });
    return Response.json({ error: 'Email di attivazione non inviata. La candidatura resta in attesa; puoi riprovare.' }, { status: 502 });
  }
  if (!(await store.approveModerator({ id, country, tokenHash, createdAt: now }))) return Response.json({ error: 'Impossibile completare l’approvazione.' }, { status: 409 });
  return Response.json({ ok: true });
}
