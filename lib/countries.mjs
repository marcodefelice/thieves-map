import { feature } from 'topojson-client';
import countries from 'i18n-iso-countries';
import topology from 'world-atlas/countries-10m.json' with { type: 'json' };

const shapes = feature(topology, topology.objects.countries).features.map(item => {
  const polygons = item.geometry.type === 'Polygon' ? [item.geometry.coordinates] : item.geometry.coordinates;
  return { code: countries.numericToAlpha2(item.id) || null, polygons: polygons.map(rings => {
    const points = rings[0];
    return { rings, bounds: points.reduce(([minX,minY,maxX,maxY], [x,y]) => [Math.min(minX,x),Math.min(minY,y),Math.max(maxX,x),Math.max(maxY,y)], [180,90,-180,-90]) };
  }) };
}).filter(item => item.code);

function insideRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// The source is a simplified world map. Locations near borders or on small
// islands can be indeterminate; do not silently assign them to a country.
export function countryForLocation({ lat, lng }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  for (const shape of shapes) for (const { rings, bounds: [minX,minY,maxX,maxY] } of shape.polygons) {
    if (lng >= minX && lng <= maxX && lat >= minY && lat <= maxY && insideRing(lng, lat, rings[0]) && !rings.slice(1).some(ring => insideRing(lng, lat, ring))) return shape.code;
  }
  return null;
}
