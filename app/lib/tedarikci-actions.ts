'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import {
  ATAMA_DURUMLARI,
  TEDARIKCI_KATEGORILERI,
  tedarikciHataMetni,
} from '@/app/lib/tedarikci';

/**
 * FAZ 8c — tedarikci ve kisa liste yazma eylemleri.
 *
 * IKI AYRI YAZMA YOLU:
 *   1. Defter ve kisa liste: DOGRUDAN TABLOYA (8a/8b ilkesi). Kurallar
 *      `20261023120000_faz8c_01_tedarikciler.sql` tetikleyicilerinde; RLS
 *      `suppliers.manage` / `events.manage` istiyor.
 *   2. TUTAR (`internal.event_supplier_costs`): YALNIZ iki RPC
 *      (`internal_event_supplier_costs_list` / `internal_event_supplier_cost_set`).
 *      `internal` semasina dogrudan sorgu YOK — CLAUDE.md degismez kural 1.
 *
 * Bu dosyanin isi: girdiyi temizlemek, yazmak ve DB'nin ASCII hata metnini
 * Turkce cumleye cevirmek (`tedarikciHataMetni`). KURAL KOPYALAMAZ — "tedarikci
 * arsivde", "kendi saglayicin eklenemez", "etkinlik bu kurulusa ait degil"
 * kontrolleri BURADA TEKRAR EDILMEZ.
 *
 * RLS engellediginde INSERT hata verir, UPDATE/DELETE ise 0 SATIR doner
 * (hata degil) — her yazma `.select()` ile satir sayar, sessiz basari olmaz.
 *
 * `service_role` KULLANILMAZ: islem kullanicinin oturumuyla, RLS altinda gider.
 */
export type TedarikciSonucu =
  | { ok: true; id?: string }
  | { ok: false; hata: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidMi(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

/** Bos/kirpilmis metin -> null. Uzunluk sinirlarini DB CHECK'i zorlar. */
function metin(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t || null;
}

/**
 * Etkilenen yuzeyleri tazeler. DARALTILMIS: gosterge sayilari bir sonraki
 * ziyarette kendiliginden tazelenir (8a'da olculen davranis — her dokunusta
 * agir gosterge sayfasini uretmek listedeki etkilesimi yavaslatiyordu).
 */
function tazeleDefter(id?: string | null, eventId?: string | null) {
  revalidatePath('/ajans/tedarikciler');
  if (id) revalidatePath(`/ajans/tedarikciler/${id}`);
  if (eventId) revalidatePath(`/etkinliklerim/${eventId}`);
}

function tazeleListe() {
  revalidatePath('/kurumsal/kisa-liste');
}

// -----------------------------------------------------------------------------
// Tedarikci defteri
// -----------------------------------------------------------------------------

export type TedarikciGirdisi = {
  organizationId: string;
  name: string;
  category?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  cityId?: number | null;
  rating?: number | null;
  notes?: string | null;
  linkedProviderId?: string | null;
};

/** Puan: bos -> null, 1-5 disi -> `undefined` (cagiran hata doner). */
function puanCoz(v: number | string | null | undefined):
  | number
  | null
  | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) return undefined;
  return n;
}

export async function tedarikciOlustur(
  girdi: TedarikciGirdisi
): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };

  if (!uuidMi(girdi.organizationId)) {
    return { ok: false, hata: 'Kuruluş seçimi geçersiz.' };
  }
  const ad = (girdi.name ?? '').trim();
  if (ad.length < 2 || ad.length > 200) {
    return { ok: false, hata: 'Ad 2–200 karakter olmalı.' };
  }
  if (girdi.category && !TEDARIKCI_KATEGORILERI.includes(girdi.category as never)) {
    return { ok: false, hata: 'Kategori geçersiz.' };
  }
  const eposta = metin(girdi.email);
  if (eposta && !eposta.includes('@')) {
    return { ok: false, hata: 'E-posta biçimi geçersiz.' };
  }
  const puan = puanCoz(girdi.rating);
  if (puan === undefined) {
    return { ok: false, hata: 'Puan 1 ile 5 arasında olmalı.' };
  }
  if (girdi.linkedProviderId && !uuidMi(girdi.linkedProviderId)) {
    return { ok: false, hata: 'Kashe kaydı seçimi geçersiz.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      organization_id: girdi.organizationId,
      name: ad,
      category: girdi.category ?? 'other',
      contact_name: metin(girdi.contactName),
      email: eposta,
      phone: metin(girdi.phone),
      website: metin(girdi.website),
      city_id: girdi.cityId ?? null,
      rating: puan,
      notes: metin(girdi.notes),
      linked_provider_id: girdi.linkedProviderId || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[tedarikci] olustur', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }

  tazeleDefter();
  return { ok: true, id: (data as { id: string }).id };
}

export type TedarikciGuncellemesi = {
  id: string;
  name?: string;
  category?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  cityId?: number | null;
  rating?: number | null;
  notes?: string | null;
  linkedProviderId?: string | null;
};

/**
 * Kismi guncelleme: YALNIZ verilen alanlar yazilir.
 * `undefined` = dokunma, `null` = temizle ayrimi korunur; aksi halde yalniz
 * telefonu degistiren bir istek notu sessizce silerdi.
 */
export async function tedarikciGuncelle(
  g: TedarikciGuncellemesi
): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(g.id)) return { ok: false, hata: 'Tedarikçi bulunamadı.' };

  const yama: Record<string, unknown> = {};

  if (g.name !== undefined) {
    const ad = g.name.trim();
    if (ad.length < 2 || ad.length > 200) {
      return { ok: false, hata: 'Ad 2–200 karakter olmalı.' };
    }
    yama.name = ad;
  }
  if (g.category !== undefined) {
    if (!TEDARIKCI_KATEGORILERI.includes(g.category as never)) {
      return { ok: false, hata: 'Kategori geçersiz.' };
    }
    yama.category = g.category;
  }
  if (g.contactName !== undefined) yama.contact_name = metin(g.contactName);
  if (g.email !== undefined) {
    const eposta = metin(g.email);
    if (eposta && !eposta.includes('@')) {
      return { ok: false, hata: 'E-posta biçimi geçersiz.' };
    }
    yama.email = eposta;
  }
  if (g.phone !== undefined) yama.phone = metin(g.phone);
  if (g.website !== undefined) yama.website = metin(g.website);
  if (g.cityId !== undefined) yama.city_id = g.cityId ?? null;
  if (g.rating !== undefined) {
    const puan = puanCoz(g.rating);
    if (puan === undefined) {
      return { ok: false, hata: 'Puan 1 ile 5 arasında olmalı.' };
    }
    yama.rating = puan;
  }
  if (g.notes !== undefined) yama.notes = metin(g.notes);
  if (g.linkedProviderId !== undefined) {
    if (g.linkedProviderId && !uuidMi(g.linkedProviderId)) {
      return { ok: false, hata: 'Kashe kaydı seçimi geçersiz.' };
    }
    yama.linked_provider_id = g.linkedProviderId || null;
  }

  if (Object.keys(yama).length === 0) return { ok: true, id: g.id };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('suppliers')
    .update(yama)
    .eq('id', g.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[tedarikci] guncelle', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }
  if (!data) return { ok: false, hata: 'Bu işlem için yetkin yok.' };

  tazeleDefter(g.id);
  return { ok: true, id: g.id };
}

/** Arsivle / arsivden cikar. Arsivdeki tedarikci etkinlige ATANAMAZ (DB). */
export async function tedarikciArsivle(
  id: string,
  aktif: boolean
): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(id)) return { ok: false, hata: 'Tedarikçi bulunamadı.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('suppliers')
    .update({ is_active: aktif })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[tedarikci] arsivle', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }
  if (!data) return { ok: false, hata: 'Bu işlem için yetkin yok.' };

  tazeleDefter(id);
  return { ok: true, id };
}

/**
 * Silme. `event_suppliers.supplier_id` RESTRICT: atanmis tedarikci silinemez ve
 * DB 23503 doner — `tedarikciHataMetni` bunu "once arsivle" cumlesine cevirir
 * (kontrol burada TEKRARLANMAZ).
 */
export async function tedarikciSil(id: string): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(id)) return { ok: false, hata: 'Tedarikçi bulunamadı.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[tedarikci] sil', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, hata: 'Bu işlem için yetkin yok.' };
  }

  tazeleDefter();
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Etkinlik atamasi
// -----------------------------------------------------------------------------

export async function etkinligeTedarikciEkle(input: {
  organizationId: string;
  eventId: string;
  supplierId: string;
  service?: string | null;
}): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };

  if (
    !uuidMi(input.organizationId) ||
    !uuidMi(input.eventId) ||
    !uuidMi(input.supplierId)
  ) {
    return { ok: false, hata: 'Seçim geçersiz.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_suppliers')
    .insert({
      organization_id: input.organizationId,
      event_id: input.eventId,
      supplier_id: input.supplierId,
      service: metin(input.service),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[tedarikci] atama ekle', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }

  tazeleDefter(input.supplierId, input.eventId);
  return { ok: true, id: (data as { id: string }).id };
}

export async function atamaGuncelle(g: {
  id: string;
  eventId?: string | null;
  service?: string | null;
  status?: string;
  notes?: string | null;
  sortOrder?: number;
}): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(g.id)) return { ok: false, hata: 'Atama bulunamadı.' };

  const yama: Record<string, unknown> = {};
  if (g.service !== undefined) yama.service = metin(g.service);
  if (g.status !== undefined) {
    if (!ATAMA_DURUMLARI.includes(g.status as never)) {
      return { ok: false, hata: 'Durum geçersiz.' };
    }
    yama.status = g.status;
  }
  if (g.notes !== undefined) yama.notes = metin(g.notes);
  if (g.sortOrder !== undefined) yama.sort_order = g.sortOrder;

  if (Object.keys(yama).length === 0) return { ok: true, id: g.id };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_suppliers')
    .update(yama)
    .eq('id', g.id)
    .select('id, event_id, supplier_id')
    .maybeSingle();

  if (error) {
    console.error('[tedarikci] atama guncelle', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }
  if (!data) return { ok: false, hata: 'Bu işlem için yetkin yok.' };

  const satir = data as { event_id: string; supplier_id: string };
  tazeleDefter(satir.supplier_id, satir.event_id);
  return { ok: true, id: g.id };
}

export async function atamaSil(
  id: string,
  eventId?: string | null
): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(id)) return { ok: false, hata: 'Atama bulunamadı.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_suppliers')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[tedarikci] atama sil', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, hata: 'Bu işlem için yetkin yok.' };
  }

  tazeleDefter(null, eventId);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Ic maliyet — YALNIZ RPC
// -----------------------------------------------------------------------------

export type TedarikciMaliyeti = {
  eventSupplierId: string;
  amount: number | null;
  note: string | null;
};

/**
 * Etkinligin tedarikci tutarlari.
 *
 * `null` DONERSE: yetki yok (42501) ya da kurulussuz etkinlik — UI tutar
 * sutununu HIC gostermez. Bos dizi ise yetki var ama henuz tutar girilmemis.
 * Ayrim onemli: "yetkisiz" ile "bos" ayni gorunurse kullanici eksik veri
 * sanirdi.
 */
export async function tedarikciMaliyetListele(
  eventId: string
): Promise<TedarikciMaliyeti[] | null> {
  const user = await getCachedUser();
  if (!user) return null;
  if (!uuidMi(eventId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    'internal_event_supplier_costs_list',
    { p_event_id: eventId }
  );

  if (error) {
    // 42501 beklenen durum (ticari yetki yok); gurultu yapmadan gizle.
    if (error.code !== '42501') {
      console.error('[tedarikci] maliyet listesi', error.code, error.message);
    }
    return null;
  }

  return (
    (data ?? []) as {
      event_supplier_id: string;
      agreed_amount: number | string | null;
      private_note: string | null;
    }[]
  ).map((m) => {
    const n = Number(m.agreed_amount);
    return {
      eventSupplierId: m.event_supplier_id,
      amount: Number.isFinite(n) ? n : null,
      note: m.private_note,
    };
  });
}

/** Tutar yazar; `amount === null` kaydi SILER (RPC dali). */
export async function tedarikciMaliyetYaz(
  eventSupplierId: string,
  amount: number | null,
  note?: string | null,
  eventId?: string | null
): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(eventSupplierId)) {
    return { ok: false, hata: 'Atama bulunamadı.' };
  }
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    return { ok: false, hata: 'Tutar 0 veya daha büyük olmalı.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('internal_event_supplier_cost_set', {
    p_event_supplier_id: eventSupplierId,
    p_amount: amount,
    p_note: metin(note),
  });

  if (error) {
    console.error('[tedarikci] maliyet yaz', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }

  if (eventId) revalidatePath(`/etkinliklerim/${eventId}`);
  return { ok: true, id: eventSupplierId };
}

// -----------------------------------------------------------------------------
// Kisa liste (alici)
// -----------------------------------------------------------------------------

export async function kisaListeOlustur(input: {
  organizationId: string;
  name: string;
  eventId?: string | null;
  notes?: string | null;
}): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(input.organizationId)) {
    return { ok: false, hata: 'Kuruluş seçimi geçersiz.' };
  }
  const ad = (input.name ?? '').trim();
  if (ad.length < 2 || ad.length > 120) {
    return { ok: false, hata: 'Liste adı 2–120 karakter olmalı.' };
  }
  if (input.eventId && !uuidMi(input.eventId)) {
    return { ok: false, hata: 'Etkinlik seçimi geçersiz.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('supplier_shortlists')
    .insert({
      organization_id: input.organizationId,
      name: ad,
      event_id: input.eventId || null,
      notes: metin(input.notes),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[kisa liste] olustur', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }

  tazeleListe();
  return { ok: true, id: (data as { id: string }).id };
}

export async function kisaListeGuncelle(g: {
  id: string;
  name?: string;
  eventId?: string | null;
  notes?: string | null;
}): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(g.id)) return { ok: false, hata: 'Liste bulunamadı.' };

  const yama: Record<string, unknown> = {};
  if (g.name !== undefined) {
    const ad = g.name.trim();
    if (ad.length < 2 || ad.length > 120) {
      return { ok: false, hata: 'Liste adı 2–120 karakter olmalı.' };
    }
    yama.name = ad;
  }
  if (g.eventId !== undefined) {
    if (g.eventId && !uuidMi(g.eventId)) {
      return { ok: false, hata: 'Etkinlik seçimi geçersiz.' };
    }
    yama.event_id = g.eventId || null;
  }
  if (g.notes !== undefined) yama.notes = metin(g.notes);

  if (Object.keys(yama).length === 0) return { ok: true, id: g.id };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('supplier_shortlists')
    .update(yama)
    .eq('id', g.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[kisa liste] guncelle', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }
  if (!data) return { ok: false, hata: 'Bu işlem için yetkin yok.' };

  tazeleListe();
  return { ok: true, id: g.id };
}

export async function kisaListeSil(id: string): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(id)) return { ok: false, hata: 'Liste bulunamadı.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('supplier_shortlists')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[kisa liste] sil', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, hata: 'Bu işlem için yetkin yok.' };
  }

  tazeleListe();
  return { ok: true };
}

export async function kisaListeyeEkle(
  shortlistId: string,
  providerId: string,
  note?: string | null
): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(shortlistId) || !uuidMi(providerId)) {
    return { ok: false, hata: 'Seçim geçersiz.' };
  }

  const supabase = await createClient();
  // `organization_id` GONDERILMEZ: tetikleyici listeden kopyalar.
  const { data, error } = await supabase
    .from('supplier_shortlist_items')
    .insert({
      shortlist_id: shortlistId,
      provider_id: providerId,
      note: metin(note),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[kisa liste] kalem ekle', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }

  tazeleListe();
  return { ok: true, id: (data as { id: string }).id };
}

export async function kisaListeKalemGuncelle(
  itemId: string,
  note: string | null
): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(itemId)) return { ok: false, hata: 'Kalem bulunamadı.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('supplier_shortlist_items')
    .update({ note: metin(note) })
    .eq('id', itemId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[kisa liste] kalem guncelle', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }
  if (!data) return { ok: false, hata: 'Bu işlem için yetkin yok.' };

  tazeleListe();
  return { ok: true, id: itemId };
}

export async function kisaListedenCikar(
  itemId: string
): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(itemId)) return { ok: false, hata: 'Kalem bulunamadı.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('supplier_shortlist_items')
    .delete()
    .eq('id', itemId)
    .select('id');

  if (error) {
    console.error('[kisa liste] kalem cikar', error.code, error.message);
    return { ok: false, hata: tedarikciHataMetni(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, hata: 'Bu işlem için yetkin yok.' };
  }

  tazeleListe();
  return { ok: true };
}

/** Hizli ekleme icin kurulusun varsayilan liste adi. */
const VARSAYILAN_LISTE_ADI = 'Genel';

/**
 * Kesfet / profil kisa yolu: TEK eylemle kisa listeye ekler.
 *
 * Kurulusun "Genel" adli listesi yoksa onu da acar — kullaniciya once "liste
 * olustur" adimi dayatmak kisa yolu kisa yol yapmazdi. Liste adi sabit ve
 * kullanici sonradan `/kurumsal/kisa-liste`'den degistirebilir.
 */
export async function kisaListeyeHizliEkle(
  organizationId: string,
  providerId: string
): Promise<TedarikciSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(organizationId) || !uuidMi(providerId)) {
    return { ok: false, hata: 'Seçim geçersiz.' };
  }

  const supabase = await createClient();

  const { data: mevcut, error: aramaHatasi } = await supabase
    .from('supplier_shortlists')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('name', VARSAYILAN_LISTE_ADI)
    .maybeSingle();

  if (aramaHatasi) {
    console.error('[kisa liste] hizli ekle arama', aramaHatasi.message);
    return { ok: false, hata: tedarikciHataMetni(aramaHatasi) };
  }

  let listeId = (mevcut as { id: string } | null)?.id ?? null;
  if (!listeId) {
    const res = await kisaListeOlustur({
      organizationId,
      name: VARSAYILAN_LISTE_ADI,
    });
    if (!res.ok) return res;
    listeId = res.id ?? null;
  }
  if (!listeId) return { ok: false, hata: 'Liste oluşturulamadı.' };

  const ekleme = await kisaListeyeEkle(listeId, providerId);
  if (!ekleme.ok) return ekleme;

  revalidatePath('/kesfet');
  return { ok: true, id: ekleme.id };
}
