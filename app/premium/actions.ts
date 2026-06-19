'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { PREMIUM_PLANS } from '@/app/lib/premium';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * SİMÜLASYON: Kullanıcı kendine premium aktive eder (iyzico öncesi).
 * Gerçek ödeme YOK. Kullanıcı yalnızca KENDİ profiline, rolüne uygun planı,
 * simülasyon amacıyla atayabilir. iyzico gelince bu action gerçek ödemeye bağlanır.
 */
export async function activatePremiumSimulation(
  tier: 'premium' | 'plus' | 'agency',
  months: number
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  // Suspension kontrolü
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { success: false, error: 'Profil bulunamadı.' };
  }
  if (profile.suspended_at) {
    return { success: false, error: 'Hesabın askıya alındı.' };
  }

  // Plan geçerli mi + role uygun mu?
  const plan = PREMIUM_PLANS.find((p) => p.tier === tier);
  if (!plan) {
    return { success: false, error: 'Geçersiz plan.' };
  }
  if (plan.forRoles.length > 0 && !plan.forRoles.includes(profile.role)) {
    return {
      success: false,
      error: 'Bu plan senin hesap türün için uygun değil.',
    };
  }
  if (![1, 3, 6, 12].includes(months)) {
    return { success: false, error: 'Geçersiz süre.' };
  }

  const until = new Date();
  until.setMonth(until.getMonth() + months);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ premium_tier: tier, premium_until: until.toISOString() })
    .eq('id', user.id);

  if (updateError) {
    return {
      success: false,
      error: 'Aktifleştirilemedi: ' + updateError.message,
    };
  }

  revalidatePath('/premium');
  revalidatePath('/profil');
  revalidatePath(`/p/${user.id}`);
  return { success: true };
}

/** SİMÜLASYON: Kullanıcı kendi premium'unu iptal eder. */
export async function cancelPremiumSimulation(): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Giriş yapmalısın.' };
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ premium_tier: 'none', premium_until: null })
    .eq('id', user.id);

  if (updateError) {
    return { success: false, error: 'İptal edilemedi: ' + updateError.message };
  }

  revalidatePath('/premium');
  revalidatePath('/profil');
  revalidatePath(`/p/${user.id}`);
  return { success: true };
}