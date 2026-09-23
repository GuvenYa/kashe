'use server';

import { createClient } from '@/app/lib/supabase-server';
import {
  EVENTSPEC_SCHEMA_VERSION,
  EVENT_WIZARD_PARSER_VERSION,
  type EventSpecProvenance,
  type EventSpecProvenanceEntry,
  type EventSpecSuggestedRole,
  type EventSpecV1,
} from '@/app/lib/eventspec';

/** Formdan gelen tek rol satiri (kategori cipi + adet + zorunluluk). */
export type WizardRoleInput = {
  slug: string;
  quantity: number;
  isRequired: boolean;
};

/** Sihirbaz URL'sindeki degerlerin sunucu karsiligi. */
export type ConfirmEventInput = {
  briefId?: string;
  baseVersionId?: string;
  rawText?: string;
  eventType: string;
  title?: string;
  cityId?: number;
  district?: string;
  startDate?: string;
  endDate?: string;
  isDateFlexible?: boolean;
  participantCount?: number;
  budgetMin?: number;
  budgetMax?: number;
  venueStatus?: 'confirmed' | 'searching' | 'not_needed';
  roles: WizardRoleInput[];
};

export type ConfirmEventResult =
  | { success: true; eventId: string; versionId: string }
  | { success: false; error: string };

/** Taban (AI) surumunun okunan alanlari. */
type TabanSurum = {
  id: string;
  brief_id: string;
  spec_jsonb: EventSpecV1;
  provenance: EventSpecProvenance;
  is_current: boolean;
};

const MEKAN_DEGERLERI = ['confirmed', 'searching', 'not_needed'] as const;

/** YYYY-MM-DD bicimi + gercek takvim gunu (P1'deki ile ayni kural). */
function gecerliGun(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Sihirbazin "Onayla" adimi: form degerlerinden YENI bir EventSpec surumu yazar
 * (ekle-yalniz) ve `create_event_from_spec` RPC'si ile onaylanmis etkinligi olusturur.
 *
 * Uygulama `events` / `event_requirements` tablolarina HIC INSERT yapmaz; tek yol RPC.
 * `version_no`, `is_current`, `created_by_user_id` gonderilmez (tetikleyici verir).
 * `organization_id` gonderilmez (kurulus atfi FAZ 8).
 */
export async function confirmEventFromWizard(
  input: ConfirmEventInput
): Promise<ConfirmEventResult> {
  const supabase = await createClient();

  // 1) Oturum + askiya alinma
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giris yapmalisin.' };

  const { data: profil } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (profil?.suspended_at) {
    return { success: false, error: 'Hesabin askida, etkinlik olusturamazsin.' };
  }

  // 2) Sunucu tarafi dogrulama — RPC'nin kontrolleriyle ayni, mesaji kullaniciya uygun
  const bugun = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
  }).format(new Date());

  const eventType = (input.eventType || '').trim();
  if (!eventType) return { success: false, error: 'Once etkinlik turunu sec.' };

  const { data: turSatiri } = await supabase
    .from('event_types')
    .select('key')
    .eq('key', eventType)
    .eq('is_active', true)
    .maybeSingle();
  if (!turSatiri) return { success: false, error: 'Etkinlik turu gecersiz.' };

  if (input.cityId != null) {
    if (!Number.isInteger(input.cityId) || input.cityId <= 0) {
      return { success: false, error: 'Sehir gecersiz.' };
    }
    const { data: sehirSatiri } = await supabase
      .from('turkish_cities')
      .select('id')
      .eq('id', input.cityId)
      .maybeSingle();
    if (!sehirSatiri) return { success: false, error: 'Sehir gecersiz.' };
  }

  const baslangic = input.startDate?.trim() || undefined;
  const bitis = input.endDate?.trim() || undefined;
  if (baslangic) {
    if (!gecerliGun(baslangic)) {
      return { success: false, error: 'Baslangic tarihi gecersiz.' };
    }
    if (baslangic < bugun) {
      return { success: false, error: 'Baslangic tarihi bugunden once olamaz.' };
    }
  }
  if (bitis) {
    if (!gecerliGun(bitis)) {
      return { success: false, error: 'Bitis tarihi gecersiz.' };
    }
    if (baslangic && bitis < baslangic) {
      return {
        success: false,
        error: 'Bitis tarihi baslangictan once olamaz.',
      };
    }
    if (!baslangic && bitis < bugun) {
      return { success: false, error: 'Bitis tarihi bugunden once olamaz.' };
    }
  }

  if (input.participantCount != null) {
    if (
      !Number.isInteger(input.participantCount) ||
      input.participantCount < 1 ||
      input.participantCount > 100000
    ) {
      return { success: false, error: 'Katilimci sayisi gecersiz (1-100000).' };
    }
  }

  const butceMin = input.budgetMin;
  const butceMax = input.budgetMax;
  if (butceMin != null && (!Number.isFinite(butceMin) || butceMin < 0)) {
    return { success: false, error: 'Butce alt siniri gecersiz.' };
  }
  if (butceMax != null && (!Number.isFinite(butceMax) || butceMax < 0)) {
    return { success: false, error: 'Butce ust siniri gecersiz.' };
  }
  if (butceMin != null && butceMax != null && butceMin > butceMax) {
    return {
      success: false,
      error: 'Butce alt siniri ust sinirdan buyuk olamaz.',
    };
  }

  const baslik = input.title?.trim() || undefined;
  if (baslik && baslik.length > 200) {
    return { success: false, error: 'Baslik en fazla 200 karakter olabilir.' };
  }
  const ilce = input.district?.trim() || undefined;
  if (ilce && ilce.length > 100) {
    return { success: false, error: 'Ilce en fazla 100 karakter olabilir.' };
  }

  if (
    input.venueStatus != null &&
    !MEKAN_DEGERLERI.includes(input.venueStatus)
  ) {
    return { success: false, error: 'Mekan durumu gecersiz.' };
  }

  const roller = input.roles ?? [];
  if (roller.length === 0) {
    return { success: false, error: 'En az bir ihtiyac sec.' };
  }
  const slugKumesi = new Set<string>();
  for (const r of roller) {
    const slug = (r.slug || '').trim();
    if (!slug) return { success: false, error: 'Ihtiyac listesi gecersiz.' };
    if (slugKumesi.has(slug)) {
      return { success: false, error: 'Ayni ihtiyac iki kez secilemez.' };
    }
    slugKumesi.add(slug);
    if (!Number.isInteger(r.quantity) || r.quantity < 1 || r.quantity > 50) {
      return { success: false, error: 'Ihtiyac adedi 1-50 arasinda olmali.' };
    }
  }
  const { data: rolSatirlari } = await supabase
    .from('service_roles')
    .select('slug')
    .in('slug', [...slugKumesi])
    .eq('is_active', true);
  const gecerliSluglar = new Set(
    ((rolSatirlari ?? []) as { slug: string }[]).map((r) => r.slug)
  );
  const eksik = [...slugKumesi].filter((s) => !gecerliSluglar.has(s));
  if (eksik.length > 0) {
    return { success: false, error: 'Secilen ihtiyaclardan biri gecersiz.' };
  }

  // 3) Taban surum (Anlat adimindan geldiyse)
  let taban: TabanSurum | null = null;
  if (input.baseVersionId) {
    const { data, error } = await supabase
      .from('event_spec_versions')
      .select('id, brief_id, spec_jsonb, provenance, is_current')
      .eq('id', input.baseVersionId)
      .maybeSingle();
    if (error || !data) {
      return { success: false, error: 'Analiz bulunamadi, yeniden anlat.' };
    }
    taban = data as unknown as TabanSurum;
    if (!taban.is_current) {
      return { success: false, error: 'Analiz bulunamadi, yeniden anlat.' };
    }
    if (input.briefId && input.briefId !== taban.brief_id) {
      return { success: false, error: 'Analiz bulunamadi, yeniden anlat.' };
    }
  }

  // 4) Brief — yoksa form ozetiyle yeni brief
  let briefId = taban?.brief_id ?? input.briefId ?? null;
  if (!briefId) {
    const { data: turAdiSatiri } = await supabase
      .from('event_types')
      .select('name_tr')
      .eq('key', eventType)
      .maybeSingle();
    let sehirAdi: string | null = null;
    if (input.cityId != null) {
      const { data: sehirAdiSatiri } = await supabase
        .from('turkish_cities')
        .select('name')
        .eq('id', input.cityId)
        .maybeSingle();
      sehirAdi = (sehirAdiSatiri as { name: string } | null)?.name ?? null;
    }
    const ozet = [
      (turAdiSatiri as { name_tr: string } | null)?.name_tr ?? eventType,
      sehirAdi ?? 'sehir belirsiz',
      baslangic ?? 'tarih belirsiz',
      input.participantCount != null
        ? `${input.participantCount} kisi`
        : 'katilimci belirsiz',
      `roller: ${roller.map((r) => r.slug).join(', ')}`,
    ].join(', ');

    const { data: yeniBrief, error: briefErr } = await supabase
      .from('event_briefs')
      .insert({
        created_by_user_id: user.id,
        source: 'client_web',
        raw_text: `[form] ${ozet}`,
      })
      .select('id')
      .single();
    if (briefErr || !yeniBrief) {
      console.error('[eventspec] brief kaydi', briefErr);
      return { success: false, error: 'Kayit yapilamadi, tekrar dene.' };
    }
    briefId = (yeniBrief as { id: string }).id;
  }

  // 5) Yeni spec + provenance
  const bugunIso = new Date().toISOString();
  const tabanSpec: EventSpecV1 = taban?.spec_jsonb ?? {};
  const tabanProv: EventSpecProvenance = taban?.provenance ?? {};
  const spec: EventSpecV1 = {};
  const provenance: EventSpecProvenance = {};

  const kullaniciGirdisi: EventSpecProvenanceEntry = {
    source: 'user_input',
    confidence: 1,
    asked_at: bugunIso,
  };

  /**
   * Alani yazar. Taban surumde ayni alan VAR ve degeri ESIT ise taban provenance
   * girdisi aynen tasinir (kullanici dokunmamis demektir); degilse `user_input`.
   */
  function yaz<K extends keyof EventSpecV1>(
    alan: K,
    deger: NonNullable<EventSpecV1[K]>
  ): void {
    spec[alan] = deger;
    const eski = tabanSpec[alan];
    const tabanGirdisi = tabanProv[alan];
    provenance[alan] =
      eski !== undefined && eski === deger && tabanGirdisi
        ? tabanGirdisi
        : kullaniciGirdisi;
  }

  yaz('event_type', eventType);
  if (baslik) yaz('title', baslik);
  if (input.cityId != null) yaz('city_id', input.cityId);
  if (ilce) yaz('district', ilce);
  if (baslangic) yaz('start_date', baslangic);
  if (bitis) yaz('end_date', bitis);
  // false = varsayilan; yazilmaz (06 bolum 1: bilinmeyen/bos alan yazilmaz)
  if (input.isDateFlexible === true) yaz('is_date_flexible', true);
  if (input.participantCount != null) {
    yaz('participant_count', input.participantCount);
  }
  if (butceMin != null) yaz('budget_min', butceMin);
  if (butceMax != null) yaz('budget_max', butceMax);
  if (input.venueStatus) yaz('venue_status', input.venueStatus);

  // Roller — form sirasi korunur; `reason` taban surumdeki ayni slug'dan gelir.
  const tabanRoller = (tabanSpec.suggested_roles ?? []) as EventSpecSuggestedRole[];
  const tabanRolHarita = new Map(tabanRoller.map((r) => [r.slug, r]));
  const yeniRoller: EventSpecSuggestedRole[] = roller.map((r) => {
    const tabanRol = tabanRolHarita.get(r.slug);
    return {
      slug: r.slug,
      ...(tabanRol?.reason ? { reason: tabanRol.reason } : {}),
      quantity: r.quantity,
      is_required: r.isRequired,
    } as EventSpecSuggestedRole;
  });
  spec.suggested_roles = yeniRoller;
  // Taban ile birebir ayni mi (slug kumesi + adet + zorunluluk)? Taban surumde adet ve
  // zorunluluk yazilmaz; RPC varsayilani olan 1/true ile karsilastirilir.
  const rollerAyni =
    tabanRoller.length === yeniRoller.length &&
    yeniRoller.every((r) => {
      const t = tabanRolHarita.get(r.slug);
      if (!t) return false;
      return (t.quantity ?? 1) === r.quantity && (t.is_required ?? true) === r.is_required;
    });
  provenance.suggested_roles =
    rollerAyni && tabanProv.suggested_roles
      ? tabanProv.suggested_roles
      : kullaniciGirdisi;

  // Tabandan tasinanlar — formda karsiligi olmayan alanlar
  if (tabanSpec.urgency) {
    spec.urgency = tabanSpec.urgency;
    if (tabanProv.urgency) provenance.urgency = tabanProv.urgency;
  }
  if (tabanSpec.tip) {
    spec.tip = tabanSpec.tip;
    if (tabanProv.tip) provenance.tip = tabanProv.tip;
  }
  if (tabanSpec.extra) {
    // `extra.error` tasinmaz (hata kaydi yeni surume gecmez)
    const { error: _hata, ...kalan } = tabanSpec.extra as Record<string, unknown>;
    void _hata;
    if (Object.keys(kalan).length > 0) spec.extra = kalan;
  }

  // 6) Surum INSERT (ekle-yalniz; model yok -> model_id/prompt_version gonderilmez)
  const { data: yeniSurum, error: surumErr } = await supabase
    .from('event_spec_versions')
    .insert({
      brief_id: briefId,
      spec_jsonb: spec,
      provenance,
      schema_version: EVENTSPEC_SCHEMA_VERSION,
      parser_version: EVENT_WIZARD_PARSER_VERSION,
      validation_status: 'valid',
    })
    .select('id')
    .single();
  if (surumErr || !yeniSurum) {
    console.error('[eventspec] surum kaydi', surumErr);
    return { success: false, error: 'Kayit yapilamadi, tekrar dene.' };
  }
  const versionId = (yeniSurum as { id: string }).id;

  // 7) Onay — tek yol RPC
  const { data, error } = await supabase.rpc('create_event_from_spec', {
    p_version_id: versionId,
  });
  if (error) {
    console.error('[eventspec] onay', error);
    const kod = error.code;
    if (kod === '23505') {
      return { success: false, error: 'Bu analiz zaten onaylanmis.' };
    }
    if (kod === '42501') {
      return { success: false, error: 'Bu etkinligi onaylama yetkin yok.' };
    }
    if (kod === '22023') {
      return {
        success: false,
        error: 'Etkinlik bilgileri gecersiz: ' + error.message,
      };
    }
    if (kod === '23514') {
      return { success: false, error: 'Tarih veya butce araligi gecersiz.' };
    }
    return {
      success: false,
      error: 'Onay sirasinda bir sorun oldu, tekrar dene.',
    };
  }

  return { success: true, eventId: data as string, versionId };
}
