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

const UUID_KALIBI =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (!Number.isInteger(r.roleId) || r.roleId <= 0) return 'Rol seçimi geçersiz.';
    if (idler.has(r.roleId)) return 'Aynı rol iki kez seçilemez.';
    idler.add(r.roleId);
    if (r.isPrimary) birincil++;
  }
  if (birincil > 1) return 'Yalnız bir rol birincil olabilir.';
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
    return 'Roller güncellenemedi.';
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
      return 'Roller çakıştı (tek birincil rol olabilir).';
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
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

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
      return { success: false, error: 'Bu kuruluşta arama yetkin yok.' };
    }
    return { success: false, error: 'Eşleme yapılamadı.' };
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
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const ad = metin(input.name, 200);
  if (!ad) return { success: false, error: 'Ad zorunlu.' };
  if (!ILISKI_TURLERI.includes(input.relationshipType)) {
    return { success: false, error: 'İlişki türü geçersiz.' };
  }
  const rolHatasi = rolleriDogrula(input.roles ?? []);
  if (rolHatasi) return { success: false, error: rolHatasi };

  if (!(await yonetebilirMi(supabase, input.organizationId))) {
    return { success: false, error: 'Bu kuruluşta havuzu yönetme yetkin yok.' };
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
      return { success: false, error: 'Bu kişi havuzda zaten var.' };
    }
    if (error?.code === '42501') {
      return { success: false, error: 'Bu kuruluşta havuzu yönetme yetkin yok.' };
    }
    return { success: false, error: 'Kayıt eklenemedi, tekrar dene.' };
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
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const ad = metin(input.name, 200);
  if (!ad) return { success: false, error: 'Ad zorunlu.' };
  if (!ILISKI_TURLERI.includes(input.relationshipType)) {
    return { success: false, error: 'İlişki türü geçersiz.' };
  }
  if (!DURUMLAR.includes(input.status)) {
    return { success: false, error: 'Durum geçersiz.' };
  }
  if (!(await yonetebilirMi(supabase, input.organizationId))) {
    return { success: false, error: 'Bu kuruluşta havuzu yönetme yetkin yok.' };
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
      return { success: false, error: 'Bu kuruluşta havuzu yönetme yetkin yok.' };
    }
    return { success: false, error: 'Kayıt güncellenemedi.' };
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
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const rolHatasi = rolleriDogrula(input.roles ?? []);
  if (rolHatasi) return { success: false, error: rolHatasi };
  if (!(await yonetebilirMi(supabase, input.organizationId))) {
    return { success: false, error: 'Bu kuruluşta havuzu yönetme yetkin yok.' };
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
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (!(await yonetebilirMi(supabase, input.organizationId))) {
    return { success: false, error: 'Bu kuruluşta havuzu yönetme yetkin yok.' };
  }

  // FAZ 5/P3-ek: `talent_id` dolu olmasi silmeye engel DEGIL (P2 sahiplenme ve P3
  // pazaryeri eklemesi de doldurur). Yalniz AKTIF Ekibim uyeligi korunur:
  // `legacy_agency_member_id` dolu VE o satir `agency_members`'ta hala var.
  const { data: kayit } = await supabase
    .from('organization_talent_records')
    .select('id, legacy_agency_member_id')
    .eq('id', input.recordId)
    .eq('organization_id', input.organizationId)
    .maybeSingle();

  if (!kayit) return { success: false, error: 'Kayıt bulunamadı.' };

  const legacyId = (kayit as { legacy_agency_member_id: string | null })
    .legacy_agency_member_id;
  if (legacyId) {
    const { data: uyelik } = await supabase
      .from('agency_members')
      .select('id')
      .eq('id', legacyId)
      .maybeSingle();
    if (uyelik) {
      return {
        success: false,
        error: 'Aktif Ekibim üyesi havuzdan silinemez; önce Ekibim\'den çıkar.',
      };
    }
  }

  const { error } = await supabase
    .from('organization_talent_records')
    .delete()
    .eq('id', input.recordId)
    .eq('organization_id', input.organizationId);

  if (error) {
    console.error('[havuz] kayit silme', error);
    return { success: false, error: 'Kayıt silinemedi.' };
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
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  const { data: token, error } = await supabase.rpc(
    'send_talent_record_invitation',
    { p_record_id: input.recordId }
  );

  if (error) {
    console.error('[havuz] davet rpc', error);
    if (error.code === '42501') {
      return { success: false, error: 'Davet gönderme yetkin yok.' };
    }
    if (error.code === '22023') {
      return {
        success: false,
        error:
          'Davet gönderilemez: kayıtta e-posta yok, kişi zaten bağlı ya da engelli.',
      };
    }
    return { success: false, error: 'Davet oluşturulamadı, tekrar dene.' };
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
    return { success: false, error: 'Kayıtta e-posta yok.' };
  }

  const roller = (k?.organization_talent_record_roles ?? [])
    .map((r) => r.service_roles?.name_tr)
    .filter((v): v is string => !!v);

  const icerik = havuzDavetEmail({
    organizationName:
      (kurulus as { display_name: string | null } | null)?.display_name?.trim() ||
      'Kashe kuruluşu',
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
    return { success: false, error: 'E-posta gönderilemedi, tekrar dene.' };
  }
  return { success: true };
}

/**
 * FAZ 5 / P3 — pazaryerinden havuza: `/p/[id]` ve kesfet kartindaki kisa yol.
 *
 * Istemci YALNIZ `providerId` gonderir; `talent_id` SUNUCUDA `providers`'tan okunur
 * (istemciden gelen kimlige guvenilmez). Roller `provider_services`'tan on dolar —
 * `fn_faz5_ensure_record_for_member` ile ayni kural (role_id + is_primary).
 * Kisisel iletisim KOPYALANMAZ: `email`/`phone` yazilmaz (Kashe uyesinin kimligi
 * `talents` aynasindadir). `visibility` ve `invitation_*` dokunulmaz.
 */
export async function addProviderToTalentPool(input: {
  organizationId: string;
  providerId: string;
  relationshipType: HavuzIliskiTuru;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Giriş yapmalısın.' };

  if (!UUID_KALIBI.test(input.providerId)) {
    return { success: false, error: 'Profil geçersiz.' };
  }
  if (!ILISKI_TURLERI.includes(input.relationshipType)) {
    return { success: false, error: 'İlişki türü geçersiz.' };
  }
  if (!(await yonetebilirMi(supabase, input.organizationId))) {
    return { success: false, error: 'Bu kuruluşta havuzu yönetme yetkin yok.' };
  }

  const { data: saglayici, error: saglayiciHatasi } = await supabase
    .from('providers')
    .select('id, provider_type, talent_id, display_name, city_id')
    .eq('id', input.providerId)
    .maybeSingle();

  if (saglayiciHatasi) {
    console.error('[havuz] saglayici okuma', saglayiciHatasi);
    return { success: false, error: 'Profil okunamadı, tekrar dene.' };
  }

  const s = saglayici as {
    id: string;
    provider_type: string;
    talent_id: string | null;
    display_name: string | null;
    city_id: number | null;
  } | null;

  // Ajans profilleri ve talent'siz kayitlar havuza eklenmez (17 bolum 9).
  if (!s || s.provider_type !== 'professional' || !s.talent_id) {
    return { success: false, error: 'Bu profil havuza eklenemez.' };
  }

  // Ayni kurulusta ayni kisi icin kayit varsa tekrar eklenmez (DB'de de kismi
  // tekil indeks var; bu kontrol mesaji duzgun vermek icin).
  const { data: mevcut } = await supabase
    .from('organization_talent_records')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('talent_id', s.talent_id)
    .maybeSingle();
  if (mevcut) {
    return { success: false, error: 'Bu kişi havuzunda zaten var.' };
  }

  const { data: rolSatirlari, error: rolHatasi } = await supabase
    .from('provider_services')
    .select('role_id, is_primary')
    .eq('provider_id', s.id);
  if (rolHatasi) console.error('[havuz] saglayici rolleri', rolHatasi);

  // Tek birincil kismi indeksi var: birden fazla birincil gelirse ilki kalir.
  let birincilKullanildi = false;
  const roles: HavuzRolGirdisi[] = (
    (rolSatirlari ?? []) as { role_id: number; is_primary: boolean }[]
  ).map((r) => {
    const birincil = r.is_primary && !birincilKullanildi;
    if (birincil) birincilKullanildi = true;
    return { roleId: r.role_id, isPrimary: birincil };
  });

  const sonuc = await addTalentRecord({
    organizationId: input.organizationId,
    name: s.display_name?.trim() || 'Kashe üyesi',
    cityId: s.city_id,
    relationshipType: input.relationshipType,
    talentId: s.talent_id,
    roles,
  });

  if (!sonuc.success) return sonuc;

  revalidatePath(`/p/${input.providerId}`);
  revalidatePath('/kesfet');
  revalidatePath('/ajans/havuz');
  return sonuc;
}
