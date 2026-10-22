import Link from 'next/link';

/**
 * FAZ 8c — "yetkin yok" durumu (8b musteriler sayfasindaki kart).
 *
 * RLS zaten keserdi; bu yuzey bos bir ekran yerine SEBEBI ve cozumu yazar.
 */
export function YetkinYok({
  aciklama,
  donusHref = '/ajans',
}: {
  aciklama: string;
  donusHref?: string;
}) {
  return (
    <div className="bg-card border border-line rounded-xl p-6">
      <p className="text-sm text-ink">Bu sayfayı görmek için yetkin yok.</p>
      <p className="text-sm text-ink-72 mt-1.5">{aciklama}</p>
      <Link
        href={donusHref}
        className="kashe-tap mt-4 inline-block text-sm text-brand-ink hover:underline"
      >
        Göstergeye dön →
      </Link>
    </div>
  );
}
