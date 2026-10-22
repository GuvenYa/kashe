import Link from 'next/link';

/**
 * FAZ 8c — "modul kapali" durumu (8a `GorevModuluKapali` kalibi).
 *
 * Modul kapisi UC yerde birden duruyor ve hepsi ayni kurali soyluyor: DB
 * tetikleyicisi (INSERT 22023), yan menu (madde gorunmez) ve bu yuzey.
 * Kullanici yine de bir yolla buraya gelirse (eski baglanti) ne oldugunu
 * gorur — bos ekran degil.
 *
 * Metin CAGIRANDAN gelir: ayni kabuk hem tedarikci defteri hem kisa liste
 * icin kullanilir, iki kopya bilesen olmasin.
 */
export function ModulKapali({
  baslik,
  aciklama,
  ayarlarAcilabilir,
}: {
  baslik: string;
  aciklama: string;
  /** `settings.manage` — yetkisi olmayana yonlendirecek bir yer yok. */
  ayarlarAcilabilir: boolean;
}) {
  return (
    <div className="bg-card border border-line rounded-xl p-6">
      <p className="text-sm text-ink">{baslik}</p>
      <p className="text-sm text-ink-72 mt-1.5">{aciklama}</p>
      {ayarlarAcilabilir && (
        <Link
          href="/kurumsal/ayarlar"
          className="kashe-tap mt-4 inline-block text-sm text-brand-ink hover:underline"
        >
          Ayarlar&apos;dan aç →
        </Link>
      )}
    </div>
  );
}
