import { createClient } from '@/app/lib/supabase-server';

export type WritableBusiness = {
  business_id: string;
  business_name: string;
};

/**
 * Kullanıcının manager+ (owner/manager) rolünde olduğu kurumlar — "kimin adına"
 * seçici + kurum adına oluşturma action'ları bunu kullanır.
 * Üyeliği yoksa boş dizi (seçici hiç render edilmez, form bugünkü gibi davranır).
 */
export async function getWritableBusinesses(): Promise<WritableBusiness[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('business_members')
    .select('business_id, member_role, business:profiles!business_members_business_id_fkey (full_name, company_name)')
    .eq('member_user_id', user.id)
    .in('member_role', ['owner', 'manager']);

  return (
    (data ?? []) as unknown as Array<{
      business_id: string;
      member_role: string;
      business: { full_name: string | null; company_name: string | null } | null;
    }>
  ).map((m) => ({
    business_id: m.business_id,
    business_name: m.business?.company_name || m.business?.full_name || 'Kurum',
  }));
}

/**
 * Kullanıcı verilen kurumda owner/manager mı? (kurum adına yazma yetkisi)
 * Action katmanında on_behalf_business_id doğrulaması için.
 */
export async function canWriteForBusiness(
  businessId: string
): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: membership } = await supabase
    .from('business_members')
    .select('member_role')
    .eq('business_id', businessId)
    .eq('member_user_id', user.id)
    .maybeSingle();

  return (
    membership?.member_role === 'owner' ||
    membership?.member_role === 'manager'
  );
}
