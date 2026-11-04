import Link from 'next/link';

/**
 * GIRISSIZ KASHE AI — ortak geri bildirim parcalari (Duzeltme 06).
 *
 * Iki yuzey ayni metni gosteriyor (`/kashe-ai` ve `/etkinlik-sihirbazi`); metin
 * ve baglantilar TEK YERDE dursun diye bilesen ortak. Mesajin kendisi sunucuda
 * uretilir (`app/lib/girissiz-ai.ts` — tek kaynak), burada yalniz cizim var.
 *
 * `'use client'` YOK: ikisi de istemci agacinda render ediliyor ama bilesen
 * durum tutmuyor, bu yuzden sunucu agacinda da kullanilabilir.
 */

/** Basarili analizden sonra: "bugun N hakkin kaldi" (yalniz girissiz). */
export function GirissizHakNotu({ kalan }: { kalan: number }) {
  return (
    <p className="text-[11px] text-ink-72 font-mono mt-3">
      Girişsiz kullanım: bugün {kalan} hakkın kaldı.
    </p>
  );
}

/**
 * Hak bittiginde (ya da girissiz kullanim kapaliyken): mesaj + iki cikis.
 *
 * `girisHref` cagiranin hesapladigi donus URL'sini tasir — kullanici giris
 * yaptiktan sonra anlattigi metne geri doner.
 */
export function GirisGerekliKutusu({
  mesaj,
  girisHref,
}: {
  mesaj: string;
  girisHref: string;
}) {
  return (
    <div className="mt-3 bg-card border border-line rounded-lg p-4">
      <p className="text-sm text-ink">{mesaj}</p>
      <div className="flex items-center gap-4 mt-2.5 flex-wrap">
        <Link
          href="/uye-ol"
          className="text-sm font-display font-semibold text-brand-ink underline hover:text-brand-ink-deep transition-colors"
        >
          Ücretsiz üye ol
        </Link>
        <Link
          href={girisHref}
          className="text-sm text-ink-72 underline hover:text-ink transition-colors"
        >
          Giriş yap
        </Link>
      </div>
    </div>
  );
}
