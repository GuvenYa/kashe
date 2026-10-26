import 'server-only';

import { createClient } from '@/app/lib/supabase-server';
import type { BilesenVerisi, ItirazDurumu } from '@/app/lib/guven';

/**
 * GUVEN DOKUMU — sunucu okuma katmani (FAZ 9c).
 *
 * `import 'server-only'`: bu modul bir istemci bilesenine import edilirse
 * DERLEME HATASI verir (projede `ai-actions.ts`, `fiyat-kiyas-data.ts` ayni
 * deseni kullaniyor).
 *
 * `trust_score_snapshots` TABLOSU BURADAN DA OKUNMAZ: tek yol
 * `my_trust_breakdown`. Yetki kontrolu (kendi saglayicisi ya da ajansta
 * `settings.manage`) DB'de, `fn_faz9c_provider_yetkisi` icinde — uygulama
 * tekrarlamaz.
 *
 * HATA SESSIZ: 42501 (yetki yok) beklenen bir durum — ajans uyesi
 * `settings.manage` degilse dokum gormez. `null` doner ve kart cizilmez;
 * `console.error` ile gurultu yapilmaz.
 */

export type GuvenAnlik = {
  id: string;
  score: number;
  computed_at: string;
  algorithm_version: string;
  components: BilesenVerisi;
};

export type GuvenItirazi = {
  id: string;
  status: ItirazDurumu;
  message: string;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  snapshot_id: string | null;
};

export type GuvenDokumu = {
  provider_id: string;
  /** Saglayici yayinda mi; `false` ise skor HESAPLANMAZ. */
  visible: boolean;
  snapshot: GuvenAnlik | null;
  appeal: GuvenItirazi | null;
};

export async function guvenDokumu(
  providerId?: string
): Promise<GuvenDokumu | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    'my_trust_breakdown',
    providerId ? { p_provider: providerId } : {}
  );
  if (error || !data) return null;

  const d = data as unknown as GuvenDokumu & {
    snapshot: (Omit<GuvenAnlik, 'score'> & { score: number | string }) | null;
  };

  // `numeric(5,2)` PostgREST'ten METIN gelebilir; gosterim sayiyla yapilir.
  const skor = d.snapshot ? Number(d.snapshot.score) : null;
  return {
    provider_id: d.provider_id,
    visible: !!d.visible,
    snapshot:
      d.snapshot && skor !== null && Number.isFinite(skor)
        ? { ...d.snapshot, score: skor }
        : null,
    appeal: d.appeal ?? null,
  };
}
