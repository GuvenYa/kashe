// Tarih secici yardimcilari (Duzeltme 14-A, bulgu 126) - SAF fonksiyonlar.
//
// 'use client' YOKTUR: hem sunucu hem istemci kullanabilir.
//
// Degerler "YYYY-MM-DD" GUN metnidir (saat ve dilim yok); `<input type="date">`
// ile ayni bicim, eylemler ve sutunlar degismez. Gun ekleme UTC uzerinden
// yapilir: yerel saat dilimi ve yaz saati gecisi gunu kaydiramaz. "Bugun"
// cagirandan gelir (`istanbulGunu()`), burada saat okunmaz.

export const AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;

/** Pazartesi ile baslar (takvim satiri). */
export const GUN_KISALTMALARI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

/** JS `getUTCDay()` sirasi (Pazar = 0). */
const GUN_ADLARI = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi',
] as const;

const ISO_GUN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parcala(iso: string): [number, number, number] | null {
  const m = ISO_GUN.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const ay = Number(m[2]);
  const g = Number(m[3]);
  const d = new Date(Date.UTC(y, ay - 1, g));
  // 2026-02-31 gibi degerler reddedilir (Date onu Mart'a tasir).
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== ay - 1 || d.getUTCDate() !== g) {
    return null;
  }
  return [y, ay - 1, g];
}

function yaz(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Gecerli bir "YYYY-MM-DD" mi (takvimde var olan gun)? */
export function gecerliGun(iso: string | null | undefined): iso is string {
  return !!iso && parcala(iso) !== null;
}

/** Yil + ay (0-11) + gun -> "YYYY-MM-DD" (tasma takvimle duzelir). */
export function gunYaz(yil: number, ay0: number, gun: number): string {
  return yaz(new Date(Date.UTC(yil, ay0, gun)));
}

/** iso + n gun. */
export function gunEkle(iso: string, n: number): string {
  const p = parcala(iso);
  if (!p) return iso;
  return gunYaz(p[0], p[1], p[2] + n);
}

/** iso + n ay; ayin son gunu tasarsa son gune kirpilir (31 Ocak + 1 ay = 28/29 Subat). */
export function ayEkle(iso: string, n: number): string {
  const p = parcala(iso);
  if (!p) return iso;
  const hedefAy = p[1] + n;
  const sonGun = new Date(Date.UTC(p[0], hedefAy + 1, 0)).getUTCDate();
  return gunYaz(p[0], hedefAy, Math.min(p[2], sonGun));
}

/** "27 Kasım 2026, Cuma" */
export function gunEtiketi(iso: string): string {
  const p = parcala(iso);
  if (!p) return iso;
  const gunAdi = GUN_ADLARI[new Date(Date.UTC(p[0], p[1], p[2])).getUTCDay()];
  return `${p[2]} ${AYLAR[p[1]]} ${p[0]}, ${gunAdi}`;
}

/** iso'nun yili ve ayi (0-11); gecersizse null. */
export function ayOf(iso: string): { yil: number; ay0: number } | null {
  const p = parcala(iso);
  return p ? { yil: p[0], ay0: p[1] } : null;
}

/**
 * Ay takvimi hucreleri, Pazartesi ile baslar: ayin ilk gununden onceki bos
 * hucreler `null`, sonra her gun "YYYY-MM-DD".
 */
export function ayHucreleri(yil: number, ay0: number): (string | null)[] {
  const ilk = new Date(Date.UTC(yil, ay0, 1));
  const gunSayisi = new Date(Date.UTC(yil, ay0 + 1, 0)).getUTCDate();
  const bosluk = (ilk.getUTCDay() + 6) % 7; // Pazartesi = 0
  const hucreler: (string | null)[] = Array.from({ length: bosluk }, () => null);
  for (let g = 1; g <= gunSayisi; g++) hucreler.push(gunYaz(yil, ay0, g));
  return hucreler;
}

/** Gun secilebilir mi: sinirlar icinde ve dolu degil. */
export function gunSecilebilir(
  iso: string,
  min: string | null,
  max: string | null,
  dolu: ReadonlySet<string>
): boolean {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return !dolu.has(iso);
}

/**
 * `hedef`ten baslayip ilk secilebilir gun (en fazla 62 gun ileri bakar).
 * Hedef `min`den onceyse `min`den baslar. Bulunamazsa null.
 */
export function ilkUygunGun(
  hedef: string,
  min: string | null,
  max: string | null,
  dolu: ReadonlySet<string>
): string | null {
  let gun = min && hedef < min ? min : hedef;
  for (let i = 0; i <= 62; i++) {
    if (max && gun > max) return null;
    if (gunSecilebilir(gun, min, max, dolu)) return gun;
    gun = gunEkle(gun, 1);
  }
  return null;
}

export type HizliSecenek = {
  anahtar: 'gelecek-hafta' | 'iki-hafta' | 'gelecek-ay';
  etiket: string;
  hesapla: (bugun: string) => string;
};

/** Fahri satir 27: "gelecek hafta / 15 gun sonra" gibi hizli secimler. */
export const HIZLI_SECENEKLER: readonly HizliSecenek[] = [
  { anahtar: 'gelecek-hafta', etiket: 'Gelecek hafta', hesapla: (b) => gunEkle(b, 7) },
  { anahtar: 'iki-hafta', etiket: '2 hafta sonra', hesapla: (b) => gunEkle(b, 14) },
  { anahtar: 'gelecek-ay', etiket: 'Gelecek ay', hesapla: (b) => ayEkle(b, 1) },
];
