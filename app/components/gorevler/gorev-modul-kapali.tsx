import Link from 'next/link';

/**
 * FAZ 8a — "Gorevler modulu kapali" durumu.
 *
 * Modul kapisi UC yerde birden duruyor ve hepsi ayni kurali soyluyor: DB
 * tetikleyicisi (INSERT 22023), yan menu (madde gorunmez) ve bu yuzey. Kullanici
 * yine de bir yolla buraya gelirse (eski baglanti, bildirim) ne oldugunu ve
 * cozumu gorur — bos ekran degil.
 *
 * "Ayarlar'dan ac" baglantisi yalniz `settings.manage` yetkisi olana cikar;
 * yetkisi olmayana yonlendirecek bir yer yok, metin de onu soylemez.
 */
export function GorevModuluKapali({
  ayarlarAcilabilir,
}: {
  ayarlarAcilabilir: boolean;
}) {
  return (
    <div className="bg-card border border-line rounded-xl p-6">
      <p className="text-sm text-ink">Görevler modülü bu kuruluşta kapalı.</p>
      <p className="text-sm text-ink-72 mt-1.5">
        Açıldığında etkinliklere ve kuruluş geneline görev ekleyebilir, ekibe
        atayabilir ve son tarih takibi yapabilirsin.
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
