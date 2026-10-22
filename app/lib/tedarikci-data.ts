import { createClient } from '@/app/lib/supabase-server';
import {
  AKTIF_DURUMLAR,
  type AtamaDurumu,
  type TedarikciKategorisi,
} from '@/app/lib/tedarikci';

/**
 * FAZ 8c — tedarikci ve kisa liste okuma katmani (SUNUCU modulu).
 *
 * `'use client'` YOKTUR ve ISTEMCIDEN IMPORT EDILMEZ: `createClient` sunucu
 * istemcisidir. Istemcinin ihtiyac duydugu sabitler `app/lib/tedarikci.ts`'de.
 *
 * Yetkiyi RLS zorlar (`suppliers.view` / `events.view`); burada tekrar kontrol
 * YOK — baska kurulusun satiri sorguya girmez. `suppliers.email/phone/
 * contact_name` yalniz bu sorgulardan geliyor, yani yalniz kurulus ici
 * yuzeylerde gorunur.
 *
 * `internal.event_supplier_costs` BURADAN OKUNMAZ: tutar yalniz iki RPC ile
 * (`tedarikci-actions.ts`).
 *
 * N+1 YOK: her liste ic bilgiyi TEK toplu sorguyla cozer.
 */

export type Tedarikci = {
  id: string;
  name: string;
  category: TedarikciKategorisi;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  cityId: number | null;
  cityName: string | null;
  rating: number | null;
  notes: string | null;
  linkedProviderId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TedarikciSatiri = Tedarikci & {
  /** Atandigi etkinlik sayisi (durum ayrimi yok). */
  etkinlikSayisi: number;
};

export type Atama = {
  id: string;
  eventId: string;
  supplierId: string;
  service: string | null;
  status: AtamaDurumu;
  notes: string | null;
  sortOrder: number;
  /** Embed'den gelen tedarikci bilgisi. */
  tedarikciAdi: string;
  tedarikciKategorisi: TedarikciKategorisi;
  tedarikciTelefonu: string | null;
  tedarikciEpostasi: string | null;
};

export type TedarikciEtkinligi = {
  atamaId: string;
  eventId: string;
  eventTitle: string | null;
  startDate: string | null;
  service: string | null;
  status: AtamaDurumu;
};

export type KisaListe = {
  id: string;
  name: string;
  eventId: string | null;
  eventTitle: string | null;
  notes: string | null;
  kalemSayisi: number;
  createdAt: string;
};

export type KisaListeKalemi = {
  id: string;
  providerId: string;
  note: string | null;
  /** `v_providers_public`'ten (FAZ 2c sozlesmesi). */
  ad: string;
  sehir: string | null;
  tur: string;
};

const TEDARIKCI_ALANLARI = `id, name, category, contact_name, email, phone, website,
   city_id, rating, notes, linked_provider_id, is_active, created_at, updated_at,
   turkish_cities(name)`;

type TedarikciHam = {
  id: string;
  name: string;
  category: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city_id: number | null;
  rating: number | null;
  notes: string | null;
  linked_provider_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  turkish_cities: { name: string } | null;
};

function tedarikciKur(h: TedarikciHam): Tedarikci {
  return {
    id: h.id,
    name: h.name,
    category: (h.category as TedarikciKategorisi) ?? 'other',
    contactName: h.contact_name,
    email: h.email,
    phone: h.phone,
    website: h.website,
    cityId: h.city_id,
    cityName: h.turkish_cities?.name ?? null,
    rating: h.rating,
    notes: h.notes,
    linkedProviderId: h.linked_provider_id,
    isActive: h.is_active,
    createdAt: h.created_at,
    updatedAt: h.updated_at,
  };
}

/**
 * Arama metnini `or()` icin guvenli hale getirir.
 *
 * PostgREST `or` dizgesinde virgul ve parantez AYIRICIDIR; temizlenmeden
 * gonderilen metin sorguyu bozar. Yuzde isareti de kaldirilir: kullanici kendi
 * joker karakterini yazmasin (8b `crm-data.ts` ile ayni kural).
 */
function aramaMetni(q: string | null | undefined): string | null {
  const t = (q ?? '').trim().replace(/[,()%*\\]/g, '');
  if (t.length < 2) return null;
  return t.slice(0, 80);
}

/** Tedarikci defteri. `arsiv` false ise yalniz aktif kayitlar. */
export async function tedarikcileriListele(
  orgId: string,
  opts?: { q?: string | null; kategori?: string | null; arsiv?: boolean }
): Promise<TedarikciSatiri[]> {
  const supabase = await createClient();
  const arama = aramaMetni(opts?.q);

  let sorgu = supabase
    .from('suppliers')
    .select(TEDARIKCI_ALANLARI)
    .eq('organization_id', orgId)
    .order('name', { ascending: true })
    .limit(500);

  if (!opts?.arsiv) sorgu = sorgu.eq('is_active', true);
  if (opts?.kategori) sorgu = sorgu.eq('category', opts.kategori);
  if (arama) {
    sorgu = sorgu.or(
      `name.ilike.%${arama}%,contact_name.ilike.%${arama}%,email.ilike.%${arama}%`
    );
  }

  const { data, error } = await sorgu;
  if (error) {
    console.error('[tedarikci] liste', error.code, error.message);
    return [];
  }

  const kayitlar = ((data ?? []) as unknown as TedarikciHam[]).map(
    tedarikciKur
  );
  if (kayitlar.length === 0) return [];

  // Etkinlik sayisi TEK toplu sorgu (kayit basina sorgu YOK).
  const { data: atamaData, error: atamaHatasi } = await supabase
    .from('event_suppliers')
    .select('supplier_id')
    .eq('organization_id', orgId)
    .in(
      'supplier_id',
      kayitlar.map((k) => k.id)
    );
  if (atamaHatasi) {
    console.error('[tedarikci] atama sayimi', atamaHatasi.message);
  }

  const sayim = new Map<string, number>();
  for (const a of (atamaData ?? []) as { supplier_id: string }[]) {
    sayim.set(a.supplier_id, (sayim.get(a.supplier_id) ?? 0) + 1);
  }

  return kayitlar.map((k) => ({
    ...k,
    etkinlikSayisi: sayim.get(k.id) ?? 0,
  }));
}

export type TedarikciDetayi = {
  tedarikci: Tedarikci;
  /** Bagli Kashe saglayicisinin gorunen adi (`v_providers_public`). */
  bagliSaglayiciAdi: string | null;
  etkinlikler: TedarikciEtkinligi[];
  /** Aktivite akisinin suzecegi kimlikler (tedarikci + atamalari). */
  aktiviteKimlikleri: string[];
};

/** Tedarikci sayfasinin tum verisi. Bulunamazsa (ya da RLS keserse) null. */
export async function tedarikciDetay(
  orgId: string,
  id: string
): Promise<TedarikciDetayi | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('suppliers')
    .select(TEDARIKCI_ALANLARI)
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[tedarikci] detay', error.code, error.message);
    return null;
  }
  if (!data) return null;

  const tedarikci = tedarikciKur(data as unknown as TedarikciHam);

  const [atamaSonuc, saglayiciSonuc] = await Promise.all([
    supabase
      .from('event_suppliers')
      .select('id, event_id, service, status, events(title, start_date)')
      .eq('organization_id', orgId)
      .eq('supplier_id', id)
      .order('created_at', { ascending: false })
      .limit(200),
    // Pazaryeri adi GORUNUMDEN (FAZ 2c sozlesmesi), `profiles`'tan DEGIL.
    tedarikci.linkedProviderId
      ? supabase
          .from('v_providers_public')
          .select('id, display_name')
          .eq('id', tedarikci.linkedProviderId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (atamaSonuc.error) {
    console.error('[tedarikci] etkinlikler', atamaSonuc.error.message);
  }

  const etkinlikler = (
    (atamaSonuc.data ?? []) as unknown as {
      id: string;
      event_id: string;
      service: string | null;
      status: string;
      events: { title: string | null; start_date: string | null } | null;
    }[]
  ).map((a) => ({
    atamaId: a.id,
    eventId: a.event_id,
    eventTitle: a.events?.title?.trim() || null,
    startDate: a.events?.start_date ?? null,
    service: a.service,
    status: (a.status as AtamaDurumu) ?? 'planned',
  }));

  return {
    tedarikci,
    bagliSaglayiciAdi:
      (saglayiciSonuc.data as { display_name: string | null } | null)
        ?.display_name?.trim() || null,
    etkinlikler,
    aktiviteKimlikleri: [tedarikci.id, ...etkinlikler.map((e) => e.atamaId)],
  };
}

/** Etkinlik sekmesinin atama listesi. */
export async function etkinlikTedarikcileri(
  orgId: string,
  eventId: string
): Promise<Atama[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_suppliers')
    .select(
      `id, event_id, supplier_id, service, status, notes, sort_order,
       suppliers(name, category, phone, email)`
    )
    .eq('organization_id', orgId)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[tedarikci] etkinlik atamalari', error.code, error.message);
    return [];
  }

  return (
    (data ?? []) as unknown as {
      id: string;
      event_id: string;
      supplier_id: string;
      service: string | null;
      status: string;
      notes: string | null;
      sort_order: number;
      suppliers: {
        name: string;
        category: string;
        phone: string | null;
        email: string | null;
      } | null;
    }[]
  ).map((a) => ({
    id: a.id,
    eventId: a.event_id,
    supplierId: a.supplier_id,
    service: a.service,
    status: (a.status as AtamaDurumu) ?? 'planned',
    notes: a.notes,
    sortOrder: a.sort_order,
    tedarikciAdi: a.suppliers?.name?.trim() || 'Tedarikçi',
    tedarikciKategorisi:
      (a.suppliers?.category as TedarikciKategorisi) ?? 'other',
    tedarikciTelefonu: a.suppliers?.phone ?? null,
    tedarikciEpostasi: a.suppliers?.email ?? null,
  }));
}

/** Atama formunun secenekleri — yalniz AKTIF tedarikciler (arsiv atanamaz). */
export async function tedarikciSecenekleri(
  orgId: string
): Promise<{ id: string; ad: string; kategori: TedarikciKategorisi }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, category')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(500);

  if (error) {
    console.error('[tedarikci] secenekler', error.code, error.message);
    return [];
  }
  return (
    (data ?? []) as { id: string; name: string; category: string }[]
  ).map((s) => ({
    id: s.id,
    ad: s.name,
    kategori: (s.category as TedarikciKategorisi) ?? 'other',
  }));
}

/** KPI sayilari. TEK defter + TEK atama sorgusu; ayrim bellekte. */
export async function tedarikciSayilari(orgId: string): Promise<{
  aktif: number;
  arsiv: number;
  kategori: number;
  aktifAtama: number;
}> {
  const supabase = await createClient();

  const [defterSonuc, atamaSonuc] = await Promise.all([
    supabase
      .from('suppliers')
      .select('category, is_active')
      .eq('organization_id', orgId)
      .limit(1000),
    supabase
      .from('event_suppliers')
      .select('status')
      .eq('organization_id', orgId)
      .in('status', AKTIF_DURUMLAR)
      .limit(2000),
  ]);

  if (defterSonuc.error) {
    console.error('[tedarikci] sayilar', defterSonuc.error.message);
  }

  let aktif = 0;
  let arsiv = 0;
  const kategoriler = new Set<string>();
  for (const s of (defterSonuc.data ?? []) as {
    category: string;
    is_active: boolean;
  }[]) {
    if (s.is_active) {
      aktif += 1;
      kategoriler.add(s.category);
    } else {
      arsiv += 1;
    }
  }

  return {
    aktif,
    arsiv,
    kategori: kategoriler.size,
    aktifAtama: (atamaSonuc.data ?? []).length,
  };
}

/** `/ajans` gostergesindeki kucuk satir icin iki sayi. */
export async function tedarikciOzeti(
  orgId: string
): Promise<{ aktif: number; aktifAtama: number }> {
  const sayilar = await tedarikciSayilari(orgId);
  return { aktif: sayilar.aktif, aktifAtama: sayilar.aktifAtama };
}

/**
 * Aktivite akisinin etkinlik suzgeci icin: o etkinligin ATAMA kimlikleri.
 *
 * `activity_logs` atamanin kimligini tasiyor, etkinligin degil — gorev
 * kimlikleriyle ayni kalip (bkz. `aktiviteGetir`). Yardimci BURADA duruyor ki
 * tedarikci tablo adlari bu modulun disina tasinmasin.
 */
export async function etkinlikAtamaKimlikleri(
  orgId: string,
  eventId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_suppliers')
    .select('id')
    .eq('organization_id', orgId)
    .eq('event_id', eventId)
    .limit(500);
  if (error) {
    console.error('[tedarikci] atama kimlikleri', error.message);
    return [];
  }
  return ((data ?? []) as { id: string }[]).map((a) => a.id);
}

/**
 * Aktivite cumlesindeki tedarikci ve saglayici adlari.
 *
 * Diff kimlik tasiyor; adi burada cozulur. Saglayici adi GORUNUMDEN
 * (`v_providers_public`) okunur — FAZ 2c okuma sozlesmesi.
 */
export async function tedarikciVeSaglayiciAdlari(
  idler: string[]
): Promise<Map<string, string>> {
  const harita = new Map<string, string>();
  if (idler.length === 0) return harita;

  const supabase = await createClient();
  const [tedarikciler, saglayicilar] = await Promise.all([
    supabase.from('suppliers').select('id, name').in('id', idler),
    supabase
      .from('v_providers_public')
      .select('id, display_name')
      .in('id', idler),
  ]);

  for (const t of (tedarikciler.data ?? []) as {
    id: string;
    name: string;
  }[]) {
    harita.set(t.id, t.name);
  }
  for (const s of (saglayicilar.data ?? []) as {
    id: string;
    display_name: string | null;
  }[]) {
    if (s.display_name?.trim()) harita.set(s.id, s.display_name.trim());
  }
  return harita;
}

// -----------------------------------------------------------------------------
// Kisa liste (alici)
// -----------------------------------------------------------------------------

export async function kisaListeleriListele(
  orgId: string
): Promise<KisaListe[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('supplier_shortlists')
    .select(
      'id, name, event_id, notes, created_at, supplier_shortlist_items(count), events(title)'
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[kisa liste] liste', error.code, error.message);
    return [];
  }

  return (
    (data ?? []) as unknown as {
      id: string;
      name: string;
      event_id: string | null;
      notes: string | null;
      created_at: string;
      supplier_shortlist_items: { count: number }[] | null;
      events: { title: string | null } | null;
    }[]
  ).map((l) => ({
    id: l.id,
    name: l.name,
    eventId: l.event_id,
    eventTitle: l.events?.title?.trim() || null,
    notes: l.notes,
    kalemSayisi: l.supplier_shortlist_items?.[0]?.count ?? 0,
    createdAt: l.created_at,
  }));
}

/**
 * Kisa listenin kalemleri.
 *
 * Saglayici bilgisi YALNIZ `v_providers_public`'ten okunur (FAZ 2c okuma
 * sozlesmesi): ad, sehir ve tur. Saglayicinin iletisim bilgisi (e-posta,
 * telefon) BURADA OKUNMAZ — alici kisa listesi bir pazaryeri secki listesidir,
 * PII deposu degil.
 */
export async function kisaListeDetay(
  orgId: string,
  listeId: string
): Promise<{ liste: KisaListe; kalemler: KisaListeKalemi[] } | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('supplier_shortlists')
    .select('id, name, event_id, notes, created_at, events(title)')
    .eq('organization_id', orgId)
    .eq('id', listeId)
    .maybeSingle();

  if (error) {
    console.error('[kisa liste] detay', error.code, error.message);
    return null;
  }
  if (!data) return null;

  const ham = data as unknown as {
    id: string;
    name: string;
    event_id: string | null;
    notes: string | null;
    created_at: string;
    events: { title: string | null } | null;
  };

  const { data: kalemData, error: kalemHatasi } = await supabase
    .from('supplier_shortlist_items')
    .select('id, provider_id, note, created_at')
    .eq('shortlist_id', listeId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (kalemHatasi) {
    console.error('[kisa liste] kalemler', kalemHatasi.message);
  }

  const hamKalemler = (kalemData ?? []) as {
    id: string;
    provider_id: string;
    note: string | null;
  }[];

  // Saglayici adlari TEK toplu sorgu (gorunumden).
  const saglayiciMap = new Map<
    string,
    { ad: string; sehir: string | null; tur: string }
  >();
  if (hamKalemler.length > 0) {
    const { data: sagData, error: sagHatasi } = await supabase
      .from('v_providers_public')
      .select('id, display_name, provider_type, city_id')
      .in(
        'id',
        hamKalemler.map((k) => k.provider_id)
      );
    if (sagHatasi) {
      console.error('[kisa liste] saglayicilar', sagHatasi.message);
    }

    const saglayicilar = (sagData ?? []) as {
      id: string;
      display_name: string | null;
      provider_type: string;
      city_id: number | null;
    }[];

    const sehirIdleri = [
      ...new Set(
        saglayicilar
          .map((s) => s.city_id)
          .filter((v): v is number => typeof v === 'number')
      ),
    ];
    const sehirMap = new Map<number, string>();
    if (sehirIdleri.length > 0) {
      const { data: sehirData } = await supabase
        .from('turkish_cities')
        .select('id, name')
        .in('id', sehirIdleri);
      for (const s of (sehirData ?? []) as { id: number; name: string }[]) {
        sehirMap.set(s.id, s.name);
      }
    }

    for (const s of saglayicilar) {
      saglayiciMap.set(s.id, {
        ad: s.display_name?.trim() || 'İsimsiz profil',
        sehir: s.city_id != null ? (sehirMap.get(s.city_id) ?? null) : null,
        tur: s.provider_type,
      });
    }
  }

  return {
    liste: {
      id: ham.id,
      name: ham.name,
      eventId: ham.event_id,
      eventTitle: ham.events?.title?.trim() || null,
      notes: ham.notes,
      kalemSayisi: hamKalemler.length,
      createdAt: ham.created_at,
    },
    kalemler: hamKalemler.map((k) => {
      const s = saglayiciMap.get(k.provider_id);
      return {
        id: k.id,
        providerId: k.provider_id,
        note: k.note,
        ad: s?.ad ?? 'İsimsiz profil',
        sehir: s?.sehir ?? null,
        tur: s?.tur ?? 'professional',
      };
    }),
  };
}

/**
 * Kesfet kartlari icin: verilen saglayicilardan hangileri kurulusun herhangi
 * bir kisa listesinde. TEK sorgu; kart basina sorgu YOK.
 */
export async function kisaListeDurumu(
  orgId: string,
  providerIds: string[]
): Promise<Set<string>> {
  if (providerIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('supplier_shortlist_items')
    .select('provider_id')
    .eq('organization_id', orgId)
    .in('provider_id', providerIds);

  if (error) {
    console.error('[kisa liste] durum', error.code, error.message);
    return new Set();
  }
  return new Set(
    ((data ?? []) as { provider_id: string }[]).map((k) => k.provider_id)
  );
}

/**
 * Bir saglayici, verilen kuruluslarin HANGISININ kisa listesinde?
 *
 * `/p/[id]` bandi icin: kullanicinin birden cok kurulusu olabilir ve bant her
 * biri icin durum gosterir. TEK sorgu; kurulus basina sorgu YOK.
 */
export async function kisaListedekiKuruluslar(
  orgIds: string[],
  providerId: string
): Promise<Set<string>> {
  if (orgIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('supplier_shortlist_items')
    .select('organization_id')
    .eq('provider_id', providerId)
    .in('organization_id', orgIds);

  if (error) {
    console.error('[kisa liste] kurulus durumu', error.code, error.message);
    return new Set();
  }
  return new Set(
    ((data ?? []) as { organization_id: string }[]).map((k) => k.organization_id)
  );
}

/**
 * RFP davet kutusunun "Kisa listeden sec" blogu: kurulusun kisa
 * listelerindeki AJANS (organization) saglayicilari.
 *
 * Profesyonel kalemler DISARIDA: RFP yalniz ajansa gider (FAZ 7b karari).
 */
export async function kisaListedekiAjanslar(
  orgId: string
): Promise<{ providerId: string; ad: string; listeAdi: string }[]> {
  const supabase = await createClient();

  const { data: kalemData, error } = await supabase
    .from('supplier_shortlist_items')
    .select('provider_id, supplier_shortlists(name)')
    .eq('organization_id', orgId)
    .limit(500);

  if (error) {
    console.error('[kisa liste] ajanslar', error.code, error.message);
    return [];
  }

  const kalemler = (kalemData ?? []) as unknown as {
    provider_id: string;
    supplier_shortlists: { name: string } | null;
  }[];
  if (kalemler.length === 0) return [];

  const { data: sagData } = await supabase
    .from('v_providers_public')
    .select('id, display_name, provider_type')
    .in(
      'id',
      [...new Set(kalemler.map((k) => k.provider_id))]
    )
    .eq('provider_type', 'organization');

  const ajanslar = new Map<string, string>();
  for (const s of (sagData ?? []) as {
    id: string;
    display_name: string | null;
  }[]) {
    ajanslar.set(s.id, s.display_name?.trim() || 'İsimsiz kuruluş');
  }

  const gorulen = new Set<string>();
  const sonuc: { providerId: string; ad: string; listeAdi: string }[] = [];
  for (const k of kalemler) {
    const ad = ajanslar.get(k.provider_id);
    if (!ad || gorulen.has(k.provider_id)) continue;
    gorulen.add(k.provider_id);
    sonuc.push({
      providerId: k.provider_id,
      ad,
      listeAdi: k.supplier_shortlists?.name?.trim() || 'Kısa liste',
    });
  }
  return sonuc;
}
