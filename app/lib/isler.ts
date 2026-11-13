// IS MERKEZLERI (Duzeltme 15-A / 15-B, bulgu 128-129) - ortak kart modeli.
//
// Musterinin "Etkinliklerim" ve profesyonelin "Islerim" merkezi ayni karti
// cizer: teklif topla talebi, dogrudan talep, rezervasyon ve sihirbaz
// etkinligi tek bir "is" satirina indirgenir. Veri toplama sayfalarin kendi
// sunucu modulunde; burada yalniz tip ve etiket var ('use client' YOK).

/**
 * Sekmeler. Fahri satir 33: "tamamlanan, yaklasan veya talep bekleyen".
 * `sonuclanmayan` ayri tutulur: iptal edilen ya da teklifsiz kapanan is
 * "tamamlanan" sayilmaz. Sekmesi yalniz doluysa gosterilir.
 *
 * `teklif` yalniz profesyonel merkezinde (Fahri satir 34): teklif verilmis,
 * musterinin karari bekleniyor ("Teklif verdiklerim"). Musteri merkezinde
 * teklif gelen is "bekleyen"de kalir (karar musteride), bu asama bos durur.
 */
export type IsAsamasi =
  | 'bekleyen'
  | 'teklif'
  | 'yaklasan'
  | 'tamamlanan'
  | 'sonuclanmayan';

export type IsTuru =
  | 'teklif-topla'
  | 'talep'
  | 'rezervasyon'
  | 'etkinlik'
  // Duzeltme 20-C: ajansin kendi etkinligine bagli olmayan teklif dosyalari.
  | 'teklif-dosyasi'
  | 'rfp-yaniti';

/** Durum etiketinin rengi: vurgu = kullanicidan is bekleniyor. */
export type IsTonu = 'vurgu' | 'olumlu' | 'notr' | 'soluk';

export type IsTeklifi = {
  id: string;
  /** Teklifi veren (cok alicili is) ya da teklif tarihi (tek kisilik is). */
  kimden: string;
  tutar: string;
  durum: string;
  ton: IsTonu;
  href: string;
};

export type IsBaglantisi = { href: string; etiket: string };

export type Is = {
  anahtar: string;
  tur: IsTuru;
  asama: IsAsamasi;
  baslik: string;
  /** "Lansman · 12 Aralik 2026 · Istanbul" gibi tek satir. */
  ayrinti: string | null;
  durum: string;
  ton: IsTonu;
  href: string;
  hrefEtiketi: string;
  /** Ikinci yol (ornek: rezervasyonlu iste "Tum teklifler" ya da "Sohbet"). */
  ekBaglanti: IsBaglantisi | null;
  tutar: string | null;
  /** Kartin altinda gosterilen teklifler (en cok uc). */
  teklifler: IsTeklifi[];
  /** Listede gosterilmeyen teklif sayisi. */
  kalanTeklif: number;
  /** Kurum adina acilan is (ekip uyesi goruyor). */
  kurulus: string | null;
};

export const IS_TURU_ETIKETI: Record<IsTuru, string> = {
  'teklif-topla': 'Teklif topla',
  talep: 'Doğrudan talep',
  rezervasyon: 'Rezervasyon',
  etkinlik: 'Etkinlik',
  'teklif-dosyasi': 'Teklif dosyası',
  'rfp-yaniti': 'RFP yanıtı',
};

export const IS_ASAMALARI: readonly IsAsamasi[] = [
  'bekleyen',
  'teklif',
  'yaklasan',
  'tamamlanan',
  'sonuclanmayan',
];

export function asamaMi(deger: string | undefined): deger is IsAsamasi {
  return !!deger && (IS_ASAMALARI as readonly string[]).includes(deger);
}
