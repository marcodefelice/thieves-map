import { allowedBrowserOrigin, clientHash } from '../../../../lib/client.mjs';
import { getReportStore } from '../../../../lib/db.mjs';
import { hashPassword, hashToken, validPassword } from '../../../../lib/moderator-auth.mjs';

export const runtime = 'nodejs';

export async function POST(request) {
  if (!allowedBrowserOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Dati non validi.' }, { status: 400 }); }
  if (typeof body.token !== 'string' || body.token.length < 32 || body.token.length > 128) return Response.json({ error: 'Link di attivazione non valido.' }, { status: 400 });
  if (!validPassword(body.password)) return Response.json({ error: 'Scegli una password di almeno 12 caratteri.' }, { status: 400 });
  const store = getReportStore();
  const now = new Date().toISOString();
  const tokenHash = hashToken(body.token);
  const attempt = { clientHash: clientHash(request), identityHash: tokenHash, createdAt: now };
  if (!(await store.recordModeratorLoginAttempt(attempt))) return Response.json({ error: 'Troppi tentativi. Riprova tra alcuni minuti.' }, { status: 429 });
  const ok = await store.activateModerator({ tokenHash, passwordHash: await hashPassword(body.password), now });
  if (!ok) return Response.json({ error: 'Link non valido, già usato o scaduto.' }, { status: 400 });
  await store.clearModeratorLoginAttempts(attempt);
  return Response.json({ ok: true });
}
