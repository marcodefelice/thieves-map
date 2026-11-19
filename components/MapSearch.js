'use client';
import { useState } from 'react';

const copy = {
  it: { placeholder: 'Cerca indirizzo o luogo', search: 'Cerca', empty: 'Nessun risultato. Prova aggiungendo la città.', error: 'Ricerca non disponibile. Riprova.' },
  en: { placeholder: 'Search for an address or place', search: 'Search', empty: 'No results. Try adding the city.', error: 'Search unavailable. Please try again.' },
  es: { placeholder: 'Buscar dirección o lugar', search: 'Buscar', empty: 'Sin resultados. Prueba añadiendo la ciudad.', error: 'Búsqueda no disponible. Inténtalo de nuevo.' },
};

export default function MapSearch({ language, onSelect, onLocate, locating, embedded = false }) {
  const t = copy[language] || copy.it;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function search(event) {
    event?.preventDefault();
    setError(''); setResults([]); setBusy(true);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw Error();
      const data = await response.json();
      setResults(data);
      if (!data.length) setError(t.empty);
    } catch { setError(t.error); } finally { setBusy(false); }
  }
  const locateLabel = { it: 'Centra sulla mia posizione', en: 'Center on my location', es: 'Centrar en mi ubicación' }[language] || 'Center on my location';
  const controls = <><label className="visually-hidden" htmlFor={embedded ? 'moderator-address-search-input' : 'map-search-input'}>{t.placeholder}</label><span aria-hidden="true">⌕</span><input id={embedded ? 'moderator-address-search-input' : 'map-search-input'} value={query} onChange={event => { setQuery(event.target.value); setResults([]); setError(''); }} placeholder={t.placeholder} minLength={4} maxLength={200} required /><button type={embedded ? 'button' : undefined} onClick={embedded ? search : undefined} disabled={busy}>{t.search}</button>{onLocate && <button type="button" className="map-locate" aria-label={locateLabel} title={locateLabel} disabled={locating} onClick={onLocate}><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>}</>;
  return <div className={embedded ? 'map-search moderator-address-search' : 'map-search'}>{embedded ? <div role="search">{controls}</div> : <form onSubmit={search} role="search">{controls}</form>}{results.length > 0 && <div className="map-search-results">{results.map((result, index) => <button type="button" key={`${result.lat}-${result.lng}-${index}`} onClick={() => { onSelect(result); setQuery(result.name); setResults([]); }}>{result.name}</button>)}</div>}{error && <div className="map-search-error" role="status">{error}</div>}</div>;
}
