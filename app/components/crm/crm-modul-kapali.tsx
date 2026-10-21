import Link from 'next/link';

/**
 * FAZ 8b — "Musteriler modulu kapali" durumu (8a `GorevModuluKapali` kalibi).
 *
 * Modul kapisi UC yerde birden duruyor ve hepsi ayni kurali soyluyor: DB
 * tetikleyicisi (INSERT 22023 'crm modulu bu kurulusta kapali'), yan menu
 * (madde gorunmez) ve bu yuzey. Kullanici yine de bir yolla buraya gelirse
 * (eski baglanti, bildirim) ne oldugunu gorur — bos ekran degil.
 *
 * "Ayarlar'dan ac" baglantisi yalniz `settings.manage` yetkisi olana cikar.
 */
export function CrmModuluKapali({
  ayarlarAcilabilir,
}: {
  ayarlarAcilabilir: boolean;
}) {
  return (
    <div className="bg-card border border-line rounded-xl p-6">
      <p className="text-sm text-ink">
        Müşteriler modülü bu kuruluşta kapalı.
      </p>
      <p className="text-sm text-ink-72 mt-1.5">
        Açıldığında müşteri ve firma kayıtlarını tutabilir, fırsatları aşamalara
        göre izleyebilir ve tekliflerini bu kayıtlara bağlayabilirsin.
      </p>
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
