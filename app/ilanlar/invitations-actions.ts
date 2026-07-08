'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { isUserSuspended } from '@/app/lib/check-suspension';
import {
  canWriteForBusiness,
  getWritableBusinesses,
} from '@/app/lib/business-write';

export type InvitationActionResult = {
  success: boolean;
  error?: string;
  invitationId?: string;
};

/**
 * Müşteri/kurumsal, kendi yayındaki ilanına bir profesyoneli davet eder.
 * listing_invitations'a 'pending' kayıt + profesyonele bildirim.
 */
export async function inviteProfessionalToListing(input: {
  listingId: string;
  professionalId: string;
  message?: string;
}): Promise<InvitationActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  if (input.professionalId === user.id) {
    return { success: false, error: 'Kendini davet edemezsin.' };
  }

  // İlan gerçekten bu kullanıcının mı + yayında mı?
  const { data: listing } = await supabase
    .from('listings')
    .select('id, creator_id, status, title')
    .eq('id', input.listingId)
    .single();

  if (!listing) return { success: false, error: 'İlan bulunamadı.' };
  // Sahibi VEYA kurum ilanında manager+ üye davet edebilir (dilim 3b).
  // inviter_id = user.id KALIR (iptal kapısı inviter_id'ye bağlı).
  if (
    listing.creator_id !== user.id &&
    !(await canWriteForBusiness(listing.creator_id))
  ) {
    return { success: false, error: 'Bu ilan sana ait değil.' };
  }
  if (listing.status !== 'published') {
    return { success: false, error: 'Sadece yayında olan ilanlara davet gönderebilirsin.' };
  }

  // Davet edilen gerçekten profesyonel/ajans mı?
  const { data: target } = await supabase
    .from('profiles')
    .select('id, role, is_published')
    .eq('id', input.professionalId)
    .single();

  if (!target) return { success: false, error: 'Profil bulunamadı.' };
  if (target.role !== 'professional' && target.role !== 'agency') {
    return { success: false, error: 'Sadece profesyonel veya ajansları davet edebilirsin.' };
  }

  // Bu profesyonel zaten bu ilana başvurmuş mu? (gereksiz davet önle)
  const { data: existingApp } = await supabase
    .from('applications')
    .select('id')
    .eq('listing_id', input.listingId)
    .eq('applicant_id', input.professionalId)
    .maybeSingle();

  if (existingApp) {
    return { success: false, error: 'Bu profesyonel zaten bu ilana başvurmuş.' };
  }

  // Bekleyen davet zaten var mı? (DB constraint de korur ama dostça mesaj verelim)
  const { data: existingInvite } = await supabase
    .from('listing_invitations')
    .select('id, status')
    .eq('listing_id', input.listingId)
    .eq('professional_id', input.professionalId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingInvite) {
    return { success: false, error: 'Bu profesyoneli zaten davet ettin (yanıt bekliyor).' };
  }

  const msg = input.message?.trim() || null;
  if (msg && msg.length > 1000) {
    return { success: false, error: 'Davet mesajı 1000 karakterden uzun olamaz.' };
  }

  const { data: invite, error } = await supabase
    .from('listing_invitations')
    .insert({
      listing_id: input.listingId,
      inviter_id: user.id,
      professional_id: input.professionalId,
      invitation_message: msg,
    })
    .select('id')
    .single();

  if (error || !invite) {
    return { success: false, error: 'Davet gönderilemedi: ' + (error?.message || 'bilinmeyen hata') };
  }

  // Profesyonele bildirim (sessiz fail — kritik akışı bozma)
  try {
    await supabase.from('notifications').insert({
      user_id: input.professionalId,
      type: 'listing_invitation',
      body: `Bir ilana davet edildin: "${listing.title}"`,
      link: '/davetlerim',
    });
  } catch {
    /* bildirim başarısızsa akışı bozma */
  }

  revalidatePath('/davetlerim');
  revalidatePath(`/ilanlar/${input.listingId}`);
  return { success: true, invitationId: invite.id };
}

/**
 * Profesyonel daveti kabul eder → applications'a normal başvuru oluşur.
 * Davet 'accepted' olur, resulting_application_id bağlanır.
 */
export async function acceptListingInvitation(
  invitationId: string
): Promise<InvitationActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı. İletişim: kasheofficial@gmail.com' };
  }

  // Daveti çek + doğrula
  const { data: invite } = await supabase
    .from('listing_invitations')
    .select('id, listing_id, inviter_id, professional_id, status, invitation_message')
    .eq('id', invitationId)
    .single();

  if (!invite) return { success: false, error: 'Davet bulunamadı.' };
  if (invite.professional_id !== user.id) {
    return { success: false, error: 'Bu davet sana ait değil.' };
  }
  if (invite.status !== 'pending') {
    return { success: false, error: 'Bu davet artık geçerli değil.' };
  }

  // İlan hâlâ yayında mı?
  const { data: listing } = await supabase
    .from('listings')
    .select('id, status, title')
    .eq('id', invite.listing_id)
    .single();

  if (!listing) return { success: false, error: 'İlan bulunamadı.' };
  if (listing.status !== 'published') {
    return { success: false, error: 'Bu ilan artık başvuruya açık değil.' };
  }

  // Zaten başvurmuş mu? (çift kayıt önle)
  const { data: existingApp } = await supabase
    .from('applications')
    .select('id')
    .eq('listing_id', invite.listing_id)
    .eq('applicant_id', user.id)
    .maybeSingle();

  let applicationId: string;

  if (existingApp) {
    applicationId = existingApp.id;
  } else {
    // applications INSERT RLS: applicant_id = auth.uid() + profesyonel + published ilan → uyuyor
    const { data: app, error: appError } = await supabase
      .from('applications')
      .insert({
        listing_id: invite.listing_id,
        applicant_id: user.id,
        cover_message: invite.invitation_message
          ? `(Davet üzerine başvuru) ${invite.invitation_message}`
          : 'İlan sahibinin daveti üzerine başvurdum.',
      })
      .select('id')
      .single();

    if (appError || !app) {
      return { success: false, error: 'Başvuru oluşturulamadı: ' + (appError?.message || 'bilinmeyen hata') };
    }
    applicationId = app.id;
  }

  // Daveti accepted yap + başvuruya bağla
  const { error: updateError } = await supabase
    .from('listing_invitations')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
      resulting_application_id: applicationId,
    })
    .eq('id', invitationId);

  if (updateError) {
    return { success: false, error: 'Davet güncellenemedi: ' + updateError.message };
  }

  // İlan sahibine bildirim
  try {
    await supabase.from('notifications').insert({
      user_id: invite.inviter_id,
      type: 'listing_invitation',
      body: `Davet ettiğin profesyonel "${listing.title}" ilanına başvurdu.`,
      link: `/ilanlar/${invite.listing_id}`,
    });
  } catch {
    /* bildirim başarısızsa akışı bozma */
  }

  revalidatePath('/davetlerim');
  revalidatePath('/basvurularim');
  revalidatePath(`/ilanlar/${invite.listing_id}`);
  return { success: true, invitationId };
}

/**
 * Profesyonel daveti reddeder.
 */
export async function declineListingInvitation(
  invitationId: string
): Promise<InvitationActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data: invite } = await supabase
    .from('listing_invitations')
    .select('id, professional_id, status, inviter_id, listing_id')
    .eq('id', invitationId)
    .single();

  if (!invite) return { success: false, error: 'Davet bulunamadı.' };
  if (invite.professional_id !== user.id) {
    return { success: false, error: 'Bu davet sana ait değil.' };
  }
  if (invite.status !== 'pending') {
    return { success: false, error: 'Bu davet artık geçerli değil.' };
  }

  const { error } = await supabase
    .from('listing_invitations')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', invitationId);

  if (error) {
    return { success: false, error: 'Davet reddedilemedi: ' + error.message };
  }

  revalidatePath('/davetlerim');
  return { success: true, invitationId };
}

/**
 * İlan sahibi gönderdiği daveti iptal eder (henüz yanıtlanmamışsa).
 */
export async function cancelListingInvitation(
  invitationId: string
): Promise<InvitationActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data: invite } = await supabase
    .from('listing_invitations')
    .select('id, inviter_id, status, listing_id')
    .eq('id', invitationId)
    .single();

  if (!invite) return { success: false, error: 'Davet bulunamadı.' };
  // Daveti gönderen ÜYE, ilan sahibi VEYA kurum ilanında manager+ üye iptal edebilir
  // (dilim 3b rötuş — davet gönderebilen iptal de edebilmeli). has_business_role kurum
  // HESABINI kapsamadığından sahip için ayrı creator_id dalı gerekir.
  if (invite.inviter_id !== user.id) {
    const { data: listing } = await supabase
      .from('listings')
      .select('creator_id')
      .eq('id', invite.listing_id)
      .single();
    const canCancel =
      !!listing &&
      (listing.creator_id === user.id ||
        (await canWriteForBusiness(listing.creator_id)));
    if (!canCancel) {
      return { success: false, error: 'Bu daveti iptal etme yetkin yok.' };
    }
  }
  if (invite.status !== 'pending') {
    return { success: false, error: 'Sadece yanıt bekleyen davetler iptal edilebilir.' };
  }

  const { error } = await supabase
    .from('listing_invitations')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('id', invitationId);

  if (error) {
    return { success: false, error: 'Davet iptal edilemedi: ' + error.message };
  }

  revalidatePath('/davetlerim');
  revalidatePath(`/ilanlar/${invite.listing_id ?? ''}`);
  return { success: true, invitationId };
}

/**
 * Müşterinin "İlanıma Davet Et" modalı için: kendi yayındaki ilanları,
 * bu profesyonelin durumu (zaten davetli mi / başvurmuş mu) ile birlikte.
 */
export async function getMyListingsForInvite(professionalId: string): Promise<{
  success: boolean;
  error?: string;
  listings?: Array<{
    id: string;
    title: string;
    alreadyInvited: boolean;
    alreadyApplied: boolean;
  }>;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  // Kendi + yazma yetkisi (manager+) olunan kurumların yayındaki ilanları
  const writable = await getWritableBusinesses();
  const creatorIds = [user.id, ...writable.map((w) => w.business_id)];
  const { data: listings } = await supabase
    .from('listings')
    .select('id, title')
    .in('creator_id', creatorIds)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (!listings || listings.length === 0) {
    return { success: true, listings: [] };
  }

  const listingIds = listings.map((l) => l.id);

  // Bu profesyonelin bekleyen davetleri + başvuruları
  const [{ data: invites }, { data: apps }] = await Promise.all([
    supabase
      .from('listing_invitations')
      .select('listing_id')
      .eq('professional_id', professionalId)
      .eq('status', 'pending')
      .in('listing_id', listingIds),
    supabase
      .from('applications')
      .select('listing_id')
      .eq('applicant_id', professionalId)
      .in('listing_id', listingIds),
  ]);

  const invitedSet = new Set((invites ?? []).map((i) => i.listing_id));
  const appliedSet = new Set((apps ?? []).map((a) => a.listing_id));

  return {
    success: true,
    listings: listings.map((l) => ({
      id: l.id,
      title: l.title,
      alreadyInvited: invitedSet.has(l.id),
      alreadyApplied: appliedSet.has(l.id),
    })),
  };
}