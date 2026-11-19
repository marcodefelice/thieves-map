// This is a deliberately closed, human-reviewed catalogue.  It is not a
// general-purpose import feed and every item must point to a primary public
// authority source before it can be added here.
const reviewedOfficialAreas = [
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
  ...[
    ['via-vitruvio', 45.4830699, 9.2054335, 'Via Vitruvio'],
    ['via-tadino', 45.4803181, 9.2088283, 'Via Alessandro Tadino'],
    ['via-benedetto-marcello', 45.4795849, 9.2064334, 'Via Benedetto Marcello'],
    ['via-vittor-pisani', 45.4826553, 9.2009840, 'Via Vittor Pisani'],
    ['via-san-gregorio', 45.4785114, 9.2065942, 'Via San Gregorio'],
    ['viale-vittorio-veneto', 45.4768316, 9.2005183, 'Viale Vittorio Veneto'],
  ].map(([slug, lat, lng, place]) => ({
    key: `official-2026-milano-${slug}`,
    lat, lng,
    source: 'https://prefettura.interno.gov.it/it/prefetture/milano/comunicazioni/nuovi-controlli-straordinari-ad-alto-impatto-area-stazione-centrale-0',
    notes: `${place}: il 17/11/2026 la Prefettura ha indicato l’area tra quelle interessate da controlli straordinari, estesi alle zone a vigilanza rafforzata. Indicatore orientativo della misura pubblica, non una classificazione dell’intero quartiere.`,
  })),
  ...[
    ['porta-garibaldi', 45.4842882, 9.1882511, 'Stazione Porta Garibaldi, presso piazza Sigmund Freud'],
    ['rogoredo', 45.4335776, 9.2380577, 'stazione Rogoredo FS'],
    ['duomo', 45.4639102, 9.1906398, 'Piazza del Duomo'],
    ['colonne-san-lorenzo', 45.4582265, 9.1810449, 'Colonne di San Lorenzo'],
    ['darsena-navigli', 45.4529111, 9.1785725, 'Darsena e Navigli'],
    ['via-padova', 45.4945547, 9.2279973, 'Via Padova'],
  ].map(([slug, lat, lng, place]) => ({
    key: `official-2026-milano-${slug}`,
    lat, lng,
    source: 'https://prefettura.interno.gov.it/it/prefetture/milano/comunicazioni/comitato-provinciale-lordine-e-sicurezza-pubblica-090926',
    notes: `${place}: il 09/09/2026 la Prefettura ha confermato l’area tra le zone a vigilanza rafforzata per il semestre successivo. Indicatore orientativo della misura pubblica, non una classificazione dell’intero quartiere.`,
  })),
  ...[
    ['parco-xxii-aprile', 44.6564711, 10.9395295, 'Parco XXII Aprile, area Attiraglio'],
    ['piazza-dante', 44.6539980, 10.9307514, 'Piazza Dante Alighieri'],
    ['parco-novi-sad', 44.6511186, 10.9227117, 'Parco Novi Sad'],
    ['autostazione', 44.6502502, 10.9197878, 'Autostazione di Modena'],
    ['porta-bologna', 44.6445350, 10.9302842, 'Largo di Porta Bologna'],
  ].map(([slug, lat, lng, place]) => ({
    key: `official-2026-modena-${slug}`,
    lat, lng,
    source: 'https://prefettura.interno.gov.it/it/prefetture/modena/notizie/riunione-comitato-ordine-e-sicurezza-pubblica',
    notes: `${place}: il 10/09/2026 la Prefettura ha inserito l’area nelle zone cittadine oggetto di vigilanza rafforzata. Indicatore orientativo della misura pubblica, non una classificazione dell’intero quartiere.`,
  })),
  ...[
    ['stazione-smn', 43.7763557, 11.2479869, 'stazione ferroviaria di Santa Maria Novella'],
    ['parco-cascine', 43.7829311, 11.2154935, 'Parco delle Cascine'],
  ].map(([slug, lat, lng, place]) => ({
    key: `official-2026-firenze-${slug}`,
    lat, lng,
    source: 'https://prefettura.interno.gov.it/it/prefetture/firenze/comunicati-stampa/prorogata-lordinanza-prefetto-sulle-zone-vigilanza-rafforzata',
    notes: `${place}: il 02/10/2026 la Prefettura ha prorogato per cinque mesi l’ordinanza di vigilanza rafforzata nell’area. Indicatore orientativo della misura pubblica, non una classificazione dell’intero quartiere.`,
  })),
  ...[
    ['piazza-duomo', 37.5024076, 15.0871898, 'Piazza Duomo'],
    ['piazza-universita', 37.5036511, 15.0871615, 'Piazza dell’Università'],
    ['piazza-stesicoro', 37.5074251, 15.0858982, 'Piazza Stesicoro'],
  ].map(([slug, lat, lng, place]) => ({
    key: `official-2026-catania-${slug}`,
    lat, lng,
    source: 'https://prefettura.interno.gov.it/it/prefetture/catania/notizie/sicurezza-urbana-catania',
    notes: `${place}: l’ordinanza prefettizia del 06/11/2026 prevede vigilanza rafforzata dal 16/11/2026 al 15/01/2027. Indicatore orientativo della misura pubblica, non una classificazione dell’intero quartiere.`,
  })),
  ...[
    ['centro-piazza-martana', 44.0336432, 10.1440403, 'Massa centro, presso piazza Martana'],
    ['stazione-piazza-iv-novembre', 44.0242037, 10.1366273, 'Massa Stazione, presso piazza IV Novembre'],
  ].map(([slug, lat, lng, place]) => ({
    key: `official-2026-massa-${slug}`,
    lat, lng,
    source: 'https://prefettura.interno.gov.it/it/prefetture/massa-carrara/notizie/individuazione-nuove-zone-vigilanza-rafforzata',
    notes: `${place}: l’area è compresa nelle zone di vigilanza rafforzata individuate dalla Prefettura, valide dal 30/10/2026 al 31/03/2027. Indicatore orientativo della misura pubblica, non una classificazione dell’intero quartiere.`,
  })),
  ...[
    ['centro-piazza-alberica', 44.0795657, 10.0977661, 'Carrara centro, presso piazza Alberica'],
    ['stazione-avenza-via-petacchi', 44.0519039, 10.0610118, 'Carrara Stazione/Avenza, via Enzo Petacchi'],
    ['marina-viale-vespucci', 44.0385987, 10.0333085, 'Marina di Carrara, viale Amerigo Vespucci'],
  ].map(([slug, lat, lng, place]) => ({
    key: `official-2026-carrara-${slug}`,
    lat, lng,
    source: 'https://prefettura.interno.gov.it/it/prefetture/massa-carrara/notizie/individuazione-nuove-zone-vigilanza-rafforzata',
    notes: `${place}: l’area è compresa nelle zone di vigilanza rafforzata individuate dalla Prefettura, valide dal 30/10/2026 al 31/03/2027. Indicatore orientativo della misura pubblica, non una classificazione dell’intero quartiere.`,
  })),
];

// The import route never accepts locations from the request body. Country and
// administrative area are deliberately part of this reviewed, closed file as
// well: importing must not depend on a third-party geocoder being available.
const administrativeAreaByKeyPrefix = [
  ['official-2026-milano-', { country: 'IT', municipality: 'Milano', province: 'Milano' }],
  ['official-2026-roma-', { country: 'IT', municipality: 'Roma', province: 'Roma' }],
  ['official-2026-napoli-', { country: 'IT', municipality: 'Napoli', province: 'Napoli' }],
  ['official-2026-torino-', { country: 'IT', municipality: 'Torino', province: 'Torino' }],
  ['official-2026-palermo-', { country: 'IT', municipality: 'Palermo', province: 'Palermo' }],
  ['official-2026-modena-', { country: 'IT', municipality: 'Modena', province: 'Modena' }],
  ['official-2026-firenze-', { country: 'IT', municipality: 'Firenze', province: 'Firenze' }],
  ['official-2026-catania-', { country: 'IT', municipality: 'Catania', province: 'Catania' }],
  ['official-2026-massa-', { country: 'IT', municipality: 'Massa', province: 'Massa-Carrara' }],
  ['official-2026-carrara-', { country: 'IT', municipality: 'Carrara', province: 'Massa-Carrara' }],
];

export const officialAreas = reviewedOfficialAreas.map((area) => {
  const administrativeArea = administrativeAreaByKeyPrefix.find(([prefix]) => area.key.startsWith(prefix))?.[1];
  if (!administrativeArea) throw new Error(`Administrative area missing for ${area.key}`);
  return { ...area, ...administrativeArea };
});
