'use server';

import { createClient } from '@/app/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  getCategoryFields,
  MODULE_REGISTRY,
  SERVICE_REGION_OPTIONS,
  CALISMA_SEKLI_OPTIONS,
  FOLLOWERS_RANGES,
  type ModuleKey,
} from '@/app/lib/category-fields';

export type SaveResult = { success: boolean; error?: string };

const TAGLINE_KEYS = ['hakkimda', 'hizmetler', 'deneyim', 'egitim'] as const;

/** URL/bağlantı/handle içeren değer reddedilir (SIRA1 + C5). */
function hasLink(s: string): boolean {
  return /(https?:\/\/|www\.|[\w-]+\.(com|net|org|io|co|me|tv|ly|gg|app|dev|xyz)\b|@[\w.]+)/i.test(
    s
  );
}
function cleanStr(v: unknown, max = 300): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  if (hasLink(t)) throw new Error('Bağlantı/URL içeren alanlar kabul edilmez.');
  return t.slice(0, max);
}
function cleanArr(v: unknown, maxRows = 40, itemMax = 120): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const c = cleanStr(item, itemMax);
    if (c) out.push(c);
    if (out.length >= maxRows) break;
  }
  return out;
}
function cleanKV(v: unknown, maxRows = 20): Record<string, string> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, string> = {};
  let n = 0;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const ck = cleanStr(k, 60);
    const cv = cleanStr(val, 200);
    if (ck && cv) {
      out[ck] = cv;
      n++;
    }
    if (n >= maxRows) break;
  }
  return out;
}

/**
 * category_attributes kaydı — WHITELIST MERGE (C5).
 * Server, izinli anahtarları KULLANICININ KATEGORİ PRESET'inden türetir (client'a güvenmez):
 *  - Ortak alanlar (service_region/experience_label/logistics/skills/section_taglines)
 *  - quick: yalnız preset.quickInfo anahtarları
 *  - modules: yalnız preset.modules; her modülün alanları MODULE_REGISTRY'den; belge (documents) formda yok
 *  - summary: yalnız uzmanlik arketipinde
 * Bilinmeyen anahtar ATILIR; link/URL değeri SAVE'i reddeder; kısmi kayıt (gönderilmeyen korunur).
 */
export async function saveCategoryAttributes(
  payload: Record<string, unknown>
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Oturum bulunamadı.' };

  const { data: prof } = await supabase
    .from('profiles')
    .select(
      'role, category_attributes, service_categories!profiles_primary_category_id_fkey(slug)'
    )
    .eq('id', user.id)
    .single();
  if (!prof) return { success: false, error: 'Profil bulunamadı.' };
  if (prof.role !== 'professional')
    return { success: false, error: 'Bu işlem yalnız profesyonel hesaplarda.' };

  const slug =
    (prof.service_categories as unknown as { slug: string } | null)?.slug ??
    null;
  const preset = getCategoryFields(slug);
  if (!preset)
    return { success: false, error: 'Kategori bilgisi bulunamadı.' };

  const current = (prof.category_attributes ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current };

  try {
    // service_region (select — sabit liste veya boş)
    if ('service_region' in payload) {
      const v = payload.service_region;
      next.service_region =
        typeof v === 'string' &&
        (SERVICE_REGION_OPTIONS as readonly string[]).includes(v)
          ? v
          : undefined;
    }
    // experience_label (serbest metin)
    if ('experience_label' in payload) {
      next.experience_label = cleanStr(payload.experience_label, 120) ?? undefined;
    }
    // calisma_sekli — ORTAK alan (select: sabit liste veya boş)
    if ('calisma_sekli' in payload) {
      const v = payload.calisma_sekli;
      next.calisma_sekli =
        typeof v === 'string' &&
        (CALISMA_SEKLI_OPTIONS as readonly string[]).includes(v)
          ? v
          : undefined;
    }
    // logistics (preset.logisticsChecks anahtarları, yalnız true)
    if (
      'logistics' in payload &&
      payload.logistics &&
      typeof payload.logistics === 'object'
    ) {
      const allowed = new Set(preset.logisticsChecks.map((c) => c.key));
      const out: Record<string, boolean> = {};
      for (const [k, val] of Object.entries(
        payload.logistics as Record<string, unknown>
      )) {
        if (allowed.has(k) && val === true) out[k] = true;
      }
      next.logistics = out;
    }
    // skills ([{name, level}] — seviye yalnız skillsWithLevels)
    if ('skills' in payload && Array.isArray(payload.skills)) {
      const out: { name: string; level: number }[] = [];
      for (const s of payload.skills as { name?: unknown; level?: unknown }[]) {
        const name = cleanStr(s?.name, 60);
        if (!name) continue;
        let level = 0;
        if (preset.skillsWithLevels) {
          const l = Number(s?.level);
          level = l >= 1 && l <= 3 ? Math.round(l) : 0;
        }
        out.push({ name, level });
        if (out.length >= 30) break;
      }
      next.skills = out;
    }
    // section_taglines (izinli anahtarlar)
    if (
      'section_taglines' in payload &&
      payload.section_taglines &&
      typeof payload.section_taglines === 'object'
    ) {
      const src = payload.section_taglines as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const k of TAGLINE_KEYS) {
        const v = cleanStr(src[k], 200);
        if (v) out[k] = v;
      }
      next.section_taglines = out;
    }
    // quick (yalnız preset.quickInfo anahtarları) — kısmi merge
    if ('quick' in payload && payload.quick && typeof payload.quick === 'object') {
      const allowed = new Set(preset.quickInfo);
      const out: Record<string, string> = {
        ...((current.quick as Record<string, string>) ?? {}),
      };
      for (const [k, val] of Object.entries(
        payload.quick as Record<string, unknown>
      )) {
        if (!allowed.has(k)) continue;
        const v = cleanStr(val, 120);
        if (v) out[k] = v;
        else delete out[k];
      }
      next.quick = out;
    }
    // summary (yalnız uzmanlik)
    if (
      'summary' in payload &&
      preset.archetype === 'uzmanlik' &&
      payload.summary &&
      typeof payload.summary === 'object'
    ) {
      const s = payload.summary as {
        title?: unknown;
        body?: unknown;
        stats?: unknown;
      };
      // C1 — stat çipi TEK metin (string[]); en fazla 3.
      const stats: string[] = [];
      if (Array.isArray(s.stats)) {
        for (const st of s.stats as unknown[]) {
          const v = cleanStr(st, 60);
          if (v) stats.push(v);
          if (stats.length >= 3) break;
        }
      }
      next.summary = {
        title: cleanStr(s.title, 100) ?? undefined,
        body: cleanStr(s.body, 600) ?? undefined,
        stats,
      };
    }
    // modules (yalnız preset.modules; alanlar MODULE_REGISTRY'den) — kısmi merge
    if (
      'modules' in payload &&
      payload.modules &&
      typeof payload.modules === 'object'
    ) {
      const allowedModules = new Set<ModuleKey>(preset.modules.map((m) => m.key));
      const outModules: Record<string, unknown> = {
        ...((current.modules as Record<string, unknown>) ?? {}),
      };
      for (const [mkey, mdata] of Object.entries(
        payload.modules as Record<string, unknown>
      )) {
        if (!allowedModules.has(mkey as ModuleKey)) continue;
        const def = MODULE_REGISTRY[mkey as ModuleKey];
        if (!def || !mdata || typeof mdata !== 'object') continue;
        const md = mdata as Record<string, unknown>;
        const sanitized: Record<string, unknown> = {};
        for (const field of def.fields) {
          if (field.type === 'documents') continue; // C4 — belge formda yok
          const raw = md[field.key];
          if (raw === undefined) continue;
          switch (field.type) {
            case 'chips':
            case 'bullet_list':
              sanitized[field.key] = cleanArr(raw);
              break;
            case 'language_pairs':
              sanitized[field.key] = cleanArr(raw, 20, 80);
              break;
            case 'text': {
              const v = cleanStr(raw, 600);
              if (v) sanitized[field.key] = v;
              break;
            }
            case 'physical': {
              const v = cleanStr(raw, 60);
              if (v) sanitized[field.key] = v;
              break;
            }
            case 'age_range': {
              // "min–max" — yalnız rakam + ayraç (kesin yaş/serbest metin YOK).
              const v = cleanStr(raw, 20);
              if (v && /^\d{0,3}\s*[–-]\s*\d{0,3}$/.test(v)) {
                sanitized[field.key] = v;
              }
              break;
            }
            case 'key_value':
              sanitized[field.key] = cleanKV(raw);
              break;
            case 'social_reach': {
              if (Array.isArray(raw)) {
                const plats: { platform: string; followers_range: string }[] = [];
                for (const p of raw as {
                  platform?: unknown;
                  followers_range?: unknown;
                }[]) {
                  const platform = cleanStr(p?.platform, 40);
                  const fr =
                    typeof p?.followers_range === 'string' &&
                    (FOLLOWERS_RANGES as readonly string[]).includes(
                      p.followers_range
                    )
                      ? p.followers_range
                      : null;
                  if (platform && fr)
                    plats.push({ platform, followers_range: fr });
                  if (plats.length >= 10) break;
                }
                sanitized[field.key] = plats;
              }
              break;
            }
          }
        }
        outModules[mkey] = sanitized;
      }
      next.modules = outModules;
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Geçersiz veri.',
    };
  }

  // undefined anahtarları düşür (JSON.stringify undefined'ı atlar)
  const cleaned = JSON.parse(JSON.stringify(next));

  const { error } = await supabase
    .from('profiles')
    .update({ category_attributes: cleaned })
    .eq('id', user.id);
  if (error) return { success: false, error: 'Kaydedilemedi: ' + error.message };

  revalidatePath('/profil/kategori-bilgileri');
  revalidatePath('/profil');
  revalidatePath(`/p/${user.id}`);
  // Başarılı kayıt → /profil'e dön (NEXT_REDIRECT server action içinde geçerli).
  // Hata durumunda buraya ulaşılmaz; { success:false } döner, form sayfada kalır.
  redirect('/profil');
}
