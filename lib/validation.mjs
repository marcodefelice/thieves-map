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
export function reportStatus(occurredAt, now = Date.now()) {
  const age = now - Date.parse(occurredAt);
  return age < 3600_000 ? 'recent' : age < 86400_000 ? 'today' : age < 172800_000 ? 'older' : 'history';
}

export function reportVisibleByAge(report, now, showHistory) {
  const age = now - Date.parse(report.occurredAt);
  if (report.category === 'degradation') return age < 30 * 86400_000 || (showHistory && age < 365 * 86400_000);
  return age < 48 * 3600_000 || (showHistory && age < 30 * 86400_000);
}
