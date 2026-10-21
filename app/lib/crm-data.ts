import { createClient } from '@/app/lib/supabase-server';
import {
  ACIK_ASAMALAR,
  CRM_GOREN_ROLLER,
  type FirsatAsamasi,
  type KisiTuru,
} from '@/app/lib/crm';
import { ORG_ROLE_LABELS, type OrgRole } from '@/app/lib/org-roles';

/**
 * FAZ 8b — CRM okuma katmani (SUNUCU modulu).
 *
 * `'use client'` YOKTUR ve ISTEMCIDEN IMPORT EDILMEZ: `createClient` sunucu
 * istemcisidir. Istemci bilesenlerinin ihtiyac duydugu sabit ve etiketler
 * `app/lib/crm.ts`'de (DB erisimi olmayan saf modul).
 *
 * Yetkiyi RLS zorlar (`crm.view`); burada tekrar kontrol YOK — baska kurulusun
 * satiri sorguya girmez. `contacts.email/phone` yalniz bu sorgulardan geliyor,
 * yani yalniz kurulus ici yuzeylerde gorunur.
 *
 * N+1 YOK: her liste ic bilgiyi (firsat sayisi, son aktivite, ad) TEK toplu
 * sorguyla cozer.
 */

export type Kisi = {
  id: string;
  kind: KisiTuru;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  linkedUserId: string | null;
  linkedOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KisiSatiri = Kisi & {
  /** Kapanmamis firsat sayisi (new + contacted + proposal_sent). */
  acikFirsat: number;
  /** Kisinin ya da firsatlarinin en son aktivite zamani; yoksa null. */
  sonAktivite: string | null;
};

export type Firsat = {
  id: string;
  contactId: string;
  title: string;
  stage: FirsatAsamasi;
  /** `numeric` PostgREST'ten METIN gelebilir; sayiya cevrilmis. */
  estimatedValue: number | null;
  expectedDate: string | null;
  ownerUserId: string | null;
  nextStep: string | null;
  nextStepAt: string | null;
  eventId: string | null;
  proposalId: string | null;
  lostReason: string | null;
  wonAt: string | null;
  lostAt: string | null;
  createdAt: string;
  /** Gosterim adlari — embed'den. */
  kisiAdi: string;
  kisiFirmasi: string | null;
  sahipAdi: string | null;
  etkinlikBasligi: string | null;
  teklifBasligi: string | null;
  teklifDurumu: string | null;
};

/** `crmGorur`: rolunde `crm.view` var mi — yoksa sahip secilemez (secenek kapali). */
export type UyeSecenegi = {
  id: string;
  ad: string;
  altNot: string;
  crmGorur: boolean;
};

export type TeklifOnerisi = {
  proposalId: string;
  proposalTitle: string;
  clientName: string | null;
  clientEmail: string;
  createdAt: string;
};

/** `numeric` metin olarak gelebilir. */
function sayi(deger: unknown): number | null {
  if (deger === null || deger === undefined || deger === '') return null;
  const n = Number(deger);
  return Number.isFinite(n) ? n : null;
}

/**
 * Arama metnini `or()` icin guvenli hale getirir.
 *
 * PostgREST `or` dizgesinde virgul ve parantez AYIRICIDIR; temizlenmeden
 * gonderilen metin sorguyu bozar (ya da baska bir suzgece doner). Yuzde
 * isareti de kaldirilir: kullanici kendi joker karakterini yazmasin.
 */
function aramaMetni(q: string | null | undefined): string | null {
  const t = (q ?? '').trim().replace(/[,()%*\\]/g, '');
  if (t.length < 2) return null;
  return t.slice(0, 80);
}

type KisiHam = {
  id: string;
  kind: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  linked_user_id: string | null;
  linked_organization_id: string | null;
  created_at: string;
  updated_at: string;
};

function kisiKur(h: KisiHam): Kisi {
  return {
    id: h.id,
    kind: (h.kind as KisiTuru) ?? 'person',
    fullName: h.full_name,
    companyName: h.company_name,
    email: h.email,
    phone: h.phone,
    notes: h.notes,
    linkedUserId: h.linked_user_id,
    linkedOrganizationId: h.linked_organization_id,
    createdAt: h.created_at,
    updatedAt: h.updated_at,
  };
}

const KISI_ALANLARI =
  'id, kind, full_name, company_name, email, phone, notes, linked_user_id, linked_organization_id, created_at, updated_at';

const FIRSAT_ALANLARI = `id, contact_id, title, stage, estimated_value, expected_date,
   owner_user_id, next_step, next_step_at, event_id, proposal_id, lost_reason,
   won_at, lost_at, created_at,
   contacts(full_name, company_name),
   profiles!crm_leads_owner_user_id_fkey(full_name),
   events(title, event_type),
   proposals(title, status)`;

type FirsatHam = {
  id: string;
  contact_id: string;
  title: string;
  stage: string;
  estimated_value: number | string | null;
  expected_date: string | null;
  owner_user_id: string | null;
  next_step: string | null;
  next_step_at: string | null;
  event_id: string | null;
  proposal_id: string | null;
  lost_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
  contacts: { full_name: string; company_name: string | null } | null;
  profiles: { full_name: string | null } | null;
  events: { title: string | null; event_type: string } | null;
  proposals: { title: string | null; status: string } | null;
};

function firsatKur(h: FirsatHam): Firsat {
  return {
    id: h.id,
    contactId: h.contact_id,
    title: h.title,
    stage: (h.stage as FirsatAsamasi) ?? 'new',
    estimatedValue: sayi(h.estimated_value),
    expectedDate: h.expected_date,
    ownerUserId: h.owner_user_id,
    nextStep: h.next_step,
    nextStepAt: h.next_step_at,
    eventId: h.event_id,
    proposalId: h.proposal_id,
    lostReason: h.lost_reason,
    wonAt: h.won_at,
    lostAt: h.lost_at,
    createdAt: h.created_at,
    kisiAdi: h.contacts?.full_name?.trim() || 'Kişi',
    kisiFirmasi: h.contacts?.company_name?.trim() || null,
    sahipAdi: h.profiles?.full_name?.trim() || null,
    etkinlikBasligi: h.events?.title?.trim() || null,
    teklifBasligi: h.proposals?.title?.trim() || null,
    teklifDurumu: h.proposals?.status ?? null,
  };
}

/**
 * Kisi listesi. `q` ad / firma / e-posta uzerinde arar (en az 2 karakter).
 *
 * Acik firsat sayisi ve son aktivite IKI toplu sorguyla cozulur (kisi basina
 * sorgu YOK): firsatlar bir kez, aktivite bir kez cekilir ve bellekte eslenir.
 */
export async function kisileriListele(
  orgId: string,
  opts?: { q?: string | null }
): Promise<KisiSatiri[]> {
  const supabase = await createClient();
  const arama = aramaMetni(opts?.q);

  let sorgu = supabase
    .from('contacts')
    .select(KISI_ALANLARI)
    .eq('organization_id', orgId)
    .order('full_name', { ascending: true })
    .limit(500);

  if (arama) {
    sorgu = sorgu.or(
      `full_name.ilike.%${arama}%,company_name.ilike.%${arama}%,email.ilike.%${arama}%`
    );
  }

  const { data, error } = await sorgu;
  if (error) {
    console.error('[crm] kisiler', error.code, error.message);
    return [];
  }

  const kisiler = ((data ?? []) as unknown as KisiHam[]).map(kisiKur);
  if (kisiler.length === 0) return [];

  const kisiIdleri = kisiler.map((k) => k.id);

  const [firsatSonuc, aktiviteSonuc] = await Promise.all([
    supabase
      .from('crm_leads')
      .select('id, contact_id, stage')
      .eq('organization_id', orgId)
      .in('contact_id', kisiIdleri),
    supabase
      .from('activity_logs')
      .select('entity_id, entity_type, created_at')
      .eq('organization_id', orgId)
      .in('entity_type', ['contact', 'lead'])
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  if (firsatSonuc.error) {
    console.error('[crm] kisi firsat sayimi', firsatSonuc.error.message);
  }
  if (aktiviteSonuc.error) {
    console.error('[crm] kisi aktivite', aktiviteSonuc.error.message);
  }

  const firsatlar = (firsatSonuc.data ?? []) as {
    id: string;
    contact_id: string;
    stage: string;
  }[];

  const acikSayim = new Map<string, number>();
  // Firsat kimligi -> kisi kimligi: aktivite satirlari firsatin kimligini
  // tasiyor, kisinin degil; son aktiviteyi kisiye baglamak icin bu koprudur.
  const firsatKisi = new Map<string, string>();
  for (const f of firsatlar) {
    firsatKisi.set(f.id, f.contact_id);
    if (ACIK_ASAMALAR.includes(f.stage as FirsatAsamasi)) {
      acikSayim.set(f.contact_id, (acikSayim.get(f.contact_id) ?? 0) + 1);
    }
  }

  const sonAktivite = new Map<string, string>();
  for (const a of (aktiviteSonuc.data ?? []) as {
    entity_id: string;
    entity_type: string;
    created_at: string;
  }[]) {
    const kisiId =
      a.entity_type === 'contact' ? a.entity_id : firsatKisi.get(a.entity_id);
    if (!kisiId) continue;
    // Sorgu tarihe gore AZALAN sirali: ilk gorulen en yenisidir.
    if (!sonAktivite.has(kisiId)) sonAktivite.set(kisiId, a.created_at);
  }

  return kisiler.map((k) => ({
    ...k,
    acikFirsat: acikSayim.get(k.id) ?? 0,
    sonAktivite: sonAktivite.get(k.id) ?? null,
  }));
}

/** Firsat listesi (pano ve kisi sayfasi ayni kaynagi kullanir). */
export async function firsatlariListele(
  orgId: string,
  opts?: { asama?: FirsatAsamasi; sahip?: string; kisiId?: string }
): Promise<Firsat[]> {
  const supabase = await createClient();

  let sorgu = supabase
    .from('crm_leads')
    .select(FIRSAT_ALANLARI)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (opts?.asama) sorgu = sorgu.eq('stage', opts.asama);
  if (opts?.sahip) sorgu = sorgu.eq('owner_user_id', opts.sahip);
  if (opts?.kisiId) sorgu = sorgu.eq('contact_id', opts.kisiId);

  const { data, error } = await sorgu;
  if (error) {
    console.error('[crm] firsatlar', error.code, error.message);
    return [];
  }
  return ((data ?? []) as unknown as FirsatHam[]).map(firsatKur);
}

export type KisiDetayi = {
  kisi: Kisi;
  firsatlar: Firsat[];
  teklifler: {
    id: string;
    title: string;
    status: string;
    total: number | null;
  }[];
  /** Aktivite akisinin suzecegi kimlikler (kisi + firsatlari). */
  aktiviteKimlikleri: string[];
};

/** Kisi sayfasinin tum verisi. Kisi bulunamazsa (ya da RLS keserse) null. */
export async function kisiDetay(
  orgId: string,
  kisiId: string
): Promise<KisiDetayi | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('contacts')
    .select(KISI_ALANLARI)
    .eq('organization_id', orgId)
    .eq('id', kisiId)
    .maybeSingle();

  if (error) {
    console.error('[crm] kisi detay', error.code, error.message);
    return null;
  }
  if (!data) return null;

  const kisi = kisiKur(data as unknown as KisiHam);

  const [firsatlar, teklifSonuc] = await Promise.all([
    firsatlariListele(orgId, { kisiId }),
    // Teklifler kisiye `buyer_contact_id` ile bagli (FAZ 8b). Satici kurulus
    // suzgeci de konur: RLS zaten sinirlar, ama sorgu niyeti aciksa kalir.
    supabase
      .from('proposals')
      .select(
        `id, title, status,
         current_version:proposal_versions!proposals_current_version_fkey(total_amount)`
      )
      .eq('seller_organization_id', orgId)
      .eq('buyer_contact_id', kisiId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (teklifSonuc.error) {
    console.error('[crm] kisi teklifleri', teklifSonuc.error.message);
  }

  const teklifler = (
    (teklifSonuc.data ?? []) as unknown as {
      id: string;
      title: string | null;
      status: string;
      current_version: { total_amount: number | string | null } | null;
    }[]
  ).map((t) => ({
    id: t.id,
    title: t.title?.trim() || 'Teklif',
    status: t.status,
    total: sayi(t.current_version?.total_amount),
  }));

  return {
    kisi,
    firsatlar,
    teklifler,
    aktiviteKimlikleri: [kisi.id, ...firsatlar.map((f) => f.id)],
  };
}

/**
 * "Kisi olarak ekle" onerileri — `crm_contact_suggestions` gorunumu
 * (satici kurulusun e-postasi olan ama kisisi olmayan teklifleri).
 */
export async function teklifOnerileri(
  orgId: string
): Promise<TeklifOnerisi[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('crm_contact_suggestions')
    .select('proposal_id, proposal_title, client_name, client_email, created_at')
    .eq('organization_id', orgId)
    // `contacts.email` CHECK'i '@' ister; gecersiz e-postali teklif onerilmez
    // (yoksa "Kisi olarak ekle" her seferinde hata verir).
    .like('client_email', '%@%')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[crm] oneriler', error.code, error.message);
    return [];
  }

  return (
    (data ?? []) as {
      proposal_id: string;
      proposal_title: string | null;
      client_name: string | null;
      client_email: string;
      created_at: string;
    }[]
  ).map((o) => ({
    proposalId: o.proposal_id,
    proposalTitle: o.proposal_title?.trim() || 'Teklif',
    clientName: o.client_name?.trim() || null,
    clientEmail: o.client_email,
    createdAt: o.created_at,
  }));
}

/** Firsat sahibi secenekleri — gorevlerdeki `atanabilirler` kalibi (uye kismi). */
export async function uyeSecenekleri(orgId: string): Promise<UyeSecenegi[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organization_memberships')
    .select(
      'user_id, role, profiles!organization_memberships_user_id_fkey(id, full_name)'
    )
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (error) {
    console.error('[crm] uyeler', error.code, error.message);
    return [];
  }

  return (
    (data ?? []) as unknown as {
      user_id: string;
      role: string;
      profiles: { id: string; full_name: string | null } | null;
    }[]
  ).map((u) => ({
    id: u.user_id,
    ad: u.profiles?.full_name?.trim() || 'Kuruluş üyesi',
    altNot: ORG_ROLE_LABELS[u.role as OrgRole] ?? 'Üye',
    crmGorur: (CRM_GOREN_ROLLER as readonly string[]).includes(u.role),
  }));
}

/**
 * Gosterge ve KPI sayilari. TEK sorgu: acik/kazanilan ayrimi bellekte yapilir
 * (bes asama icin bes `count` sorgusu atmak yerine).
 */
export async function crmSayilari(orgId: string): Promise<{
  acikFirsat: number;
  beklenenTutar: number;
  buAyKazanilanAdet: number;
  buAyKazanilanTutar: number;
  kisiSayisi: number;
}> {
  const supabase = await createClient();

  const ayBasi = new Date();
  ayBasi.setUTCDate(1);
  ayBasi.setUTCHours(0, 0, 0, 0);

  const [firsatSonuc, kisiSonuc] = await Promise.all([
    supabase
      .from('crm_leads')
      .select('stage, estimated_value, won_at')
      .eq('organization_id', orgId)
      .limit(2000),
    supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
  ]);

  if (firsatSonuc.error) {
    console.error('[crm] sayilar', firsatSonuc.error.message);
  }

  let acikFirsat = 0;
  let beklenenTutar = 0;
  let buAyKazanilanAdet = 0;
  let buAyKazanilanTutar = 0;

  for (const f of (firsatSonuc.data ?? []) as {
    stage: string;
    estimated_value: number | string | null;
    won_at: string | null;
  }[]) {
    const deger = sayi(f.estimated_value) ?? 0;
    if (ACIK_ASAMALAR.includes(f.stage as FirsatAsamasi)) {
      acikFirsat += 1;
      beklenenTutar += deger;
    } else if (f.stage === 'won' && f.won_at) {
      const d = new Date(f.won_at);
      if (!isNaN(d.getTime()) && d >= ayBasi) {
        buAyKazanilanAdet += 1;
        buAyKazanilanTutar += deger;
      }
    }
  }

  return {
    acikFirsat,
    beklenenTutar,
    buAyKazanilanAdet,
    buAyKazanilanTutar,
    kisiSayisi: kisiSonuc.count ?? 0,
  };
}

/** `/ajans` gostergesi icin yalniz acik firsat sayisi (tek `count`). */
export async function acikFirsatSayisi(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('crm_leads')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .in('stage', ACIK_ASAMALAR);

  if (error) {
    console.error('[crm] acik firsat sayisi', error.message);
    return 0;
  }
  return count ?? 0;
}
