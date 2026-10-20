'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { gorevHataMetni } from '@/app/lib/gorevler';

/**
 * FAZ 8a — kurulus modulunu ac/kapat.
 *
 * Yalniz RPC ile: `org_module_set` `settings.manage` kontrolunu yapar,
 * `internal.log_access` ile denetim satirini yazar ve acilabilir modul listesini
 * (tasks / crm / suppliers) kendisi sinirlar. Uygulama `organization_modules`
 * tablosuna YAZMAZ — yetkisi de yok.
 */
export type ModulSonucu = { ok: true; acik: boolean } | { ok: false; hata: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Arayuzden acilabilen moduller — RPC ayni listeyi DB tarafinda zorluyor. */
const ACILABILIR = ['tasks', 'crm', 'suppliers'] as const;

export async function modulAyarla(
  orgId: string,
  modulAnahtari: string,
  acik: boolean
): Promise<ModulSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!UUID.test(orgId)) return { ok: false, hata: 'Kuruluş seçimi geçersiz.' };
  if (!ACILABILIR.includes(modulAnahtari as never)) {
    return { ok: false, hata: 'Bu modül buradan açılamaz.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('org_module_set', {
    p_org_id: orgId,
    p_module_key: modulAnahtari,
    p_enabled: acik,
  });

  if (error) {
    console.error('[modul] ayarla', error.code, error.message);
    return { ok: false, hata: gorevHataMetni(error) };
  }

  revalidatePath('/kurumsal/ayarlar');
  revalidatePath('/kurulus/gorevler');
  revalidatePath('/kurumsal');
  revalidatePath('/ajans');
  return { ok: true, acik };
}
