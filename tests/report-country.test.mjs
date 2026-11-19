import test from 'node:test';
import assert from 'node:assert/strict';
import { checkReportCountry } from '../lib/report-country.mjs';

const rome = { lat: 41.9, lng: 12.5 };
const request = headers => new Request('https://example.com/api/reports', { headers });
test('accepts matching country and rejects different or unknown countries', () => {
  const env = { VERCEL: '1' };
  assert.equal(checkReportCountry(request({ 'x-vercel-ip-country': 'IT' }), rome, env), null);
  assert.equal(checkReportCountry(request({ 'x-vercel-ip-country': 'FR' }), rome, env), 'country_mismatch');
  assert.equal(checkReportCountry(request({ 'x-vercel-ip-country': 'XX' }), rome, env), 'country_unavailable');
  assert.equal(checkReportCountry(request({ 'x-vercel-ip-country': 'IT' }), { lat: 0, lng: 0 }, env), 'report_country_unknown');
});
test('ignores untrusted headers and requires an explicitly trusted proxy', () => {
  const req = request({ 'x-country-code': 'IT', 'x-vercel-ip-country': 'IT' });
  assert.equal(checkReportCountry(req, rome, {}), 'country_unavailable');
  assert.equal(checkReportCountry(req, rome, { TRUST_COUNTRY_PROXY: '1' }), null);
  assert.equal(checkReportCountry(request({}), rome, { TRUST_COUNTRY_PROXY: '1' }), 'country_unavailable');
});
