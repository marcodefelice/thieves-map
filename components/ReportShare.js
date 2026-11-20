'use client';
import { useRef, useState } from 'react';

const messages = {
  it: { share: 'Condividi segnalazione', text: 'Segnalazione su Punto Sicuro:', copy: 'Copia link', copied: 'Link copiato', select: 'Seleziona e copia il link', close: 'Chiudi' },
  en: { share: 'Share report', text: 'Report on Punto Sicuro:', copy: 'Copy link', copied: 'Link copied', select: 'Select and copy the link', close: 'Close' },
  es: { share: 'Compartir aviso', text: 'Aviso en Punto Sicuro:', copy: 'Copiar enlace', copied: 'Enlace copiado', select: 'Selecciona y copia el enlace', close: 'Cerrar' },
};

export default function ReportShare({ id, locale }) {
  const t = messages[locale] || messages.it;
  const [open, setOpen] = useState(false), [status, setStatus] = useState('');
  const trigger = useRef(null);
  const url = `${window.location.origin}/s/${id}`;
  async function share() {
    setStatus('');
    if (navigator.share) {
      try { await navigator.share({ title: 'Punto Sicuro', text: t.text, url }); return; }
      catch (error) { if (error?.name === 'AbortError') return; }
    }
    setOpen(true);
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setStatus(t.copied); }
    catch { setStatus(t.select); }
  }
  function close() { setOpen(false); trigger.current?.focus(); }
  return <div className="report-share" onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(); } }}>
    <button ref={trigger} className="report-share-trigger" onClick={share} aria-expanded={open}>{t.share}</button>
    {open && <div className="report-share-options" role="group" aria-label={t.share}>
      <a href={`https://wa.me/?text=${encodeURIComponent(`${t.text} ${url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(t.text)}`} target="_blank" rel="noopener noreferrer">Telegram</a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
      <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(t.text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">X</a>
      <button onClick={copyLink}>{t.copy}</button>
      <button onClick={close}>{t.close}</button>
      {status && <p role="status">{status}</p>}
      {status === t.select && <input aria-label={t.select} readOnly value={url} onFocus={event => event.target.select()} />}
    </div>}
  </div>;
}
