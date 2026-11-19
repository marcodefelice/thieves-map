// A fixed grid keeps the public location stable across requests and deployments.
// At the equator the furthest point in a cell is about 134 metres from its centre.
const STEP = 0.0017;
export function approximateLocation({ lat, lng }) {
  return {
    lat: Math.max(-90, Math.min(90, Number((Math.round(lat / STEP) * STEP).toFixed(4)))),
    lng: Math.max(-180, Math.min(180, Number((Math.round(lng / STEP) * STEP).toFixed(4)))),
  };
}

export function normalizeAdministrativeArea(value) {
  return typeof value === 'string' ? value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('it-IT').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ') : '';
}
