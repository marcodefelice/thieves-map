import { normalizeAdministrativeArea } from './location.mjs';

export async function reverseGeocode({ lat, lng }) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.search = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '18', addressdetails: '1' });
  const response = await fetch(url, { headers: { 'User-Agent': process.env.GEOCODER_USER_AGENT || 'ThievesMap/1.0 (self-hosted map)', 'Accept-Language': 'it' }, next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error('Address unavailable');
  const result = await response.json();
  const address = result.address || {};
  return {
    address: result.display_name || null,
    country: typeof address.country_code === 'string' ? address.country_code.toUpperCase() : null,
    municipality: normalizeAdministrativeArea(address.city || address.town || address.village || address.municipality || address.city_district),
    province: normalizeAdministrativeArea(address.province || address.county || address.state_district),
  };
}
