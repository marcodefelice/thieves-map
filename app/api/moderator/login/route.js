import { allowedBrowserOrigin, clientHash } from '../../../../lib/client.mjs';
import { getReportStore } from '../../../../lib/db.mjs';
import { hashToken, newToken, sessionCookie, sessionExpiry, verifyPassword } from '../../../../lib/moderator-auth.mjs';

export const runtime = 'nodejs';

export async function POST(request) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Credenziali non valide.' }, { status: 400 }); }
  if (typeof body.email !== 'string' || typeof body.password !== 'string') return Response.json({ error: 'Credenziali non valide.' }, { status: 400 });
  const now = new Date().toISOString();
  const store = getReportStore();
  const attempt = { clientHash: clientHash(request), identityHash: hashToken(body.email.trim().toLowerCase()), createdAt: now };
  if (!(await store.recordModeratorLoginAttempt(attempt))) return Response.json({ error: 'Troppi tentativi. Riprova tra alcuni minuti.' }, { status: 429 });
  const moderator = await store.moderatorForLogin({ email: body.email, now });
  if (!moderator || !(await verifyPassword(body.password, moderator.passwordHash))) return Response.json({ error: 'Email o password non valide.' }, { status: 401 });
  const token = newToken();
  const expiresAt = sessionExpiry();
  await store.clearModeratorLoginAttempts(attempt);
  await store.createModeratorSession({ sessionHash: hashToken(token), moderatorId: moderator.id, expiresAt, createdAt: now });
  return Response.json({ ok: true, moderator: { nickname: moderator.nickname } }, { headers: { 'Set-Cookie': sessionCookie(token, expiresAt), 'Cache-Control': 'no-store' } });
}
