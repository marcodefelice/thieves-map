import './globals.css';
import './language.css';
import './recent-reports.css';
import './pwa.css';
import './map-ui.css';
import './mobile-viewport.css';
import './community.css';
import 'leaflet/dist/leaflet.css';
const title = 'Punto Sicuro — Mappa delle segnalazioni';
const description = 'Una mappa condivisa delle segnalazioni di furto, delinquenza e degrado.';
export const metadata = {
  metadataBase: new URL('https://thievesmap.cloud'),
  title,
  description,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Thieves Map', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icon-192.png',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Punto Sicuro',
    title,
    description,
    images: [{ url: '/social-preview.jpeg', width: 1408, height: 768, alt: 'Punto Sicuro — la mappa delle segnalazioni' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/social-preview.jpeg'] },
};
export const viewport = { themeColor: '#315747' };
export default function RootLayout({ children }) { return <html lang="it"><body>{children}</body></html>; }
