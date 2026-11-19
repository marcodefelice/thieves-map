import { getReportStore } from '../../../../../lib/db.mjs';
import { allowedOrigin, clientHash } from '../../../../../lib/client.mjs';

export const runtime = 'nodejs';
export async function POST(request, { params }) {
  if (!allowedOrigin(request)) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({ error: 'Invalid report' }, { status: 400 });
  let kind = 'confirm';
  if ((request.headers.get('content-type') || '').startsWith('application/json')) {
    try { kind = (await request.json()).kind; } catch { return Response.json({ error: 'Invalid vote' }, { status: 400 }); }
    if (!['confirm', 'dispute'].includes(kind)) return Response.json({ error: 'Invalid vote' }, { status: 400 });
  }
  const confirmed = await getReportStore().confirm({ reportId: Number(id), clientHash: clientHash(request), createdAt: new Date().toISOString(), kind });
  if (!confirmed) return Response.json({ error: 'Confirmation unavailable' }, { status: 409 });
  return Response.json({ ok: true }, { status: 201 });
}
