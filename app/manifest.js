export default function manifest() {
  return {
    id: '/', name: 'Thieves Map', short_name: 'Thieves Map',
    description: 'A community map of reported burglary attempts.',
    start_url: '/', scope: '/', display: 'standalone',
    background_color: '#fbfcf8', theme_color: '#315747',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
