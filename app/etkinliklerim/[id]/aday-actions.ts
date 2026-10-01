'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';

/**
 * FAZ 6 / P1 — eslestirme eylemleri.
 *
 * Skor ve aday listesi DB'de uretilir: burada YALNIZ RPC cagrilir.
 * `match_runs` / `match_candidates` tablolarina INSERT/UPDATE YOK (yetki de yok).
 * Strateji parametresi GONDERILMEZ — varsayilan `hybrid` (18 bolum 2).
 *
 * Yetkiyi DB zorlar (`events.owner_user_id = auth.uid()`); kodlar:
 * insufficient_privilege 42501, no_data_found P0002, invalid_parameter_value 22023.
 */

type ActionResult = { success: true } | { success: false; error: string };

type RpcHata = { code?: string | null; message?: string | null };

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function eslestirmeHataMesaji(error: RpcHata): string {
  const kod = error.code ?? '';
  const mesaj = error.message ?? '';

  if (kod === '42501') {
    return 'Bu etkinlik için eşleştirme yapma yetkin yok.';
  }
  if (kod === '22023') {
    if (mesaj.includes('onaylanmali')) return 'Önce etkinliği onayla.';
    if (mesaj.includes('gereksinimi yok')) {
      return 'Etkinlikte ihtiyaç kaydı yok; sihirbazdan ekle.';
    }
    return mesaj;
  }
  if (kod === 'P0002') return 'Etkinlik bulunamadı.';
  return 'Eşleştirme yapılamadı, tekrar dene.';
}

/** Eslestirmeyi calistirir (ilk kosu ya da yeniden kosu). */
export async function runEventMatch(eventId: string): Promise<ActionResult> {
  if (!UUID_KALIBI.test(eventId)) {
    return { success: false, error: 'Etkinlik geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.rpc('run_event_match', {
    p_event_id: eventId,
  });
  if (error) {
    console.error('[match] run', error);
    return { success: false, error: eslestirmeHataMesaji(error) };
  }

  revalidatePath(`/etkinliklerim/${eventId}`);
  return { success: true };
}

/**
 * Gosterim isareti — liste ekranda gorununce cagrilir (yalniz `was_shown = false`
 * olanlar gonderilir; RPC de ikinci kez yazmaz). Hata akisi KESMEZ: kullaniciya
 * mesaj gosterilmez, yalniz loglanir. `revalidatePath` YOK (panel dongusu olmasin).
 */
export async function markCandidatesShown(
  runId: string,
  candidateIds: string[]
): Promise<{ success: boolean }> {
  if (!UUID_KALIBI.test(runId)) return { success: false };

  const idler = (candidateIds ?? []).filter((v) => UUID_KALIBI.test(v));
  if (idler.length === 0) return { success: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase.rpc('mark_match_candidates_shown', {
    p_run_id: runId,
    p_candidate_ids: idler,
  });
  if (error) {
    console.error('[match] shown', error);
    return { success: false };
  }
  return { success: true };
}

/** Tik isareti — "Profili gor" tiklanince; basarisiz olsa da gezinme surer. */
export async function markCandidateClicked(
  candidateId: string
): Promise<{ success: boolean }> {
  if (!UUID_KALIBI.test(candidateId)) return { success: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase.rpc('mark_match_candidate_clicked', {
    p_candidate_id: candidateId,
  });
  if (error) {
    console.error('[match] clicked', error);
    return { success: false };
  }
  return { success: true };
}
