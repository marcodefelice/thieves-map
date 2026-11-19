import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smtpOptions } from '../lib/moderator-mail.mjs';

test('uses encrypted Aruba SMTP defaults and accepts explicit STARTTLS configuration', () => {
  const credentials = { SMTP_HOST: 'smtps.aruba.it', SMTP_USER: 'moderatori@example.test', SMTP_PASSWORD: 'secret' };
  const secure = smtpOptions(credentials);
  assert.equal(secure.port, 465);
  assert.equal(secure.secure, true);
  assert.equal(secure.auth.user, credentials.SMTP_USER);
  const starttls = smtpOptions({ ...credentials, SMTP_PORT: '587', SMTP_SECURE: 'false' });
  assert.equal(starttls.port, 587);
  assert.equal(starttls.secure, false);
});
