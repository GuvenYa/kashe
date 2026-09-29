import type { createClient } from '@/app/lib/supabase-server';

type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * FAZ 4c/P3 — istemciden gelen `event_id` tek kapidan gecer.
 *
 * Kural: `event_id` yalniz SUNUCU tarafinda, DOGRULANARAK yazilir. Buradaki sorgu
 * RLS ile kosar (kendi etkinligi / kurulus `events.view` / admin); satir gorunmuyorsa
 * bag kurulmaz ve NULL yazilir — yani baskasinin etkinligine kayit baglanamaz.
 *
 * Bos veya uuid bicimine uymayan deger icin sorgu HIC yapilmaz.
 */
export async function gorunenEtkinlikId(
  supabase: SunucuIstemcisi,
  id: string | null | undefined
): Promise<string | null> {
  if (!id || !UUID_KALIBI.test(id)) return null;

  const { data } = await supabase
    .from('events')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (!data) {
    console.warn('[eventspec] event_id gorunmuyor', id);
    return null;
  }
  return (data as { id: string }).id;
}
