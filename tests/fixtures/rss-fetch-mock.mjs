globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  if (url === 'https://feed.example/rss') return new Response(`<rss><channel><item><title>Furto in centro a Varese</title><link>https://news.example/articolo</link><description>Un furto in piazza</description><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`, { status: 200 });
  if (url === 'https://llm.example/chat') { const body = JSON.parse(options.body); if (body.model !== 'gpt-6-luna' || body.reasoning_effort !== 'none') throw new Error('Invalid model parameters'); return Response.json({ choices: [{ message: { content: JSON.stringify({ categoria: 'theft', 'città': 'Varese', via_o_zona: 'Piazza Monte Grappa', riassunto_neutro: 'Un furto è stato riportato dalla stampa.', data_evento: null }) } }] }); }
  if (url.startsWith('https://geo.example/search?')) { const query = new URL(url).searchParams; if (query.get('key') !== 'secret-test' || query.get('format') !== 'json') throw new Error('Invalid geocoder parameters'); return Response.json([{ lat: '45.818', lon: '8.825', address: { country_code: 'it', city: 'Varese', province: 'Varese' } }]); }
  throw new Error(`Unexpected URL ${url}`);
};
