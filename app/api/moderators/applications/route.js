import { allowedBrowserOrigin, clientHash } from '../../../../lib/client.mjs';
import { getReportStore } from '../../../../lib/db.mjs';
import { validateModeratorApplication } from '../../../../lib/validation.mjs';
import { verifyTurnstile } from '../../../../lib/turnstile.mjs';
import { adminCountry } from '../../../../lib/moderator-auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return Response.json({ error: 'Formato non valido.' }, { status: 415 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Dati non validi.' }, { status: 400 }); }
  const error = validateModeratorApplication(body);
  if (error) return Response.json({ error }, { status: 400 });
  if (body.acceptedRules !== true) return Response.json({ error: 'Devi accettare le regole di collaborazione.' }, { status: 400 });
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const required = Boolean(process.env.VERCEL) || Boolean(secret) || Boolean(siteKey);
  if (required && (!secret || !siteKey)) return Response.json({ error: 'La verifica anti-spam non è configurata.' }, { status: 503 });
  if (required && !(await verifyTurnstile({ token: body.turnstileToken, secret, hostname: new URL(request.url).hostname, action: 'moderator_application' }))) return Response.json({ error: 'Verifica anti-spam non riuscita.' }, { status: 403 });
  try {
    const created = await getReportStore().createModeratorApplication({ ...body, country: adminCountry(), applicantHash: clientHash(request), createdAt: new Date().toISOString() });
    if (!created) return Response.json({ error: 'Hai raggiunto il limite di candidature. Riprova domani.' }, { status: 429 });
  } catch (cause) {
    if (/unique constraint/i.test(String(cause.message))) return Response.json({ error: 'Nickname o email già presenti.' }, { status: 409 });
    throw cause;
  }
  return Response.json({ ok: true }, { status: 201 });
}
