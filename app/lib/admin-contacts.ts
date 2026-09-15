import type { createClient } from '@/app/lib/supabase-server';

type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

/**
 * Admin sayfaları başka kullanıcıların kapalı 7 sütununu (email, phone, notlar) yalnız bu
 * iki RPC ile okur: profiles'ta bu sütunlar authenticated rolüne kapalı (PII adım 2b).
 * İki RPC de admin olmayan çağırana 42501 döner; hata log'a düşer, sayfa boş alanla sürer.
 */
export type AdminProfileContact = {
  id: string;
  email: string | null;
  phone: string | null;
  kvkk_approved_at: string | null;
  approval_note: string | null;
  suspension_reason: string | null;
  suspended_by: string | null;
  welcome_email_sent_at: string | null;
};

export async function getAdminProfileContacts(
  supabase: SunucuIstemcisi,
  ids: ReadonlyArray<string | null | undefined>
): Promise<Map<string, AdminProfileContact>> {
  const tekil = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (tekil.length === 0) return new Map();

  const { data, error } = await supabase.rpc('admin_profile_contacts', { p_ids: tekil });
  if (error) {
    console.error('[admin] admin_profile_contacts:', error.message);
    return new Map();
  }
  return new Map(((data ?? []) as AdminProfileContact[]).map((r) => [r.id, r] as const));
}

/** Admin araması: e-postası sorguyu içeren profillerin id'leri (`email.ilike` yerine). */
export async function findProfileIdsByEmail(
  supabase: SunucuIstemcisi,
  query: string
): Promise<string[]> {
  const { data, error } = await supabase.rpc('admin_profile_ids_by_email', { p_query: query });
  if (error) {
    console.error('[admin] admin_profile_ids_by_email:', error.message);
    return [];
  }
  return (data ?? []) as string[];
}
