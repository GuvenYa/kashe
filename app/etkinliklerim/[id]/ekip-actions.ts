'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import {
  UYE_DURUM_SECENEKLERI,
  type UyeDurum,
} from './ekip-data';

/**
 * FAZ 6 / P2 — ekip eylemleri.
 *
 * Yazim DOGRUDAN tablo INSERT/UPDATE/DELETE ile olur; yetkiyi RLS zorlar
 * (etkinlik sahibi VEYA ekibin kurulusunda `crew.manage`). Yalniz GRANT edilen
 * sutunlar gonderilir:
 *   crews  INSERT: event_id, organization_id, name, strategy, source_policy, objective, status
 *          UPDATE: name, strategy, source_policy, objective, status
 *   members INSERT: crew_id, role_id, talent_record_id, provider_id, status, is_locked,
 *                   sort_order, note, match_candidate_id
 *          UPDATE: status, is_locked, sort_order, note
 * `pool_origin` ve `created_by` TETIKLEYICI yazar — govdeye konmaz.
 * `event_id`/`crew_id` degistirilmez; uyenin kaynagi degistirilmez (yeni kisi = yeni uye).
 */

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

type RpcHata = { code?: string | null; message?: string | null };

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EKIP_DURUMLARI = ['draft', 'proposed', 'confirmed', 'cancelled'] as const;
type EkipDurum = (typeof EKIP_DURUMLARI)[number];

/**
 * Hata eslemesi. DB tetikleyici metinleri ASCII; eslesme ona gore.
 * `zorunlu rol kapsanmadi: <slug,...>` -> slug'lar `rolAdlari` ile Turkce adlara cevrilir.
 */
function ekipHataMesaji(
  error: RpcHata,
  rolAdlari?: Record<string, string>
): string {
  const kod = error.code ?? '';
  const mesaj = error.message ?? '';

  if (kod === '42501') return 'Bu ekip için yetkin yok.';
  if (kod === '23503') return 'Bağlı kayıt bulunamadı.';
  if (kod === '22023' || kod === '23514') {
    if (mesaj.includes('zorunlu rol kapsanmadi')) {
      const ham = mesaj.split('zorunlu rol kapsanmadi:')[1] ?? '';
      const adlar = ham
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((slug) => rolAdlari?.[slug] ?? slug);
      return `Zorunlu roller onaylanmış üyelerle kapsanmadan ekip onaylanamaz: ${adlar.join(', ')}`;
    }
    if (mesaj.includes('havuz kaydi ekibin kurulusuna ait degil')) {
      return 'Bu kayıt ekibin kuruluşuna ait değil.';
    }
    if (mesaj.includes('havuz kaydi veya saglayici gerekir')) {
      return 'Üye için kaynak seçilmedi.';
    }
    if (mesaj.includes('etkinligi degistirilemez')) {
      return 'Ekibin etkinliği değiştirilemez.';
    }
    if (mesaj.includes('kurulusu degistirilemez')) {
      return 'Ekibin kuruluşu değiştirilemez.';
    }
    if (mesaj.includes('ekibi degistirilemez')) {
      return 'Üyenin ekibi değiştirilemez.';
    }
    if (mesaj.includes('degistirilemez; yeni uye ekle')) {
      return 'Üyenin kaynağı değiştirilemez; yeni üye ekle.';
    }
    if (mesaj.includes('not')) return 'Not en fazla 2000 karakter olabilir.';
    return 'İşlem yapılamadı, tekrar dene.';
  }
  if (kod === 'P0002' || kod === 'PGRST116') return 'Kayıt bulunamadı.';
  return 'İşlem yapılamadı, tekrar dene.';
}

function metin(v: string | null | undefined, enFazla: number): string | null {
  const t = (v ?? '').trim();
  if (!t) return null;
  return t.slice(0, enFazla);
}

/** Ekip kurar. `organizationId` NULL -> bireysel ekip. */
export async function createCrew(input: {
  eventId: string;
  organizationId: string | null;
}): Promise<ActionResult<{ id: string }>> {
  if (!UUID_KALIBI.test(input.eventId)) {
    return { success: false, error: 'Etkinlik geçersiz.' };
  }
  if (input.organizationId && !UUID_KALIBI.test(input.organizationId)) {
    return { success: false, error: 'Kuruluş geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  // `source_policy`/`objective` varsayilan birakilir; kurulus ekibinde tetikleyici
  // `private_first` yapar. `created_by` tetikleyici yazar.
  const { data, error } = await supabase
    .from('crews')
    .insert({
      event_id: input.eventId,
      organization_id: input.organizationId,
      name: 'Ekip',
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[ekip] kurma', error);
    return { success: false, error: ekipHataMesaji(error ?? {}) };
  }

  revalidatePath(`/etkinliklerim/${input.eventId}`);
  revalidatePath('/ajans/ekipler');
  return { success: true, data: { id: (data as { id: string }).id } };
}

/** Ekip durumu. `confirmed` kapisi DB tetikleyicisinde. */
export async function setCrewStatus(input: {
  crewId: string;
  eventId: string;
  status: EkipDurum;
  /** slug -> Turkce rol adi (hata mesajini cevirmek icin). */
  rolAdlari?: Record<string, string>;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.crewId)) {
    return { success: false, error: 'Ekip geçersiz.' };
  }
  if (!EKIP_DURUMLARI.includes(input.status)) {
    return { success: false, error: 'Durum geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase
    .from('crews')
    .update({ status: input.status })
    .eq('id', input.crewId);

  if (error) {
    console.error('[ekip] durum', error);
    return { success: false, error: ekipHataMesaji(error, input.rolAdlari) };
  }

  revalidatePath(`/etkinliklerim/${input.eventId}`);
  revalidatePath('/ajans/ekipler');
  return { success: true };
}

/** Adaylardan uye ekler (pazaryeri saglayicisi). */
export async function addCrewMemberFromCandidate(input: {
  crewId: string;
  eventId: string;
  roleId: number;
  providerId: string;
  matchCandidateId: string;
  sortOrder?: number;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.crewId) || !UUID_KALIBI.test(input.providerId)) {
    return { success: false, error: 'Kayıt geçersiz.' };
  }
  if (!Number.isInteger(input.roleId) || input.roleId <= 0) {
    return { success: false, error: 'Rol geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.from('crew_members').insert({
    crew_id: input.crewId,
    role_id: input.roleId,
    provider_id: input.providerId,
    match_candidate_id: UUID_KALIBI.test(input.matchCandidateId)
      ? input.matchCandidateId
      : null,
    status: 'proposed',
    sort_order: input.sortOrder ?? 0,
  });

  if (error) {
    console.error('[ekip] aday uye', error);
    return { success: false, error: ekipHataMesaji(error) };
  }

  revalidatePath(`/etkinliklerim/${input.eventId}`);
  revalidatePath('/ajans/ekipler');
  return { success: true };
}

/**
 * Havuzdan uye ekler (yalniz kurulus ekibi). `provider_id` GONDERILMEZ:
 * havuz kaydi Kashe uyesine bagliysa tetikleyici turetir.
 */
export async function addCrewMemberFromPool(input: {
  crewId: string;
  eventId: string;
  roleId: number;
  talentRecordId: string;
  sortOrder?: number;
}): Promise<ActionResult> {
  if (
    !UUID_KALIBI.test(input.crewId) ||
    !UUID_KALIBI.test(input.talentRecordId)
  ) {
    return { success: false, error: 'Kayıt geçersiz.' };
  }
  if (!Number.isInteger(input.roleId) || input.roleId <= 0) {
    return { success: false, error: 'Rol geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.from('crew_members').insert({
    crew_id: input.crewId,
    role_id: input.roleId,
    talent_record_id: input.talentRecordId,
    status: 'proposed',
    sort_order: input.sortOrder ?? 0,
  });

  if (error) {
    console.error('[ekip] havuz uye', error);
    return { success: false, error: ekipHataMesaji(error) };
  }

  revalidatePath(`/etkinliklerim/${input.eventId}`);
  revalidatePath('/ajans/ekipler');
  return { success: true };
}

/** Uye durumu / kilit / not — UPDATE yalniz bu sutunlarda. */
export async function updateCrewMember(input: {
  memberId: string;
  eventId: string;
  status?: UyeDurum;
  isLocked?: boolean;
  note?: string | null;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.memberId)) {
    return { success: false, error: 'Üye geçersiz.' };
  }

  const govde: Record<string, unknown> = {};
  if (input.status !== undefined) {
    if (!UYE_DURUM_SECENEKLERI.includes(input.status)) {
      return { success: false, error: 'Durum geçersiz.' };
    }
    govde.status = input.status;
  }
  if (input.isLocked !== undefined) govde.is_locked = input.isLocked;
  if (input.note !== undefined) govde.note = metin(input.note, 2000);
  if (Object.keys(govde).length === 0) return { success: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase
    .from('crew_members')
    .update(govde)
    .eq('id', input.memberId);

  if (error) {
    console.error('[ekip] uye guncelleme', error);
    return { success: false, error: ekipHataMesaji(error) };
  }

  revalidatePath(`/etkinliklerim/${input.eventId}`);
  revalidatePath('/ajans/ekipler');
  return { success: true };
}

/** Uyeyi ekipten cikarir. */
export async function removeCrewMember(input: {
  memberId: string;
  eventId: string;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.memberId)) {
    return { success: false, error: 'Üye geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase
    .from('crew_members')
    .delete()
    .eq('id', input.memberId);

  if (error) {
    console.error('[ekip] uye cikarma', error);
    return { success: false, error: ekipHataMesaji(error) };
  }

  revalidatePath(`/etkinliklerim/${input.eventId}`);
  revalidatePath('/ajans/ekipler');
  return { success: true };
}
