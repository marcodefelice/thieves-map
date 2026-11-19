import { currentModerator } from '../../../../lib/moderator-auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const moderator = await currentModerator(request);
  if (!moderator) return Response.json({ error: 'Non autorizzato.' }, { status: 401 });
  return Response.json({ moderator }, { headers: { 'Cache-Control': 'no-store' } });
}
