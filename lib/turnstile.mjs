const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile({ token, secret, hostname, action = 'report' }) {
  if (!secret || typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true && result.action === action && result.hostname === hostname;
  } catch {
    return false;
  }
}
