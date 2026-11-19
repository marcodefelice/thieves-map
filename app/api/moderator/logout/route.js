import { allowedBrowserOrigin } from '../../../../lib/client.mjs';
import { getReportStore } from '../../../../lib/db.mjs';
import { clearSessionCookie, hashToken, sessionToken } from '../../../../lib/moderator-auth.mjs';

export const runtime = 'nodejs';

export async function POST(request) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  const token = sessionToken(request);
  if (token) await getReportStore().deleteModeratorSession(hashToken(token));
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookie() } });
}
