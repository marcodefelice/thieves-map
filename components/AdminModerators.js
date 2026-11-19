'use client';

import { useState } from 'react';

async function adminRequest(token, options = {}) {
  const response = await fetch('/api/admin/moderators', { ...options, headers: { 'x-admin-token': token, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
  return data;
}

export default function AdminModerators() {
  const [token, setToken] = useState('');
  const [applications, setApplications] = useState(null);
  const [reports, setReports] = useState([]);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load(event) {
    event?.preventDefault(); setBusy(true); setError('');
    try { const [data, reportResponse] = await Promise.all([adminRequest(token), fetch('/api/admin/reports', { headers: { 'x-admin-token': token } })]); const reportData = await reportResponse.json().catch(() => ({})); if (!reportResponse.ok) throw new Error(reportData.error || 'Impossibile caricare le segnalazioni.'); setApplications(data.applications); setEmailConfigured(data.emailConfigured); setReports(reportData.reports); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function act(id, action) {
    if (action === 'suspend' && !window.confirm('Revocare subito l’accesso a questo moderatore?')) return;
    setBusy(true); setError('');
    try { await adminRequest(token, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) }); await load(); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function archiveReport(id) {
    if (!window.confirm('Archiviare questa segnalazione? Sparirà subito dalla mappa pubblica, ma resterà nell’audit log.')) return;
    setBusy(true); setError('');
    try { const response = await fetch(`/api/admin/reports/${id}/archive`, { method: 'POST', headers: { 'x-admin-token': token } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.'); await load(); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return <main className="account-page"><section className="moderator-dashboard admin-dashboard"><header><div><p className="account-kicker">ACCESSO AMMINISTRATORE</p><h1>Amministrazione</h1><p>Il token resta soltanto in memoria del browser e non viene salvato.</p></div></header>{applications === null ? <form className="account-card" onSubmit={load}><label>Token amministratore<input type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" required /></label>{error && <p className="error" role="alert">{error}</p>}<button className="account-button" disabled={busy}>{busy ? 'Verifica…' : 'Apri pannello'}</button></form> : <><p className={emailConfigured ? 'notice-ok' : 'notice-warning'}>{emailConfigured ? 'Invio email di attivazione configurato.' : 'L’invio email non è configurato: le approvazioni sono bloccate.'}</p>{error && <p className="error" role="alert">{error}</p>}<h2>Candidature moderatori</h2><section className="application-list">{applications.map(application => <article key={application.id}><div><strong>{application.nickname}</strong><small>{application.email}</small><small>{application.area}</small><p>{application.note}</p><small>Stato: {application.status} · {new Date(application.createdAt).toLocaleString('it-IT')}</small></div>{application.status === 'pending' && <button className="account-button" disabled={busy || !emailConfigured} onClick={() => act(application.id, 'approve')}>Approva e invia link</button>}{application.status === 'moderator' && <button className="danger-button" disabled={busy} onClick={() => act(application.id, 'suspend')}>Sospendi</button>}{application.status === 'suspended' && <span>Sospeso</span>}</article>)}</section><h2 className="admin-section-title">Tutte le segnalazioni</h2><section className="application-list">{reports.map(report => <article key={report.id} className={report.status === 'archived' ? 'archived' : ''}><div><strong>#{report.id} · {report.category}</strong><small>{new Date(report.occurredAt).toLocaleString('it-IT')} {report.moderatorNickname ? `· ${report.moderatorNickname}` : '· community'}</small>{report.notes && <p>{report.notes}</p>}{report.source && <a href={report.source} target="_blank" rel="noreferrer">Fonte</a>}</div>{report.status === 'active' ? <button className="danger-button" disabled={busy} onClick={() => archiveReport(report.id)}>Archivia</button> : <span>Archiviata</span>}</article>)}</section></>}</section></main>;
}
