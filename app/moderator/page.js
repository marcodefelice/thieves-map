import ModeratorPortal from '../../components/ModeratorPortal';

export const metadata = { title: 'Area moderatori — Punto Sicuro', robots: { index: false, follow: false } };

export default async function ModeratorPage({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === 'string' ? params.token : '';
  return <ModeratorPortal activationToken={token} />;
}
