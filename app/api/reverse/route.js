export const dynamic = 'force-dynamic';
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const latText = params.get('lat'), lngText = params.get('lng');
  if (latText === null || lngText === null || !latText.trim() || !lngText.trim()) return Response.json({ error: 'Invalid coordinates' }, { status: 400 });
  const lat = Number(latText), lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return Response.json({ error: 'Invalid coordinates' }, { status: 400 });
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.search = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '18' });
    const response = await fetch(url, { headers: { 'User-Agent': process.env.GEOCODER_USER_AGENT || 'ThievesMap/1.0 (self-hosted map)' }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error();
    const result = await response.json();
    return Response.json({ address: result.display_name || null });
  } catch { return Response.json({ error: 'Address unavailable' }, { status: 502 }); }
}
