import 'server-only';
import { createHash } from 'crypto';
import { headers } from 'next/headers';
import type { createClient } from '@/app/lib/supabase-server';

/**
 * GIRISSIZ KASHE AI HAKKI (Duzeltme 06, bulgu 64).
 *
 * Urun karari (Guven, 5 Kasim 2026): girissiz kullanici IP basina gunde 3 analiz
 * yapabilir; ayrica gunluk bir TOPLAM ust sinir var (maliyet korumasi). Sayaclar
 * `internal` semasinda, tek giris noktasi `ai_girissiz_hak_kullan` RPC'si.
 *
 * KURAL TEKRARI YOK: sinirlar, atomik sayim, gun tanimi (Europe/Istanbul) ve
 * saklama suresi DB'de (`20261105140000_duzeltme_06_girissiz_ai_hakki.sql`).
 * Burada yalniz anahtar + IP ozeti hesaplanir ve sonuc Turkce mesaja eslenir.
 *
 * HAM IP HICBIR YERE YAZILMAZ: RPC'ye `sha256(anahtar:gun:ip)` ozeti gider.
 * Anahtar ozete girdigi icin ozet tahmin edilemez, gun girdigi icin gunler
 * arasi ayni kullanici baglanamaz. Loglara IP de anahtar da yazilmaz.
 *
 * KAPALI BASLAR: ortam degiskeni yoksa hak verilmez (`neden: 'kapali'`).
 * Yanlis yapilandirmada ucretsiz kota acik kalmaz.
 */

type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

export type GirissizHakSonucu =
  | { izin: true; kalan: number }
  | { izin: false; neden: GirissizRedNedeni };

/** RPC'nin dondurdugu ret nedenleri (DB ile birebir). */
export type GirissizRedNedeni = 'ip' | 'toplam' | 'kapali';

/** Kullaniciya gosterilen metinler — TEK KAYNAK. */
const MESAJLAR: Record<GirissizRedNedeni, string> = {
  ip: 'Bugünlük ücretsiz Kashe AI hakkın doldu (günde 3). Ücretsiz üye olup devam edebilirsin.',
  toplam: 'Kashe AI şu an çok yoğun. Giriş yaparak hemen devam edebilirsin.',
  kapali:
    'Girişsiz Kashe AI şu an kullanılamıyor. Giriş yaparak devam edebilirsin.',
};

/** Ret nedeninin Turkce mesaji. */
export function girissizHakMesaji(neden: GirissizRedNedeni): string {
  return MESAJLAR[neden];
}

/** Istanbul takvim gunu (`YYYY-MM-DD`) — DB'deki gun tanimiyla ayni. */
function istanbulGunu(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
  }).format(new Date());
}

/**
 * Istek sahibinin IP'si.
 *
 * Vercel `x-forwarded-for` basligini kendisi yazar (ilk deger gercek istemci).
 * Hicbiri yoksa sabit `'bilinmiyor'`: boyle istekler ayni kovada toplanir —
 * sinirsiz kalmaktan iyidir.
 */
async function istekIpsi(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const ilk = xff.split(',')[0]?.trim();
    if (ilk) return ilk;
  }
  return h.get('x-real-ip')?.trim() || 'bilinmiyor';
}

/**
 * Girissiz bir Kashe AI cagrisi icin hak harcar.
 *
 * MODEL CAGRISINDAN ONCE cagrilir ve YALNIZ oturumsuz istekte. Hak verilmezse
 * cagiran model cagrisini hic yapmaz.
 */
export async function girissizHakKullan(
  supabase: SunucuIstemcisi
): Promise<GirissizHakSonucu> {
  const anahtar = process.env.AI_GIRISSIZ_ANAHTAR;
  if (!anahtar) {
    console.error('[girissiz ai] AI_GIRISSIZ_ANAHTAR tanimsiz');
    return { izin: false, neden: 'kapali' };
  }

  const ip = await istekIpsi();
  const ozet = createHash('sha256')
    .update(`${anahtar}:${istanbulGunu()}:${ip}`)
    .digest('hex');

  const { data, error } = await supabase.rpc('ai_girissiz_hak_kullan', {
    p_anahtar: anahtar,
    p_ip_ozeti: ozet,
  });

  if (error) {
    // Anahtar ve IP LOGA YAZILMAZ; yalniz kod + mesaj.
    console.error('[girissiz ai] rpc', error.code, error.message);
    return { izin: false, neden: 'kapali' };
  }

  const yanit = (data ?? null) as {
    izin?: boolean;
    kalan?: number;
    neden?: string | null;
  } | null;

  if (yanit?.izin === true) {
    return { izin: true, kalan: Number(yanit.kalan ?? 0) };
  }

  const neden = yanit?.neden;
  return {
    izin: false,
    neden:
      neden === 'ip' || neden === 'toplam' || neden === 'kapali'
        ? neden
        : 'kapali',
  };
}
