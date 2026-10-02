'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import type { IcKalemSatiri } from './teklif-data';

/**
 * FAZ 7a / P1 — teklif kalemlerinin gizli ic maliyeti.
 *
 * `internal` semasina DOGRUDAN sorgu YOK; yalniz iki RPC (assert -> log -> sorgu
 * deseni DB tarafinda). Yetkiyi asil olarak DB zorlar (`commercial.view` okur,
 * `commercial.manage` yazar); burada ayrica kontrol edilir ki kullaniciya duzgun
 * mesaj verilebilsin. Dondurulmus surumde yazma RPC'si 22023 doner.
 *
 * `sales` rolu musteri fiyatini girer ama bu karti GORMEZ (02): kart yalniz
 * `commercial.view` olana render edilir.
 */

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

type RpcHata = { code?: string | null; message?: string | null };

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    console.error('[teklif] maliyet yetkisi', error);
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
    if (mesaj.includes('surum dondurulmus')) {
      return 'Bu sürüm gönderildi; değişiklik için yeni sürüm aç.';
    }
    if (mesaj.includes('maliyet 0 veya daha buyuk')) {
      return 'Maliyet 0 veya daha büyük olmalı.';
    }
    if (mesaj.includes('kalemin kurulusu ve surumuyle')) {
      return 'Bu kalem teklifin kuruluşuna ait değil.';
    }
    return 'Girilen değerler geçersiz.';
  }
  return 'İşlem tamamlanamadı, tekrar dene.';
}

export async function listProposalInternalItems(input: {
  versionId: string;
  organizationId: string;
}): Promise<ActionResult<IcKalemSatiri[]>> {
  if (!UUID_KALIBI.test(input.versionId)) {
    return { success: false, error: 'Sürüm geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (!(await yetkiVarMi(supabase, input.organizationId, 'commercial.view'))) {
    return { success: false, error: 'Bu bilgiye erişim yetkin yok.' };
  }

  const { data, error } = await supabase.rpc('internal_proposal_items_list', {
    p_version_id: input.versionId,
  });
  if (error) {
    console.error('[teklif] ic kalem listesi', error);
    return { success: false, error: maliyetHataMesaji(error) };
  }
  return { success: true, data: (data ?? []) as unknown as IcKalemSatiri[] };
}

export async function upsertProposalItemCost(input: {
  itemId: string;
  proposalId: string;
  organizationId: string;
  internalCost: number;
  note?: string | null;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.itemId)) {
    return { success: false, error: 'Kalem geçersiz.' };
  }
  if (!Number.isFinite(input.internalCost) || input.internalCost < 0) {
    return { success: false, error: 'Maliyet 0 veya daha büyük olmalı.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (!(await yetkiVarMi(supabase, input.organizationId, 'commercial.manage'))) {
    return { success: false, error: 'Bu bilgiye erişim yetkin yok.' };
  }

  const { error } = await supabase.rpc('internal_proposal_item_upsert', {
    p_item_id: input.itemId,
    p_internal_cost: input.internalCost,
    p_note: input.note?.trim() || null,
  });
  if (error) {
    console.error('[teklif] ic kalem yazma', error);
    return { success: false, error: maliyetHataMesaji(error) };
  }

  revalidatePath(`/ajans/teklifler/${input.proposalId}`);
  return { success: true };
}
