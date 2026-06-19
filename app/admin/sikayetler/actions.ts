'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, adminId: null, error: 'Giriş yapmalısın.' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) {
    return { supabase, adminId: null, error: 'Bu işlem için yetkin yok.' };
  }
  return { supabase, adminId: user.id, error: null };
}

async function logAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
  action: string,
  targetId: string,
  notes?: string
) {
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_type: 'report',
      target_id: targetId,
      notes: notes ?? null,
    });
  } catch (err) {
    console.error('[admin-audit] report log error:', err);
  }
}

/** pending → reviewing (incelemeye al) */
export async function markReportReviewing(
  reportId: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const { error: updErr } = await supabase
    .from('reports')
    .update({ status: 'reviewing' })
    .eq('id', reportId);

  if (updErr) return { success: false, error: 'Güncellenemedi: ' + updErr.message };

  await logAction(supabase, adminId, 'review_report', reportId);
  revalidatePath('/admin/sikayetler');
  revalidatePath('/admin');
  return { success: true };
}

/** → resolved (çözüldü), opsiyonel admin notu */
export async function resolveReport(
  reportId: string,
  note?: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const trimmed = (note ?? '').trim();
  if (trimmed.length > 1000) {
    return { success: false, error: 'Not en fazla 1000 karakter olabilir.' };
  }

  const { error: updErr } = await supabase
    .from('reports')
    .update({
      status: 'resolved',
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
      admin_note: trimmed || null,
    })
    .eq('id', reportId);

  if (updErr) return { success: false, error: 'Güncellenemedi: ' + updErr.message };

  await logAction(supabase, adminId, 'resolve_report', reportId, trimmed || undefined);
  revalidatePath('/admin/sikayetler');
  revalidatePath('/admin');
  return { success: true };
}

/** → dismissed (reddet/yok say), opsiyonel admin notu */
export async function dismissReport(
  reportId: string,
  note?: string
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const trimmed = (note ?? '').trim();
  if (trimmed.length > 1000) {
    return { success: false, error: 'Not en fazla 1000 karakter olabilir.' };
  }

  const { error: updErr } = await supabase
    .from('reports')
    .update({
      status: 'dismissed',
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
      admin_note: trimmed || null,
    })
    .eq('id', reportId);

  if (updErr) return { success: false, error: 'Güncellenemedi: ' + updErr.message };

  await logAction(supabase, adminId, 'dismiss_report', reportId, trimmed || undefined);
  revalidatePath('/admin/sikayetler');
  revalidatePath('/admin');
  return { success: true };
}