import * as webpush from 'web-push';
import { getReportStore } from './db.mjs';

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}
export function validEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    const hosts = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'wns2-bl2p.notify.windows.com'];
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && (hosts.includes(url.hostname) || url.hostname.endsWith('.push.apple.com') || url.hostname.endsWith('.notify.windows.com'));
  } catch { return false; }
}
export function distanceKm(a, b) {
  const rad = value => value * Math.PI / 180;
  const dlat = rad(b.lat - a.lat), dlng = rad(b.lng - a.lng);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const text = {
  it: 'Nuova segnalazione non verificata nella zona che segui.',
  en: 'A new unverified report has been added near your selected location.',
  es: 'Hay un nuevo aviso no verificado cerca de la zona que sigues.',
};
export async function notifyNearby(report) {
  if (!pushConfigured() || report.category === 'degradation' || Date.now() - Date.parse(report.occurredAt) >= 3600_000) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const store = getReportStore();
  const subscriptions = await store.listSubscriptions();
  // Process bounded batches so an individual slow push provider cannot stall all sends.
  for (let index = 0; index < subscriptions.length; index += 20) {
    await Promise.allSettled(subscriptions.slice(index, index + 20).filter(item => validEndpoint(item.endpoint) && distanceKm(item, report) <= item.radius).map(async item => {
      try {
        await webpush.sendNotification({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } }, JSON.stringify({ title: 'Thieves Map', body: text[item.language] || text.it }), { TTL: 3600, timeout: 5000 });
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) await store.deleteSubscription(item.endpoint);
        else console.error('Push delivery failed:', error.statusCode || error.message);
      }
    }));
  }
}
