import countries from 'i18n-iso-countries';
import { countryForLocation } from './countries.mjs';

// Only trust a country header injected by the hosting platform or an explicitly
// configured proxy that strips incoming copies of the header.
export function checkReportCountry(request, location, env = process.env) {
  const header = env.VERCEL ? 'x-vercel-ip-country' : env.TRUST_COUNTRY_PROXY === '1' ? 'x-country-code' : null;
  const raw = header && request.headers.get(header);
  const visitorCountry = raw?.trim().toUpperCase();
  if (!visitorCountry || !countries.isValid(visitorCountry)) return 'country_unavailable';
  const reportCountry = countryForLocation(location);
  if (!reportCountry) return 'report_country_unknown';
  return visitorCountry === reportCountry ? null : 'country_mismatch';
}
