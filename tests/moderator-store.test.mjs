import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { createReportStore } from '../lib/db.mjs';
import { hashPassword, hashToken, verifyPassword } from '../lib/moderator-auth.mjs';
import { validateModeratorApplication, validateModeratorReport } from '../lib/validation.mjs';

const now = '2026-11-19T10:00:00.000Z';

test('validates a narrow moderator application and sourced moderator report', () => {
  const application = { nickname: 'Anna.Map', email: 'anna@example.test', area: 'Varese', note: 'Conosco bene la zona e voglio contribuire in modo responsabile.' };
  assert.equal(validateModeratorApplication(application), null);
  assert.ok(validateModeratorApplication({ ...application, nickname: 'x' }));
  assert.ok(validateModeratorApplication({ ...application, note: 'troppo corta' }));
  const report = { lat: 45.8, lng: 8.8, occurredAt: '2026-11-19T09:00:00.000Z', source: 'https://example.test/cronaca', category: 'theft' };
  assert.equal(validateModeratorReport(report, Date.parse(now)), null);
  assert.ok(validateModeratorReport({ ...report, source: 'http://example.test/cronaca' }, Date.parse(now)));
});

test('approval, activation, session revocation, sourced pins and audit are all persistent', async () => {
  const store = createReportStore(createClient({ url: 'file::memory:' }));
  assert.equal(await store.createModeratorApplication({ nickname: 'Anna.Map', email: 'anna@example.test', area: 'Varese', note: 'Conosco bene la zona e voglio contribuire in modo responsabile.', applicantHash: 'applicant', createdAt: now }), true);
  const [application] = await store.listModeratorApplications();
  assert.equal(application.status, 'pending');

  const activationHash = hashToken('activation-token');
  assert.deepEqual(await store.beginModeratorApproval({ id: application.id, tokenHash: activationHash, expiresAt: '2026-11-21T10:00:00.000Z' }), { email: 'anna@example.test', nickname: 'Anna.Map' });
  assert.equal(await store.approveModerator({ id: application.id, tokenHash: activationHash, createdAt: now }), true);
  const passwordHash = await hashPassword('a long enough test password');
  assert.equal(await store.activateModerator({ tokenHash: activationHash, passwordHash, now }), true);
  assert.equal(await store.activateModerator({ tokenHash: activationHash, passwordHash, now }), false);
  const moderator = await store.moderatorForLogin({ email: 'anna@example.test', now });
  assert.equal(await verifyPassword('a long enough test password', moderator.passwordHash), true);

  await store.createModeratorSession({ sessionHash: hashToken('session-token'), moderatorId: moderator.id, createdAt: now, expiresAt: '2026-11-20T10:00:00.000Z' });
  assert.equal((await store.moderatorForSession({ sessionHash: hashToken('session-token'), now })).nickname, 'Anna.Map');
  const id = await store.submitModerated({ lat: 45.8, lng: 8.8, occurredAt: '2026-11-19T09:00:00.000Z', createdAt: now, moderatorId: moderator.id, source: 'https://example.test/cronaca', notes: 'Fonte verificata.' });
  const [publicReport] = await store.list();
  assert.equal(publicReport.id, id);
  assert.equal(publicReport.source, 'https://example.test/cronaca');
  assert.equal(publicReport.moderatorNickname, 'Anna.Map');
  assert.equal((await store.listModerationAudit({ targetType: 'report', targetId: id }))[0].action, 'report_created');
  assert.equal(await store.archiveReport({ reportId: id, moderatorId: moderator.id, createdAt: now }), true);
  assert.equal((await store.list()).length, 0);
  assert.equal((await store.listModerationAudit({ targetType: 'report', targetId: id }))[0].action, 'report_archived');

  assert.equal(await store.suspendModerator({ id: moderator.id, createdAt: now }), true);
  assert.equal(await store.moderatorForSession({ sessionHash: hashToken('session-token'), now }), null);
  store.close();
});

test('limits repeated activation or login attempts without retaining raw credentials', async () => {
  const store = createReportStore(createClient({ url: 'file::memory:' }));
  for (let attempt = 0; attempt < 8; attempt += 1) assert.equal(await store.recordModeratorLoginAttempt({ clientHash: 'network', identityHash: 'identity', createdAt: now }), true);
  assert.equal(await store.recordModeratorLoginAttempt({ clientHash: 'network', identityHash: 'identity', createdAt: now }), false);
  await store.clearModeratorLoginAttempts({ clientHash: 'network', identityHash: 'identity' });
  assert.equal(await store.recordModeratorLoginAttempt({ clientHash: 'network', identityHash: 'identity', createdAt: now }), true);
  store.close();
});
