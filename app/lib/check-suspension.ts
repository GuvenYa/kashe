import { createClient } from '@/app/lib/supabase-server';
import { SuspendedNotice } from '@/app/components/suspended-notice';

/**
 * Askıya alınmış kullanıcı kontrolü.
 *
 * Login akışından sonra (sign-in action veya middleware'da) çağrılır:
 *   const isSuspended = await isUserSuspended(userId);
 *   if (isSuspended) redirect('/askiya-alindi');
 *
 * Server action'larda (mesaj gönderme, teklif verme vb.) çağrılır:
 *   const suspended = await isUserSuspended(userId);
 *   if (suspended) return { success: false, error: 'Hesabın askıya alındı.' };
 */
export async function isUserSuspended(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', userId)
    .single();

  return !!data?.suspended_at;
}

/**
 * Mevcut kullanıcının askıda olup olmadığını döner.
 * Giriş yapmamışsa false döner.
 */
export async function isCurrentUserSuspended(): Promise<{
  userId: string | null;
  suspended: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null, suspended: false };
  }

  const { data } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();

  return { userId: user.id, suspended: !!data?.suspended_at };
}
