import 'server-only';

import { createClient } from '@/app/lib/supabase-server';
import { kiyasSatirindan, type PazarKiyasi } from '@/app/lib/fiyat-kiyas';

/**
 * FIYAT KIYASLARI — sunucu okuma katmani (FAZ 9b).
 *
 * `import 'server-only'`: bu modul bir istemci bilesenine import edilirse
 * DERLEME HATASI verir (projede `ai-actions.ts` ve `push-server.ts` ayni
 * deseni kullaniyor). Istemci bilesenleri `fiyat-kiyas.ts`'i okur ve RPC'yi
 * tarayici istemcisiyle kendisi cagirir.
 *
 * `price_benchmarks` TABLOSU BURADAN DA OKUNMAZ: tek yol RPC. Tablonun
 * `authenticated` icin SELECT hakki var ama RLS yalniz admine aciyor; ham
 * satirlari uygulamaya tasimak hem gereksiz hem de yayin esigini (15 islem)
 * uygulamanin tekrar uygulamasi demekti — esik DB'de, tek yerde.
 *
 * HATA SESSIZ: fiyat ipucu kritik degil. RPC hata verirse bos Map doner ve
 * yuzey hicbir sey cizmez; `console.error` ILE GURULTU YAPILMAZ (her sayfa
 * yuklemesinde loglanacak bir sey degil).
 */

/**
 * Rol basina yayinli kiyas. Yayinli olmayan rol haritada YER ALMAZ — cagiran
 * `undefined` gorur ve o rol icin hicbir sey cizmez.
 */
export async function pazarKiyaslari(
  roleIds: number[],
  cityId: number | null,
  eventType: string | null
): Promise<Map<number, PazarKiyasi>> {
  const harita = new Map<number, PazarKiyasi>();
  const idler = [...new Set(roleIds.filter((n) => Number.isInteger(n) && n > 0))];
  if (idler.length === 0) return harita;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('price_benchmark_lookup_many', {
    p_role_ids: idler,
    p_city_id: cityId,
    p_event_type: eventType,
  });
  if (error || !data) return harita;

  for (const row of data as {
    role_id: number;
    median: number | string;
    p25: number | string;
    p75: number | string;
    sample_size: number | string;
    period_end: string;
    granularity: string;
  }[]) {
    const k = kiyasSatirindan(row);
    if (k) harita.set(k.roleId, k);
  }
  return harita;
}

/**
 * Kategori/rol slug'indan rol kimligi.
 *
 * FAZ 3a: rol slug'i kategori slug'iyla BIREBIR ayni (23 kategori = 23 rol),
 * bu yuzden kesfet ve sihirbazdaki kategori secimi dogrudan rol aramasina
 * cevrilebiliyor.
 */
export async function rolIdleriSlugdan(
  slugs: string[]
): Promise<Map<string, number>> {
  const harita = new Map<string, number>();
  const temiz = [...new Set(slugs.filter((s) => !!s && s.length < 80))];
  if (temiz.length === 0) return harita;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_roles')
    .select('id, slug')
    .in('slug', temiz)
    .eq('is_active', true);
  if (error || !data) return harita;

  for (const r of data as { id: number; slug: string }[]) {
    harita.set(r.slug, r.id);
  }
  return harita;
}
