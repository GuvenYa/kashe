/**
 * YAKLASIK BUTCE -> ARALIK (Duzeltme 08 / bulgu 17).
 *
 * "250 bin civari" diyen kullaniciya model tek tutar cikariyor
 * (`budget_min = budget_max = 250000`) ve sihirbaz bunu KESIN butce gibi
 * gosteriyordu. Kullanici yaklasik konustuysa aralik da yaklasik olmali.
 *
 * KURAL (deterministik son isleme; model cagrisi ve istem metni DEGISMEZ):
 *   - sonuc tek tutar ise (min === max) VE metinde yaklasiklik sozcugu varsa
 *     VE kesinlik sozcugu YOKSA aralik +-%15 olur,
 *   - alt sinir 5.000'e ASAGI, ust sinir 5.000'e YUKARI yuvarlanir,
 *   - zaten aralik olan ("50-80 bin") ya da kesin ifade ("en fazla 250 bin")
 *     sonuclar DEGISMEZ.
 *
 * Ornek: "250 bin civari" -> 210.000 - 290.000
 *        (250.000 -+%15 = 212.500 / 287.500 -> 210.000 / 290.000)
 *
 * "TEK TUTAR" olcutu metindeki rakamlari saymak DEGIL, modelin `min === max`
 * cikarimidir: brief'te katilimci sayisi gibi baska sayilar da olabilir
 * ("150 kisilik dugun, 250 bin civari").
 */

/** Yuvarlama adimi (TL). */
const ADIM = 5000;

/** Oran: +-%15. */
const ORAN = 0.15;

/** Turkce harfleri ASCII'ye indirir, kucuk harfe cevirir. */
function sadelestir(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u');
}

/** Yaklasiklik bildiren ifadeler. */
const YAKLASIK = [
  'civari',
  'civarinda',
  'yaklasik',
  'gibi',
  'asagi yukari',
];

/**
 * Kesinlik bildiren ifadeler — bunlar varsa aralik ACILMAZ.
 *
 * `tam` YALNIZ tutara bitisik sayilir (`tam 250 bin`, `tam olarak`): bu alanda
 * "tam gun" cok gecen bir ifade ve butce ile ilgisi yok.
 */
const KESIN = [/\ben fazla\b/, /\ben az\b/, /\bazami\b/, /\basgari\b/, /\btam olarak\b/, /\btam\s+\d/];

/**
 * Tek tutarli yaklasik butceyi araliga cevirir.
 *
 * @returns genisletilmis aralik ya da `null` (degisiklik yok).
 */
export function yaklasikButceAraligi(
  metin: string,
  min: number | null,
  max: number | null
): { min: number; max: number } | null {
  if (min === null || max === null) return null;
  if (min !== max) return null; // zaten aralik
  if (min <= 0) return null;

  const n = sadelestir(metin);
  if (KESIN.some((k) => k.test(n))) return null;
  if (!YAKLASIK.some((y) => n.includes(y))) return null;

  const alt = Math.floor((min * (1 - ORAN)) / ADIM) * ADIM;
  const ust = Math.ceil((max * (1 + ORAN)) / ADIM) * ADIM;

  // Cok kucuk tutarda alt sinir 0'a duser — boyle bir aralik bilgi vermez.
  if (alt <= 0 || alt >= ust) return null;

  return { min: alt, max: ust };
}
