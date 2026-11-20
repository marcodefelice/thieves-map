import { reportVisibleByAge } from './validation.mjs';

export function parseSharedReportId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function shareableReport(report, now = Date.now()) {
  return Boolean(report && reportVisibleByAge(report, now, true));
}

export function reportShareMetadata(report, zone) {
  const category = { theft: 'Furto o tentata effrazione', crime: 'Movimento sospetto o delinquenza', degradation: 'Degrado urbano', antisocial: 'Delinquenza o degrado' }[report.category] || 'Segnalazione';
  const title = `${category} · ${zone} | Punto Sicuro`;
  const date = new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeZone: 'Europe/Rome' }).format(new Date(report.occurredAt));
  const status = report.verifiedByNickname ? 'Segnalazione verificata da un moderatore.' : 'Segnalazione della community non verificata.';
  return { title, description: `${status} Data indicata: ${date}. Apri la mappa per i dettagli.` };
}

// Request only an administrative area using the same public coordinates as the map.
export async function reportZone(report) {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.search = new URLSearchParams({ lat: String(report.lat), lon: String(report.lng), format: 'jsonv2', zoom: '10', addressdetails: '1' });
    const response = await fetch(url, { headers: { 'User-Agent': process.env.GEOCODER_USER_AGENT || 'ThievesMap/1.0 (self-hosted map)', 'Accept-Language': 'it' }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      const { address = {} } = await response.json();
      const zone = address.city || address.town || address.village || address.municipality || address.county || address.state;
      if (typeof zone === 'string' && zone.trim()) return zone.trim();
    }
  } catch {}
  if (report.municipality) return report.municipality;
  if (report.province) return report.province;
  try { if (report.country && report.country !== 'UN' && report.country !== 'ZZ') return new Intl.DisplayNames(['it'], { type: 'region' }).of(report.country); } catch {}
  return 'Zona sulla mappa';
}
