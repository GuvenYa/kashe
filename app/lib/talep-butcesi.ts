import type { createClient } from '@/app/lib/supabase-server';

type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

/**
 * Guvenlik 04 (bulgu 104): `quote_requests.budget_min / budget_max` istemciye
 * kapali (sutun yetkisi). Butce yalniz `teklif_talebi_butceleri` RPC'si ile
 * okunur: talep sahibi, kurum uyesi ve yonetici her zaman; talebin gonderildigi
 * profesyonel yalniz `share_budget` acikken. Gorunmeyen talep haritada yer almaz.
 */
export type TalepButcesi = {
  budget_min: number | null;
  budget_max: number | null;
};

export async function talepButceleri(
  supabase: SunucuIstemcisi,
  talepIdleri: ReadonlyArray<string | null | undefined>
): Promise<Map<string, TalepButcesi>> {
  const tekil = Array.from(new Set(talepIdleri.filter((id): id is string => Boolean(id))));
  if (tekil.length === 0) return new Map();

  const { data, error } = await supabase.rpc('teklif_talebi_butceleri', { p_talepler: tekil });
  if (error) {
    console.error('[teklif] teklif_talebi_butceleri:', error.message);
    return new Map();
  }
  return new Map(
    (
      (data ?? []) as { talep_id: string; budget_min: number | string | null; budget_max: number | string | null }[]
    ).map((r) => [
      r.talep_id,
      {
        budget_min: r.budget_min == null ? null : Number(r.budget_min),
        budget_max: r.budget_max == null ? null : Number(r.budget_max),
      },
    ] as const)
  );
}
