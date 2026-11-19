import { normalizeAdministrativeArea } from './location.mjs';

export function validateReport(body, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Dati non validi.';
  const { lat, lng, occurredAt } = body;
  if (body.indirect !== undefined && typeof body.indirect !== 'boolean') return 'Fonte non valida.';
  if (body.category === 'crime' && body.publicPlaceConfirmed !== true) return 'Conferma che il luogo indicato è pubblico e non identifica persone o attività.';
  if (body.category !== undefined && !['theft', 'crime', 'degradation', 'antisocial'].includes(body.category)) return 'Tipologia non valida.';
  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 500)) return 'Note non valide.';
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 || typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) return 'Posizione non valida.';
  if (typeof occurredAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?Z$/.test(occurredAt)) return 'Data e ora non valide.';
  const time = Date.parse(occurredAt);
  if (!Number.isFinite(time) || time > now + 60_000 || time < now - 365 * 86400_000) return 'Scegli una data nell’ultimo anno, non futura.';
  return null;
}

export function validateModeratorApplication(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Dati non validi.';
  const { nickname, email, area, address, scopeType, note } = body;
  if (typeof nickname !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N}_. -]{2,29}$/u.test(nickname.trim())) return 'Scegli un nickname di 3–30 caratteri.';
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Inserisci un’email valida.';
  if (typeof scopeType !== 'string' || !['municipality', 'province'].includes(scopeType)) return 'Scegli Comune oppure Provincia.';
  if (typeof area !== 'string' || area.trim().length < 2 || area.trim().length > 120) return 'Indica un Comune o una Provincia validi.';
  if (normalizeAdministrativeArea(area) === 'italia') return 'Scegli un Comune o una Provincia, non l’Italia intera.';
  if (typeof address !== 'string' || address.trim().length < 2 || address.trim().length > 200) return 'Indica una località o un indirizzo di riferimento.';
  if (typeof note !== 'string' || note.trim().length < 20 || note.trim().length > 1_000) return 'La nota deve contenere da 20 a 1000 caratteri.';
  return null;
}

export function validateModeratorReport(body, now = Date.now()) {
  const error = validateReport(body, now);
  if (error) return error;
  if (typeof body.source !== 'string' || body.source.length > 2_048) return 'Inserisci il link HTTPS alla fonte.';
  try {
    const url = new URL(body.source);
    if (url.protocol !== 'https:' || url.username || url.password) return 'La fonte deve essere un link HTTPS pubblico.';
  } catch {
    return 'La fonte deve essere un link HTTPS valido.';
  }
  return null;
}

export function validateAdminReport(body, now = Date.now()) {
  const error = validateReport(body, now);
  if (error) return error;
  if (body.source === undefined || body.source === '') return null;
  if (typeof body.source !== 'string' || body.source.length > 2_048) return 'La fonte non è valida.';
  try {
    const url = new URL(body.source);
    if (url.protocol !== 'https:' || url.username || url.password) return 'La fonte deve essere un link HTTPS pubblico.';
  } catch {
    return 'La fonte deve essere un link HTTPS valido.';
  }
  return null;
}
export function reportStatus(occurredAt, now = Date.now()) {
  const age = now - Date.parse(occurredAt);
  return age < 3600_000 ? 'recent' : age < 86400_000 ? 'today' : age < 172800_000 ? 'older' : 'history';
}

export function reportVisibleByAge(report, now, showHistory) {
  const age = now - Date.parse(report.occurredAt);
  if (report.category === 'degradation') return age < 30 * 86400_000 || (showHistory && age < 365 * 86400_000);
  return age < 48 * 3600_000 || (showHistory && age < 30 * 86400_000);
}
