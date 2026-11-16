import { getReportStore } from '../../../lib/db.mjs';
import { pushConfigured, validEndpoint } from '../../../lib/push.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export function GET() {
  return Response.json({ enabled: pushConfigured(), publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request) {
  const origin = request.headers.get('origin');
  if (!origin || (origin !== new URL(request.url).origin && origin !== process.env.PUBLIC_ORIGIN)) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return Response.json({ error: 'Invalid content type' }, { status: 415 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!body || typeof body.endpoint !== 'string' || body.endpoint.length > 2048 || !validEndpoint(body.endpoint)) return Response.json({ error: 'Invalid subscription' }, { status: 400 });
  const store = getReportStore();
  if (body.action === 'unsubscribe') { await store.deleteSubscription(body.endpoint); return Response.json({ ok: true }); }
  const validKey = (value, bytes) => typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) && Buffer.from(value, 'base64url').length === bytes;
  if (!pushConfigured()) return Response.json({ error: 'Push not configured' }, { status: 503 });
  if (!validKey(body.keys?.p256dh, 65) || !validKey(body.keys?.auth, 16) || typeof body.lat !== 'number' || !Number.isFinite(body.lat) || body.lat < -90 || body.lat > 90 || typeof body.lng !== 'number' || !Number.isFinite(body.lng) || body.lng < -180 || body.lng > 180 || ![1, 5, 10, 25].includes(body.radius) || !['it','en','es'].includes(body.language)) return Response.json({ error: 'Invalid subscription' }, { status: 400 });
  await store.saveSubscription(body);
  return Response.json({ ok: true });
}
