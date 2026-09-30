'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { sendAccountEmail } from '@/app/lib/email/account-emails';
import { havuzDavetEmail } from '@/app/lib/email/talent-invite-email';
import {
  DURUM_SECENEKLERI,
  ILISKI_SECENEKLERI,
  type HavuzDurum,
  type HavuzIliskiTuru,
  type HavuzRolGirdisi,
} from './havuz-data';

/**
 * FAZ 5 / P1 — yetenek havuzu sunucu eylemleri.
 *
 * Yazim DOGRUDAN tablo INSERT/UPDATE/DELETE ile olur; yetkiyi RLS zorlar
 * (`talent.manage` + `talent_pool` modulu). Yine de `has_org_permission` sunucuda
 * kontrol edilir — kullaniciya "yetkin yok" mesajini duzgun verebilmek icin.
 *
 * Istemciden YAZILMAYAN alanlar: `visibility` (varsayilan private; CHECK),
 * `invitation_*` (yalniz `send_talent_record_invitation` RPC'si),
 * `legacy_agency_member_id`, `created_by` (tetikleyici) ve `organization_id` (UPDATE'te).
 */

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

type HavuzEklemeGirdisi = {
  organizationId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  cityId?: number | null;
  instagram?: string | null;
  notes?: string | null;
  relationshipType: HavuzIliskiTuru;
  /** "Kashe uyesi olarak bagla" secildiyse `find_talent_by_contact`'ten donen id. */
  talentId?: string | null;
  roles: HavuzRolGirdisi[];
};

type HavuzGuncellemeGirdisi = {
  recordId: string;
  organizationId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  cityId?: number | null;
  instagram?: string | null;
  notes?: string | null;
  relationshipType: HavuzIliskiTuru;
  status: HavuzDurum;
};

const ILISKI_TURLERI: readonly HavuzIliskiTuru[] = ILISKI_SECENEKLERI;
const DURUMLAR: readonly HavuzDurum[] = DURUM_SECENEKLERI;

/** Sunucu tarafi yetki kontrolu — mesaj kalitesi icin (asil kapi RLS). */
async function yonetebilirMi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_org_permission', {
    p_org_id: organizationId,
    p_permission: 'talent.manage',
  });
  if (error) {
    console.error('[havuz] yetki kontrolu', error);
    return false;
  }
  return data === true;
}

function metin(v: string | null | undefined, enFazla: number): string | null {
  const t = (v ?? '').trim();
  if (!t) return null;
  return t.slice(0, enFazla);
}

/** Rol listesi gecerli mi: en fazla bir birincil, tekil rol id'leri. */
function rolleriDogrula(roles: HavuzRolGirdisi[]): string | null {
  const idler = new Set<number>();
  let birincil = 0;
  for (const r of roles) {
    if (!Number.isInteger(r.roleId) || r.roleId <= 0) return 'Rol secimi gecersiz.';
    if (idler.has(r.roleId)) return 'Ayni rol iki kez secilemez.';
    idler.add(r.roleId);
    if (r.isPrimary) birincil++;
  }
  if (birincil > 1) return 'Yalniz bir rol birincil olabilir.';
  return null;
}

/** Roller: once tumu silinir, sonra birincil OLMAYANLAR, en son birincil yazilir. */
async function rolleriYaz(
  supabase: Awaited<ReturnType<typeof createClient>>,
  recordId: string,
  roles: HavuzRolGirdisi[]
): Promise<string | null> {
  const { error: silmeHatasi } = await supabase
    .from('organization_talent_record_roles')
    .delete()
    .eq('record_id', recordId);
  if (silmeHatasi) {
    console.error('[havuz] rol silme', silmeHatasi);
    return 'Roller guncellenemedi.';
  }
  if (roles.length === 0) return null;

  // Tek birincil kismi indeksi var: birincili en sona birak.
  const sirali = [...roles].sort(
    (a, b) => Number(a.isPrimary) - Number(b.isPrimary)
  );
  const { error: eklemeHatasi } = await supabase
    .from('organization_talent_record_roles')
    .insert(
      sirali.map((r) => ({
        record_id: recordId,
        role_id: r.roleId,
        is_primary: r.isPrimary,
      }))
    );
  if (eklemeHatasi) {
    console.error('[havuz] rol ekleme', eklemeHatasi);
    if (eklemeHatasi.code === '23505') {
      return 'Roller cakisti (tek birincil rol olabilir).';
    }
    return 'Roller kaydedilemedi.';
  }
  return null;
}

/** Kimlik esleme — YALNIZ bu RPC; profiles/talents e-postayla taranmaz. */
export async function lookupTalentByContact(input: {
  organizationId: string;
  email?: string | null;
  phone?: string | null;
}): Promise<ActionResult<{ talentId: string; matchKind: string } | null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giris yapmalisin.' };

  const email = metin(input.email, 200);
  const phone = metin(input.phone, 40);
  if (!email && !phone) return { success: true, data: null };

  const { data, error } = await supabase.rpc('find_talent_by_contact', {
    p_org_id: input.organizationId,
    p_email: email,
    p_phone: phone,
  });
  if (error) {
    console.error('[havuz] kimlik esleme', error);
    if (error.code === '42501') {
      return { success: false, error: 'Bu kurulusta arama yetkin yok.' };
    }
    return { success: false, error: 'Esleme yapilamadi.' };
  }

  const satirlar = (data ?? []) as { talent_id: string; match_kind: string }[];
  if (satirlar.length === 0) return { success: true, data: null };
  return {
    success: true,
    data: { talentId: satirlar[0].talent_id, matchKind: satirlar[0].match_kind },
  };
}

export async function addTalentRecord(
  input: HavuzEklemeGirdisi
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giris yapmalisin.' };

  const ad = metin(input.name, 200);
  if (!ad) return { success: false, error: 'Ad zorunlu.' };
  if (!ILISKI_TURLERI.includes(input.relationshipType)) {
    return { success: false, error: 'Iliski turu gecersiz.' };
  }
  const rolHatasi = rolleriDogrula(input.roles ?? []);
  if (rolHatasi) return { success: false, error: rolHatasi };

  if (!(await yonetebilirMi(supabase, input.organizationId))) {
    return { success: false, error: 'Bu kurulusta havuzu yonetme yetkin yok.' };
  }

  const bagli = !!input.talentId;
  const { data: kayit, error } = await supabase
    .from('organization_talent_records')
    .insert({
      organization_id: input.organizationId,
      talent_id: input.talentId ?? null,
      name: ad,
      email: metin(input.email, 200),
      phone: metin(input.phone, 40),
      city_id: input.cityId ?? null,
      instagram: metin(input.instagram, 100),
      notes: metin(input.notes, 4000),
      // talent_id dolu iken CHECK external_manual'i yasaklar.
      source: bagli ? 'marketplace_linked' : 'external_manual',
      relationship_type: input.relationshipType,
      status: 'active',
    })
    .select('id')
    .single();

  if (error || !kayit) {
    console.error('[havuz] kayit ekleme', error);
    if (error?.code === '23505') {
      return { success: false, error: 'Bu kisi havuzda zaten var.' };
    }
    if (error?.code === '42501') {
      return { success: false, error: 'Bu kurulusta havuzu yonetme yetkin yok.' };
    }
    return { success: false, error: 'Kayit eklenemedi, tekrar dene.' };
  }

  const recordId = (kayit as { id: string }).id;
  const rolYazmaHatasi = await rolleriYaz(supabase, recordId, input.roles ?? []);
  revalidatePath('/ajans/havuz');
  if (rolYazmaHatasi) return { success: false, error: rolYazmaHatasi };
  return { success: true, data: { id: recordId } };
}

export async function updateTalentRecord(
  input: HavuzGuncellemeGirdisi
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giris yapmalisin.' };

  const ad = metin(input.name, 200);
  if (!ad) return { success: false, error: 'Ad zorunlu.' };
  if (!ILISKI_TURLERI.includes(input.relationshipType)) {
    return { success: false, error: 'Iliski turu gecersiz.' };
  }
  if (!DURUMLAR.includes(input.status)) {
    return { success: false, error: 'Durum gecersiz.' };
  }
  if (!(await yonetebilirMi(supabase, input.organizationId))) {
    return { success: false, error: 'Bu kurulusta havuzu yonetme yetkin yok.' };
  }

  // `talent_id` ve `organization_id` istemciden DEGISTIRILMEZ.
  const { error } = await supabase
    .from('organization_talent_records')
    .update({
      name: ad,
      email: metin(input.email, 200),
      phone: metin(input.phone, 40),
      city_id: input.cityId ?? null,
      instagram: metin(input.instagram, 100),
      notes: metin(input.notes, 4000),
      relationship_type: input.relationshipType,
      status: input.status,
    })
    .eq('id', input.recordId)
    .eq('organization_id', input.organizationId);

  if (error) {
    console.error('[havuz] kayit guncelleme', error);
    if (error.code === '42501') {
      return { success: false, error: 'Bu kurulusta havuzu yonetme yetkin yok.' };
    }
    return { success: false, error: 'Kayit guncellenemedi.' };
  }
  revalidatePath('/ajans/havuz');
  return { success: true };
}

export async function setTalentRecordRoles(input: {
  recordId: string;
  organizationId: string;
  roles: HavuzRolGirdisi[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giris yapmalisin.' };

  const rolHatasi = rolleriDogrula(input.roles ?? []);
  if (rolHatasi) return { success: false, error: rolHatasi };
  if (!(await yonetebilirMi(supabase, input.organizationId))) {
    return { success: false, error: 'Bu kurulusta havuzu yonetme yetkin yok.' };
  }

  const hata = await rolleriYaz(supabase, input.recordId, input.roles ?? []);
  revalidatePath('/ajans/havuz');
  if (hata) return { success: false, error: hata };
  return { success: true };
}

export async function deleteTalentRecord(input: {
  recordId: string;
  organizationId: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giris yapmalisin.' };

  if (!(await yonetebilirMi(supabase, input.organizationId))) {
    return { success: false, error: 'Bu kurulusta havuzu yonetme yetkin yok.' };
  }

  // Kashe uyesi (talent_id dolu) kayit BURADAN silinmez — Ekibim'den yonetilir.
  const { data: kayit } = await supabase
    .from('organization_talent_records')
    .select('id, talent_id')
    .eq('id', input.recordId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (!kayit) return { success: false, error: 'Kayit bulunamadi.' };
  if ((kayit as { talent_id: string | null }).talent_id) {
    return {
      success: false,
      error: 'Kashe uyesi kayitlari Ekibim uzerinden yonetilir.',
    };
  }

  const { error } = await supabase
    .from('organization_talent_records')
    .delete()
    .eq('id', input.recordId)
    .eq('organization_id', input.organizationId);

  if (error) {
    console.error('[havuz] kayit silme', error);
    return { success: false, error: 'Kayit silinemedi.' };
  }
  revalidatePath('/ajans/havuz');
  return { success: true };
}

/**
 * Davet: token'i RPC uretir (`invitation_status = sent`, 14 gun), e-postayi uygulama yollar.
 * Token sutunu istemciye kapali oldugu icin DONEN deger yalniz burada kullanilir.
 */
export async function sendTalentInvitation(input: {
  recordId: string;
  organizationId: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giris yapmalisin.' };

  const { data: token, error } = await supabase.rpc(
    'send_talent_record_invitation',
    { p_record_id: input.recordId }
  );

  if (error) {
    console.error('[havuz] davet rpc', error);
    if (error.code === '42501') {
      return { success: false, error: 'Davet gonderme yetkin yok.' };
    }
    if (error.code === '22023') {
      return {
        success: false,
        error:
          'Davet gonderilemez: kayitta e-posta yok, kisi zaten bagli ya da engelli.',
      };
    }
    return { success: false, error: 'Davet olusturulamadi, tekrar dene.' };
  }

  // E-posta icerigi icin kayit + kurulus adi + roller
  const { data: kayit } = await supabase
    .from('organization_talent_records')
    .select(
      'id, name, email, organization_id, organization_talent_record_roles(role_id, is_primary, service_roles(name_tr))'
    )
    .eq('id', input.recordId)
    .maybeSingle();

  const { data: kurulus } = await supabase
    .from('organizations')
    .select('display_name')
    .eq('id', input.organizationId)
    .maybeSingle();

  type KayitSatiri = {
    name: string;
    email: string | null;
    organization_talent_record_roles: {
      role_id: number;
      is_primary: boolean;
      service_roles: { name_tr: string } | null;
    }[] | null;
  };
  const k = kayit as unknown as KayitSatiri | null;
  const adres = k?.email ?? null;
  if (!adres) {
    // RPC zaten e-posta sart kosuyor; buraya dusmek beklenmez.
    revalidatePath('/ajans/havuz');
    return { success: false, error: 'Kayitta e-posta yok.' };
  }

  const roller = (k?.organization_talent_record_roles ?? [])
    .map((r) => r.service_roles?.name_tr)
    .filter((v): v is string => !!v);

  const icerik = havuzDavetEmail({
    organizationName:
      (kurulus as { display_name: string | null } | null)?.display_name?.trim() ||
      'Kashe kurulusu',
    recipientName: k?.name ?? null,
    roleLabels: roller,
    token: token as string,
  });

  const sonuc = await sendAccountEmail({
    to: adres,
    subject: icerik.subject,
    html: icerik.html,
    text: icerik.text,
  });

  revalidatePath('/ajans/havuz');
  if (!sonuc.sent) {
    // RPC kaydi `sent` yapti: panelde "Gonderildi" gorunur ama e-posta cikmadi.
    // Tekrar cagrilirsa YENI token uretilir, eski gecersiz olur.
    console.error('[havuz] davet e-postasi', sonuc.reason);
    return { success: false, error: 'E-posta gonderilemedi, tekrar dene.' };
  }
  return { success: true };
}
