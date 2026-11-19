import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedBrowserOrigin } from '../lib/client.mjs';

test('privileged browser writes require a same-origin Origin header', () => {
  assert.equal(allowedBrowserOrigin(new Request('https://example.test/api/moderator/login', { method: 'POST', headers: { Origin: 'https://example.test' } })), true);
  assert.equal(allowedBrowserOrigin(new Request('https://example.test/api/moderator/login', { method: 'POST', headers: { Origin: 'https://attacker.test' } })), false);
  assert.equal(allowedBrowserOrigin(new Request('https://example.test/api/moderator/login', { method: 'POST' })), false);
});
