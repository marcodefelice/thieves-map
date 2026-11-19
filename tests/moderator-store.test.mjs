import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { createReportStore } from '../lib/db.mjs';
import { currentModerator, hashPassword, hashToken, verifyPassword } from '../lib/moderator-auth.mjs';
import { officialAreas } from '../lib/official-areas.mjs';
import { validateAdminReport, validateModeratorApplication, validateModeratorReport } from '../lib/validation.mjs';

const now = '2026-11-19T10:00:00.000Z';

test('uses the session hash when loading the current moderator', async () => {
  const previousStore = globalThis.__reportStore;
  let received;
  globalThis.__reportStore = { moderatorForSession: async value => { received = value; return { id: 7, nickname: 'Anna.Map' }; } };
  try {
    const moderator = await currentModerator(new Request('https://example.test/api/moderator/me', { headers: { cookie: 'thieves_map_moderator=session-token' } }));
    assert.equal(moderator.nickname, 'Anna.Map');
    assert.equal(received.sessionHash, hashToken('session-token'));
    assert.equal(typeof received.now, 'string');
  } finally {
    if (previousStore === undefined) delete globalThis.__reportStore;
    else globalThis.__reportStore = previousStore;
  }
});

test('validates a narrow moderator application and sourced moderator report', () => {
  const application = { nickname: 'Anna.Map', email: 'anna@example.test', scopeType: 'municipality', area: 'Varese', address: 'Varese centro', note: 'Conosco bene la zona e voglio contribuire in modo responsabile.' };
  assert.equal(validateModeratorApplication(application), null);
  assert.ok(validateModeratorApplication({ ...application, nickname: 'x' }));
  assert.ok(validateModeratorApplication({ ...application, note: 'troppo corta' }));
  assert.ok(validateModeratorApplication({ ...application, area: 'Italia' }));
  const report = { lat: 45.8, lng: 8.8, occurredAt: '2026-11-19T09:00:00.000Z', source: 'https://example.test/cronaca', category: 'theft' };
  assert.equal(validateModeratorReport(report, Date.parse(now)), null);
  assert.ok(validateModeratorReport({ ...report, source: 'http://example.test/cronaca' }, Date.parse(now)));
  assert.equal(validateAdminReport({ ...report, source: '' }, Date.parse(now)), null);
  assert.ok(validateAdminReport({ ...report, source: 'http://example.test/cronaca' }, Date.parse(now)));
});

test('keeps a closed, sourced and duplicate-free official-area catalogue', () => {
  assert.equal(officialAreas.length, 58);
  assert.equal(new Set(officialAreas.map(area => area.key)).size, officialAreas.length);
  for (const area of officialAreas) {
    assert.match(area.key, /^official-2026-/);
    assert.match(area.source, /^https:\/\/(?:prefettura\.interno\.gov\.it|www\.comune\.roma\.it)\//);
    assert.ok(Number.isFinite(area.lat) && Number.isFinite(area.lng));
    assert.equal(area.country, 'IT');
    assert.ok(area.municipality.length > 0 && area.province.length > 0);
    assert.ok(area.notes.length >= 40 && area.notes.length <= 500);
  }
});

test('approval, activation, session revocation, sourced pins and audit are all persistent', async () => {
  const store = createReportStore(createClient({ url: 'file::memory:' }));
  assert.equal(await store.createModeratorApplication({ nickname: 'Anna.Map', email: 'anna@example.test', scopeType: 'municipality', area: 'Varese', address: 'Varese centro', country: 'IT', note: 'Conosco bene la zona e voglio contribuire in modo responsabile.', applicantHash: 'applicant', createdAt: now }), true);
  const [application] = await store.listModeratorApplications({ country: 'IT' });
  assert.equal(application.status, 'pending');
  assert.equal(application.scopeValue, 'varese');

  const activationHash = hashToken('activation-token');
  assert.deepEqual(await store.beginModeratorApproval({ id: application.id, country: 'IT', tokenHash: activationHash, expiresAt: '2026-11-21T10:00:00.000Z' }), { email: 'anna@example.test', nickname: 'Anna.Map' });
  assert.equal(await store.approveModerator({ id: application.id, country: 'IT', tokenHash: activationHash, createdAt: now }), true);
  const passwordHash = await hashPassword('a long enough test password');
  assert.equal(await store.activateModerator({ tokenHash: activationHash, passwordHash, now }), true);
  assert.equal(await store.activateModerator({ tokenHash: activationHash, passwordHash, now }), false);
  const moderator = await store.moderatorForLogin({ email: 'anna@example.test', now });
  assert.equal(await verifyPassword('a long enough test password', moderator.passwordHash), true);

  await store.createModeratorSession({ sessionHash: hashToken('session-token'), moderatorId: moderator.id, createdAt: now, expiresAt: '2026-11-20T10:00:00.000Z' });
  assert.equal((await store.moderatorForSession({ sessionHash: hashToken('session-token'), now })).nickname, 'Anna.Map');
  const id = await store.submitModerated({ lat: 45.8, lng: 8.8, occurredAt: '2026-11-19T09:00:00.000Z', createdAt: now, moderatorId: moderator.id, country: 'IT', municipality: 'Varese', province: 'Varese', source: 'https://example.test/cronaca', notes: 'Fonte verificata.' });
  const verificationId = await store.submitModerated({ lat: 45.81, lng: 8.81, occurredAt: '2026-11-19T09:05:00.000Z', createdAt: now, moderatorId: 999, country: 'IT', municipality: 'Varese', province: 'Varese', source: 'https://example.test/cronaca', notes: 'Da verificare.' });
  await store.submitModerated({ lat: 45.4, lng: 9.2, occurredAt: '2026-11-19T09:00:00.000Z', createdAt: now, moderatorId: moderator.id, country: 'IT', municipality: 'Milano', province: 'Milano', source: 'https://example.test/cronaca', notes: 'Fuori dall ambito di Anna.' });
  const publicReport = (await store.list()).find(report => report.id === id);
  assert.equal(publicReport.id, id);
  assert.equal(publicReport.source, 'https://example.test/cronaca');
  assert.equal(publicReport.moderatorNickname, 'Anna.Map');
  assert.equal((await store.listModerationAudit({ targetType: 'report', targetId: id }))[0].action, 'report_created');
  assert.equal(await store.verifyReport({ reportId: id, moderatorId: moderator.id, nickname: moderator.nickname, country: 'IT', scopeType: 'municipality', scopeValue: 'varese', createdAt: now }), false);
  assert.equal(await store.verifyReport({ reportId: verificationId, moderatorId: moderator.id, nickname: moderator.nickname, country: 'IT', scopeType: 'municipality', scopeValue: 'varese', createdAt: now }), true);
  assert.equal(await store.verifyReport({ reportId: verificationId, moderatorId: moderator.id, nickname: moderator.nickname, country: 'IT', scopeType: 'municipality', scopeValue: 'varese', createdAt: now }), false);
  const verifiedReport = (await store.list()).find(report => report.id === verificationId);
  assert.equal(verifiedReport.verifiedByNickname, 'Anna.Map');
  assert.equal((await store.listModerationAudit({ targetType: 'report', targetId: verificationId }))[0].action, 'report_verified');
  assert.equal(await store.verifyReportAsAdmin({ reportId: id, country: 'IT', nickname: 'Punto Sicuro', createdAt: now }), true);
  assert.equal((await store.list()).find(report => report.id === id).verifiedByNickname, 'Punto Sicuro');
  const officialId = await store.submitAdminReport({ lat: 45.82, lng: 8.82, occurredAt: '2026-11-19T09:10:00.000Z', createdAt: now, country: 'IT', municipality: 'Varese', province: 'Varese', notes: 'Punto inserito dall amministrazione.' });
  const officialReport = (await store.list()).find(report => report.id === officialId);
  assert.equal(officialReport.verifiedByNickname, 'Punto Sicuro');
  assert.equal((await store.listModerationAudit({ targetType: 'report', targetId: officialId }))[0].action, 'report_verified');
  const imported = await store.importOfficialArea({ key: 'official-test-varese', lat: 45.83, lng: 8.83, occurredAt: now, createdAt: now, country: 'IT', municipality: 'Varese', province: 'Varese', source: 'https://example.test/official', notes: 'Area sottoposta a misura pubblica verificata.' });
  assert.equal(imported.imported, true);
  assert.equal((await store.importOfficialArea({ key: 'official-test-varese', lat: 45.83, lng: 8.83, occurredAt: now, createdAt: now, country: 'IT', municipality: 'Varese', province: 'Varese', source: 'https://example.test/official', notes: 'Area sottoposta a misura pubblica verificata.' })).imported, false);
  assert.equal((await store.list()).find(report => report.id === imported.id).verifiedByNickname, 'Punto Sicuro');
  assert.equal((await store.listModerationAudit({ targetType: 'report', targetId: imported.id }))[0].action, 'report_verified');
  const scoped = await store.listReportsForModeration({ country: 'IT', scopeType: 'municipality', scopeValue: 'varese', page: 1, pageSize: 1 });
  assert.equal(scoped.total, 4);
  assert.equal(scoped.reports.length, 1);
  assert.equal(await store.archiveReport({ reportId: id, moderatorId: moderator.id, country: 'IT', scopeType: 'municipality', scopeValue: 'varese', createdAt: now }), true);
  assert.equal((await store.list()).length, 4);
  assert.equal((await store.listModerationAudit({ targetType: 'report', targetId: id }))[0].action, 'report_archived');

  assert.equal(await store.suspendModerator({ id: moderator.id, country: 'IT', createdAt: now }), true);
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
