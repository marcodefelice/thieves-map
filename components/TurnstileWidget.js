'use client';

import { useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'cloudflare-turnstile-api';

export default function TurnstileWidget({ siteKey, onToken, labels }) {
  const container = useRef(null);
  const widgetId = useRef(null);
  const tokenCallback = useRef(onToken);
  const [status, setStatus] = useState('loading');

  useEffect(() => { tokenCallback.current = onToken; }, [onToken]);

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let cancelled = false;
    let script = document.getElementById(SCRIPT_ID);
    const handleError = () => { if (!cancelled) setStatus('error'); };

    const render = () => {
      if (cancelled || !container.current || !window.turnstile || widgetId.current !== null) return;
      try {
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action: 'report',
          theme: 'auto',
          callback: token => { tokenCallback.current(token); setStatus('ready'); },
          'expired-callback': () => { tokenCallback.current(''); setStatus('expired'); },
          'error-callback': () => { tokenCallback.current(''); setStatus('error'); return true; },
        });
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    };

    if (window.turnstile) render();
    else {
      if (!script) {
        script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', render);
      script.addEventListener('error', handleError, { once: true });
    }

    return () => {
      cancelled = true;
      tokenCallback.current('');
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
      script?.removeEventListener('load', render);
      script?.removeEventListener('error', handleError);
    };
  }, [siteKey]);

  const message = status === 'loading' ? labels.loading : status === 'expired' ? labels.expired : status === 'error' ? labels.error : '';
  return <div className="turnstile-field">
    <div ref={container} />
    {message && <small role={status === 'error' ? 'alert' : 'status'}>{message}</small>}
  </div>;
}
