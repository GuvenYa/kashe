'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { sendAccountEmail } from '@/app/lib/email/account-emails';
import { teklifEmail } from '@/app/lib/email/proposal-email';
import { SITE_URL } from '@/app/lib/email/resend-client';
import { paraMetni, tarihMetni } from './teklif-data';

/**
 * FAZ 7a / P1 — teklif eylemleri.
 *
 * Teklif ve surum YALNIZ RPC ile acilir (`proposal_create`, `proposal_new_version`);
 * tablolara INSERT yetkisi YOK ve tetikleyici bayrak olmadan reddeder.
 * `status` / `current_version_id` dogrudan yazilmaz. Dogrudan yazilan alanlar:
 *   proposals        UPDATE: title, client_name, client_email, buyer_*, event_id, crew_id
 *   proposal_versions UPDATE: tax_rate, valid_until, notes
 *   proposal_items   INSERT/UPDATE/DELETE (duzenlenebilir sutunlar; RLS + dondurma tetikleyicisi)
 *
 * Ham jeton YALNIZ `proposal_send` donusunde bir kez gelir: cagirana donulur,
 * e-postaya konur; LOGLANMAZ ve veritabanina yazilmaz.
 */

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

type RpcHata = { code?: string | null; message?: string | null };

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DB tetikleyici/RPC metinleri ASCII; eslesme ona gore. */
function teklifHataMesaji(error: RpcHata): string {
  const kod = error.code ?? '';
  const mesaj = error.message ?? '';

  if (kod === '42501') return 'Bu teklif için yetkin yok.';
  if (kod === 'P0002') return 'Teklif bulunamadı.';
  if (kod === '23503') return 'Bağlı kayıt bulunamadı.';
  if (kod === '22023' || kod === '23514') {
    if (mesaj.includes('surum dondurulmus')) {
      return 'Bu sürüm gönderildi; değişiklik için yeni sürüm aç.';
    }
    if (mesaj.includes('musteriye gorunen kalem yok')) {
      return 'Gönderilecek görünür kalem yok.';
    }
    if (mesaj.includes('fiyati girilmemis kalem')) {
      return 'Fiyatı girilmemiş kalem var.';
    }
    if (mesaj.includes('mevcut surum zaten taslak')) {
      return 'Zaten taslak sürümdesin.';
    }
    if (mesaj.includes('onaylanmis teklifte')) {
      return 'Onaylanmış teklifte yeni sürüm açılamaz.';
    }
    if (mesaj.includes('kurulusun saglayici kaydi yok')) {
      return 'Kuruluşun sağlayıcı kaydı yok.';
    }
    if (mesaj.includes('gonderilecek taslak surum yok')) {
      return 'Gönderilecek taslak sürüm yok.';
    }
    if (mesaj.includes('gecerlilik 1-365')) {
      return 'Geçerlilik 1-365 gün olmalı.';
    }
    if (mesaj.includes('bu durumda kapatilamaz')) {
      return 'Bu durumda teklif kapatılamaz.';
    }
    if (mesaj.includes('baslik gerekir')) return 'Başlık gerekir.';
    if (mesaj.includes('ekip bu kurulusa ait degil')) {
      return 'Ekip bu kuruluşa ait değil.';
    }
    if (mesaj.includes('durum ve gecerli surum yalniz RPC')) {
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

async function oturum() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Yeni teklif (bos ya da ekipten). Yalniz RPC. */
export async function createProposal(input: {
  organizationId: string;
  title: string;
  eventId?: string | null;
  crewId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  if (!UUID_KALIBI.test(input.organizationId)) {
    return { success: false, error: 'Kuruluş geçersiz.' };
  }
  const baslik = metin(input.title, 200);
  if (!baslik) return { success: false, error: 'Başlık gerekir.' };

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data, error } = await supabase.rpc('proposal_create', {
    p_org_id: input.organizationId,
    p_title: baslik,
    p_event_id: input.eventId ?? null,
    p_crew_id: input.crewId ?? null,
    p_client_name: metin(input.clientName, 200),
    p_client_email: metin(input.clientEmail, 200),
    p_buyer_user_id: null,
  });

  if (error || !data) {
    console.error('[teklif] olusturma', error);
    return { success: false, error: teklifHataMesaji(error ?? {}) };
  }

  revalidatePath('/ajans/teklifler');
  return { success: true, data: { id: data as string } };
}

/** Baslik / musteri bilgileri (dogrudan UPDATE; yalniz izinli sutunlar). */
export async function updateProposalFields(input: {
  proposalId: string;
  title?: string;
  clientName?: string | null;
  clientEmail?: string | null;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.proposalId)) {
    return { success: false, error: 'Teklif geçersiz.' };
  }

  const govde: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const baslik = metin(input.title, 200);
    if (!baslik) return { success: false, error: 'Başlık gerekir.' };
    govde.title = baslik;
  }
  if (input.clientName !== undefined) {
    govde.client_name = metin(input.clientName, 200);
  }
  if (input.clientEmail !== undefined) {
    govde.client_email = metin(input.clientEmail, 200);
  }
  if (Object.keys(govde).length === 0) return { success: true };

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase
    .from('proposals')
    .update(govde)
    .eq('id', input.proposalId);
  if (error) {
    console.error('[teklif] alan guncelleme', error);
    return { success: false, error: teklifHataMesaji(error) };
  }

  revalidatePath(`/ajans/teklifler/${input.proposalId}`);
  revalidatePath('/ajans/teklifler');
  return { success: true };
}

/** Surum alanlari: KDV orani, gecerlilik, musteri notu. */
export async function updateVersionFields(input: {
  versionId: string;
  proposalId: string;
  /** Yuzde olarak gelir (ornek 20); DB 0-1 bekler. */
  taxPercent?: number;
  /** YYYY-MM-DD ya da bos. */
  validUntil?: string | null;
  notes?: string | null;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.versionId)) {
    return { success: false, error: 'Sürüm geçersiz.' };
  }

  const govde: Record<string, unknown> = {};
  if (input.taxPercent !== undefined) {
    if (!Number.isFinite(input.taxPercent) || input.taxPercent < 0 || input.taxPercent > 100) {
      return { success: false, error: 'KDV oranı 0-100 arasında olmalı.' };
    }
    govde.tax_rate = Math.round(input.taxPercent * 100) / 10000;
  }
  if (input.validUntil !== undefined) {
    const t = (input.validUntil ?? '').trim();
    if (t === '') govde.valid_until = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      return { success: false, error: 'Geçerlilik tarihi geçersiz.' };
    } else govde.valid_until = `${t}T23:59:59+03:00`;
  }
  if (input.notes !== undefined) govde.notes = metin(input.notes, 4000);
  if (Object.keys(govde).length === 0) return { success: true };

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase
    .from('proposal_versions')
    .update(govde)
    .eq('id', input.versionId);
  if (error) {
    console.error('[teklif] surum guncelleme', error);
    return { success: false, error: teklifHataMesaji(error) };
  }

  revalidatePath(`/ajans/teklifler/${input.proposalId}`);
  return { success: true };
}

export async function addProposalItem(input: {
  versionId: string;
  proposalId: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  sortOrder?: number;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.versionId)) {
    return { success: false, error: 'Sürüm geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.from('proposal_items').insert({
    proposal_version_id: input.versionId,
    description: metin(input.description, 500) ?? 'Yeni kalem',
    quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
    unit_client_price:
      input.unitPrice && input.unitPrice > 0 ? input.unitPrice : 0,
    sort_order: input.sortOrder ?? 0,
  });
  if (error) {
    console.error('[teklif] kalem ekleme', error);
    return { success: false, error: teklifHataMesaji(error) };
  }

  revalidatePath(`/ajans/teklifler/${input.proposalId}`);
  return { success: true };
}

export async function updateProposalItem(input: {
  itemId: string;
  proposalId: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  isVisible?: boolean;
  sortOrder?: number;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.itemId)) {
    return { success: false, error: 'Kalem geçersiz.' };
  }

  const govde: Record<string, unknown> = {};
  if (input.description !== undefined) {
    const a = metin(input.description, 500);
    if (!a) return { success: false, error: 'Kalem açıklaması gerekir.' };
    govde.description = a;
  }
  if (input.quantity !== undefined) {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      return { success: false, error: 'Adet 0’dan büyük olmalı.' };
    }
    govde.quantity = input.quantity;
  }
  if (input.unitPrice !== undefined) {
    if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) {
      return { success: false, error: 'Birim fiyat 0 veya daha büyük olmalı.' };
    }
    govde.unit_client_price = input.unitPrice;
  }
  if (input.isVisible !== undefined) govde.is_visible_to_client = input.isVisible;
  if (input.sortOrder !== undefined) govde.sort_order = input.sortOrder;
  if (Object.keys(govde).length === 0) return { success: true };

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase
    .from('proposal_items')
    .update(govde)
    .eq('id', input.itemId);
  if (error) {
    console.error('[teklif] kalem guncelleme', error);
    return { success: false, error: teklifHataMesaji(error) };
  }

  revalidatePath(`/ajans/teklifler/${input.proposalId}`);
  return { success: true };
}

export async function deleteProposalItem(input: {
  itemId: string;
  proposalId: string;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.itemId)) {
    return { success: false, error: 'Kalem geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase
    .from('proposal_items')
    .delete()
    .eq('id', input.itemId);
  if (error) {
    console.error('[teklif] kalem silme', error);
    return { success: false, error: teklifHataMesaji(error) };
  }

  revalidatePath(`/ajans/teklifler/${input.proposalId}`);
  return { success: true };
}

/** Yeni surum (kalemler + ic maliyetler kopyali). Yalniz RPC. */
export async function newProposalVersion(
  proposalId: string
): Promise<ActionResult> {
  if (!UUID_KALIBI.test(proposalId)) {
    return { success: false, error: 'Teklif geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.rpc('proposal_new_version', {
    p_proposal_id: proposalId,
  });
  if (error) {
    console.error('[teklif] yeni surum', error);
    return { success: false, error: teklifHataMesaji(error) };
  }

  revalidatePath(`/ajans/teklifler/${proposalId}`);
  revalidatePath('/ajans/teklifler');
  return { success: true };
}

/** Teklifi kapat (satici yalniz `declined` yapabilir). */
export async function closeProposal(
  proposalId: string
): Promise<ActionResult> {
  if (!UUID_KALIBI.test(proposalId)) {
    return { success: false, error: 'Teklif geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.rpc('proposal_set_status', {
    p_proposal_id: proposalId,
    p_status: 'declined',
  });
  if (error) {
    console.error('[teklif] kapatma', error);
    return { success: false, error: teklifHataMesaji(error) };
  }

  revalidatePath(`/ajans/teklifler/${proposalId}`);
  revalidatePath('/ajans/teklifler');
  return { success: true };
}

export async function revokeProposalLink(input: {
  linkId: string;
  proposalId: string;
}): Promise<ActionResult> {
  if (!UUID_KALIBI.test(input.linkId)) {
    return { success: false, error: 'Bağlantı geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { error } = await supabase.rpc('proposal_revoke_link', {
    p_link_id: input.linkId,
  });
  if (error) {
    console.error('[teklif] baglanti iptali', error);
    return { success: false, error: teklifHataMesaji(error) };
  }

  revalidatePath(`/ajans/teklifler/${input.proposalId}`);
  return { success: true };
}

/**
 * Gonderim: RPC surumu dondurur, eski baglantilari iptal eder, yeni jeton uretir.
 * Jeton donuste BIR KEZ gelir -> baglanti kurulur, e-posta yollanir, cagirana
 * donulur. `console.log`'a YAZILMAZ (hata loglarinda da jeton gecmez).
 */
export async function sendProposal(input: {
  proposalId: string;
  validDays: number;
}): Promise<
  ActionResult<{ link: string; mailSent: boolean; mailReason?: string | null }>
> {
  if (!UUID_KALIBI.test(input.proposalId)) {
    return { success: false, error: 'Teklif geçersiz.' };
  }
  const gun = Math.trunc(input.validDays);
  if (!Number.isFinite(gun) || gun < 1 || gun > 365) {
    return { success: false, error: 'Geçerlilik 1-365 gün olmalı.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data, error } = await supabase.rpc('proposal_send', {
    p_proposal_id: input.proposalId,
    p_valid_days: gun,
  });
  if (error) {
    console.error('[teklif] gonderim rpc', error);
    return { success: false, error: teklifHataMesaji(error) };
  }

  const satir = ((data ?? []) as { link_id: string; token: string }[])[0];
  if (!satir?.token) {
    console.error('[teklif] gonderim: jeton donmedi');
    return { success: false, error: 'Bağlantı oluşturulamadı, tekrar dene.' };
  }
  const baglanti = `${SITE_URL}/portal/teklif/${satir.token}`;

  // E-posta icerigi icin teklif + gecerli surum + satici adi (jeton yok).
  const { data: teklifData } = await supabase
    .from('proposals')
    .select(
      'title, client_name, client_email, seller_organization_id, current_version_id'
    )
    .eq('id', input.proposalId)
    .maybeSingle();
  const teklif = teklifData as {
    title: string;
    client_name: string | null;
    client_email: string | null;
    seller_organization_id: string;
    current_version_id: string | null;
  } | null;

  let mailSent = false;
  let mailReason: string | null = null;

  if (teklif?.client_email) {
    const [{ data: surumData }, { data: kurulusData }] = await Promise.all([
      teklif.current_version_id
        ? supabase
            .from('proposal_versions')
            .select('total_amount, currency, valid_until')
            .eq('id', teklif.current_version_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('organizations')
        .select('display_name')
        .eq('id', teklif.seller_organization_id)
        .maybeSingle(),
    ]);

    const surum = surumData as {
      total_amount: number | string;
      currency: string;
      valid_until: string | null;
    } | null;

    const icerik = teklifEmail({
      aliciAdi: teklif.client_name,
      saticiAdi:
        (kurulusData as { display_name: string | null } | null)?.display_name?.trim() ||
        'Kashe kuruluşu',
      baslik: teklif.title,
      toplam: surum ? paraMetni(surum.total_amount, surum.currency) : null,
      gecerlilik: surum ? tarihMetni(surum.valid_until) : null,
      baglanti,
    });

    const sonuc = await sendAccountEmail({
      to: teklif.client_email,
      subject: icerik.subject,
      html: icerik.html,
      text: icerik.text,
    });
    mailSent = sonuc.sent;
    if (!sonuc.sent) {
      // Baglanti ekranda yine gosterilir; akis KESILMEZ.
      console.error('[teklif] e-posta gonderilemedi', sonuc.reason);
      mailReason = 'E-posta gönderilemedi, bağlantıyı elle ilet.';
    }
  } else {
    mailReason = 'Kayıtta e-posta yok; bağlantıyı elle iletmen gerekir.';
  }

  revalidatePath(`/ajans/teklifler/${input.proposalId}`);
  revalidatePath('/ajans/teklifler');
  return { success: true, data: { link: baglanti, mailSent, mailReason } };
}

/**
 * FAZ 7a / P2 — hic gonderilmemis taslak teklifi siler (7a-DB/02 politikasi).
 * DB kapisi: `proposals.manage` + `status = 'draft'` + hicbir surumde `sent_at`.
 * Gonderilmis teklifte politika 0 satir siler -> kullaniciya "kapatabilirsin" denir.
 */
export async function deleteDraftProposal(
  proposalId: string
): Promise<ActionResult> {
  if (!UUID_KALIBI.test(proposalId)) {
    return { success: false, error: 'Teklif geçersiz.' };
  }

  const { supabase, user } = await oturum();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data, error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', proposalId)
    .select('id');

  if (error) {
    console.error('[teklif] taslak silme', error);
    return { success: false, error: teklifHataMesaji(error) };
  }
  if (!data || data.length === 0) {
    // Politika satiri suzdu: gonderilmis ya da yetki yok.
    return {
      success: false,
      error: 'Gönderilmiş teklif silinemez; kapatabilirsin.',
    };
  }

  revalidatePath('/ajans/teklifler');
  return { success: true };
}
