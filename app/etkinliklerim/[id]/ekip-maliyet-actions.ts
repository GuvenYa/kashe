'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import type { MaliyetBirimi, MaliyetSatiri } from './ekip-data';

/**
 * FAZ 6 / P2 — ekip uyesi ic maliyeti (gizli).
 *
 * `internal` semasina DOGRUDAN sorgu YOK; yalniz uc RPC (assert -> log -> sorgu
 * deseni DB tarafinda). Yetkiyi asil olarak DB zorlar (`commercial.view` okur,
 * `commercial.manage` yazar); burada ayrica kontrol edilir ki kullaniciya duzgun
 * mesaj verilebilsin. Bireysel ekipte (organization_id NULL) RPC 22023 doner.
 *
 * Veri istemciye YALNIZ karti acan istek aninda gider; liste ilk yuklemede
 * toplu maliyet cekmez.
 */

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

type RpcHata = { code?: string | null; message?: string | null };

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BIRIMLER = ['per_job', 'per_hour', 'per_day'] as const;

async function yetkiVarMi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  izin: 'commercial.view' | 'commercial.manage'
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_org_permission', {
    p_org_id: organizationId,
    p_permission: izin,
  });
  if (error) {
    console.error('[ekip] maliyet yetkisi', error);
    return false;
  }
  return data === true;
}

function maliyetHataMesaji(error: RpcHata): string {
  const kod = error.code ?? '';
  const mesaj = error.message ?? '';

  if (kod === '42501') return 'Bu bilgiye erişim yetkin yok.';
  if (kod === 'P0002') return 'Kayıt bulunamadı.';
  if (kod === '22023') {
    if (mesaj.includes('bireysel ekipte')) {
      return 'Bireysel ekipte iç maliyet tutulmaz.';
    }
    if (mesaj.includes('havuz kaydi olmayan uye')) {
      return 'Bu üye havuzdan değil; maliyeti elle gir.';
    }
    if (mesaj.includes('acik ic oran yok')) {
      return 'Bu rol için açık iç oran yok; elle gir.';
    }
    if (mesaj.includes('maliyet 0 veya daha buyuk')) {
      return 'Maliyet 0 veya daha büyük olmalı.';
    }
    if (mesaj.includes('musteri fiyati')) {
      return 'Müşteri fiyatı 0 veya daha büyük olmalı.';
    }
    if (mesaj.includes('birim gecersiz')) return 'Birim geçersiz.';
    if (mesaj.includes('ayni kurulusla yazilir')) {
      return 'Bu üye ekibin kuruluşuna ait değil.';
    }
    return 'Girilen değerler geçersiz.';
  }
  return 'İşlem tamamlanamadı, tekrar dene.';
}

export async function listCrewCommercials(input: {
  crewId: string;
  organizationId: string;
}): Promise<ActionResult<MaliyetSatiri[]>> {
  if (!UUID_KALIBI.test(input.crewId)) {
    return { success: false, error: 'Ekip geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (!(await yetkiVarMi(supabase, input.organizationId, 'commercial.view'))) {
    return { success: false, error: 'Bu bilgiye erişim yetkin yok.' };
  }

  const { data, error } = await supabase.rpc('internal_crew_commercials_list', {
    p_crew_id: input.crewId,
  });
  if (error) {
    console.error('[ekip] maliyet listesi', error);
    return { success: false, error: maliyetHataMesaji(error) };
  }
  return { success: true, data: (data ?? []) as unknown as MaliyetSatiri[] };
}

/** Havuzdaki acik ic orandan anlik goruntu alir (`rate_source = default`). */
export async function snapshotCrewCommercial(input: {
  memberId: string;
  crewId: string;
  eventId: string;
  organizationId: string;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.memberId)) {
    return { success: false, error: 'Üye geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (!(await yetkiVarMi(supabase, input.organizationId, 'commercial.manage'))) {
    return { success: false, error: 'Bu bilgiye erişim yetkin yok.' };
  }

  const { error } = await supabase.rpc('crew_member_commercial_snapshot', {
    p_crew_member_id: input.memberId,
  });
  if (error) {
    console.error('[ekip] maliyet anlik goruntu', error);
    return { success: false, error: maliyetHataMesaji(error) };
  }

  revalidatePath(`/etkinliklerim/${input.eventId}`);
  return { success: true };
}

/** Elle maliyet / musteri fiyati (`rate_source = manual_override`). */
export async function upsertCrewCommercial(input: {
  memberId: string;
  crewId: string;
  eventId: string;
  organizationId: string;
  agreedCost: number;
  basis: MaliyetBirimi;
  clientPrice?: number | null;
  note?: string | null;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.memberId)) {
    return { success: false, error: 'Üye geçersiz.' };
  }
  if (!Number.isFinite(input.agreedCost) || input.agreedCost < 0) {
    return { success: false, error: 'Maliyet 0 veya daha büyük olmalı.' };
  }
  if (!BIRIMLER.includes(input.basis)) {
    return { success: false, error: 'Birim geçersiz.' };
  }
  if (
    input.clientPrice !== null &&
    input.clientPrice !== undefined &&
    (!Number.isFinite(input.clientPrice) || input.clientPrice < 0)
  ) {
    return { success: false, error: 'Müşteri fiyatı 0 veya daha büyük olmalı.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (!(await yetkiVarMi(supabase, input.organizationId, 'commercial.manage'))) {
    return { success: false, error: 'Bu bilgiye erişim yetkin yok.' };
  }

  const { error } = await supabase.rpc('internal_crew_commercial_upsert', {
    p_crew_member_id: input.memberId,
    p_agreed_cost: input.agreedCost,
    p_basis: input.basis,
    p_currency: 'TRY',
    p_client_price: input.clientPrice ?? null,
    p_note: input.note?.trim() || null,
  });
  if (error) {
    console.error('[ekip] maliyet yazma', error);
    return { success: false, error: maliyetHataMesaji(error) };
  }

  revalidatePath(`/etkinliklerim/${input.eventId}`);
  return { success: true };
}
