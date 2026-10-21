'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { crmHataMetni, FIRSAT_ASAMALARI, KISI_TURLERI } from '@/app/lib/crm';

/**
 * FAZ 8b — CRM yazma eylemleri.
 *
 * ILKE (8a ile ayni, FAZ 7'nin AKSINE): yazma DOGRUDAN TABLOYA. Kurallar
 * `20261022120000_faz8b_01_crm.sql` tetikleyicilerinde; RLS `crm.manage`
 * istiyor. Ticari risk yok (fiyat/marj/jeton uretilmiyor), bu yuzden RPC
 * katmani eklenmedi.
 *
 * Bu dosyanin isi: girdiyi temizlemek, tabloya yazmak ve DB'nin ASCII hata
 * metnini Turkce cumleye cevirmek (`crmHataMetni`). KURAL KOPYALAMAZ — ornegin
 * "sahip kurulusun aktif uyesi mi" ya da "kisi bu kurulusa ait mi" kontrolleri
 * BURADA TEKRAR EDILMEZ; tetikleyici reddeder, mesaji eslenir.
 *
 * RLS engellediginde INSERT hata verir, UPDATE/DELETE ise 0 SATIR doner
 * (hata degil) — her yazma `.select()` ile satir sayar, sessiz basari olmaz.
 *
 * `service_role` KULLANILMAZ: islem kullanicinin oturumuyla, RLS altinda gider.
 */
export type CrmSonucu = { ok: true; id?: string } | { ok: false; hata: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidMi(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

/**
 * Etkilenen yuzeyleri tazeler.
 *
 * YALNIZ CRM yuzeyleri: `/ajans` gostergesinin "acik firsat" sayisi bir sonraki
 * ziyarette kendiliginden tazelenir. Her firsat dokunusunda agir gosterge
 * sayfasini yeniden uretmek panodaki etkilesimi gorunur bicimde yavaslatirdi
 * (8a'da olculen davranis).
 */
function tazele(kisiId?: string | null) {
  revalidatePath('/ajans/musteriler');
  if (kisiId) revalidatePath(`/ajans/musteriler/${kisiId}`);
}

/** Bos/kirpilmis metin -> null. Uzunluk sinirlarini DB CHECK'i zorlar. */
function metin(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t || null;
}

/**
 * `date` alani (beklenen tarih). Bos deger null; gecersiz deger `undefined`
 * (cagiran hata doner). Saat YOK — sutun `date`, dilim kaymasi olusmaz.
 */
function tarihCoz(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  const s = (v ?? '').trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00Z`);
  return isNaN(d.getTime()) ? undefined : s;
}

/**
 * `datetime-local` -> ISO (sonraki adim zamani).
 * Dilimsiz deger ISTANBUL saati sayilir: sunucu UTC'de kosar, `new Date(s)`
 * onu UTC okur ve her kayitta 3 saat kayardi (8a'da ayni cozum).
 */
function zamanCoz(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  const s = (v ?? '').trim();
  if (!s) return null;
  const dilimsiz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s);
  const d = new Date(dilimsiz ? `${s}${s.length === 16 ? ':00' : ''}+03:00` : s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Tutar: bos -> null, negatif/gecersiz -> `undefined`. */
function tutarCoz(v: string | number | null | undefined):
  | number
  | null
  | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

// -----------------------------------------------------------------------------
// Kisi
// -----------------------------------------------------------------------------

export type KisiGirdisi = {
  organizationId: string;
  kind?: string;
  fullName: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export async function kisiOlustur(girdi: KisiGirdisi): Promise<CrmSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };

  if (!uuidMi(girdi.organizationId)) {
    return { ok: false, hata: 'Kuruluş seçimi geçersiz.' };
  }
  const ad = (girdi.fullName ?? '').trim();
  if (ad.length < 2 || ad.length > 200) {
    return { ok: false, hata: 'Ad 2–200 karakter olmalı.' };
  }
  if (girdi.kind && !KISI_TURLERI.includes(girdi.kind as never)) {
    return { ok: false, hata: 'Kişi türü geçersiz.' };
  }
  const eposta = metin(girdi.email);
  if (eposta && !eposta.includes('@')) {
    return { ok: false, hata: 'E-posta biçimi geçersiz.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      organization_id: girdi.organizationId,
      kind: girdi.kind ?? 'person',
      full_name: ad,
      company_name: metin(girdi.companyName),
      email: eposta,
      phone: metin(girdi.phone),
      notes: metin(girdi.notes),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[crm] kisi olustur', error.code, error.message);
    return { ok: false, hata: crmHataMetni(error) };
  }

  tazele();
  return { ok: true, id: (data as { id: string }).id };
}

export type KisiGuncellemesi = {
  id: string;
  kind?: string;
  fullName?: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

/**
 * Kismi guncelleme: YALNIZ verilen alanlar yazilir.
 * `undefined` = dokunma, `null` = temizle ayrimi korunur; aksi halde yalniz
 * telefon degistiren bir istek notu sessizce silerdi.
 */
export async function kisiGuncelle(
  g: KisiGuncellemesi
): Promise<CrmSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(g.id)) return { ok: false, hata: 'Kişi bulunamadı.' };

  const yama: Record<string, unknown> = {};

  if (g.fullName !== undefined) {
    const ad = g.fullName.trim();
    if (ad.length < 2 || ad.length > 200) {
      return { ok: false, hata: 'Ad 2–200 karakter olmalı.' };
    }
    yama.full_name = ad;
  }
  if (g.kind !== undefined) {
    if (!KISI_TURLERI.includes(g.kind as never)) {
      return { ok: false, hata: 'Kişi türü geçersiz.' };
    }
    yama.kind = g.kind;
  }
  if (g.companyName !== undefined) yama.company_name = metin(g.companyName);
  if (g.email !== undefined) {
    const eposta = metin(g.email);
    if (eposta && !eposta.includes('@')) {
      return { ok: false, hata: 'E-posta biçimi geçersiz.' };
    }
    yama.email = eposta;
  }
  if (g.phone !== undefined) yama.phone = metin(g.phone);
  if (g.notes !== undefined) yama.notes = metin(g.notes);

  if (Object.keys(yama).length === 0) return { ok: true, id: g.id };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .update(yama)
    .eq('id', g.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[crm] kisi guncelle', error.code, error.message);
    return { ok: false, hata: crmHataMetni(error) };
  }
  if (!data) return { ok: false, hata: 'Bu işlem için yetkin yok.' };

  tazele(g.id);
  return { ok: true, id: g.id };
}

/**
 * Kisi silme. `crm_leads.contact_id` RESTRICT: firsati olan kisi silinemez ve
 * DB 23503 doner — `crmHataMetni` bunu "Once firsatlari sil ya da tasi"
 * cumlesine cevirir (kontrol burada TEKRARLANMAZ).
 */
export async function kisiSil(id: string): Promise<CrmSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(id)) return { ok: false, hata: 'Kişi bulunamadı.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[crm] kisi sil', error.code, error.message);
    return { ok: false, hata: crmHataMetni(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, hata: 'Bu işlem için yetkin yok.' };
  }

  tazele();
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Firsat
// -----------------------------------------------------------------------------

export type FirsatGirdisi = {
  organizationId: string;
  contactId: string;
  title: string;
  stage?: string;
  estimatedValue?: string | number | null;
  expectedDate?: string | null;
  ownerUserId?: string | null;
  nextStep?: string | null;
  nextStepAt?: string | null;
  eventId?: string | null;
  proposalId?: string | null;
};

export async function firsatOlustur(
  girdi: FirsatGirdisi
): Promise<CrmSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };

  if (!uuidMi(girdi.organizationId)) {
    return { ok: false, hata: 'Kuruluş seçimi geçersiz.' };
  }
  if (!uuidMi(girdi.contactId)) {
    return { ok: false, hata: 'Kişi seçimi geçersiz.' };
  }
  const baslik = (girdi.title ?? '').trim();
  if (baslik.length < 2 || baslik.length > 200) {
    return { ok: false, hata: 'Başlık 2–200 karakter olmalı.' };
  }
  if (girdi.stage && !FIRSAT_ASAMALARI.includes(girdi.stage as never)) {
    return { ok: false, hata: 'Aşama geçersiz.' };
  }
  if (girdi.eventId && !uuidMi(girdi.eventId)) {
    return { ok: false, hata: 'Etkinlik seçimi geçersiz.' };
  }
  if (girdi.proposalId && !uuidMi(girdi.proposalId)) {
    return { ok: false, hata: 'Teklif seçimi geçersiz.' };
  }
  if (girdi.ownerUserId && !uuidMi(girdi.ownerUserId)) {
    return { ok: false, hata: 'Sahip seçimi geçersiz.' };
  }

  const tutar = tutarCoz(girdi.estimatedValue);
  if (tutar === undefined) {
    return { ok: false, hata: 'Tahmini değer okunamadı.' };
  }
  const beklenen = tarihCoz(girdi.expectedDate);
  if (beklenen === undefined) {
    return { ok: false, hata: 'Beklenen tarih okunamadı.' };
  }
  const adimZamani = zamanCoz(girdi.nextStepAt);
  if (adimZamani === undefined) {
    return { ok: false, hata: 'Sonraki adım tarihi okunamadı.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('crm_leads')
    .insert({
      organization_id: girdi.organizationId,
      contact_id: girdi.contactId,
      title: baslik,
      stage: girdi.stage ?? 'new',
      estimated_value: tutar,
      expected_date: beklenen,
      owner_user_id: girdi.ownerUserId || null,
      next_step: metin(girdi.nextStep),
      next_step_at: adimZamani,
      event_id: girdi.eventId || null,
      proposal_id: girdi.proposalId || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[crm] firsat olustur', error.code, error.message);
    return { ok: false, hata: crmHataMetni(error) };
  }

  tazele(girdi.contactId);
  return { ok: true, id: (data as { id: string }).id };
}

export type FirsatGuncellemesi = {
  id: string;
  title?: string;
  stage?: string;
  estimatedValue?: string | number | null;
  expectedDate?: string | null;
  ownerUserId?: string | null;
  nextStep?: string | null;
  nextStepAt?: string | null;
  eventId?: string | null;
  proposalId?: string | null;
  lostReason?: string | null;
  contactId?: string;
};

export async function firsatGuncelle(
  g: FirsatGuncellemesi
): Promise<CrmSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(g.id)) return { ok: false, hata: 'Fırsat bulunamadı.' };

  const yama: Record<string, unknown> = {};

  if (g.title !== undefined) {
    const baslik = g.title.trim();
    if (baslik.length < 2 || baslik.length > 200) {
      return { ok: false, hata: 'Başlık 2–200 karakter olmalı.' };
    }
    yama.title = baslik;
  }
  if (g.stage !== undefined) {
    if (!FIRSAT_ASAMALARI.includes(g.stage as never)) {
      return { ok: false, hata: 'Aşama geçersiz.' };
    }
    yama.stage = g.stage;
  }
  if (g.estimatedValue !== undefined) {
    const tutar = tutarCoz(g.estimatedValue);
    if (tutar === undefined) {
      return { ok: false, hata: 'Tahmini değer okunamadı.' };
    }
    yama.estimated_value = tutar;
  }
  if (g.expectedDate !== undefined) {
    const beklenen = tarihCoz(g.expectedDate);
    if (beklenen === undefined) {
      return { ok: false, hata: 'Beklenen tarih okunamadı.' };
    }
    yama.expected_date = beklenen;
  }
  if (g.ownerUserId !== undefined) {
    if (g.ownerUserId && !uuidMi(g.ownerUserId)) {
      return { ok: false, hata: 'Sahip seçimi geçersiz.' };
    }
    yama.owner_user_id = g.ownerUserId || null;
  }
  if (g.nextStep !== undefined) yama.next_step = metin(g.nextStep);
  if (g.nextStepAt !== undefined) {
    const adimZamani = zamanCoz(g.nextStepAt);
    if (adimZamani === undefined) {
      return { ok: false, hata: 'Sonraki adım tarihi okunamadı.' };
    }
    yama.next_step_at = adimZamani;
  }
  if (g.eventId !== undefined) {
    if (g.eventId && !uuidMi(g.eventId)) {
      return { ok: false, hata: 'Etkinlik seçimi geçersiz.' };
    }
    yama.event_id = g.eventId || null;
  }
  if (g.proposalId !== undefined) {
    if (g.proposalId && !uuidMi(g.proposalId)) {
      return { ok: false, hata: 'Teklif seçimi geçersiz.' };
    }
    yama.proposal_id = g.proposalId || null;
  }
  if (g.contactId !== undefined) {
    if (!uuidMi(g.contactId)) {
      return { ok: false, hata: 'Kişi seçimi geçersiz.' };
    }
    yama.contact_id = g.contactId;
  }
  if (g.lostReason !== undefined) yama.lost_reason = metin(g.lostReason);

  if (Object.keys(yama).length === 0) return { ok: true, id: g.id };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('crm_leads')
    .update(yama)
    .eq('id', g.id)
    .select('id, contact_id')
    .maybeSingle();

  if (error) {
    console.error('[crm] firsat guncelle', error.code, error.message);
    return { ok: false, hata: crmHataMetni(error) };
  }
  if (!data) return { ok: false, hata: 'Bu işlem için yetkin yok.' };

  tazele((data as { contact_id: string }).contact_id);
  return { ok: true, id: g.id };
}

export async function firsatSil(
  id: string,
  kisiId?: string | null
): Promise<CrmSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(id)) return { ok: false, hata: 'Fırsat bulunamadı.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('crm_leads')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[crm] firsat sil', error.code, error.message);
    return { ok: false, hata: crmHataMetni(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, hata: 'Bu işlem için yetkin yok.' };
  }

  tazele(kisiId);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Teklif musterisi -> kisi
// -----------------------------------------------------------------------------

/**
 * Oneri seridinin eylemi: teklifin `client_name`/`client_email` bilgisinden kisi
 * acar ve teklifi ona baglar.
 *
 * Sira onemli: ONCE kisi, SONRA `proposals.buyer_contact_id`. Sutun izni FAZ 8b
 * ile verildi (`GRANT UPDATE (buyer_contact_id)`), kurulus esligini
 * `trg_faz8b_proposal_contact_validate` dogrular.
 *
 * Kisi zaten varsa (23505 — e-posta kurulus icinde tekil) yeni kisi acilmaz,
 * MEVCUT kisiye baglanir: kullanici ayni musteriyi iki kez acmasin.
 */
export async function teklifMusterisiniKisiYap(
  orgId: string,
  proposalId: string
): Promise<CrmSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(orgId) || !uuidMi(proposalId)) {
    return { ok: false, hata: 'Kayıt geçersiz.' };
  }

  const supabase = await createClient();

  const { data: teklif, error: teklifHatasi } = await supabase
    .from('proposals')
    .select('id, client_name, client_email, buyer_contact_id')
    .eq('id', proposalId)
    .eq('seller_organization_id', orgId)
    .maybeSingle();

  if (teklifHatasi) {
    console.error('[crm] oneri teklif', teklifHatasi.code, teklifHatasi.message);
    return { ok: false, hata: crmHataMetni(teklifHatasi) };
  }
  if (!teklif) return { ok: false, hata: 'Teklif bulunamadı.' };

  const t = teklif as {
    id: string;
    client_name: string | null;
    client_email: string | null;
    buyer_contact_id: string | null;
  };
  if (t.buyer_contact_id) {
    return { ok: false, hata: 'Bu teklif zaten bir kişiye bağlı.' };
  }

  const eposta = (t.client_email ?? '').trim().toLowerCase();
  if (!eposta || !eposta.includes('@')) {
    return { ok: false, hata: 'Teklifte geçerli bir e-posta yok.' };
  }
  // Ad 2 karakterden kisaysa (ya da bos) e-postanin yerel kismi kullanilir:
  // CHECK'i gecmeyen bir ad yuzunden oneri kullanilamaz kalmasin.
  const hamAd = (t.client_name ?? '').trim();
  const ad =
    hamAd.length >= 2 ? hamAd.slice(0, 200) : eposta.split('@')[0].slice(0, 200);
  if (ad.length < 2) return { ok: false, hata: 'Teklifte kullanılabilir ad yok.' };

  let kisiId: string | null = null;

  const { data: yeni, error: kisiHatasi } = await supabase
    .from('contacts')
    .insert({
      organization_id: orgId,
      kind: 'person',
      full_name: ad,
      email: eposta,
    })
    .select('id')
    .single();

  if (kisiHatasi) {
    if (kisiHatasi.code === '23505') {
      // Ayni e-postali kisi var — onu bul ve ona bagla.
      const { data: mevcut } = await supabase
        .from('contacts')
        .select('id')
        .eq('organization_id', orgId)
        .eq('email', eposta)
        .maybeSingle();
      kisiId = (mevcut as { id: string } | null)?.id ?? null;
      if (!kisiId) {
        return { ok: false, hata: 'Bu e-posta ile kayıtlı kişi bulunamadı.' };
      }
    } else {
      console.error('[crm] oneri kisi', kisiHatasi.code, kisiHatasi.message);
      return { ok: false, hata: crmHataMetni(kisiHatasi) };
    }
  } else {
    kisiId = (yeni as { id: string }).id;
  }

  const { data: baglanan, error: baglamaHatasi } = await supabase
    .from('proposals')
    .update({ buyer_contact_id: kisiId })
    .eq('id', proposalId)
    .select('id')
    .maybeSingle();

  if (baglamaHatasi) {
    console.error(
      '[crm] oneri bagla',
      baglamaHatasi.code,
      baglamaHatasi.message
    );
    return { ok: false, hata: crmHataMetni(baglamaHatasi) };
  }
  // Kisi acildi ama bag kurulamadi: kullanici bos bir basari gormesin.
  if (!baglanan) {
    return {
      ok: false,
      hata: 'Kişi oluşturuldu ama teklife bağlanamadı. Teklif sayfasından dene.',
    };
  }

  tazele(kisiId);
  revalidatePath(`/ajans/teklifler/${proposalId}`);
  return { ok: true, id: kisiId };
}
