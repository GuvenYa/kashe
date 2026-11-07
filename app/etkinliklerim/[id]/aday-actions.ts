'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { kamuAdi } from '@/app/lib/kamu-adi';
import type { AramaSonucu } from './aday-data';

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

/**
 * Duzeltme 13-B (bulgu 125): "Bu rolden kac kisi?" — gereksinimin kisi
 * sayisi (`event_requirements.quantity`, 1-1000). Yetkiyi RLS zorlar
 * (etkinlik sahibi ya da kurulusta events.manage); yetkisiz guncelleme 0
 * satir doner ve hata sayilir. Eslestirme YENIDEN KOSMAZ: aday listesi ayni
 * kalir, yalniz secim tavani degisir.
 */
export async function rolIhtiyaciGuncelle(input: {
  eventId: string;
  roleId: number;
  adet: number;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.eventId)) {
    return { success: false, error: 'Etkinlik geçersiz.' };
  }
  if (!Number.isInteger(input.roleId) || input.roleId <= 0) {
    return { success: false, error: 'Rol geçersiz.' };
  }
  if (!Number.isInteger(input.adet) || input.adet < 1 || input.adet > 100) {
    return { success: false, error: 'Kişi sayısı 1 ile 100 arasında olmalı.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data, error } = await supabase
    .from('event_requirements')
    .update({ quantity: input.adet })
    .eq('event_id', input.eventId)
    .eq('role_id', input.roleId)
    .select('id');
  if (error) {
    console.error('[match] ihtiyac', error);
    return { success: false, error: 'Kişi sayısı kaydedilemedi, tekrar dene.' };
  }
  if ((data ?? []).length === 0) {
    return { success: false, error: 'Bu etkinliğin ihtiyaçlarını değiştirme yetkin yok.' };
  }

  revalidatePath(`/etkinliklerim/${input.eventId}`);
  return { success: true };
}

/**
 * Duzeltme 13-C (bulgu 125): "Kashe'den ara ve ekle". Rolde hizmet veren,
 * YAYINDAKI saglayicilar (`v_provider_roles.is_visible`); etkinligin sehri
 * once. Profesyonel adi kamu kuraliyla ("Ad S."), ajans ticari unvaniyla.
 * Etkinligi goremeyen kullanici icin bos liste (etkinlik satiri RLS ile okunur).
 */
export async function kasheRolAra(input: {
  eventId: string;
  roleId: number;
  sorgu: string;
  /** Sutunda zaten olan saglayicilar (sonuca girmez; 8'lik liste onlarla dolmasin). */
  haric?: string[];
}): Promise<{ success: true; sonuclar: AramaSonucu[] } | { success: false; error: string }> {
  if (!UUID_KALIBI.test(input.eventId)) {
    return { success: false, error: 'Etkinlik geçersiz.' };
  }
  if (!Number.isInteger(input.roleId) || input.roleId <= 0) {
    return { success: false, error: 'Rol geçersiz.' };
  }
  // Yalniz harf, rakam ve bosluk (ilike kalibina % / _ / virgul girmesin)
  const sorgu = (input.sorgu ?? '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data: etkinlik } = await supabase
    .from('events')
    .select('id, city_id')
    .eq('id', input.eventId)
    .maybeSingle();
  if (!etkinlik) return { success: false, error: 'Etkinlik bulunamadı.' };

  let q = supabase
    .from('v_provider_roles')
    .select('provider_id, provider_type, display_name, city_id, pricing_mode, price_min')
    .eq('role_id', input.roleId)
    .eq('is_visible', true)
    .limit(200);
  if (sorgu) q = q.ilike('display_name', `%${sorgu}%`);
  const { data: roller, error } = await q;
  if (error) {
    console.error('[match] kashe ara', error);
    return { success: false, error: 'Arama yapılamadı, tekrar dene.' };
  }

  type Satir = {
    provider_id: string;
    provider_type: string;
    display_name: string | null;
    city_id: number | null;
    pricing_mode: string | null;
    price_min: number | string | null;
  };
  const haric = new Set(
    (input.haric ?? []).filter((v) => UUID_KALIBI.test(v)).slice(0, 300)
  );
  const satirlar = ((roller ?? []) as Satir[]).filter(
    (r) => r.provider_id !== user.id && !haric.has(r.provider_id)
  );
  const sehirId = (etkinlik as { city_id: number | null }).city_id;
  satirlar.sort((a, b) => {
    const as = sehirId != null && a.city_id === sehirId ? 0 : 1;
    const bs = sehirId != null && b.city_id === sehirId ? 0 : 1;
    if (as !== bs) return as - bs;
    return (a.display_name ?? '').localeCompare(b.display_name ?? '', 'tr');
  });
  const ilk = satirlar.slice(0, 8);
  if (ilk.length === 0) return { success: true, sonuclar: [] };

  const idler = ilk.map((r) => r.provider_id);
  const sehirIdleri = [
    ...new Set(ilk.map((r) => r.city_id).filter((v): v is number => v != null)),
  ];
  const [{ data: gorunum }, { data: sehirler }] = await Promise.all([
    supabase.from('v_providers_public').select('id, avatar_url').in('id', idler),
    sehirIdleri.length > 0
      ? supabase.from('turkish_cities').select('id, name').in('id', sehirIdleri)
      : Promise.resolve({ data: [] as { id: number; name: string }[] }),
  ]);
  const avatar = new Map(
    ((gorunum ?? []) as { id: string; avatar_url: string | null }[]).map((g) => [g.id, g.avatar_url])
  );
  const sehirAdi = new Map(
    ((sehirler ?? []) as { id: number; name: string }[]).map((c) => [c.id, c.name])
  );

  const sonuclar: AramaSonucu[] = ilk.map((r) => {
    const fiyat = Number(r.price_min);
    return {
      providerId: r.provider_id,
      ad:
        (r.provider_type === 'professional'
          ? kamuAdi(r.display_name)
          : r.display_name?.trim()) || 'İsimsiz profil',
      sehir: r.city_id != null ? (sehirAdi.get(r.city_id) ?? null) : null,
      avatarUrl: avatar.get(r.provider_id) ?? null,
      baslangicFiyati:
        r.pricing_mode !== 'on_request' && Number.isFinite(fiyat) && fiyat > 0 ? fiyat : null,
      ajans: r.provider_type === 'organization',
    };
  });
  return { success: true, sonuclar };
}
