'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';

/**
 * FAZ 7b / P1 — RFP satici (ajans) eylemleri.
 *
 * Yalniz RPC: `rfp_mark_viewed`, `rfp_invite_decline`, `proposal_create_from_rfp`.
 * `rfp_invites` tablosuna yazma YOK (yetki de yok; tetikleyici de reddeder).
 *
 * Butce ipucu bu tarafta HIC bilinmez: `rfp_detail` saticiya ipucu alanlarini
 * gondermez, `rfp_items` sutun yetkisi de kapalidir.
 */

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

type RpcHata = { code?: string | null; message?: string | null };

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function saticiHataMesaji(error: RpcHata): string {
  const kod = error.code ?? '';
  const mesaj = error.message ?? '';

  if (kod === '42501') {
    if (mesaj.includes('davet yok')) return 'Bu kuruluş davetli değil.';
    if (mesaj.includes('davetli degil')) return 'Bu kuruluş davetli değil.';
    return 'Bu işlem için yetkin yok.';
  }
  if (kod === 'P0002') return 'Teklif talebi bulunamadı.';
  if (kod === '22023') {
    if (mesaj.includes('teklif talebi kapali')) return 'Teklif talebi kapalı.';
    if (mesaj.includes('davet bu durumda')) {
      return 'Davet bu durumda yanıtlanamaz.';
    }
    if (mesaj.includes('kurulusun saglayici kaydi yok')) {
      return 'Kuruluşun sağlayıcı kaydı yok.';
    }
    return 'İşlem yapılamadı, tekrar dene.';
  }
  return 'İşlem yapılamadı, tekrar dene.';
}

async function oturum() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Goruntuleme isareti — sayfa acilirken cagrilir. SESSIZ: hata yutulur
 * (davetli olmayan kullanici icin 42501 doner, sayfa yine calisir).
 */
export async function markRfpViewed(rfpId: string): Promise<void> {
  if (!UUID_KALIBI.test(rfpId)) return;

  const { supabase, user } = await oturum();
  if (!user) return;

  const { error } = await supabase.rpc('rfp_mark_viewed', { p_rfp_id: rfpId });
  if (error) {
    // Jeton/kimlik tasimaz; yalniz kod + mesaj.
    console.error('[rfp] goruntuleme', error.code, error.message);
  }
}

/** Daveti reddeder. */
export async function declineRfpInvite(rfpId: string): Promise<ActionResult> {
  if (!UUID_KALIBI.test(rfpId)) {
    return { success: false, error: 'Talep geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.rpc('rfp_invite_decline', {
    p_rfp_id: rfpId,
  });
  if (error) {
    console.error('[rfp] davet reddi', error);
    return { success: false, error: saticiHataMesaji(error) };
  }

  revalidatePath(`/ajans/rfp/${rfpId}`);
  revalidatePath('/ajans/rfp');
  return { success: true };
}

/**
 * Talebe yanit teklifi acar (idempotan: davetin teklifi varsa onu doner).
 * Kalemler RFP kalemlerinden DB'de olusur, fiyatlar 0 gelir.
 */
export async function respondRfp(input: {
  rfpId: string;
  organizationId: string;
}): Promise<ActionResult<{ proposalId: string }>> {
  if (
    !UUID_KALIBI.test(input.rfpId) ||
    !UUID_KALIBI.test(input.organizationId)
  ) {
    return { success: false, error: 'Kayıt geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data, error } = await supabase.rpc('proposal_create_from_rfp', {
    p_rfp_id: input.rfpId,
    p_org_id: input.organizationId,
  });
  if (error || !data) {
    console.error('[rfp] yanit teklifi', error);
    return { success: false, error: saticiHataMesaji(error ?? {}) };
  }

  revalidatePath(`/ajans/rfp/${input.rfpId}`);
  revalidatePath('/ajans/rfp');
  revalidatePath('/ajans/teklifler');
  return { success: true, data: { proposalId: data as string } };
}
