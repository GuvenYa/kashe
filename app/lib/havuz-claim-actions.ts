'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';

/**
 * FAZ 5 / P2 — havuz kaydini sahiplenme (claim) eylemleri.
 *
 * Token YALNIZ URL'den gelir ve YALNIZ RPC'ye verilir; token ile tablo sorgusu
 * yapilmaz (`invitation_token` sutunu istemciye kapali). E-posta eslesmesine
 * DB karar verir (`auth.email()` ile normalize karsilastirma) — istemci karar vermez.
 *
 * Hem davet sayfasi (/davet/havuz/[token]) hem profil bandi bu dosyayi kullanir.
 */

export type ClaimResult =
  | { success: true; recordId: string }
  | { success: false; error: string; needsLogin?: boolean };

type RpcHata = { code?: string | null; message?: string | null };

/**
 * RPC hata kodlarini kullanici mesajina cevirir.
 * Kodlar `faz5_01` icindeki RAISE ... USING ERRCODE degerleridir:
 * insufficient_privilege 42501, no_data_found P0002, invalid_parameter_value 22023,
 * unique_violation 23505.
 */
function havuzHataMesaji(error: RpcHata): {
  error: string;
  needsLogin?: boolean;
} {
  const kod = error.code ?? '';
  const mesaj = (error.message ?? '').toLocaleLowerCase('tr');

  if (kod === '42501') {
    if (mesaj.includes('giris gerekir')) {
      return { error: 'Giriş yapmalısın.', needsLogin: true };
    }
    return {
      error:
        'Bu davet başka bir e-posta adresine gönderilmiş; hesabının e-postası eşleşmiyor.',
    };
  }
  if (kod === 'P0002') {
    if (mesaj.includes('profesyonel')) {
      return {
        error: 'Sahiplenmek için profesyonel veya ajans profili gerekir.',
      };
    }
    return { error: 'Davet bulunamadı ya da daha önce kullanılmış.' };
  }
  if (kod === '22023') {
    if (mesaj.includes('zaten sahiplenilmis')) {
      return { error: 'Bu kayıt zaten sahiplenilmiş.' };
    }
    if (mesaj.includes('engelli')) {
      return { error: 'Bu kayıt engellenmiş; kuruluşla iletişime geç.' };
    }
    return { error: 'Davetin süresi dolmuş; kuruluştan yeni davet iste.' };
  }
  if (kod === '23505') {
    return { error: 'Bu kuruluşta sana bağlı bir kayıt zaten var.' };
  }
  return { error: 'İşlem tamamlanamadı, tekrar dene.' };
}

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Davet baglantisindan sahiplenme (token ile). */
export async function claimTalentInvitation(token: string): Promise<ClaimResult> {
  if (!UUID_KALIBI.test(token)) {
    return { success: false, error: 'Davet bağlantısı geçersiz.' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('claim_talent_record', {
    p_token: token,
  });
  if (error) {
    console.error('[havuz] claim token', error);
    const { error: mesaj, needsLogin } = havuzHataMesaji(error);
    return { success: false, error: mesaj, needsLogin };
  }
  revalidatePath('/profil');
  revalidatePath('/ajans/havuz');
  return { success: true, recordId: data as string };
}

/** Profil bandindan sahiplenme (kayit id'si ile; token yok). */
export async function claimTalentRecordById(
  recordId: string
): Promise<ClaimResult> {
  if (!UUID_KALIBI.test(recordId)) {
    return { success: false, error: 'Kayıt geçersiz.' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('claim_talent_record_by_id', {
    p_record_id: recordId,
  });
  if (error) {
    console.error('[havuz] claim id', error);
    const { error: mesaj, needsLogin } = havuzHataMesaji(error);
    return { success: false, error: mesaj, needsLogin };
  }
  revalidatePath('/profil');
  revalidatePath('/ajans/havuz');
  return { success: true, recordId: data as string };
}

/** Daveti reddetme (yalniz token ile; kayit `declined` olur). */
export async function declineTalentInvitation(
  token: string
): Promise<ClaimResult> {
  if (!UUID_KALIBI.test(token)) {
    return { success: false, error: 'Davet bağlantısı geçersiz.' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    'decline_talent_record_invitation',
    { p_token: token }
  );
  if (error) {
    console.error('[havuz] decline', error);
    const { error: mesaj, needsLogin } = havuzHataMesaji(error);
    return { success: false, error: mesaj, needsLogin };
  }
  revalidatePath('/profil');
  revalidatePath('/ajans/havuz');
  return { success: true, recordId: data as string };
}
