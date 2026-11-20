import { getReportStore } from './db.mjs';
import { normalizeAdministrativeArea } from './location.mjs';
import { reportZone, shareableReport } from './report-share.mjs';
import { reportDate, reportLabel, reportSummary, reportUrl, reportVerification } from './publication-feed.mjs';

export async function publishTelegramReport(id, { verification = false } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;
  const report = await getReportStore().sharedReport(id);
  if (!shareableReport(report)) return false;
  const zone = await reportZone(report);
  const filter = process.env.TELEGRAM_MUNICIPALITY?.trim();
  if (filter && normalizeAdministrativeArea(zone) !== normalizeAdministrativeArea(filter)) return false;
  const text = [verification ? 'Segnalazione verificata' : 'Nuova segnalazione', `Categoria: ${reportLabel(report)}`, `Zona: ${zone}`, `Data indicata: ${reportDate(report)}`, reportVerification(report), `Riassunto: ${reportSummary(report)}`, reportUrl(report)].join('\n');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(8000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) throw new Error(`Telegram delivery failed (HTTP ${response.status})`);
  return true;
}
export async function dispatchTelegramReport(id, options) {
  try { await publishTelegramReport(id, options); }
  catch { console.error('Telegram delivery failed. Check bot configuration and Telegram availability.'); }
}
