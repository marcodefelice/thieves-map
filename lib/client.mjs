import { createHash } from 'node:crypto';

export function clientHash(request) {
  const forwarded = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') : process.env.TRUST_PROXY === '1' ? request.headers.get('x-forwarded-for') : null;
  const ip = forwarded?.split(',').at(-1).trim() || 'shared';
  return createHash('sha256').update(`${process.env.IP_HASH_SALT || 'local-only'}:${ip}`).digest('hex');
}

export function allowedOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin || origin === process.env.PUBLIC_ORIGIN;
}

// Credential-bearing and privileged writes are browser-only. Requiring Origin
// there prevents a cross-site form from relying on ambient cookies.
export function allowedBrowserOrigin(request) {
  return Boolean(request.headers.get('origin')) && allowedOrigin(request);
}
