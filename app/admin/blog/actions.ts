'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

type ActionResult = { success: true } | { success: false; error: string };
type CreateResult =
  | { success: true; id: string; slug: string }
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
      target_type: 'blog_post',
      target_id: targetId,
      notes: notes ?? null,
    });
  } catch (err) {
    console.error('[admin-audit] blog log error:', err);
  }
}

/** Türkçe başlıktan URL-uyumlu slug. "Düğün Rehberi" → "dugun-rehberi" */
function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  return input
    .trim()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Benzersiz slug üretir. Çakışırsa -2, -3... ekler.
 * excludeId: düzenlemede kendi kaydını çakışma saymamak için.
 */
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
  excludeId?: string
): Promise<string> {
  const root = slugifyTr(base) || 'yazi';
  let candidate = root;
  let n = 1;
  // En fazla birkaç deneme; pratikte 1-2 yeter
  while (true) {
    let q = supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', candidate)
      .limit(1);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

export type BlogFormData = {
  title: string;
  slug: string; // boş gelirse başlıktan üretilir
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  status: 'draft' | 'published';
};

function validate(data: BlogFormData): string | null {
  const title = data.title.trim();
  if (title.length < 3) return 'Başlık en az 3 karakter olmalı.';
  if (title.length > 200) return 'Başlık 200 karakterden uzun olamaz.';
  if (data.excerpt && data.excerpt.length > 500) {
    return 'Özet 500 karakterden uzun olamaz.';
  }
  if (data.content.trim().length < 1) return 'İçerik boş olamaz.';
  if (data.content.length > 100000) return 'İçerik çok uzun.';
  if (data.status !== 'draft' && data.status !== 'published') {
    return 'Geçersiz durum.';
  }
  return null;
}

export async function createBlogPost(
  data: BlogFormData
): Promise<CreateResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const v = validate(data);
  if (v) return { success: false, error: v };

  const slug = await uniqueSlug(supabase, data.slug.trim() || data.title);

  const { data: inserted, error: insErr } = await supabase
    .from('blog_posts')
    .insert({
      slug,
      title: data.title.trim(),
      excerpt: data.excerpt?.trim() || null,
      content: data.content,
      cover_image_url: data.cover_image_url,
      author_id: adminId,
      status: data.status,
      published_at: data.status === 'published' ? new Date().toISOString() : null,
    })
    .select('id, slug')
    .single();

  if (insErr || !inserted) {
    return { success: false, error: 'Eklenemedi: ' + (insErr?.message ?? '?') };
  }

  await logAction(supabase, adminId, 'create_blog_post', inserted.id);
  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  return { success: true, id: inserted.id, slug: inserted.slug };
}

export async function updateBlogPost(
  postId: string,
  data: BlogFormData
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const v = validate(data);
  if (v) return { success: false, error: v };

  // Mevcut kaydı al — yayın durumu geçişinde published_at yönetimi için
  const { data: existing } = await supabase
    .from('blog_posts')
    .select('status, published_at, slug')
    .eq('id', postId)
    .single();

  if (!existing) return { success: false, error: 'Yazı bulunamadı.' };

  // Slug: kullanıcı elle değiştirdiyse benzersizle, yoksa mevcut slug'ı koru
  const desiredSlugSource = data.slug.trim();
  let slug = existing.slug;
  if (desiredSlugSource && slugifyTr(desiredSlugSource) !== existing.slug) {
    slug = await uniqueSlug(supabase, desiredSlugSource, postId);
  }

  // published_at: ilk kez yayınlanıyorsa now; zaten yayındaysa koru; taslağa
  // çekiliyorsa null.
  let publishedAt: string | null = existing.published_at;
  if (data.status === 'published' && !existing.published_at) {
    publishedAt = new Date().toISOString();
  } else if (data.status === 'draft') {
    publishedAt = null;
  }

  const { error: updErr } = await supabase
    .from('blog_posts')
    .update({
      slug,
      title: data.title.trim(),
      excerpt: data.excerpt?.trim() || null,
      content: data.content,
      cover_image_url: data.cover_image_url,
      status: data.status,
      published_at: publishedAt,
    })
    .eq('id', postId);

  if (updErr) {
    return { success: false, error: 'Güncellenemedi: ' + updErr.message };
  }

  await logAction(supabase, adminId, 'update_blog_post', postId);
  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
  return { success: true };
}

export async function deleteBlogPost(postId: string): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const { error: delErr } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', postId);

  if (delErr) {
    return { success: false, error: 'Silinemedi: ' + delErr.message };
  }

  await logAction(supabase, adminId, 'delete_blog_post', postId);
  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  return { success: true };
}

export async function toggleBlogStatus(
  postId: string,
  publish: boolean
): Promise<ActionResult> {
  const { supabase, adminId, error } = await requireAdmin();
  if (error || !adminId) return { success: false, error: error || 'Yetki yok' };

  const { data: existing } = await supabase
    .from('blog_posts')
    .select('published_at')
    .eq('id', postId)
    .single();
  if (!existing) return { success: false, error: 'Yazı bulunamadı.' };

  const { error: updErr } = await supabase
    .from('blog_posts')
    .update({
      status: publish ? 'published' : 'draft',
      published_at: publish
        ? existing.published_at ?? new Date().toISOString()
        : null,
    })
    .eq('id', postId);

  if (updErr) {
    return { success: false, error: 'Güncellenemedi: ' + updErr.message };
  }

  await logAction(
    supabase,
    adminId,
    publish ? 'publish_blog_post' : 'unpublish_blog_post',
    postId
  );
  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  return { success: true };
}