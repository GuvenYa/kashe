import type { createClient } from '@/app/lib/supabase-server';

type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

/**
 * profiles tablosunda anon ve authenticated rollerine AÇIK 23 sütun.
 *
 * Liste iki GRANT ile birebir aynıdır: 20260914150000_profiles_anon_pii_kapat.sql (anon)
 * ve PII adım 2b (authenticated). select('*') adım 2b'den sonra 42501 verir, çünkü kapalı
 * 7 sütunu da ister. profiles'a sütun eklenirse bu liste ve iki GRANT birlikte güncellenir.
 */
export const PROFILE_OPEN_COLUMNS = [
  'id',
  'full_name',
  'role',
  'avatar_url',
  'created_at',
  'updated_at',
  'bio',
  'city_id',
  'slug',
  'is_published',
  'primary_category_id',
  'company_name',
  'last_seen_at',
  'is_admin',
  'approval_status',
  'approved_at',
  'attributes',
  'suspended_at',
  'premium_tier',
  'premium_until',
  'views_count',
  'default_allowed_applicant_roles',
  'category_attributes',
].join(', ');

/** Oturum sahibinin kapalı 7 sütunu — yalnız get_own_private_profile() RPC'siyle okunur. */
export type OwnPrivateProfile = {
  email: string | null;
  phone: string | null;
  kvkk_approved_at: string | null;
  approval_note: string | null;
  suspension_reason: string | null;
  suspended_by: string | null;
  welcome_email_sent_at: string | null;
};

export async function getOwnPrivateProfile(
  supabase: SunucuIstemcisi
): Promise<OwnPrivateProfile | null> {
  const { data, error } = await supabase.rpc('get_own_private_profile').maybeSingle();
  if (error) {
    console.error('[profil] get_own_private_profile:', error.message);
    return null;
  }
  return (data as OwnPrivateProfile | null) ?? null;
}

/**
 * select('*') yerine: açık sütunlar (+ istenen embed'ler) ve kapalı sütunlar tek nesnede.
 * Dönüş `{ data }` biçiminde olduğu için mevcut `.from('profiles')...single()` çağrısının
 * yerine doğrudan geçer. RPC hata verirse kapalı alanlar boş kalır ve log'a düşer.
 */
export async function fetchOwnProfile(
  supabase: SunucuIstemcisi,
  userId: string,
  embeds?: string
) {
  const [{ data }, ozel] = await Promise.all([
    supabase
      .from('profiles')
      .select(embeds ? `${PROFILE_OPEN_COLUMNS}, ${embeds}` : PROFILE_OPEN_COLUMNS)
      .eq('id', userId)
      .single(),
    getOwnPrivateProfile(supabase),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { data: data ? ({ ...(data as any), ...ozel } as any) : null };
}
