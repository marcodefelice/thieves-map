'use client';

import { useEffect, useState } from 'react';
import MapSearch from './MapSearch';

function localDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function Draft({ draft, busy, onAction }) {
  const [form, setForm] = useState({ lat: draft.lat, lng: draft.lng, occurredAt: localDate(draft.occurredAt), category: draft.category, notes: draft.notes, reviewConfirmed: false, publicPlaceConfirmed: false });
  const change = event => setForm(value => ({ ...value, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const lat = Number(form.lat), lng = Number(form.lng);
  const map = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.008}%2C${lat - 0.004}%2C${lng + 0.008}%2C${lat + 0.004}&layer=mapnik&marker=${lat}%2C${lng}`;
  return <article className="rss-draft"><h3>{draft.title || 'Notizia RSS'}</h3><p>{draft.municipality} · Provincia: {draft.province}</p><a href={draft.source} target="_blank" rel="noreferrer">Apri la fonte originale ↗</a><p>Pubblicazione della notizia: {draft.publishedAt ? new Date(draft.publishedAt).toLocaleString('it-IT') : 'non disponibile'}.</p><p>Posizione proposta: {draft.locationLabel}. Verifica il pin e, se necessario, cerca un luogo pubblico diverso.</p><iframe title={`Posizione proposta: ${draft.locationLabel}`} src={map} loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: '220px', border: 0 }} /><MapSearch language="it" embedded onSelect={result => setForm(value => ({ ...value, lat: result.lat, lng: result.lng, reviewConfirmed: false }))} /><form onSubmit={event => { event.preventDefault(); onAction(draft.id, { ...form, occurredAt: new Date(form.occurredAt).toISOString(), action: 'approve' }); }}><label>Data e ora del fatto (verifica sulla fonte)<input name="occurredAt" type="datetime-local" value={form.occurredAt} onChange={change} required /></label><label>Tipologia<select name="category" value={form.category} onChange={change}><option value="theft">Furto / tentata effrazione</option><option value="crime">Delinquenza / movimento sospetto</option><option value="degradation">Degrado urbano</option></select></label><label>Descrizione pubblica<textarea name="notes" value={form.notes} maxLength="500" onChange={change} required /></label>{form.category === 'crime' && <label className="check-label"><input name="publicPlaceConfirmed" type="checkbox" checked={form.publicPlaceConfirmed} onChange={change} required /> Confermo che è un luogo pubblico e non identifica persone o attività.</label>}<label className="check-label"><input name="reviewConfirmed" type="checkbox" checked={form.reviewConfirmed} onChange={change} required /> Ho verificato fonte, data del fatto, testo e posizione.</label><div className="report-actions"><button className="account-button" disabled={busy}>Approva e pubblica</button><button className="danger-button" type="button" disabled={busy} onClick={() => onAction(draft.id, { action: 'reject' })}>Scarta</button></div></form></article>;
}
export default function RssQueue({ adminToken }) {
  const [data, setData] = useState({ drafts: [], page: 1, total: 0, pageSize: 25 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const base = adminToken ? '/api/admin/rss' : '/api/moderator/rss';
  const headers = adminToken ? { 'x-admin-token': adminToken } : {};
  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Operazione non riuscita.');
    return result;
  }
  async function load(page = 1) { try { setData(await request(`${base}?page=${page}`)); setError(''); } catch (cause) { setError(cause.message); } }
  useEffect(() => { load(); }, [base, adminToken]);
  async function act(id, body) {
    setBusy(true); setError('');
    try { await request(`${base}/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); await load(1); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <section className="account-card rss-queue"><h2>Coda notizie RSS</h2><p>{adminToken ? 'Tutte le province italiane.' : 'Notizie nel tuo ambito territoriale.'} Le bozze non sono pubbliche. Controlla i dati automatici prima di pubblicare.</p>{error && <p className="error" role="alert">{error}</p>}<p>{data.total} notizie da revisionare</p>{data.drafts.length ? data.drafts.map(draft => <Draft key={draft.id} draft={draft} busy={busy} onAction={act} />) : <p>Nessuna bozza in questa pagina.</p>}<nav className="admin-pagination" aria-label="Pagine notizie RSS"><button className="account-link" disabled={busy || data.page <= 1} onClick={() => load(data.page - 1)}>← Precedente</button><span>Pagina {data.page} / {pages}</span><button className="account-link" disabled={busy || data.page >= pages} onClick={() => load(data.page + 1)}>Successiva →</button></nav></section>;
}
