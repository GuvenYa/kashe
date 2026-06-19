'use server';

import { createClient } from '@/app/lib/supabase-server';
import { isUserSuspended } from '@/app/lib/check-suspension';
import type { ReportReason, ReportTargetType } from '@/app/lib/types';

export type ReportResult = { success: true } | { success: false; error: string };

const VALID_TARGETS: ReportTargetType[] = ['listing', 'profile', 'review'];
const VALID_REASONS: ReportReason[] = [
  'spam',
  'inappropriate',
  'fake',
  'harassment',
  'other',
];

/**
 * Kullanıcı bir ilanı / profili / yorumu şikayet eder.
 * - Giriş zorunlu, askıdaki kullanıcı şikayet edemez.
 * - Aynı hedefi 2. kez şikayet edemez (UNIQUE → 23505).
 * - Profil hedefinde kendi profilini şikayet edemez.
 */
export async function reportContent(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}): Promise<ReportResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Şikayet için giriş yapmalısın.' };
  }
  if (await isUserSuspended(user.id)) {
    return { success: false, error: 'Hesabın askıya alındı.' };
  }

  if (!VALID_TARGETS.includes(input.targetType)) {
    return { success: false, error: 'Geçersiz şikayet hedefi.' };
  }
  if (!VALID_REASONS.includes(input.reason)) {
    return { success: false, error: 'Geçersiz şikayet sebebi.' };
  }

  const details = (input.details ?? '').trim();
  if (details.length > 1000) {
    return { success: false, error: 'Açıklama en fazla 1000 karakter olabilir.' };
  }

  // Kendi profilini şikayet edemez
  if (input.targetType === 'profile' && input.targetId === user.id) {
    return { success: false, error: 'Kendi profilini şikayet edemezsin.' };
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: details || null,
  });

  if (error) {
    // UNIQUE(reporter, target_type, target_id) → zaten şikayet etmiş
    if (error.code === '23505') {
      return {
        success: false,
        error: 'Bu içeriği zaten şikayet ettin. İncelemeye alındı.',
      };
    }
    return { success: false, error: 'Şikayet gönderilemedi: ' + error.message };
  }

  return { success: true };
}