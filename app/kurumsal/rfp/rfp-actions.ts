'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';

/**
 * FAZ 7b / P1 — RFP (teklif talebi) alici eylemleri.
 *
 * Talep, davet ve durum gecisleri YALNIZ RPC ile (`rfp_create`, `rfp_invite`,
 * `rfp_send`, `rfp_cancel`); `rfps`/`rfp_invites` tablolarina INSERT YOK
 * (yetki de yok, tetikleyici de reddeder).
 *
 * Taslakta dogrudan yazilanlar (RLS + sutun yetkisi):
 *   rfps      UPDATE: title, description, deadline
 *   rfp_items INSERT/UPDATE: role_id, quantity, is_required, budget_hint_min,
 *             budget_hint_max, notes, sort_order — DELETE serbest
 * Butce ipucu YAZILIR ama OKUNMAZ (sutun SELECT yetkisi yok); alici degerleri
 * `rfp_detail` JSON'undan gorur.
 */

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

type RpcHata = { code?: string | null; message?: string | null };

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DB metinleri ASCII; eslesme ona gore. */
function rfpHataMesaji(error: RpcHata): string {
  const kod = error.code ?? '';
  const mesaj = error.message ?? '';

  if (kod === '42501') return 'Bu işlem için yetkin yok.';
  if (kod === 'P0002') {
    if (mesaj.includes('etkinlik yok')) return 'Etkinlik bulunamadı.';
    if (mesaj.includes('saglayici yok')) return 'Ajans bulunamadı.';
    return 'Teklif talebi bulunamadı.';
  }
  if (kod === '23503') return 'Bağlı kayıt bulunamadı.';
  if (kod === '22023' || kod === '23514') {
    if (mesaj.includes('etkinlik bu kurulusa ait degil')) {
      return 'Etkinlik bu kuruluşa ait değil.';
    }
    if (mesaj.includes('iptal edilmis etkinlik')) {
      return 'İptal edilmiş etkinlik için talep açılamaz.';
    }
    if (mesaj.includes('baslik')) return 'Başlık 2-200 karakter olmalı.';
    if (mesaj.includes('son tarih gerekir')) {
      return 'Son tarih gerekir ve gelecekte olmalı.';
    }
    if (mesaj.includes('son tarih')) return 'Son tarih gelecekte olmalı.';
    if (mesaj.includes('yalniz ajans kuruluslari')) {
      return 'Yalnızca ajans kuruluşları davet edilebilir.';
    }
    if (mesaj.includes('kendini davet edemez')) {
      return 'Kuruluş kendini davet edemez.';
    }
    if (mesaj.includes('bu durumda davet eklenemez')) {
      return 'Bu durumda davet eklenemez.';
    }
    if (mesaj.includes('talepte kalem yok')) return 'Talepte kalem yok.';
    if (mesaj.includes('davetli ajans yok')) return 'En az bir ajans davet et.';
    if (mesaj.includes('yalniz taslak gonderilir')) {
      return 'Yalnızca taslak gönderilebilir.';
    }
    if (mesaj.includes('bu durumda iptal edilemez')) {
      return 'Bu durumda iptal edilemez.';
    }
    if (mesaj.includes('gonderilmis teklif talebi duzenlenemez')) {
      return 'Gönderilmiş talep düzenlenemez.';
    }
    if (mesaj.includes('kalemleri degismez')) {
      return 'Gönderilmiş talebin kalemleri değişmez.';
    }
    if (mesaj.includes('durum yalniz RPC')) {
      return 'Bu alan doğrudan değiştirilemez.';
    }
    return 'İşlem yapılamadı, tekrar dene.';
  }
  return 'İşlem yapılamadı, tekrar dene.';
}

function metin(v: string | null | undefined, enFazla: number): string | null {
  const t = (v ?? '').trim();
  if (!t) return null;
  return t.slice(0, enFazla);
}

/** `<input type="datetime-local">` -> ISO (Istanbul). */
function yerelZamanIso(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) return null;
  // Kashe saati: girilen deger Istanbul kabul edilir (+03:00).
  return `${t}:00+03:00`;
}

async function oturum() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Yeni talep: kalemler etkinlik gereksinimlerinden DB'de kopyalanir. */
export async function createRfp(input: {
  organizationId: string;
  eventId: string;
  title: string;
  deadline?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  if (!UUID_KALIBI.test(input.organizationId) || !UUID_KALIBI.test(input.eventId)) {
    return { success: false, error: 'Kayıt geçersiz.' };
  }
  const baslik = metin(input.title, 200);
  if (!baslik || baslik.length < 2) {
    return { success: false, error: 'Başlık 2-200 karakter olmalı.' };
  }
  const sonTarih = yerelZamanIso(input.deadline);
  if (input.deadline && !sonTarih) {
    return { success: false, error: 'Son tarih geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data, error } = await supabase.rpc('rfp_create', {
    p_org_id: input.organizationId,
    p_event_id: input.eventId,
    p_title: baslik,
    p_description: null,
    p_deadline: sonTarih,
  });
  if (error || !data) {
    console.error('[rfp] olusturma', error);
    return { success: false, error: rfpHataMesaji(error ?? {}) };
  }

  revalidatePath('/kurumsal/rfp');
  return { success: true, data: { id: data as string } };
}

/** Taslak alanlari (dogrudan UPDATE; yalniz izinli sutunlar). */
export async function updateRfpFields(input: {
  rfpId: string;
  title?: string;
  description?: string | null;
  deadline?: string | null;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.rfpId)) {
    return { success: false, error: 'Talep geçersiz.' };
  }

  const govde: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const baslik = metin(input.title, 200);
    if (!baslik || baslik.length < 2) {
      return { success: false, error: 'Başlık 2-200 karakter olmalı.' };
    }
    govde.title = baslik;
  }
  if (input.description !== undefined) {
    govde.description = metin(input.description, 4000);
  }
  if (input.deadline !== undefined) {
    const t = (input.deadline ?? '').trim();
    if (t === '') govde.deadline = null;
    else {
      const iso = yerelZamanIso(t);
      if (!iso) return { success: false, error: 'Son tarih geçersiz.' };
      govde.deadline = iso;
    }
  }
  if (Object.keys(govde).length === 0) return { success: true };

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase
    .from('rfps')
    .update(govde)
    .eq('id', input.rfpId);
  if (error) {
    console.error('[rfp] alan guncelleme', error);
    return { success: false, error: rfpHataMesaji(error) };
  }

  revalidatePath(`/kurumsal/rfp/${input.rfpId}`);
  revalidatePath('/kurumsal/rfp');
  return { success: true };
}

export async function addRfpItem(input: {
  rfpId: string;
  roleId: number;
  sortOrder?: number;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.rfpId)) {
    return { success: false, error: 'Talep geçersiz.' };
  }
  if (!Number.isInteger(input.roleId) || input.roleId <= 0) {
    return { success: false, error: 'Rol seç.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.from('rfp_items').insert({
    rfp_id: input.rfpId,
    role_id: input.roleId,
    quantity: 1,
    is_required: true,
    sort_order: input.sortOrder ?? 0,
  });
  if (error) {
    console.error('[rfp] kalem ekleme', error);
    return { success: false, error: rfpHataMesaji(error) };
  }

  revalidatePath(`/kurumsal/rfp/${input.rfpId}`);
  return { success: true };
}

export async function updateRfpItem(input: {
  itemId: string;
  rfpId: string;
  roleId?: number;
  quantity?: number;
  isRequired?: boolean;
  budgetMin?: number | null;
  budgetMax?: number | null;
  notes?: string | null;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.itemId)) {
    return { success: false, error: 'Kalem geçersiz.' };
  }

  const govde: Record<string, unknown> = {};
  if (input.roleId !== undefined) {
    if (!Number.isInteger(input.roleId) || input.roleId <= 0) {
      return { success: false, error: 'Rol geçersiz.' };
    }
    govde.role_id = input.roleId;
  }
  if (input.quantity !== undefined) {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      return { success: false, error: 'Adet 0’dan büyük olmalı.' };
    }
    govde.quantity = input.quantity;
  }
  if (input.isRequired !== undefined) govde.is_required = input.isRequired;
  if (input.budgetMin !== undefined) {
    if (
      input.budgetMin !== null &&
      (!Number.isFinite(input.budgetMin) || input.budgetMin < 0)
    ) {
      return { success: false, error: 'Bütçe ipucu 0 veya daha büyük olmalı.' };
    }
    govde.budget_hint_min = input.budgetMin;
  }
  if (input.budgetMax !== undefined) {
    if (
      input.budgetMax !== null &&
      (!Number.isFinite(input.budgetMax) || input.budgetMax < 0)
    ) {
      return { success: false, error: 'Bütçe ipucu 0 veya daha büyük olmalı.' };
    }
    govde.budget_hint_max = input.budgetMax;
  }
  if (input.notes !== undefined) govde.notes = metin(input.notes, 2000);
  if (Object.keys(govde).length === 0) return { success: true };

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase
    .from('rfp_items')
    .update(govde)
    .eq('id', input.itemId);
  if (error) {
    console.error('[rfp] kalem guncelleme', error);
    // CHECK: min <= max
    if (error.code === '23514' && (error.message ?? '').includes('budget')) {
      return {
        success: false,
        error: 'Bütçe ipucunda alt sınır üst sınırdan büyük olamaz.',
      };
    }
    return { success: false, error: rfpHataMesaji(error) };
  }

  revalidatePath(`/kurumsal/rfp/${input.rfpId}`);
  return { success: true };
}

export async function deleteRfpItem(input: {
  itemId: string;
  rfpId: string;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.itemId)) {
    return { success: false, error: 'Kalem geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase
    .from('rfp_items')
    .delete()
    .eq('id', input.itemId);
  if (error) {
    console.error('[rfp] kalem silme', error);
    return { success: false, error: rfpHataMesaji(error) };
  }

  revalidatePath(`/kurumsal/rfp/${input.rfpId}`);
  return { success: true };
}

/** Ajans daveti (idempotan: ayni saglayici ikinci kez eklenmez). */
export async function inviteRfp(input: {
  rfpId: string;
  providerId: string;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.rfpId) || !UUID_KALIBI.test(input.providerId)) {
    return { success: false, error: 'Kayıt geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.rpc('rfp_invite', {
    p_rfp_id: input.rfpId,
    p_provider_id: input.providerId,
  });
  if (error) {
    console.error('[rfp] davet', error);
    return { success: false, error: rfpHataMesaji(error) };
  }

  revalidatePath(`/kurumsal/rfp/${input.rfpId}`);
  return { success: true };
}

/** Talebi gonderir (kalem + davet + son tarih sarti DB'de). */
export async function sendRfp(rfpId: string): Promise<ActionResult> {
  if (!UUID_KALIBI.test(rfpId)) {
    return { success: false, error: 'Talep geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.rpc('rfp_send', { p_rfp_id: rfpId });
  if (error) {
    console.error('[rfp] gonderim', error);
    return { success: false, error: rfpHataMesaji(error) };
  }

  revalidatePath(`/kurumsal/rfp/${rfpId}`);
  revalidatePath('/kurumsal/rfp');
  return { success: true };
}

/** Talebi iptal eder (davetler `not_selected` olur; DB yapar). */
export async function cancelRfp(rfpId: string): Promise<ActionResult> {
  if (!UUID_KALIBI.test(rfpId)) {
    return { success: false, error: 'Talep geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.rpc('rfp_cancel', { p_rfp_id: rfpId });
  if (error) {
    console.error('[rfp] iptal', error);
    return { success: false, error: rfpHataMesaji(error) };
  }

  revalidatePath(`/kurumsal/rfp/${rfpId}`);
  revalidatePath('/kurumsal/rfp');
  return { success: true };
}

/** Ajans arama (davet kutusu): yalniz `organization` tipi saglayicilar. */
export async function searchAgencies(
  q: string
): Promise<ActionResult<{ id: string; name: string; cityId: number | null }[]>> {
  const terim = (q ?? '').trim();
  if (terim.length < 2) return { success: true, data: [] };

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data, error } = await supabase
    .from('v_providers_public')
    .select('id, display_name, city_id')
    .eq('provider_type', 'organization')
    .ilike('display_name', `%${terim}%`)
    .limit(10);
  if (error) {
    console.error('[rfp] ajans arama', error);
    return { success: false, error: 'Arama yapılamadı.' };
  }

  return {
    success: true,
    data: ((data ?? []) as { id: string; display_name: string | null; city_id: number | null }[]).map(
      (p) => ({
        id: p.id,
        name: p.display_name?.trim() || 'İsimsiz kuruluş',
        cityId: p.city_id,
      })
    ),
  };
}
