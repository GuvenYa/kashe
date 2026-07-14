'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export type ExperienceKind = 'work' | 'education' | 'award';

export type ExperienceFormData = {
  kind: ExperienceKind;
  group_key: string | null; // yalnız work; education/award'da null
  title: string;
  subtitle: string | null;
  organization: string | null;
  location: string | null;
  description: string | null;
  // Yapılandırılmış tarihler. period_label formdan YAZILMAZ (okuma-yalnız miras).
  start_year: number | null;
  start_month: number | null;
  end_year: number | null;
  end_month: number | null;
  is_current: boolean;
};

export type ExperienceActionResult = {
  success: boolean;
  error?: string;
  id?: string;
};

const KINDS: ExperienceKind[] = ['work', 'education', 'award'];

function clean(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/** Yıl 1970-2030 aralığında değilse null. */
function yearOrNull(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Math.trunc(v);
  return n >= 1970 && n <= 2030 ? n : null;
}
/** Ay 1-12 aralığında değilse null. */
function monthOrNull(v: number | null | undefined): number | null {
  if (v == null) return null;
  const n = Math.trunc(v);
  return n >= 1 && n <= 12 ? n : null;
}

function validate(data: ExperienceFormData): string | null {
  if (!KINDS.includes(data.kind)) return 'Geçersiz kayıt türü.';
  const title = clean(data.title);
  if (!title) return 'Başlık boş olamaz.';
  if (title.length > 150) return 'Başlık 150 karakterden uzun olamaz.';
  const caps: [string | null, number, string][] = [
    [data.subtitle, 150, 'Alt başlık'],
    [data.organization, 150, 'Kurum'],
    [data.location, 120, 'Konum'],
    [data.description, 2000, 'Açıklama'],
  ];
  for (const [val, max, label] of caps) {
    if (val && val.length > max) return `${label} ${max} karakterden uzun olamaz.`;
  }
  // Tarih: yıl 1970-2030; bitiş başlangıçtan önce olamaz (work/education, devam-etmiyor).
  if (data.start_year != null && yearOrNull(data.start_year) == null)
    return 'Başlangıç yılı 1970-2030 aralığında olmalı.';
  if (data.end_year != null && yearOrNull(data.end_year) == null)
    return 'Bitiş yılı 1970-2030 aralığında olmalı.';
  if (data.kind !== 'award' && !data.is_current) {
    const sy = yearOrNull(data.start_year);
    const ey = yearOrNull(data.end_year);
    if (sy && ey) {
      const sm = monthOrNull(data.start_month) ?? 1;
      const em = monthOrNull(data.end_month) ?? 12;
      if (ey < sy || (ey === sy && em < sm))
        return 'Bitiş tarihi başlangıçtan önce olamaz.';
    }
  }
  return null;
}

/**
 * Form verisini DB satırına normalize eder. period_label KASITEN yok:
 * update'te dokunulmaz (eski etiket korunur), insert'te DB default (null).
 * award → bitiş/devam yok; is_current → bitiş temizlenir.
 */
function toRow(data: ExperienceFormData) {
  const isAward = data.kind === 'award';
  const isCurrent = isAward ? false : !!data.is_current;
  return {
    kind: data.kind,
    group_key: data.kind === 'work' ? clean(data.group_key) : null,
    title: clean(data.title),
    subtitle: clean(data.subtitle),
    organization: clean(data.organization),
    location: clean(data.location),
    description: clean(data.description),
    start_year: yearOrNull(data.start_year),
    start_month: monthOrNull(data.start_month),
    end_year: isAward || isCurrent ? null : yearOrNull(data.end_year),
    end_month: isAward || isCurrent ? null : monthOrNull(data.end_month),
    is_current: isCurrent,
  };
}

function revalidateAll(userId: string) {
  revalidatePath('/profil/deneyim');
  revalidatePath('/profil');
  revalidatePath(`/p/${userId}`);
}

export async function createExperience(
  data: ExperienceFormData
): Promise<ExperienceActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Oturum bulunamadı.' };

  const err = validate(data);
  if (err) return { success: false, error: err };

  // sort_order = aynı kind içindeki mevcut max + 1
  const { data: maxRow } = await supabase
    .from('profile_experiences')
    .select('sort_order')
    .eq('profile_id', user.id)
    .eq('kind', data.kind)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (maxRow?.sort_order ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from('profile_experiences')
    .insert({ profile_id: user.id, ...toRow(data), sort_order: nextSort })
    .select('id')
    .single();

  if (error) return { success: false, error: 'Eklenemedi: ' + error.message };
  revalidateAll(user.id);
  return { success: true, id: inserted.id };
}

export async function updateExperience(
  id: string,
  data: ExperienceFormData
): Promise<ExperienceActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Oturum bulunamadı.' };

  const err = validate(data);
  if (err) return { success: false, error: err };

  const { error } = await supabase
    .from('profile_experiences')
    .update(toRow(data))
    .eq('id', id)
    .eq('profile_id', user.id);

  if (error) return { success: false, error: 'Güncellenemedi: ' + error.message };
  revalidateAll(user.id);
  return { success: true };
}

export async function deleteExperience(
  id: string
): Promise<ExperienceActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Oturum bulunamadı.' };

  const { error } = await supabase
    .from('profile_experiences')
    .delete()
    .eq('id', id)
    .eq('profile_id', user.id);

  if (error) return { success: false, error: 'Silinemedi: ' + error.message };
  revalidateAll(user.id);
  return { success: true };
}

/**
 * Satırı aynı kind içinde bir yukarı/aşağı taşır (sort_order takası).
 * Sürükle-bırak YOK — komşuyla sort_order değiş-tokuş.
 */
export async function moveExperience(
  id: string,
  direction: 'up' | 'down'
): Promise<ExperienceActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Oturum bulunamadı.' };

  // Taşınacak satır
  const { data: current } = await supabase
    .from('profile_experiences')
    .select('id, kind, sort_order')
    .eq('id', id)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (!current) return { success: false, error: 'Kayıt bulunamadı.' };

  // Aynı kind içindeki komşu (yukarı = daha küçük sort, aşağı = daha büyük)
  const neighborQuery = supabase
    .from('profile_experiences')
    .select('id, sort_order')
    .eq('profile_id', user.id)
    .eq('kind', current.kind);

  const { data: neighbor } =
    direction === 'up'
      ? await neighborQuery
          .lt('sort_order', current.sort_order)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle()
      : await neighborQuery
          .gt('sort_order', current.sort_order)
          .order('sort_order', { ascending: true })
          .limit(1)
          .maybeSingle();

  if (!neighbor) return { success: true }; // zaten uçta — sessiz no-op

  // sort_order takası (iki update)
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase
      .from('profile_experiences')
      .update({ sort_order: neighbor.sort_order })
      .eq('id', current.id)
      .eq('profile_id', user.id),
    supabase
      .from('profile_experiences')
      .update({ sort_order: current.sort_order })
      .eq('id', neighbor.id)
      .eq('profile_id', user.id),
  ]);

  if (e1 || e2) return { success: false, error: 'Sıralama güncellenemedi.' };
  revalidateAll(user.id);
  return { success: true };
}
