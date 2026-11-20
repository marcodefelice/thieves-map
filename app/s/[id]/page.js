import { cache } from 'react';
import { notFound } from 'next/navigation';
import MapApp from '../../../components/MapApp';
import { getReportStore } from '../../../lib/db.mjs';
import { parseSharedReportId, reportShareMetadata, reportZone, shareableReport } from '../../../lib/report-share.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const getReport = cache(async value => {
  const id = parseSharedReportId(value);
  if (!id) return null;
  const report = await getReportStore().sharedReport(id);
  return shareableReport(report) ? report : null;
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();
  const { title, description } = reportShareMetadata(report, await reportZone(report));
  const url = `/s/${id}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: 'Punto Sicuro', url, title, description, images: [{ url: '/social-preview.jpeg', width: 1408, height: 768, alt: 'Punto Sicuro — la mappa delle segnalazioni' }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/social-preview.jpeg'] },
  };
}

export default async function SharedReportPage({ params }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();
  return <MapApp turnstileSiteKey={process.env.TURNSTILE_SITE_KEY || ''} sharedReport={{ id: report.id, lat: report.lat, lng: report.lng }} />;
}
