'use client';

import { useState } from 'react';
import MapSearch from './MapSearch';

const localDate = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };

async function adminRequest(token, options = {}) {
  const response = await fetch('/api/admin/moderators', { ...options, headers: { 'x-admin-token': token, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
  return data;
}

async function reportRequest(token, path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'x-admin-token': token, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
  return data;
}

function AddressLookup({ onSelect }) {
  return <div className="moderator-address-field"><span>INDIRIZZO O LUOGO</span><small>Cerca e seleziona l’indirizzo del punto.</small><MapSearch language="it" embedded onSelect={onSelect} /></div>;
}

export default function AdminModerators() {
  const [token, setToken] = useState('');
  const [applications, setApplications] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportMeta, setReportMeta] = useState({ page: 1, pageSize: 25, total: 0 });
  const [addresses, setAddresses] = useState({});
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [createForm, setCreateForm] = useState({ lat: '', lng: '', occurredAt: localDate(), category: 'theft', notes: '', source: '', publicPlaceConfirmed: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load(event, requestedPage = reportMeta.page) {
    event?.preventDefault();
    setBusy(true); setError('');
    try {
      const [data, reportData] = await Promise.all([adminRequest(token), reportRequest(token, `/api/admin/reports?page=${requestedPage}`)]);
      setApplications(data.applications);
      setEmailConfigured(data.emailConfigured);
      setReports(reportData.reports || []);
      setReportMeta({ page: reportData.page, pageSize: reportData.pageSize, total: reportData.total });
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function act(id, action) {
    if (action === 'suspend' && !window.confirm('Revocare subito l’accesso a questo moderatore?')) return;
    setBusy(true); setError('');
    try { await adminRequest(token, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) }); await load(null, reportMeta.page); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function createReport(event) {
    event.preventDefault();
    setError('');
    if (!createForm.lat || !createForm.lng) { setError('Cerca e seleziona un indirizzo prima di pubblicare.'); return; }
    setBusy(true);
    try {
      await reportRequest(token, '/api/admin/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...createForm, lat: Number(createForm.lat), lng: Number(createForm.lng), occurredAt: new Date(createForm.occurredAt).toISOString() }) });
      setCreateForm({ lat: '', lng: '', occurredAt: localDate(), category: 'theft', notes: '', source: '', publicPlaceConfirmed: false });
      await load(null, 1);
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function reportAction(id, action) {
    const text = action === 'archive' ? 'Archiviare questa segnalazione? Sparirà subito dalla mappa pubblica, ma resterà nell’audit log.' : 'Confermi di aver verificato questa segnalazione? Sulla mappa apparirà come verificata da Punto Sicuro.';
    if (!window.confirm(text)) return;
    setBusy(true); setError('');
    try { await reportRequest(token, `/api/admin/reports/${id}/${action}`, { method: 'POST' }); await load(null, reportMeta.page); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function showAddress(id) {
    setBusy(true); setError('');
    try { const data = await reportRequest(token, `/api/admin/reports/${id}/address`, { method: 'POST' }); setAddresses(value => ({ ...value, [id]: data.address })); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  const changeCreateForm = event => setCreateForm(value => ({ ...value, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const setAddress = result => setCreateForm(value => ({ ...value, lat: String(result.lat), lng: String(result.lng) }));
  const pages = Math.max(1, Math.ceil(reportMeta.total / reportMeta.pageSize));
  return <main className="account-page"><section className="moderator-dashboard admin-dashboard"><header><div><p className="account-kicker">ACCESSO AMMINISTRATORE · ITALIA</p><h1>Amministrazione</h1><p>Il token resta soltanto in memoria del browser e non viene salvato.</p></div></header>{applications === null ? <form className="account-card" onSubmit={load}><label>Token amministratore<input type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" required /></label>{error && <p className="error" role="alert">{error}</p>}<button className="account-button" disabled={busy}>{busy ? 'Verifica…' : 'Apri pannello'}</button></form> : <><p className={emailConfigured ? 'notice-ok' : 'notice-warning'}>{emailConfigured ? 'Invio email di attivazione configurato.' : 'L’invio email non è configurato: le approvazioni sono bloccate.'}</p>{error && <p className="error" role="alert">{error}</p>}<section className="account-card admin-report-form"><h2>Nuovo punto ufficiale</h2><p>Il punto sarà pubblicato come verificato da Punto Sicuro.</p><form onSubmit={createReport}><AddressLookup onSelect={setAddress} /><label>Data e ora<input name="occurredAt" type="datetime-local" value={createForm.occurredAt} max={localDate()} onChange={changeCreateForm} required /></label><label>Tipologia<select name="category" value={createForm.category} onChange={changeCreateForm}><option value="theft">Furto / tentata effrazione</option><option value="crime">Delinquenza / movimento sospetto</option><option value="degradation">Degrado urbano</option><option value="antisocial">Delinquenza e degrado</option></select></label>{createForm.category === 'crime' && <label className="check-label"><input name="publicPlaceConfirmed" type="checkbox" checked={createForm.publicPlaceConfirmed} onChange={changeCreateForm} required /> Confermo che è un luogo pubblico e non identifica persone o attività.</label>}<label>Fonte HTTPS (facoltativa)<input name="source" type="url" placeholder="https://…" value={createForm.source} onChange={changeCreateForm} /></label><label>Note pubbliche (facoltative)<textarea name="notes" value={createForm.notes} onChange={changeCreateForm} maxLength="500" rows="4" /></label><button className="account-button" disabled={busy || (createForm.category === 'crime' && !createForm.publicPlaceConfirmed)}>{busy ? 'Pubblicazione…' : 'Pubblica punto verificato'}</button></form></section><h2>Candidature moderatori</h2><section className="application-list">{applications.length === 0 ? <p>Nessuna candidatura per l’Italia.</p> : applications.map(application => <article key={application.id}><div><strong>{application.nickname}</strong><small>{application.email}</small><small>{application.scopeType === 'province' ? 'Provincia' : 'Comune'}: {application.area}</small><small>Indirizzo/località: {application.address}</small><p>{application.note}</p><small>Stato: {application.status} · {new Date(application.createdAt).toLocaleString('it-IT')}</small></div>{application.status === 'pending' && <button className="account-button" disabled={busy || !emailConfigured} onClick={() => act(application.id, 'approve')}>Approva e invia link</button>}{application.status === 'moderator' && <button className="danger-button" disabled={busy} onClick={() => act(application.id, 'suspend')}>Sospendi</button>}{application.status === 'suspended' && <span>Sospeso</span>}</article>)}</section><h2 className="admin-section-title">Segnalazioni da moderare</h2><p>{reportMeta.total} segnalazioni in Italia · pagina {reportMeta.page} di {pages}</p><section className="application-list">{reports.length === 0 ? <p>Nessuna segnalazione in questa pagina.</p> : reports.map(report => <article key={report.id} className={report.status === 'archived' ? 'archived' : ''}><div><strong>#{report.id} · {report.category}</strong><small>{new Date(report.occurredAt).toLocaleString('it-IT')} {report.moderatorNickname ? `· ${report.moderatorNickname}` : '· community'}</small>{report.verifiedByNickname && <small>Verificata da {report.verifiedByNickname}</small>}{addresses[report.id] ? <small>Indirizzo: {addresses[report.id]}</small> : <button className="account-link" disabled={busy} onClick={() => showAddress(report.id)}>Mostra indirizzo</button>}{report.notes && <p>{report.notes}</p>}{report.source && <a href={report.source} target="_blank" rel="noreferrer">Fonte</a>}</div>{report.status === 'active' ? <div className="report-actions">{!report.verifiedByNickname && <button className="account-button" disabled={busy} onClick={() => reportAction(report.id, 'verify')}>Verifica segnalazione</button>}<button className="danger-button" disabled={busy} onClick={() => reportAction(report.id, 'archive')}>Archivia</button></div> : <span>Archiviata</span>}</article>)}</section><nav className="admin-pagination" aria-label="Pagine segnalazioni"><button className="account-link" disabled={busy || reportMeta.page <= 1} onClick={() => load(null, reportMeta.page - 1)}>← Precedente</button><span>Pagina {reportMeta.page} / {pages}</span><button className="account-link" disabled={busy || reportMeta.page >= pages} onClick={() => load(null, reportMeta.page + 1)}>Successiva →</button></nav></>}</section></main>;
}
