import { countryForLocation } from '../../../lib/countries.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const lat = params.get('lat'), lng = params.get('lng');
  if (lat === null || lng === null || !lat.trim() || !lng.trim() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) return Response.json({ error: 'Invalid coordinates' }, { status: 400 });
  return Response.json({ country: countryForLocation({ lat: Number(lat), lng: Number(lng) }) }, { headers: { 'Cache-Control': 'no-store' } });
}
