'use client';
import { useState } from 'react';

const copy = {
  it: { sponsor: 'Sostieni il progetto', share: 'Condividi il progetto', text: 'Scopri Punto Sicuro, la mappa condivisa delle segnalazioni.', copy: 'Copia link', copied: 'Link copiato', select: 'Seleziona e copia il link', close: 'Chiudi' },
  en: { sponsor: 'Support the project', share: 'Share the project', text: 'Discover Punto Sicuro, the shared map of reports.', copy: 'Copy link', copied: 'Link copied', select: 'Select and copy the link', close: 'Close' },
  es: { sponsor: 'Apoya el proyecto', share: 'Compartir el proyecto', text: 'Descubre Punto Sicuro, el mapa compartido de avisos.', copy: 'Copiar enlace', copied: 'Enlace copiado', select: 'Selecciona y copia el enlace', close: 'Cerrar' },
};

export default function ShareButton({ language }) {
  const t = copy[language];
  const [open, setOpen] = useState(false), [status, setStatus] = useState('');
  const url = 'https://thievesmap.cloud/';
  async function share() {
    setStatus('');
    if (navigator.share) {
      try { await navigator.share({ title: 'Punto Sicuro', text: t.text, url }); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    setOpen(true);
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setStatus(t.copied); }
    catch { setStatus(t.select); }
  }
  return <div className="share-control" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
    {open && <div className="share-popover" role="group" aria-label={t.share}>
      <button className="share-close" onClick={() => setOpen(false)} aria-label={t.close}>×</button>
      <strong>{t.share}</strong>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
      <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(t.text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">X</a>
      <a href={`https://wa.me/?text=${encodeURIComponent(`${t.text} ${url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <button className="share-copy" onClick={copyLink}>{t.copy}</button>
      {status && <p role="status">{status}</p>}
      {status === t.select && <input aria-label={t.select} readOnly value={url} onFocus={event => event.target.select()}/>}
    </div>}
    <a className="share-button sponsor-button" href="https://github.com/sponsors/marcodefelice" target="_blank" rel="noopener noreferrer" aria-label={t.sponsor} title={t.sponsor}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 6l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.3a5.5 5.5 0 0 0 0-7.8Z"/></svg>
    </a>
    <button className="share-button" onClick={share} aria-label={t.share} title={t.share} aria-expanded={open}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>
    </button>
  </div>;
}
