'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import type { HavuzOranSatiri } from './havuz-data';

/**
 * FAZ 5 / P2 — gizli ic oranlar.
 *
 * `internal` semasina DOGRUDAN sorgu yok; yalniz `internal_talent_rate_*` RPC'leri
 * (assert -> log -> sorgu deseni DB tarafinda). Yetkiyi asil olarak DB zorlar
 * (`commercial.view` okur, `commercial.manage` yazar); burada ayrica kontrol edilir
 * ki kullaniciya duzgun mesaj verilebilsin.
 *
 * Oran verisi istemciye YALNIZ karti acan istek aninda gider; liste ilk yuklemede
 * toplu oran cekmez.
 */

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

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
    console.error('[havuz] oran yetkisi', error);
    return false;
  }
  return data === true;
}

function oranHataMesaji(error: {
  code?: string | null;
  message?: string | null;
}): string {
  if (error.code === '42501') return 'Bu bilgiye erişim yetkin yok.';
  if (error.code === '22023') {
    const m = error.message ?? '';
    if (m.includes('rol gecersiz')) return 'Seçilen rol geçersiz ya da pasif.';
    if (m.includes('maliyet')) return 'Tutar 0 veya daha büyük olmalı.';
    if (m.includes('cost_basis')) return 'Birim geçersiz.';
    if (m.includes('valid_to')) return 'Kapanış tarihi başlangıçtan önce olamaz.';
    if (m.includes('valid_from')) return 'Geçerlilik başlangıcı gerekir.';
    return 'Girilen değerler geçersiz.';
  }
  return 'İşlem tamamlanamadı, tekrar dene.';
}

export async function listTalentRates(
  organizationId: string,
  recordId: string
): Promise<ActionResult<HavuzOranSatiri[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (!(await yetkiVarMi(supabase, organizationId, 'commercial.view'))) {
    return { success: false, error: 'Bu bilgiye erişim yetkin yok.' };
  }

  const { data, error } = await supabase.rpc('internal_talent_rates_list', {
    p_org_id: organizationId,
    p_record_id: recordId,
  });
  if (error) {
    console.error('[havuz] oran listesi', error);
    return { success: false, error: oranHataMesaji(error) };
  }
  return { success: true, data: (data ?? []) as unknown as HavuzOranSatiri[] };
}

export async function upsertTalentRate(input: {
  organizationId: string;
  recordId: string;
  roleId: number;
  cost: number;
  basis: 'per_job' | 'per_hour' | 'per_day';
  validFrom: string;
  note?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (!Number.isFinite(input.cost) || input.cost < 0) {
    return { success: false, error: 'Tutar 0 veya daha büyük olmalı.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.validFrom)) {
    return { success: false, error: 'Geçerlilik başlangıcı geçersiz.' };
  }
  if (!(await yetkiVarMi(supabase, input.organizationId, 'commercial.manage'))) {
    return { success: false, error: 'Bu bilgiye erişim yetkin yok.' };
  }

  const { error } = await supabase.rpc('internal_talent_rate_upsert', {
    p_org_id: input.organizationId,
    p_record_id: input.recordId,
    p_role_id: input.roleId,
    p_cost: input.cost,
    p_basis: input.basis,
    p_currency: 'TRY',
    p_valid_from: input.validFrom,
    p_note: input.note?.trim() || null,
  });
  if (error) {
    console.error('[havuz] oran yazma', error);
    return { success: false, error: oranHataMesaji(error) };
  }
  revalidatePath('/ajans/havuz');
  return { success: true };
}

export async function closeTalentRate(input: {
  organizationId: string;
  rateId: string;
  validTo: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.validTo)) {
    return { success: false, error: 'Kapanış tarihi geçersiz.' };
  }
  if (!(await yetkiVarMi(supabase, input.organizationId, 'commercial.manage'))) {
    return { success: false, error: 'Bu bilgiye erişim yetkin yok.' };
  }

  const { error } = await supabase.rpc('internal_talent_rate_close', {
    p_org_id: input.organizationId,
    p_rate_id: input.rateId,
    p_valid_to: input.validTo,
  });
  if (error) {
    console.error('[havuz] oran kapatma', error);
    return { success: false, error: oranHataMesaji(error) };
  }
  revalidatePath('/ajans/havuz');
  return { success: true };
}
