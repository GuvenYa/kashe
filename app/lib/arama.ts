/**
 * KESFET ARAMASI — terim temizligi ve es anlamli sozlugu (Duzeltme 05-D, bulgu 67).
 *
 * Iki ayri is:
 *
 * 1) `aramaTerimi` — GUVENLIK. Terim PostgREST'in `or=(...)` filtresine metin
 *    olarak giriyor; `,` kosullari ayirir, `()` gruplar, `*` / `%` joker,
 *    `:` ve `"` deger sarmalar, `\` kacis karakteri. Kullanici "a,b" yazinca
 *    sorgu bozulup sayfa hata veriyordu. Bu karakterler BOSLUKLA degistirilir
 *    (silinmez: "a,b" -> "a b", kelime siniri korunur), terim bosa duserse
 *    arama YOK SAYILIR.
 *
 * 2) `esAnlamliEslesme` — KAPSAM. "acilis" yazan kullanici "Lansman" turunu
 *    beyan eden saglayicilari, "organizator" yazan organizasyon kategorisini
 *    bulamiyordu. Sozluk yalniz ES ANLAMLILARI tutar; etkinlik turu ETIKETLERI
 *    ve gecerli anahtar kumesi `event_types` TABLOSUNDAN gelir (bkz.
 *    `app/lib/etkinlik-turleri.ts`) — burada tur LISTESI yok, yalniz hedef
 *    anahtarlar. Tabloda olmayan bir anahtar cagiran tarafta suzulur.
 *
 * Normalizasyon: Turkce harfler ASCII karsiligina indirilir, boylece "açılış"
 * ve "acilis" ayni girise duser (sozluk tek yazimda durur).
 *
 * 3) `aramaKatla` — TURKCE HARF DUYARSIZ ARAMA (Duzeltme 07, bulgu 71).
 *    Veritabanindaki `public.tr_katla` ile BIREBIR ayni esleme: Kesfet
 *    `v_providers_public.arama_metni` (katlanmis ad + sirket + baslik +
 *    tanitim + kategori adi) sutununda katlanmis terimle arar, boylece
 *    "fotograf" "Fotoğrafçı"yi, "dogan" "Doğan"i bulur. Esleme degisirse
 *    migration'daki `tr_katla` da ayni commit'te degisir.
 */

/** PostgREST filtre sozdizimini kiran karakterler. */
const KIRAN_KARAKTERLER = /[,()*:%\\"]/g;

/**
 * Ham `q` degerini aramaya UYGUN hale getirir.
 *
 * Donus bos string ise arama uygulanmaz (cagiran taraf karar verir).
 */
export function aramaTerimi(ham: string | null | undefined): string {
  if (!ham) return '';
  return ham.replace(KIRAN_KARAKTERLER, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Turkce ve sapkali harfleri ASCII'ye indirip kucuk harfe cevirir.
 * `public.tr_katla` (DB) ile ayni sonuc: "Çağrı IŞIK" -> "cagri isik".
 * Sapkali harfler kaynakta kacis koduyla yazilir.
 */
export function aramaKatla(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/\u00e2/g, 'a')
    .replace(/\u00ee/g, 'i')
    .replace(/\u00fb/g, 'u');
}

/** Katlanmis + bosluklari sadelestirilmis hal (sozluk eslemesi). */
function sadelestir(s: string): string {
  return aramaKatla(s).replace(/\s+/g, ' ').trim();
}

export type AramaEslesmesi = {
  /** `event_types.key` degerleri — cagiran taraf tabloya gore suzer. */
  etkinlikTurleri: string[];
  /** `service_categories.slug` degerleri. */
  kategoriSluglari: string[];
  /** Kurumsal hizmet saglayicilari (rol `agency`) sonuca katilsin mi. */
  kurumsalSaglayici: boolean;
};

type SozlukSatiri = {
  /** Sadelestirilmis (ASCII, kucuk harf) es anlamlilar. */
  terimler: string[];
  etkinlik?: string[];
  kategori?: string[];
  kurumsal?: boolean;
};

const SOZLUK: SozlukSatiri[] = [
  {
    terimler: ['acilis', 'magaza acilisi', 'acilis organizasyonu', 'lansman'],
    etkinlik: ['launch'],
  },
  {
    terimler: ['nikah', 'nikah toreni', 'dugun', 'dugun organizasyonu'],
    etkinlik: ['wedding'],
  },
  {
    terimler: ['dogum gunu', 'dogum gunu partisi', 'yas gunu'],
    etkinlik: ['birthday'],
  },
  { terimler: ['kina', 'kina gecesi'], etkinlik: ['henna'] },
  {
    terimler: [
      'organizasyon firmasi',
      'organizasyon sirketi',
      'organizator',
      'etkinlik firmasi',
      'etkinlik ajansi',
    ],
    kategori: ['organizasyon', 'etkinlik-koordinatoru'],
    kurumsal: true,
  },
  { terimler: ['menajer', 'menajerlik', 'menajans'], kurumsal: true },
];

/**
 * Terimi sozlukte arar. Iki yonlu kapsama:
 *   - kullanicinin yazdigi metin bir es anlamliyi ICERIYORSA ("acilis
 *     organizasyonu" -> "acilis"),
 *   - ya da es anlamli, yazilan metni iceriyorsa ("organizat" gibi kisaltmalar
 *     icin; en az 4 karakter sarti yanlis eslesmeyi onler).
 *
 * Hicbir sey eslesmezse uc alan da bos doner ve arama bugunku gibi yalniz
 * metin sutunlarinda yapilir.
 */
export function esAnlamliEslesme(terim: string): AramaEslesmesi {
  const n = sadelestir(terim);
  const etkinlikTurleri = new Set<string>();
  const kategoriSluglari = new Set<string>();
  let kurumsalSaglayici = false;

  if (n.length >= 3) {
    for (const satir of SOZLUK) {
      const esledi = satir.terimler.some(
        (t) => n === t || n.includes(t) || (n.length >= 4 && t.includes(n))
      );
      if (!esledi) continue;
      satir.etkinlik?.forEach((k) => etkinlikTurleri.add(k));
      satir.kategori?.forEach((s) => kategoriSluglari.add(s));
      if (satir.kurumsal) kurumsalSaglayici = true;
    }
  }

  return {
    etkinlikTurleri: [...etkinlikTurleri],
    kategoriSluglari: [...kategoriSluglari],
    kurumsalSaglayici,
  };
}

/**
 * ETKINLIK TURU ADIYLA ESLESME (Duzeltme 10-C, bulgu 81).
 *
 * Arama bugun yalniz metin sutunlarinda ve el yazimi es anlamli sozlugunde
 * bakiyordu; "Gala" yazan kullanici Gala turunu PROFILINDE BEYAN EDEN
 * saglayicilari bulamiyordu (dalda metin 17, beyan 38). Burasi tur ADLARINI
 * da arar — sozluk satirlari ayrica KALIR (es anlamlilar farkli bir is).
 *
 * Kural `esAnlamliEslesme` ile AYNI: iki yonlu kapsama, en az 3 karakter.
 * `other` ("Diger") HARIC — herkesi getiren anlamsiz bir esleme olurdu.
 * Cagiran yalniz AKTIF turleri gondermeli.
 */
export function etkinlikTuruEslesmesi(
  terim: string,
  turler: { key: string; name_tr: string }[]
): string[] {
  const n = sadelestir(terim);
  if (n.length < 3) return [];
  const bulunan = new Set<string>();
  for (const t of turler) {
    if (t.key === 'other') continue;
    const ad = sadelestir(t.name_tr);
    if (!ad) continue;
    if (n === ad || n.includes(ad) || (n.length >= 4 && ad.includes(n))) {
      bulunan.add(t.key);
    }
  }
  return [...bulunan];
}
