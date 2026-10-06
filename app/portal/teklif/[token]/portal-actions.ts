'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { JETON_KALIBI } from './portal-data';

/**
 * FAZ 7a / P2 — portal islemleri (onay / revizyon istegi).
 *
 * Portal AYRI YUZEY: yalniz iki anon RPC cagrilir. Tablo sorgusu YOK,
 * `internal` YOK, `has_org_permission` YOK, oturum gerekmez.
 *
 * Jeton yalniz URL'den gelir ve yalniz RPC'ye verilir: hicbir log satirina,
 * veritabanina veya baska URL'ye yazilmaz (hata loglari da jeton tasimaz).
 */

type ActionResult = { success: true } | { success: false; error: string };

type RpcHata = { code?: string | null; message?: string | null };

function islemHataMesaji(error: RpcHata, islem: 'onay' | 'revizyon'): string {
  const kod = error.code ?? '';
  const mesaj = error.message ?? '';

  if (kod === '42501') {
    return islem === 'onay'
      ? 'Bu bağlantı onay yetkisi taşımıyor.'
      : 'Bu bağlantı revizyon yetkisi taşımıyor.';
  }
  if (kod === 'P0002') return 'Bağlantı geçersiz.';
  if (kod === '22023') {
    if (mesaj.includes('iptal')) return 'Bu bağlantı iptal edilmiş.';
    if (mesaj.includes('baglantinin suresi dolmus')) {
      return 'Bağlantının süresi dolmuş.';
    }
    if (mesaj.includes('goruntuleme hakki')) {
      return 'Bağlantının görüntüleme hakkı bitmiş.';
    }
    if (mesaj.includes('zaten onaylanmis')) {
      return 'Bu teklif zaten onaylanmış.';
    }
    if (mesaj.includes('gecerlilik suresi dolmus')) {
      return 'Teklifin geçerlilik süresi dolmuş.';
    }
    if (mesaj.includes('bu durumda onaylanamaz')) {
      return 'Teklif bu durumda onaylanamaz.';
    }
    if (mesaj.includes('bu durumda revize istenemez')) {
      return 'Teklif bu durumda revize istenemez.';
    }
    if (mesaj.includes('ad soyad')) {
      return 'Ad soyad 2-120 karakter olmalı.';
    }
    if (mesaj.includes('revizyon notu')) {
      return 'Revizyon notu 2-4000 karakter olmalı.';
    }
    if (mesaj.includes('gonderilmis surum yok')) {
      return 'Teklif henüz gönderilmemiş.';
    }
  }
  return 'İşlem yapılamadı, tekrar dene.';
}

/** Teklifi onaylar (kritik islem; onay ekrani istemcide). */
export async function approveProposal(
  token: string,
  name: string
): Promise<ActionResult> {
  if (!JETON_KALIBI.test(token)) {
    return { success: false, error: 'Bağlantı geçersiz.' };
  }
  const ad = (name ?? '').trim();
  if (ad.length < 2 || ad.length > 120) {
    return { success: false, error: 'Ad soyad 2-120 karakter olmalı.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('portal_proposal_approve', {
    p_token: token,
    p_name: ad,
  });
  if (error) {
    // Jeton loglanmaz: yalniz kod ve mesaj.
    console.error('[portal] onay', error.code, error.message);
    return { success: false, error: islemHataMesaji(error, 'onay') };
  }

  revalidatePath(`/portal/teklif/${token}`);
  return { success: true };
}

/** Revizyon ister (not zorunlu). */
export async function requestRevision(
  token: string,
  note: string
): Promise<ActionResult> {
  if (!JETON_KALIBI.test(token)) {
    return { success: false, error: 'Bağlantı geçersiz.' };
  }
  const not = (note ?? '').trim();
  if (not.length < 2 || not.length > 4000) {
    return { success: false, error: 'Revizyon notu 2-4000 karakter olmalı.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('portal_proposal_request_revision', {
    p_token: token,
    p_note: not,
  });
  if (error) {
    console.error('[portal] revizyon', error.code, error.message);
    return { success: false, error: islemHataMesaji(error, 'revizyon') };
  }

  revalidatePath(`/portal/teklif/${token}`);
  return { success: true };
}
