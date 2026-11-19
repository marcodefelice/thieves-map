import { clientHash, allowedOrigin } from '../../../lib/client.mjs';
import { approximateLocation } from '../../../lib/location.mjs';
import { getReportStore } from '../../../lib/db.mjs';
import { validateReport } from '../../../lib/validation.mjs';
import { notifyNearby } from '../../../lib/push.mjs';
import { verifyTurnstile } from '../../../lib/turnstile.mjs';
import { after } from 'next/server';
import { checkReportCountry } from '../../../lib/report-country.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request) {
  const reports = await getReportStore().list(clientHash(request));
  return Response.json(reports, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request) {
  if (!allowedOrigin(request)) return Response.json({ error: 'Origine non consentita.' }, { status: 403 });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return Response.json({ error: 'Formato non valido.' }, { status: 415 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Dati non validi.' }, { status: 400 }); }
  const error = validateReport(body);
  if (error) return Response.json({ error }, { status: 400 });
  const countryError = checkReportCountry(request, body);
  if (countryError) return Response.json({ error: 'Impossibile verificare il Paese della segnalazione.', code: countryError }, { status: 403 });
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY;
  const turnstileRequired = Boolean(process.env.VERCEL) || Boolean(turnstileSecret) || Boolean(turnstileSiteKey);
  if (turnstileRequired && (!turnstileSecret || !turnstileSiteKey)) {
    return Response.json({ error: 'Anti-spam verification is not configured.', code: 'turnstile_not_configured' }, { status: 503 });
  }
  if (turnstileRequired && !(await verifyTurnstile({ token: body.turnstileToken, secret: turnstileSecret, hostname: new URL(request.url).hostname }))) {
    return Response.json({ error: 'Anti-spam verification failed.', code: 'turnstile_failed' }, { status: 403 });
  }
  const hash = clientHash(request);
  const now = new Date().toISOString();
  const inserted = await getReportStore().submit({ ...body, createdAt: now, clientHash: hash });
  if (!inserted) return Response.json({ error: 'Limite di segnalazioni raggiunto. Riprova più tardi.' }, { status: 429 });
  after(async () => { try { await notifyNearby({ ...body, ...approximateLocation(body) }); } catch (error) { console.error('Push dispatch failed:', error.message); } });
  return Response.json({ ok: true }, { status: 201 });
}
