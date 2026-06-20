import { cache } from 'react';
import { createClient } from './supabase-server';

/**
 * Request başına TEK auth.getUser() çağrısı.
 *
 * React cache() aynı render geçişinde (tek HTTP isteği) sonucu paylaşır:
 * TopNav + sayfa + alt bileşenler hepsi getCachedUser() çağırsa bile
 * Supabase'e yalnızca 1 istek gider. Bu, 429 over_request_rate_limit'i
 * ve her sayfadaki gereksiz auth gecikmesini ortadan kaldırır.
 *
 * NOT: Server action'lar ayrı request'tir — cache her action çağrısında
 * yeniden başlar (bu doğru davranış; action içinde tekrar varsa paylaşır).
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});