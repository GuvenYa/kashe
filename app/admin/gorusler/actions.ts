'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

type ActionResult = { success: true } | { success: false; error: string };
type CreateResult =
  | { success: true; id: string }
  | { success: false; error: string };

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
      target_type: 'testimonial',
      target_id: targetId,
      notes: notes ?? null,
    });
  } catch (err) {
    console.error('[admin-audit] testimonial log error:', err);
  }
}

export type TestimonialFormData = {
  author_name: string;
  author_role: string | null;
  body: string;
  rating: number;
  sort_order: number;
  source_note: string | null;
  is_published: boolean;
};

function validate(data: TestimonialFormData): string | null {
  const name = data.author_name.trim();
  if (name.length < 2) return 'Görünen ad en az 2 karakter olmalı.';
  if (name.length > 120) return 'Görünen ad 120 karakterden uzun olamaz.';
  if (data.body.trim().length < 3) return 'Görüş metni en az 3 karakter olmalı.';
  if (data.body.length > 2000) return 'Görüş metni 2000 karakterden uzun olamaz.';
  if (data.author_role && data.author_role.length > 120) {
    return 'Rol/etiket 120 karakterden uzun olamaz.';
  }
  if (data.source_note && data.source_note.length > 1000) {
    return 'İç not 1000 karakterden uzun olamaz.';
  }
  if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
    return 'Puan 1-5 arasında olmalı.';
  }
  if (!Number.isInteger(data.sort_order)) {
    return 'Sıra değeri bir tam sayı olmalı.';
  }
  return null;
}

function toRow(data: TestimonialFormData) {
  return {
    author_name: data.author_name.trim(),
    author_role: data.author_role?.trim() || null,
    body: data.body.trim(),
    rating: data.rating,
    sort_order: data.sort_order,
    source_note: data.source_note?.trim() || null,
    is_published: data.is_published,
  };
}

export async function createTestimonial(
  data: TestimonialFormData
): Promise<CreateResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const v = validate(data);
  if (v) return { success: false, error: v };

  const { data: inserted, error: insErr } = await supabase
    .from('testimonials')
    .insert(toRow(data))
    .select('id')
    .single();

  if (insErr || !inserted) {
    return { success: false, error: 'Eklenemedi: ' + (insErr?.message ?? '?') };
  }

  await logAction(supabase, adminId, 'create_testimonial', inserted.id);
  revalidatePath('/admin/gorusler');
  revalidatePath('/');
  return { success: true, id: inserted.id };
}

export async function updateTestimonial(
  id: string,
  data: TestimonialFormData
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const v = validate(data);
  if (v) return { success: false, error: v };

  const { error: updErr } = await supabase
    .from('testimonials')
    .update(toRow(data))
    .eq('id', id);

  if (updErr) {
    return { success: false, error: 'Güncellenemedi: ' + updErr.message };
  }

  await logAction(supabase, adminId, 'update_testimonial', id);
  revalidatePath('/admin/gorusler');
  revalidatePath('/');
  return { success: true };
}

export async function deleteTestimonial(id: string): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const { error: delErr } = await supabase
    .from('testimonials')
    .delete()
    .eq('id', id);

  if (delErr) {
    return { success: false, error: 'Silinemedi: ' + delErr.message };
  }

  await logAction(supabase, adminId, 'delete_testimonial', id);
  revalidatePath('/admin/gorusler');
  revalidatePath('/');
  return { success: true };
}

export async function toggleTestimonialPublish(
  id: string,
  publish: boolean
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const { error: updErr } = await supabase
    .from('testimonials')
    .update({ is_published: publish })
    .eq('id', id);

  if (updErr) {
    return { success: false, error: 'Güncellenemedi: ' + updErr.message };
  }

  await logAction(
    supabase,
    adminId,
    publish ? 'publish_testimonial' : 'unpublish_testimonial',
    id
  );
  revalidatePath('/admin/gorusler');
  revalidatePath('/');
  return { success: true };
}
