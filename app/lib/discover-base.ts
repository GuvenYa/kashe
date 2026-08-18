/**
 * KEŞFET TEMEL FİLTRESİ — TEK KAYNAK.
 *
 * "Keşfet'te görünebilir profil" tanımı burada yaşar. İki tüketicisi var:
 *   • app/kesfet/page.tsx        → sonuç listesi
 *   • app/etkinlik-sihirbazi/    → sihirbazın canlı sayacı
 *
 * NEDEN FONKSİYON: iki yer aynı koşulu ayrı ayrı yazdığında sayaç ile listenin
 * sessizce ayrışması an meselesi — kullanıcıya "34 profesyonel uyuyor" deyip
 * Keşfet'te başka bir sayı göstermek doğrudan yalan olur. Yorum bağı ("değişirse
 * şurayı da değiştir") bunu engellemez; ortak fonksiyon engeller.
 *
 * Buraya bir koşul EKLENİRSE (ör. approval_status) iki taraf da otomatik alır.
 */

/** Keşfet'te listelenebilen roller. */
export const DISCOVER_ROLES = ['professional', 'agency'] as const;

/**
 * Zincirlenebilir sorgu kurucusunun ihtiyaç duyulan YÜZEYİ.
 * Özyinelemesiz (`Q extends Filterable<Q>` DEĞİL): Supabase'in sorgu kurucusu
 * kendine dönen derin jenerikler taşıyor ve özyinelemeli kısıt TS2589
 * ("type instantiation is excessively deep") veriyor.
 */
interface Chainable {
  eq(column: string, value: unknown): Chainable;
  in(column: string, values: readonly unknown[]): Chainable;
}

/**
 * Keşfet'in temel görünürlük koşullarını sorguya uygular.
 * Kategori/şehir/etkinlik gibi KULLANICI filtreleri buraya girmez — onlar
 * çağıranın işidir; burada yalnız "kim listelenebilir" kuralı vardır.
 *
 * Dönüş çağıranın tipini korur: iki `as unknown as` dönüşümü YALNIZ burada,
 * tek yerde toplanmıştır; çağıranlar tam tipli sorgu kurucusuyla devam eder.
 */
export function applyDiscoverBase<Q>(query: Q): Q {
  const q = query as unknown as Chainable;
  return q
    .eq('is_published', true)
    .in('role', DISCOVER_ROLES as readonly string[]) as unknown as Q;
}

/**
 * Sayaç metni — sonuç kümesi profesyonel VE ajans içerdiği için "profesyonel"
 * demek yanlış olur. Keşfet nötr "sonuç" diyor; sihirbaz da aynı dili kullanır.
 */
export function sonucEtiketi(sayi: number): string {
  return `${sayi} sonuç`;
}
