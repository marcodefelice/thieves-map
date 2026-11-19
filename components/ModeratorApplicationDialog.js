'use client';

import { useState } from 'react';
import TurnstileWidget from './TurnstileWidget';

const copy = {
  it: { title: 'Collabora alla moderazione', intro: 'Valutiamo manualmente ogni candidatura. Finché non ricevi l’approvazione, non avrai accesso agli strumenti di moderazione.', nickname: 'NICKNAME DESIDERATO', email: 'EMAIL', area: 'ZONA O AMBITO', areaPlaceholder: 'Es. Varese / Altomilanese', note: 'PERCHÉ VUOI CONTRIBUIRE?', notePlaceholder: 'Raccontaci brevemente come vuoi aiutare la community.', rules: 'Accetto di non pubblicare nomi, targhe, indirizzi privati o accuse verso persone identificabili.', send: 'Invia candidatura', wait: 'Invio in corso…', success: 'Candidatura ricevuta. Ti contatteremo dopo la verifica.', close: 'Chiudi', failed: 'Invio non riuscito. Riprova più tardi.', challengeLoading: 'Caricamento verifica anti-spam…', challengeExpired: 'Verifica scaduta. Completa di nuovo il controllo.', challengeError: 'Verifica non disponibile. Ricarica la pagina e riprova.' },
  en: { title: 'Help moderate', intro: 'Every application is reviewed manually. You will not receive moderation access until you are approved.', nickname: 'DESIRED NICKNAME', email: 'EMAIL', area: 'AREA OR TOPIC', areaPlaceholder: 'E.g. Varese / Altomilanese', note: 'WHY DO YOU WANT TO HELP?', notePlaceholder: 'Briefly tell us how you would help the community.', rules: 'I agree not to publish names, license plates, private addresses, or accusations about identifiable people.', send: 'Send application', wait: 'Sending…', success: 'Application received. We will contact you after review.', close: 'Close', failed: 'Could not send the application. Please try again later.', challengeLoading: 'Loading anti-spam check…', challengeExpired: 'Verification expired. Please complete it again.', challengeError: 'Verification unavailable. Reload and try again.' },
  es: { title: 'Colabora en la moderación', intro: 'Todas las candidaturas se revisan manualmente. No tendrás acceso de moderación hasta recibir aprobación.', nickname: 'APODO DESEADO', email: 'EMAIL', area: 'ZONA O ÁMBITO', areaPlaceholder: 'Ej. Varese / Altomilanese', note: '¿POR QUÉ QUIERES COLABORAR?', notePlaceholder: 'Cuéntanos brevemente cómo ayudarías a la comunidad.', rules: 'Acepto no publicar nombres, matrículas, direcciones privadas ni acusaciones contra personas identificables.', send: 'Enviar candidatura', wait: 'Enviando…', success: 'Candidatura recibida. Te contactaremos tras la revisión.', close: 'Cerrar', failed: 'No se pudo enviar la candidatura. Inténtalo más tarde.', challengeLoading: 'Cargando verificación anti-spam…', challengeExpired: 'La verificación ha caducado. Complétala de nuevo.', challengeError: 'Verificación no disponible. Recarga e inténtalo de nuevo.' },
};

export default function ModeratorApplicationDialog({ language = 'it', siteKey, onClose }) {
  const t = copy[language] || copy.it;
  const [form, setForm] = useState({ nickname: '', email: '', area: '', note: '', acceptedRules: false });
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const change = event => setForm(value => ({ ...value, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.acceptedRules) { setError(t.rules); return; }
    if (siteKey && !token) { setError(t.challengeExpired); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/moderators/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, ...(siteKey ? { turnstileToken: token } : {}) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || t.failed);
      setSent(true);
    } catch (cause) { setError(cause.message || t.failed); } finally { setBusy(false); }
  }
  return <div className="welcome-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="welcome-dialog moderator-application" role="dialog" aria-modal="true" aria-labelledby="collaborate-title"><button className="supporters-close" onClick={onClose} aria-label={t.close}>×</button><h2 id="collaborate-title">{t.title}</h2>{sent ? <><p role="status">{t.success}</p><button className="primary" onClick={onClose}>{t.close}</button></> : <form onSubmit={submit}><p>{t.intro}</p><label>{t.nickname}<input name="nickname" value={form.nickname} onChange={change} autoComplete="username" minLength="3" maxLength="30" required /></label><label>{t.email}<input name="email" type="email" value={form.email} onChange={change} autoComplete="email" maxLength="254" required /></label><label>{t.area}<input name="area" value={form.area} onChange={change} placeholder={t.areaPlaceholder} minLength="2" maxLength="120" required /></label><label>{t.note}<textarea name="note" value={form.note} onChange={change} placeholder={t.notePlaceholder} minLength="20" maxLength="1000" rows="4" required /></label><label className="check-label"><input name="acceptedRules" type="checkbox" checked={form.acceptedRules} onChange={change} required /> {t.rules}</label>{siteKey && <TurnstileWidget siteKey={siteKey} onToken={setToken} action="moderator_application" labels={{ loading: t.challengeLoading, expired: t.challengeExpired, error: t.challengeError }} />}{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy || (Boolean(siteKey) && !token)}>{busy ? t.wait : t.send}</button></form>}</section></div>;
}
