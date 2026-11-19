'use client';

import { useEffect, useState } from 'react';

const localDate = () => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
  return data;
}

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await request('/api/moderator/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); await onLoggedIn(); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return <section className="account-card"><h1>Area moderatori</h1><p>Accedi solo dopo aver ricevuto l’approvazione e il link di attivazione.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <p className="error" role="alert">{error}</p>}<button className="account-button" disabled={busy}>{busy ? 'Accesso…' : 'Accedi'}</button></form></section>;
}

function Activation({ token, onActivated }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError('');
    if (password !== confirm) { setError('Le password non coincidono.'); return; }
    setBusy(true);
    try { await request('/api/moderator/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) }); onActivated(); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return <section className="account-card"><h1>Attiva il tuo accesso</h1><p>Scegli una password personale di almeno 12 caratteri. Il link può essere usato una sola volta.</p><form onSubmit={submit}><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength="12" maxLength="128" required /></label><label>Conferma password<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" minLength="12" maxLength="128" required /></label>{error && <p className="error" role="alert">{error}</p>}<button className="account-button" disabled={busy}>{busy ? 'Attivazione…' : 'Attiva account'}</button></form></section>;
}

function Dashboard({ moderator, onLogout }) {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ lat: '', lng: '', occurredAt: localDate(), category: 'theft', notes: '', source: '', publicPlaceConfirmed: false });
  async function load() {
    try { setReports((await request('/api/moderator/reports')).reports); } catch (cause) { setError(cause.message); }
  }
  useEffect(() => { load(); }, []);
  const change = event => setForm(value => ({ ...value, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  async function create(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await request('/api/moderator/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, lat: Number(form.lat), lng: Number(form.lng), occurredAt: new Date(form.occurredAt).toISOString(), indirect: true }) });
      setForm({ lat: '', lng: '', occurredAt: localDate(), category: 'theft', notes: '', source: '', publicPlaceConfirmed: false }); await load();
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function archive(id) {
    if (!window.confirm('Archiviare questa segnalazione? Sparirà dalla mappa pubblica, ma rimarrà nello storico di audit.')) return;
    setBusy(true); setError('');
    try { await request(`/api/moderator/reports/${id}/archive`, { method: 'POST' }); await load(); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function verify(id) {
    if (!window.confirm('Confermi di aver verificato questa segnalazione? Il tuo nickname sarà visibile sulla mappa.')) return;
    setBusy(true); setError('');
    try { await request(`/api/moderator/reports/${id}/verify`, { method: 'POST' }); await load(); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return <section className="moderator-dashboard"><header><div><p className="account-kicker">MODERATORE ATTIVO</p><h1>Ciao, {moderator.nickname}</h1><p>{moderator.area}</p></div><button className="account-link" onClick={onLogout}>Esci</button></header><div className="moderator-rules"><strong>Prima di pubblicare</strong><ol><li>Niente nomi, targhe, indirizzi privati o dettagli identificativi.</li><li>Per la cronaca inserisci sempre una fonte HTTPS verificabile.</li><li>Per persone o reati usa solo luoghi pubblici e testi neutrali.</li><li>Verifica solo fatti controllati: la verifica mostrerà pubblicamente il tuo nickname.</li><li>Archivia i contenuti problematici: ogni azione viene registrata.</li></ol></div><div className="moderator-grid"><form className="account-card moderator-form" onSubmit={create}><h2>Nuovo pin da cronaca</h2><p>La fonte è obbligatoria e il tuo nickname sarà visibile, mai la tua email.</p><div className="coordinate-fields"><label>Latitudine<input name="lat" type="number" step="any" min="-90" max="90" value={form.lat} onChange={change} required /></label><label>Longitudine<input name="lng" type="number" step="any" min="-180" max="180" value={form.lng} onChange={change} required /></label></div><label>Data e ora<input name="occurredAt" type="datetime-local" value={form.occurredAt} max={localDate()} onChange={change} required /></label><label>Tipologia<select name="category" value={form.category} onChange={change}><option value="theft">Furto / tentata effrazione</option><option value="crime">Delinquenza / movimento sospetto</option><option value="degradation">Degrado urbano</option></select></label>{form.category === 'crime' && <label className="check-label"><input name="publicPlaceConfirmed" type="checkbox" checked={form.publicPlaceConfirmed} onChange={change} required /> Confermo che è un luogo pubblico e che non identifica persone o attività.</label>}<label>Fonte HTTPS<input name="source" type="url" placeholder="https://…" value={form.source} onChange={change} required /></label><label>Note pubbliche (facoltative)<textarea name="notes" value={form.notes} onChange={change} maxLength="500" rows="4" /></label>{error && <p className="error" role="alert">{error}</p>}<button className="account-button" disabled={busy || (form.category === 'crime' && !form.publicPlaceConfirmed)}>{busy ? 'Pubblicazione…' : 'Pubblica pin tracciato'}</button></form><section className="account-card report-review"><h2>Segnalazioni recenti</h2><p>Puoi verificare o archiviare contenuti nel tuo ambito. Ogni azione è immediata e tracciata.</p>{reports.length === 0 ? <p>Nessuna segnalazione.</p> : <ul>{reports.map(report => <li key={report.id} className={report.status === 'archived' ? 'archived' : ''}><div><strong>#{report.id} · {report.category}</strong><small>{new Date(report.occurredAt).toLocaleString('it-IT')}</small>{report.moderatorNickname && <small>Inserita da {report.moderatorNickname}</small>}{report.verifiedByNickname && <small>Verificata da {report.verifiedByNickname}</small>}{report.source && <a href={report.source} target="_blank" rel="noreferrer">Fonte</a>}</div>{report.status === 'active' ? <div className="report-actions">{!report.verifiedByNickname && report.moderatorId !== moderator.id && <button className="account-button" disabled={busy} onClick={() => verify(report.id)}>Verifica</button>}<button className="danger-button" disabled={busy} onClick={() => archive(report.id)}>Archivia</button></div> : <span>Archiviata</span>}</li>)}</ul>}</section></div></section>;
}

export default function ModeratorPortal({ activationToken = '' }) {
  const [state, setState] = useState(activationToken ? 'activate' : 'loading');
  const [moderator, setModerator] = useState(null);
  async function loadMe() {
    try { const data = await request('/api/moderator/me'); setModerator(data.moderator); setState('dashboard'); }
    catch { setState('login'); }
  }
  useEffect(() => { if (!activationToken) loadMe(); }, [activationToken]);
  async function logout() { await fetch('/api/moderator/logout', { method: 'POST' }); setModerator(null); setState('login'); }
  if (state === 'loading') return <main className="account-page"><p>Caricamento…</p></main>;
  return <main className="account-page">{state === 'activate' ? <Activation token={activationToken} onActivated={() => setState('login')} /> : state === 'login' ? <Login onLoggedIn={loadMe} /> : <Dashboard moderator={moderator} onLogout={logout} />}</main>;
}
