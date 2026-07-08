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

/**
 * Kullanıcı verilen kurumda 'owner' ROLÜNDE mi? (owner-only aksiyonlar:
 * ilan silme, close/cancel, promotion, kurum adına yorum). manager YETMEZ.
 */
export async function canOwnForBusiness(businessId: string): Promise<boolean> {
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

  return membership?.member_role === 'owner';
}

/**
 * Kullanıcının 'owner' rolünde olduğu kurumların id'leri (kurum adına yorum
 * bağlamını çözmek için — self konuşma yoksa owner kurumların konuşması aranır).
 */
export async function getOwnedBusinessIds(): Promise<string[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('member_user_id', user.id)
    .eq('member_role', 'owner');

  return (data ?? []).map((m) => m.business_id);
}

/**
 * Kurumsal ekip bağlamı — TEK sorguda üyelik id'leri + rol setleri. Sayfalarda
 * kopyalanan "business_members çek + filtrele" bloğunu (5+ yer) tek kaynağa taşır.
 *
 * - teamBusinessIds: üyesi olunan TÜM kurumlar (owner/manager/member) — okuma
 *   görünürlüğü. Kurum-kendine-üyelik DB'de imkânsız (no_self_business_membership),
 *   o yüzden ayrıca filtre gerekmez.
 * - canWriteSet: owner+manager (kurum adına yazma / yönetim — edit/publish/composer).
 * - canOwnSet: yalnız owner (owner-only aksiyonlar — silme/close/cancel/promotion).
 */
export async function getTeamContext(): Promise<{
  teamBusinessIds: string[];
  canWriteSet: Set<string>;
  canOwnSet: Set<string>;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      teamBusinessIds: [],
      canWriteSet: new Set<string>(),
      canOwnSet: new Set<string>(),
    };
  }

  const { data } = await supabase
    .from('business_members')
    .select('business_id, member_role')
    .eq('member_user_id', user.id);

  const memberships = (data ?? []) as Array<{
    business_id: string;
    member_role: string;
  }>;

  return {
    teamBusinessIds: memberships.map((m) => m.business_id),
    canWriteSet: new Set(
      memberships
        .filter(
          (m) => m.member_role === 'owner' || m.member_role === 'manager'
        )
        .map((m) => m.business_id)
    ),
    canOwnSet: new Set(
      memberships
        .filter((m) => m.member_role === 'owner')
        .map((m) => m.business_id)
    ),
  };
}
