import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateReport, validateAdminReport, validateModeratorReport, isOfficialSource, reportStatus, reportVisibleByAge } from '../lib/validation.mjs';
const now=Date.parse('2026-11-18T12:00:00.000Z');
test('validates position and occurrence time',()=>{assert.equal(validateReport({lat:41,lng:12,occurredAt:'2026-11-18T11:00:00.000Z'},now),null);assert.ok(validateReport({lat:91,lng:12,occurredAt:'2026-11-18T11:00:00.000Z'},now));assert.ok(validateReport({lat:41,lng:12,occurredAt:'2026-11-19T11:00:00.000Z'},now));});
test('status changes at one and 24 hours',()=>{assert.equal(reportStatus('2026-11-18T11:00:01.000Z',now),'recent');assert.equal(reportStatus('2026-11-18T11:00:00.000Z',now),'today');assert.equal(reportStatus('2026-11-17T12:00:00.000Z',now),'older');});
test('history starts at 48 hours and category and notes are validated',()=>{assert.equal(reportStatus('2026-11-16T12:00:01.000Z',now),'older');assert.equal(reportStatus('2026-11-16T12:00:00.000Z',now),'history');const report={lat:41,lng:12,occurredAt:'2026-11-18T11:00:00.000Z',category:'antisocial',notes:'A note'};assert.equal(validateReport(report,now),null);assert.ok(validateReport({...report,category:'other'},now));assert.ok(validateReport({...report,notes:'x'.repeat(501)},now));});
test('separates new categories and keeps urban decay visible longer',()=>{
  const report={lat:41,lng:12,occurredAt:'2026-11-18T11:00:00.000Z'};
  assert.equal(validateReport({...report,category:'crime',publicPlaceConfirmed:true},now),null);
  assert.equal(validateReport({...report,category:'degradation'},now),null);
  const ago=days=>new Date(now-days*86400_000).toISOString();
  assert.equal(reportVisibleByAge({category:'degradation',occurredAt:ago(29)},now,false),true);
  assert.equal(reportVisibleByAge({category:'degradation',occurredAt:ago(30)},now,false),false);
  assert.equal(reportVisibleByAge({category:'degradation',occurredAt:ago(30)},now,true),true);
  assert.equal(reportVisibleByAge({category:'degradation',occurredAt:ago(365)},now,true),false);
  assert.equal(reportVisibleByAge({category:'crime',publicPlaceConfirmed:true,occurredAt:ago(2)},now,false),false);
  assert.equal(reportVisibleByAge({category:'crime',publicPlaceConfirmed:true,occurredAt:ago(2)},now,true),true);
  assert.equal(reportVisibleByAge({category:'crime',publicPlaceConfirmed:true,occurredAt:ago(30)},now,true),false);
});

test('requires public-place confirmation for crime and validates the indirect flag', () => {
  const report = { lat: 41, lng: 12, occurredAt: new Date().toISOString(), category: 'crime' };
  assert.ok(validateReport(report));
  assert.equal(validateReport({ ...report, publicPlaceConfirmed: true, indirect: true }), null);
  assert.ok(validateReport({ ...report, publicPlaceConfirmed: true, indirect: 'yes' }));
});

test('historical events require a recent official source', () => {
  const event = { lat: 45.46, lng: 9.19, occurredAt: '2026-11-18T11:00:00.000Z', category: 'theft', recordKind: 'official_event', source: 'https://prefettura.interno.gov.it/it/notizia' };
  assert.equal(isOfficialSource(event.source), true);
  assert.equal(validateModeratorReport(event, now), null);
  assert.equal(validateAdminReport(event, now), null);
  assert.equal(validateAdminReport({ ...event, source: 'https://example.test/furto' }, now), 'Per un evento storico usa una fonte ufficiale (Prefettura, Comune, Forze dell’Ordine o ente pubblico).');
  assert.equal(validateAdminReport({ ...event, occurredAt: '2020-11-18T11:00:00.000Z' }, now), 'Scegli una data negli ultimi cinque anni, non futura.');
  assert.equal(isOfficialSource('https://www.comune.milano.it/albo'), true);
  assert.equal(isOfficialSource('https://questure.poliziadistato.it/it/Milano'), true);
  assert.equal(isOfficialSource('https://comune.milano.it.attacker.example/albo'), false);
  assert.equal(isOfficialSource('https://comune.fake.example.it/albo'), false);
});
