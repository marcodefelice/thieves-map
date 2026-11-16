'use client';
import { useEffect, useState } from 'react';

const copy = {
  it: { install: 'Installa app', installTitle: 'Installa Thieves Map', ios: 'Tocca Condividi nel browser, poi “Aggiungi alla schermata Home”.', close: 'Chiudi', push: 'Notifiche nelle vicinanze', enable: 'Attiva notifiche', update: 'Aggiorna zona', disable: 'Disattiva', radius: 'Raggio degli avvisi', km: 'km', location: 'Usa la tua posizione attuale come centro degli avvisi.', active: 'Notifiche attive per la zona scelta.', denied: 'Notifiche bloccate: controlla i permessi del browser o del dispositivo.', failed: 'Impossibile configurare le notifiche. Controlla posizione e permessi e riprova.', disabled: 'Notifiche disattivate.', unavailable: 'Per attivare le notifiche, il gestore deve completare la configurazione.' },
  en: { install: 'Install app', installTitle: 'Install Thieves Map', ios: 'Tap Share in your browser, then “Add to Home Screen”.', close: 'Close', push: 'Nearby notifications', enable: 'Enable notifications', update: 'Update area', disable: 'Turn off', radius: 'Alert radius', km: 'km', location: 'Use your current location as the center for alerts.', active: 'Notifications are active for your selected area.', denied: 'Notifications are blocked. Check your browser or device permissions.', failed: 'Could not configure notifications. Check location and permissions and try again.', disabled: 'Notifications turned off.', unavailable: 'The operator must finish configuring notifications before they can be enabled.' },
  es: { install: 'Instalar app', installTitle: 'Instalar Thieves Map', ios: 'Pulsa Compartir en el navegador y después “Añadir a pantalla de inicio”.', close: 'Cerrar', push: 'Notificaciones cercanas', enable: 'Activar notificaciones', update: 'Actualizar zona', disable: 'Desactivar', radius: 'Radio de avisos', km: 'km', location: 'Usa tu ubicación actual como centro de los avisos.', active: 'Notificaciones activas para la zona elegida.', denied: 'Notificaciones bloqueadas. Revisa los permisos del navegador o dispositivo.', failed: 'No se pudieron configurar las notificaciones. Revisa la ubicación y los permisos.', disabled: 'Notificaciones desactivadas.', unavailable: 'El administrador debe completar la configuración para activar las notificaciones.' },
};
const decodeKey = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
const getLocation = () => new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }));
const notice = { it: 'Ricevi avvisi per le segnalazioni non verificate vicino a te.', en: 'Receive alerts for unverified reports near you.', es: 'Recibe avisos sobre reportes no verificados cerca de ti.' };

export default function PwaControls({ language, settingsOpen, onCloseSettings, allowPrompt = true }) {
  const t = copy[language];
  const [prompt, setPrompt] = useState(null), [ios, setIos] = useState(false), [installed, setInstalled] = useState(false), [help, setHelp] = useState(false), [firstVisitPrompt, setFirstVisitPrompt] = useState(false), [ready, setReady] = useState(false), [supported, setSupported] = useState(false), [config, setConfig] = useState(null), [subscribed, setSubscribed] = useState(false), [radius, setRadius] = useState(5), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const updateInstalled = () => setInstalled(display.matches || navigator.standalone === true);
    const onPrompt = event => { event.preventDefault(); setPrompt(event); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setHelp(false); };
    updateInstalled();
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    display.addEventListener('change', updateInstalled);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js').then(async registration => {
        setSupported('PushManager' in window && 'Notification' in window);
        setSubscribed(Boolean(await registration.pushManager?.getSubscription()));
        setReady(true);
      }).catch(() => { setSupported(false); setReady(true); });
      fetch('/api/push').then(response => response.json()).then(setConfig).catch(() => setConfig({ enabled: false }));
    } else setReady(true);
    return () => { display.removeEventListener('change', updateInstalled); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  useEffect(() => {
    if (allowPrompt && ready && config?.enabled && !subscribed && ((supported && Notification.permission !== 'denied') || (ios && !installed)) && localStorage.getItem('thieves-map-push-prompted') !== '1') setFirstVisitPrompt(true);
  }, [allowPrompt, ready, supported, config, subscribed, ios, installed]);
  function closeSettings() { setFirstVisitPrompt(false); localStorage.setItem('thieves-map-push-prompted','1'); onCloseSettings(); }
  async function install() {
    if (!prompt) { setHelp(true); return; }
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }
  async function activate() {
    setBusy(true); setMessage('');
    let created = false, subscription;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setMessage(t.denied); return; }
      if (!navigator.geolocation) throw new Error('Location unavailable');
      const position = await getLocation();
      const registration = await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.getSubscription();
      if (!subscription) { subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(config.publicKey) }); created = true; }
      const response = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...subscription.toJSON(), lat: position.coords.latitude, lng: position.coords.longitude, radius, language }) });
      if (!response.ok) throw new Error('Subscription failed');
      setSubscribed(true); localStorage.setItem('thieves-map-push-prompted','1'); setMessage(t.active);
    } catch { if (created && subscription) await subscription.unsubscribe().catch(() => {}); setMessage(t.failed); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setMessage('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unsubscribe', endpoint: subscription.endpoint }) });
        if (!response.ok) throw new Error('Unsubscribe failed');
        await subscription.unsubscribe();
      }
      setSubscribed(false); setMessage(t.disabled);
    } catch { setMessage(t.failed); } finally { setBusy(false); }
  }
  return <div className="pwa-controls">
    {!installed && (prompt || ios) && <button className="pwa-button" onClick={install}>{t.install}</button>}
    {help && <div className="pwa-popover" role="dialog" aria-label={t.installTitle}><strong>{t.installTitle}</strong><p>{t.ios}</p><button onClick={() => setHelp(false)}>{t.close}</button></div>}
    {(settingsOpen || firstVisitPrompt) && <div className="push-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeSettings(); }}><section className="push-dialog" role="dialog" aria-modal="true" aria-labelledby="push-dialog-title"><button className="push-close" onClick={closeSettings} aria-label={t.close}>×</button><strong id="push-dialog-title">{t.push}</strong><p>{notice[language]}</p>{!supported && ios && !installed ? <p>{t.ios}</p> : supported && config?.enabled ? <><p>{t.location}</p><label>{t.radius} <select value={radius} onChange={event => setRadius(Number(event.target.value))}>{[1,5,10,25].map(value => <option key={value} value={value}>{value} {t.km}</option>)}</select></label><div className="pwa-actions"><button disabled={busy} onClick={activate}>{subscribed ? t.update : t.enable}</button>{subscribed && <button disabled={busy} onClick={disable}>{t.disable}</button>}</div></> : <p>{t.unavailable}</p>}{message && <p role="status">{message}</p>}<button className="push-later" onClick={closeSettings}>{t.close}</button></section></div>}
  </div>;
}
