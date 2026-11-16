import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryForLocation } from '../lib/countries.mjs';

test('identifies countries for report and map coordinates worldwide', () => {
  assert.equal(countryForLocation({ lat: 45.4642, lng: 9.19 }), 'IT');
  assert.equal(countryForLocation({ lat: 40.7128, lng: -74.006 }), 'US');
  assert.equal(countryForLocation({ lat: 40.4168, lng: -3.7038 }), 'ES');
  assert.equal(countryForLocation({ lat: -33.8688, lng: 151.2093 }), 'AU');
  assert.equal(countryForLocation({ lat: 0, lng: -140 }), null);
  assert.equal(countryForLocation({ lat: 100, lng: 0 }), null);
});
