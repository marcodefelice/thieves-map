export const dynamic = 'force-dynamic';
export async function GET(request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() || '';
  if (q.length < 4 || q.length > 200) return Response.json({ error: 'Inserisci almeno 4 caratteri.' }, { status: 400 });
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    // Italian addresses are often written "street, number, postcode city (province)".
    // Nominatim can resolve them better with the number first and without the
    // street type, which may differ between local address sources.
    const address = q.match(/^(.+?),\s*(\d+[\w/-]*),\s*(.+)$/u);
    const normalized = address
      ? `${address[2]} ${address[1].replace(/^(?:via|viale|v\.le|v\.)\s+/i, '')}, ${address[3].replace(/\s*\([A-Za-z]{2}\)\s*$/, '')}`
      : q;
    url.search = new URLSearchParams({ q: normalized, format: 'jsonv2', limit: '5', addressdetails: '0' }).toString();
    const response = await fetch(url, { headers: { 'User-Agent': process.env.GEOCODER_USER_AGENT || 'ThievesMap/1.0 (self-hosted map)', 'Accept-Language': 'it' }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error();
    const data = await response.json();
    return Response.json(data.map(item => ({ name: item.display_name, lat: Number(item.lat), lng: Number(item.lon) })));
  } catch { return Response.json({ error: 'Ricerca indirizzo temporaneamente non disponibile.' }, { status: 502 }); }
}
