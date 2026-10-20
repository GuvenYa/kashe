/**
 * GUVEN CIPLERI (D2) — profilin dogrulanabilir sinyalleri.
 *
 * 'use client' YOKTUR: sunucu sayfalari render eder.
 *
 * KURAL: HER CIP BIR VERIYE DAYANIR. Sinyal yoksa cip CIZILMEZ; olculmeyen bir
 * seyi (portfoy denetimi, komisyon kapsami gibi) ima eden ifadeler bu bilesene
 * GIRMEZ. Prop'lar bu yuzden metin degil SINYAL alir: cagiran cumle uyduramaz.
 *
 * Mevcut `badgeCards` karti (en cok iki rozet, aciklama metniyle) bu satira
 * dondu: iki rozet bir kart kadar yer kaplarken ayni bilgiyi tasiyordu.
 */
type Props = {
  /** `isVerified` — kimlik/onay sinyali. */
  dogrulanmis: boolean;
  /** `profiles.approval_status === 'approved'`. */
  profilOnayli: boolean;
  /** Tamamlanmis rezervasyon sayisi; 0 ise cip yok. */
  tamamlanmisIs: number;
  /**
   * Ortalama ilk yanit suresi (saat). Bugun `null`: ilk-yanit taramasi FAZ 2
   * (bkz. `getBadgeCards` responseTime notu). Sinyal gelince cip kendiliginden
   * cikar; sayiyi BURADA uretmiyoruz.
   */
  ortalamaYanitSaati: number | null;
  /** `repeatChoice` sinyali. */
  tekrarTercih: boolean;
  /** Aktif premium. */
  premium: boolean;
  /**
   * Puan sinyalleri (`getBadges`: ortalama >= 4,5 ve >= 3 yorum; >= 10 yorum).
   * Ajans dalindaki eski rozetler bu iki cipe tasindi.
   */
  yuksekPuanli?: boolean;
  cokTercihEdilen?: boolean;
};

function Cip({ metin }: { metin: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-moss bg-moss/10 border border-moss/25 px-2.5 py-1 rounded-full">
      <span aria-hidden="true">✓</span>
      {metin}
    </span>
  );
}

export function GuvenCipleri({
  dogrulanmis,
  profilOnayli,
  tamamlanmisIs,
  ortalamaYanitSaati,
  tekrarTercih,
  premium,
  yuksekPuanli = false,
  cokTercihEdilen = false,
}: Props) {
  const cipler: string[] = [];

  if (dogrulanmis) cipler.push('Kimlik doğrulandı');
  if (profilOnayli) cipler.push('Profil onaylı');
  if (tamamlanmisIs > 0) cipler.push(`${tamamlanmisIs} tamamlanmış iş`);
  if (ortalamaYanitSaati !== null && ortalamaYanitSaati > 0) {
    cipler.push(`Ortalama yanıt: ${Math.round(ortalamaYanitSaati)} saat`);
  }
  if (yuksekPuanli) cipler.push('Yüksek puanlı');
  if (cokTercihEdilen) cipler.push('Çok tercih ediliyor');
  if (tekrarTercih) cipler.push('Tekrar tercih ediliyor');
  if (premium) cipler.push('Premium');

  if (cipler.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {cipler.map((m) => (
        <Cip key={m} metin={m} />
      ))}
    </div>
  );
}
