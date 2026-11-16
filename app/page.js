import MapApp from '../components/MapApp';
export const dynamic = 'force-dynamic';
export default function Home() { return <MapApp turnstileSiteKey={process.env.TURNSTILE_SITE_KEY || ''} />; }
