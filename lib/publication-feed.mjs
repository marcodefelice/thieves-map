import { shareableReport } from './report-share.mjs';

export const categories = { theft: 'Furto o tentata effrazione', crime: 'Delinquenza o movimento sospetto', degradation: 'Degrado urbano', antisocial: 'Delinquenza o degrado' };
export function publicOrigin() {
  const url = new URL(process.env.PUBLIC_ORIGIN || 'https://thievesmap.cloud');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin.');
  return url.origin;
}
export function reportUrl(report) { return `${publicOrigin()}/s/${report.id}`; }
export function reportSummary(report) {
  const text = (report.notes || '').replace(/\s+/g, ' ').trim();
  return text.length > 280 ? `${text.slice(0, 277)}…` : text || 'Apri la mappa per i dettagli.';
}
export function reportLabel(report) { return categories[report.category] || 'Segnalazione'; }
export function reportVerification(report) { return report.verifiedByNickname ? 'Verificata da un moderatore' : 'Segnalazione della community non verificata'; }
export function reportDate(report) { return new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeZone: 'Europe/Rome' }).format(new Date(report.occurredAt)); }
export function storedArea(report) {
  if (report.municipality || report.province) return report.municipality || report.province;
  try { if (report.country && !['UN', 'ZZ'].includes(report.country)) return new Intl.DisplayNames(['it'], { type: 'region' }).of(report.country); } catch {}
  return 'Zona sulla mappa';
}
export function xmlEscape(value) {
  return Array.from(String(value)).filter(char => { const code = char.codePointAt(0); return code === 9 || code === 10 || code === 13 || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff); }).join('').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
}
export function rssXml(reports, now = Date.now()) {
  const origin = publicOrigin();
  const items = reports.filter(report => report.verifiedAt && shareableReport(report, now)).map(report => {
    const url = reportUrl(report);
    const zone = storedArea(report);
    const title = `${reportLabel(report)} · ${zone}`;
    const date = new Date(report.verifiedAt);
    const description = `${reportVerification(report)}. Data indicata: ${reportDate(report)}. ${reportSummary(report)}`;
    return `<item><title>${xmlEscape(title)}</title><link>${xmlEscape(url)}</link><guid isPermaLink="true">${xmlEscape(url)}</guid><description>${xmlEscape(description)}</description>${Number.isNaN(date.getTime()) ? '' : `<pubDate>${date.toUTCString()}</pubDate>`}</item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Punto Sicuro — Segnalazioni</title><link>${xmlEscape(origin)}</link><description>Segnalazioni verificate e pubblicate sulla mappa Punto Sicuro.</description><language>it</language>${items}</channel></rss>`;
}
