import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getReportStore } from './db.mjs';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'thieves_map_moderator';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const ACTIVATION_TTL_MS = 48 * 60 * 60 * 1_000;

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken() {
  return randomBytes(32).toString('base64url');
}

export function activationExpiry(now = Date.now()) {
  return new Date(now + ACTIVATION_TTL_MS).toISOString();
}

export function sessionExpiry(now = Date.now()) {
  return new Date(now + SESSION_TTL_MS).toISOString();
}

export function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128;
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const digest = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(digest).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || typeof encoded !== 'string') return false;
  const [algorithm, salt, stored] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !stored) return false;
  try {
    const actual = Buffer.from(await scrypt(password, salt, 64));
    const expected = Buffer.from(stored, 'base64url');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function sessionCookie(token, expiresAt) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function sessionToken(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

export async function currentModerator(request) {
  const token = sessionToken(request);
  if (!token || token.length > 128) return null;
  return getReportStore().moderatorForSession({ sessionHash: hashToken(token), now: new Date().toISOString() });
}

export function validAdminToken(request) {
  const expected = process.env.ADMIN_API_TOKEN;
  const actual = request.headers.get('x-admin-token');
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function adminCountry() {
  const country = (process.env.ADMIN_COUNTRY || 'IT').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('ADMIN_COUNTRY must be an ISO 3166-1 alpha-2 code.');
  return country;
}
