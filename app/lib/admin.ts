import { createClient } from '@/app/lib/supabase-server';

// Mevcut kullanıcı admin mi? Değilse null user / false döner.
export async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isAdmin: false };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, is_admin')
    .eq('id', user.id)
    .single();

  return {
    user,
    isAdmin: profile?.is_admin === true,
    profile: profile ?? null,
  };
}