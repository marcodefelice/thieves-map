// This is a deliberately closed, human-reviewed catalogue.  It is not a
// general-purpose import feed and every item must point to a primary public
// authority source before it can be added here.
export const officialAreas = [
  {
    key: 'official-2026-milano-stazione-centrale',
    lat: 45.4856, lng: 9.2028,
    source: 'https://prefettura.interno.gov.it/it/prefetture/milano/comunicazioni/nuovi-controlli-straordinari-ad-alto-impatto-area-stazione-centrale-0',
    notes: "Stazione Centrale e piazza Duca d'Aosta: il 17/11/2026 la Prefettura ha indicato l’area tra quelle oggetto di controlli straordinari e di vigilanza rafforzata. Indicatore orientativo della misura pubblica, non una classificazione dell’intero quartiere.",
  },
  ...[
    ['piazza-iv-novembre', 45.4840, 9.2054, 'Piazza IV Novembre'],
    ['via-sammartini', 45.4913, 9.2076, 'via Sammartini'],
    ['piazzale-oberdan', 45.4754, 9.2012, 'piazzale Oberdan e giardini di Porta Venezia'],
    ['piazza-repubblica', 45.4792, 9.1955, 'piazza della Repubblica'],
  ].map(([slug, lat, lng, place]) => ({
    key: `official-2026-milano-${slug}`,
    lat, lng,
    source: 'https://prefettura.interno.gov.it/it/prefetture/milano/comunicazioni/nuovi-controlli-straordinari-ad-alto-impatto-area-stazione-centrale-0',
    notes: `${place}: il 17/11/2026 la Prefettura ha indicato l’area tra quelle oggetto di controlli straordinari e di vigilanza rafforzata. Indicatore orientativo della misura pubblica, non una classificazione dell’intero quartiere.`,
  })),
  {
    key: 'official-2026-roma-ponte-milvio',
    lat: 41.9344, lng: 12.4666,
    source: 'https://www.comune.roma.it/web-resources/cms/documents/QH20260075063_OdS_n_137_26.pdf',
    notes: "Piazzale di Ponte Milvio rientra nell’ordinanza comunale contro la malamovida, in vigore fino all’11/04/2027, con misure serali per tutelare vivibilità e decoro. Indicatore orientativo dell’area pubblica, non una classificazione dell’intero quartiere.",
  },
  ...[
    ['primavalle', 41.9089, 12.4138, 'Piazza Alfonso Capecelatro, Primavalle'],
    ['torrevecchia', 41.9111, 12.4068, 'via di Torrevecchia'],
    ['monte-mario', 41.9266, 12.4407, 'piazza Guadalupe, Monte Mario'],
    ['selva-nera', 41.9305, 12.3774, 'largo Ines Bedeschi, Selva Nera'],
    ['stazione-ottavia', 41.9481, 12.3927, 'stazione di Ottavia'],
    ['saxa-rubra', 41.9666, 12.4833, 'Piazza Saxa Rubra, Labaro/Prima Porta'],
  ].map(([slug, lat, lng, place]) => ({
    key: `official-2026-roma-${slug}`,
    lat, lng,
    source: 'https://www.comune.roma.it/web-resources/cms/documents/QH20260075063_OdS_n_137_26.pdf',
    notes: `${place} rientra nell’ordinanza comunale contro la malamovida, in vigore fino all’11/04/2027, con misure serali per tutelare vivibilità e decoro. Indicatore orientativo dell’area pubblica, non una classificazione dell’intero quartiere.`,
  })),
  {
    key: 'official-2026-napoli-piazza-bellini-dante',
    lat: 40.8486, lng: 14.2492,
    source: 'https://prefettura.interno.gov.it/it/prefetture/napoli/notizie/sicurezza-urbana',
    notes: 'L’area Piazza Bellini–Dante è indicata dalla Prefettura tra le macro-zone a vigilanza rafforzata per prevenzione, contrasto dell’illegalità e tutela della fruibilità degli spazi pubblici. Indicatore orientativo dell’area, non una classificazione dell’intero quartiere.',
  },
  {
    key: 'official-2026-napoli-porta-capuana',
    lat: 40.8529, lng: 14.2708,
    source: 'https://prefettura.interno.gov.it/it/prefetture/napoli/notizie/sicurezza-urbana',
    notes: 'Porta Capuana è indicata dalla Prefettura tra le macro-zone a vigilanza rafforzata per prevenzione, contrasto dell’illegalità e tutela della fruibilità degli spazi pubblici. Indicatore orientativo dell’area, non una classificazione dell’intero quartiere.',
  },
  ...[
    ['coroglio-bagnoli', 40.8155, 14.1660, 'Coroglio–Bagnoli'],
    ['mergellina', 40.8279, 14.2200, 'Mergellina'],
    ['barra', 40.8235, 14.2902, 'Barra'],
    ['porta-nolana', 40.8473, 14.2690, 'Porta Nolana'],
    ['rione-sanita', 40.8590, 14.2528, 'Rione Sanità'],
    ['chiaia', 40.8333, 14.2393, 'Chiaia'],
    ['stadio-maradona', 40.8279, 14.1930, 'area dello Stadio Maradona'],
  ].map(([slug, lat, lng, place]) => ({
    key: `official-2026-napoli-${slug}`,
    lat, lng,
    source: 'https://prefettura.interno.gov.it/it/prefetture/napoli/notizie/sicurezza-urbana',
    notes: `${place} è indicata dalla Prefettura tra le macro-zone a vigilanza rafforzata per prevenzione, contrasto dell’illegalità e tutela della fruibilità degli spazi pubblici. Indicatore orientativo dell’area, non una classificazione dell’intero quartiere.`,
  })),
  {
    key: 'official-2026-torino-piazza-bengasi',
    lat: 45.0214, lng: 7.6411,
    source: 'https://prefettura.interno.gov.it/it/prefetture/torino/notizie/torino-confermate-ed-estese-otto-zone-vigilanza-rafforzata',
    notes: 'Piazza Bengasi–Nizza Millefonti è compresa nel provvedimento prefettizio di vigilanza rafforzata illustrato il 02/10/2026. Indicatore orientativo della misura pubblica, non una classificazione dell’intero quartiere.',
  },
  ...[
    ['dora-vanchiglia', 45.0716, 7.7006, 'Dora Vanchiglia, presso piazza Santa Giulia'],
    ['san-salvario', 45.0580, 7.6780, 'San Salvario, presso piazza Madama Cristina'],
    ['san-donato', 45.0790, 7.6654, 'San Donato, presso piazza Statuto'],
    ['barriera-milano', 45.0908, 7.6969, 'Barriera di Milano, presso piazza Foroni'],
    ['centro-movida', 45.0627, 7.6961, 'Centro, presso piazza Vittorio Veneto'],
  ].map(([slug, lat, lng, place]) => ({
    key: `official-2026-torino-${slug}`,
    lat, lng,
    source: 'https://prefettura.interno.gov.it/it/prefetture/torino/notizie/torino-confermate-ed-estese-otto-zone-vigilanza-rafforzata',
    notes: `${place} è compresa nel provvedimento prefettizio di vigilanza rafforzata illustrato il 02/10/2026. Indicatore orientativo della misura pubblica, non una classificazione dell’intero quartiere.`,
  })),
  {
    key: 'official-2026-palermo-teatro-massimo',
    lat: 38.1208, lng: 13.3575,
    source: 'https://prefettura.interno.gov.it/it/prefetture/palermo/notizie/proroga-zone-vigilanza-rafforzata',
    notes: 'L’area Teatro Massimo è inclusa tra le zone a vigilanza rafforzata prorogate dalla Prefettura fino al 23/04/2027 per prevenzione e ordinata fruizione degli spazi della movida. Indicatore orientativo dell’area, non una classificazione dell’intero quartiere.',
  },
  {
    key: 'official-2026-palermo-vucciria',
    lat: 38.1171, lng: 13.3614,
    source: 'https://prefettura.interno.gov.it/it/prefetture/palermo/notizie/proroga-zone-vigilanza-rafforzata',
    notes: 'L’area Vucciria è inclusa tra le zone a vigilanza rafforzata prorogate dalla Prefettura fino al 23/04/2027 per prevenzione e ordinata fruizione degli spazi della movida. Indicatore orientativo dell’area, non una classificazione dell’intero quartiere.',
  },
  {
    key: 'official-2026-palermo-maqueda-stazione',
    lat: 38.1100, lng: 13.3692,
    source: 'https://prefettura.interno.gov.it/it/prefetture/palermo/notizie/proroga-zone-vigilanza-rafforzata',
    notes: 'L’area Maqueda–Stazione è inclusa tra le zone a vigilanza rafforzata prorogate dalla Prefettura fino al 23/04/2027 per prevenzione e ordinata fruizione degli spazi della movida. Indicatore orientativo dell’area, non una classificazione dell’intero quartiere.',
  },
  {
    key: 'official-2026-palermo-piazza-nasce',
    lat: 38.1290, lng: 13.3581,
    source: 'https://prefettura.interno.gov.it/it/prefetture/palermo/notizie/proroga-zone-vigilanza-rafforzata',
    notes: 'Piazza Nascè è inclusa tra le zone a vigilanza rafforzata prorogate dalla Prefettura fino al 23/04/2027 per prevenzione e ordinata fruizione degli spazi della movida. Indicatore orientativo dell’area, non una classificazione dell’intero quartiere.',
  },
];
