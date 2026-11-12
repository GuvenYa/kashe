import type { createClient } from '@/app/lib/supabase-server';
import { getTeamContext } from '@/app/lib/business-write';
import { getCrewContext } from '@/app/lib/org-context';
import { gosterilecekAd } from '@/app/lib/kamu-adi';
import { etkinlikTurleri } from '@/app/lib/etkinlik-turleri';
import { etiketle } from '@/app/lib/etkinlik-turu';
import { gunAyMetni, istanbulGunu } from '@/app/lib/tarih';
import {
  formatQuoteAmount,
  getQuoteStatusLabel,
  teklifTarihiMetni,
  type QuoteStatus,
} from '@/app/mesajlar/quotes-data';
import type { Is, IsAsamasi, IsTeklifi, IsTonu } from '@/app/lib/isler';

/**
 * MUSTERI IS MERKEZI VERISI (Duzeltme 15-A, bulgu 128 - Fahri satir 33).
 *
 * Musterinin isi dort yere dagilmisti: sihirbaz etkinlikleri, teklif topla
 * talepleri, sohbetlerdeki dogrudan talepler ve rezervasyonlar. Bu modul
 * hepsini okuyup AYNI ISE AIT PARCALARI TEK KARTTA birlestirir:
 *
 *   - Sohbetteki is birimi = (sohbet, talep numarasi). Teklifler `request_no`
 *     ile, rezervasyon `quote_id` ile birime baglanir (Duzeltme 12-B).
 *   - Teklif topla talebi, alicilarinin sohbetlerindeki ilgili birimleri
 *     sahiplenir (alicinin yanit anindan sonraki ilk teklifin birimi).
 *   - Etkinlige bagli talep / birim / rezervasyon etkinlik kartinin altina
 *     girer (`event_id`); ayrica kart acilmaz.
 *
 * Yalniz OKUR; yeni DB nesnesi yok, gorunurluk mevcut RLS ile ayni. Sayilar
 * okunan satirlardan gelir (uydurma sayac yok).
 */
type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

type ProOzeti = {
  full_name: string | null;
  company_name: string | null;
  role: string;
} | null;

type EtkinlikSatiri = {
  id: string;
  title: string | null;
  event_type: string;
  start_date: string | null;
  end_date: string | null;
  is_date_flexible: boolean;
  participant_count: number | null;
  status: string;
  created_at: string;
  organization_id: string | null;
  event_types: { name_tr: string } | null;
  turkish_cities: { name: string } | null;
  event_requirements: { id: string }[] | null;
};

type TalepSatiri = {
  id: string;
  customer_id: string;
  status: string;
  recipient_count: number;
  created_at: string;
  response_deadline: string | null;
  event_date: string | null;
  event_type: string | null;
  event_id: string | null;
  service_categories: { name_tr: string } | null;
  turkish_cities: { name: string } | null;
  quote_request_recipients:
    | {
        id: string;
        status: string;
        conversation_id: string | null;
        responded_at: string | null;
      }[]
    | null;
};

type SohbetSatiri = {
  id: string;
  customer_id: string;
  professional_id: string;
  event_date: string | null;
  event_type: string | null;
  location: string | null;
  event_id: string | null;
  request_count: number | null;
  last_message_at: string | null;
  professional: ProOzeti;
};

type TeklifSatiri = {
  id: string;
  conversation_id: string;
  total_amount: number;
  currency: string;
  status: QuoteStatus;
  created_at: string;
  expires_at: string;
  event_date: string | null;
  request_no: number | null;
};

type RezervasyonSatiri = {
  id: string;
  quote_id: string | null;
  customer_id: string | null;
  professional_id: string | null;
  event_date: string | null;
  event_type: string | null;
  location: string | null;
  total_amount: number;
  currency: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  event_id: string | null;
  completion_requested_at: string | null;
  created_at: string;
  professional: ProOzeti;
};

/** Sohbetteki tek is: (sohbet, talep numarasi). */
type Birim = {
  anahtar: string;
  sohbet: SohbetSatiri;
  no: number;
  /** En yeni once. */
  teklifler: TeklifSatiri[];
  rezervasyon: RezervasyonSatiri | null;
};

type TalepDugumu = { talep: TalepSatiri; birimler: Birim[] };

type Cocuklar = {
  talepler: TalepDugumu[];
  birimler: Birim[];
  rezervasyonlar: RezervasyonSatiri[];
};

type Sirali = {
  is: Is;
  /** 0 = musteriden is bekleniyor (ustte). */
  oncelik: number;
  /** Son hareket (ms); yeni once. */
  zaman: number;
  /** Etkinlik gunu "YYYY-MM-DD"; yaklasanlar yakin tarihe gore dizilir. */
  gun: string | null;
  /** Karar bekleyen teklif sayisi (yalniz "bekleyen" asamasinda sayilir). */
  bekleyenTeklif: number;
  tamamlanmaOnayi: boolean;
};

export type MusteriIsleri = {
  /** Asamaya, sonra oncelige gore dizili. */
  isler: Is[];
  ozet: {
    /** "Teklif bekleyen" asamasindaki is sayisi. */
    acikIs: number;
    /** Bunlardan en az bir bekleyen teklifi olanlar. */
    teklifGelenIs: number;
    kararBekleyenTeklif: number;
    tamamlanmaOnayiBekleyen: number;
  };
};

const GUN_MS = 86_400_000;
/** Tarihsiz, teklifsiz dogrudan talep bu kadar gun "bekleyen" sayilir. */
const ACIK_TALEP_GUNU = 30;
const KART_TEKLIF_SINIRI = 3;

/** `event_status` etiketleri (etkinlik listesiyle ayni sozler). */
const ETKINLIK_DURUMU: Record<string, string> = {
  draft: 'Taslak',
  confirmed: 'Onaylandı',
  matching: 'Eşleştiriliyor',
  booked: 'Rezerve',
  running: 'Devam ediyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

const TALEP_DURUMU: Record<string, string> = {
  closed: 'Kapatıldı',
  expired: 'Süresi doldu',
  fulfilled: 'Tamamlandı',
};

function ms(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return isNaN(t) ? 0 : t;
}

function parcalar(...p: (string | null | undefined | false)[]): string | null {
  const dolu = p.filter((x): x is string => !!x);
  return dolu.length > 0 ? dolu.join(' · ') : null;
}

/** Gunluk is 'expired' yazana kadar suresi gecmis bekleyen teklif dolmus gorunur. */
function gorunenDurum(t: TeklifSatiri, simdi: number): QuoteStatus {
  return t.status === 'pending' && ms(t.expires_at) < simdi ? 'expired' : t.status;
}

function teklifTonu(d: QuoteStatus): IsTonu {
  return d === 'pending' ? 'vurgu' : d === 'accepted' ? 'olumlu' : 'soluk';
}

function proAdi(pro: ProOzeti, tamAd: boolean): string {
  if (!pro) return 'Profesyonel';
  if ((pro.role === 'agency' || pro.role === 'business') && pro.company_name) {
    return pro.company_name;
  }
  return gosterilecekAd(pro.role, pro.full_name, tamAd) || 'Profesyonel';
}

const REZ_SIRASI: Record<RezervasyonSatiri['status'], number> = {
  confirmed: 0,
  completed: 1,
  cancelled: 2,
};

/** Onayli > tamamlanan > iptal; esitlikte en yeni. */
function iyiRezervasyon(
  liste: (RezervasyonSatiri | null)[]
): RezervasyonSatiri | null {
  const dolu = liste.filter((r): r is RezervasyonSatiri => !!r);
  dolu.sort(
    (a, b) =>
      REZ_SIRASI[a.status] - REZ_SIRASI[b.status] ||
      ms(b.created_at) - ms(a.created_at)
  );
  return dolu[0] ?? null;
}

function rezervasyonDurumu(
  r: RezervasyonSatiri,
  bugun: string
): { asama: IsAsamasi; durum: string; ton: IsTonu; onay: boolean } {
  if (r.status === 'completed') {
    return { asama: 'tamamlanan', durum: 'Tamamlandı', ton: 'olumlu', onay: false };
  }
  if (r.status === 'cancelled') {
    return { asama: 'sonuclanmayan', durum: 'İptal edildi', ton: 'soluk', onay: false };
  }
  // Duzeltme 12-F: satici tarihten once tamamlanma onayi istedi.
  if (r.completion_requested_at) {
    return { asama: 'yaklasan', durum: 'Onayın bekleniyor', ton: 'vurgu', onay: true };
  }
  if (r.event_date && r.event_date < bugun) {
    return { asama: 'yaklasan', durum: 'Tarihi geçti', ton: 'notr', onay: false };
  }
  return { asama: 'yaklasan', durum: 'Rezervasyon onaylandı', ton: 'olumlu', onay: false };
}

export async function musteriIsleri(
  supabase: SunucuIstemcisi,
  userId: string
): Promise<MusteriIsleri> {
  const [{ teamBusinessIds }, { orgs }, turler] = await Promise.all([
    getTeamContext(),
    getCrewContext(),
    etkinlikTurleri({ hepsi: true }),
  ]);
  // Kendi isleri + uyesi oldugu kurumlarin isleri (RLS ayni kapsami veriyor).
  const musteriIdleri = [userId, ...teamBusinessIds];
  const orgIdleri = orgs.map((o) => o.id);

  // Etkinlikler: kendi + uyesi oldugu kurulus. RLS yoneticiye hepsini
  // gosterdigi icin suzgec ACIK yazilir (merkez kisinin kendi isleridir).
  const etkinlikSuzgeci = [
    `owner_user_id.eq.${userId}`,
    ...(orgIdleri.length > 0 ? [`organization_id.in.(${orgIdleri.join(',')})`] : []),
  ].join(',');

  const [etkinlikSonuc, talepSonuc, sohbetSonuc, teklifSonuc, rezSonuc] =
    await Promise.all([
      supabase
        .from('events')
        .select(
          `
          id, title, event_type, start_date, end_date, is_date_flexible,
          participant_count, status, created_at, organization_id,
          event_types (name_tr),
          turkish_cities (name),
          event_requirements (id)
        `
        )
        .or(etkinlikSuzgeci)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('quote_requests')
        .select(
          `
          id, customer_id, status, recipient_count, created_at,
          response_deadline, event_date, event_type, event_id,
          service_categories (name_tr),
          turkish_cities (name),
          quote_request_recipients (id, status, conversation_id, responded_at)
        `
        )
        .in('customer_id', musteriIdleri)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('conversations')
        .select(
          `
          id, customer_id, professional_id, event_date, event_type, location,
          event_id, request_count, last_message_at,
          professional:profiles!conversations_professional_id_fkey (full_name, company_name, role)
        `
        )
        .in('customer_id', musteriIdleri)
        .order('last_message_at', { ascending: false })
        .limit(300),
      supabase
        .from('quotes')
        .select(
          `
          id, conversation_id, total_amount, currency, status, created_at,
          expires_at, event_date, request_no,
          conversations!inner (customer_id)
        `
        )
        .in('conversations.customer_id', musteriIdleri)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('bookings')
        .select(
          `
          id, quote_id, customer_id, professional_id, event_date, event_type,
          location, total_amount, currency, status, event_id,
          completion_requested_at, created_at,
          professional:profiles!bookings_professional_id_fkey (full_name, company_name, role)
        `
        )
        .in('customer_id', musteriIdleri)
        .order('created_at', { ascending: false })
        .limit(300),
    ]);

  for (const [ad, sonuc] of [
    ['etkinlik', etkinlikSonuc],
    ['talep', talepSonuc],
    ['sohbet', sohbetSonuc],
    ['teklif', teklifSonuc],
    ['rezervasyon', rezSonuc],
  ] as const) {
    if (sonuc.error) {
      console.error('[etkinliklerim merkez]', ad, sonuc.error.code, sonuc.error.message);
    }
  }

  const etkinlikListesi = (etkinlikSonuc.data ?? []) as unknown as EtkinlikSatiri[];
  const talepListesi = (talepSonuc.data ?? []) as unknown as TalepSatiri[];
  const sohbetListesi = (sohbetSonuc.data ?? []) as unknown as SohbetSatiri[];
  const teklifListesi = (teklifSonuc.data ?? []) as unknown as TeklifSatiri[];
  // Teklif sekli rezervasyonlar (FAZ 7c, `quote_id` bos) kurulus yuzeylerinde.
  const rezListesi = ((rezSonuc.data ?? []) as unknown as RezervasyonSatiri[]).filter(
    (r) => !!r.quote_id
  );

  // Uyesi olunan kurumlarin adlari ("<Kurum> adina" etiketi).
  const kurumAdlari: Record<string, string> = {};
  if (teamBusinessIds.length > 0) {
    const { data: kurumlar } = await supabase
      .from('profiles')
      .select('id, full_name, company_name')
      .in('id', teamBusinessIds);
    for (const k of kurumlar ?? []) {
      kurumAdlari[k.id] = k.company_name || k.full_name || 'Kurum';
    }
  }
  const orgAdlari: Record<string, string> = {};
  for (const o of orgs) orgAdlari[o.id] = o.name;

  const simdi = Date.now();
  const bugun = istanbulGunu();

  // --- 1) Sohbet birimleri -------------------------------------------------
  const sohbetler = new Map<string, SohbetSatiri>();
  for (const s of sohbetListesi) sohbetler.set(s.id, s);

  const birimler = new Map<string, Birim>();
  const teklifBirimi = new Map<string, Birim>();
  const birimAl = (s: SohbetSatiri, no: number): Birim => {
    const anahtar = `${s.id}#${no}`;
    let b = birimler.get(anahtar);
    if (!b) {
      b = { anahtar, sohbet: s, no, teklifler: [], rezervasyon: null };
      birimler.set(anahtar, b);
    }
    return b;
  };
  // `teklifListesi` en yeni once geldigi icin birimdeki sira da oyle kalir.
  for (const t of teklifListesi) {
    const s = sohbetler.get(t.conversation_id);
    if (!s) continue;
    const b = birimAl(s, t.request_no ?? 1);
    b.teklifler.push(t);
    teklifBirimi.set(t.id, b);
  }
  // Sohbetin GUNCEL talebi teklif almamis olsa da bir istir ("teklif bekleniyor").
  for (const s of sohbetListesi) birimAl(s, s.request_count ?? 1);

  // --- 2) Rezervasyonlar birime baglanir ------------------------------------
  // Kamu ad kurali (Duzeltme 05-E) KISI bazinda: onayli ya da tamamlanmis
  // rezervasyonu olan profesyonelin tam adi gorunur.
  const tamAdliProlar = new Set<string>();
  const bagimsizRez: RezervasyonSatiri[] = [];
  for (const r of rezListesi) {
    if (r.professional_id && (r.status === 'confirmed' || r.status === 'completed')) {
      tamAdliProlar.add(r.professional_id);
    }
    const b = r.quote_id ? teklifBirimi.get(r.quote_id) : undefined;
    if (b) b.rezervasyon = iyiRezervasyon([b.rezervasyon, r]);
    else bagimsizRez.push(r);
  }

  // --- 3) Teklif topla talepleri birimleri sahiplenir -----------------------
  // Alicinin yanit anindan (yoksa talebin acilisindan) sonraki ILK teklifin
  // birimi o talebe aittir. Eski talep once sahiplenir: ayni profesyonele
  // ikinci talep, ikinci birimi alir.
  const sahiplenilen = new Set<string>();
  const talepDugumleri: TalepDugumu[] = [];
  for (const talep of [...talepListesi].reverse()) {
    const dugum: TalepDugumu = { talep, birimler: [] };
    for (const alici of talep.quote_request_recipients ?? []) {
      if (!alici.conversation_id) continue;
      const esik = ms(alici.responded_at ?? talep.created_at) - 5 * 60_000;
      let aday: TeklifSatiri | null = null;
      for (const t of teklifListesi) {
        if (t.conversation_id !== alici.conversation_id) continue;
        if (ms(t.created_at) < esik) continue;
        if (!aday || ms(t.created_at) < ms(aday.created_at)) aday = t;
      }
      const b = aday ? teklifBirimi.get(aday.id) : undefined;
      if (!b || sahiplenilen.has(b.anahtar)) continue;
      sahiplenilen.add(b.anahtar);
      dugum.birimler.push(b);
    }
    talepDugumleri.push(dugum);
  }

  // --- 4) Etkinlige bagli parcalar etkinlik kartina girer -------------------
  const etkinlikIdleri = new Set(etkinlikListesi.map((e) => e.id));
  const cocuklar = new Map<string, Cocuklar>();
  const cocukAl = (id: string): Cocuklar => {
    let c = cocuklar.get(id);
    if (!c) {
      c = { talepler: [], birimler: [], rezervasyonlar: [] };
      cocuklar.set(id, c);
    }
    return c;
  };

  const ustTalepler: TalepDugumu[] = [];
  for (const d of talepDugumleri) {
    const e = d.talep.event_id;
    if (e && etkinlikIdleri.has(e)) cocukAl(e).talepler.push(d);
    else ustTalepler.push(d);
  }
  const ustBirimler: Birim[] = [];
  for (const b of birimler.values()) {
    if (sahiplenilen.has(b.anahtar)) continue;
    // Sohbetin etkinlik bagi "en son is"e aittir (Yol A); eski birimler icin
    // yalniz rezervasyonun kendi bagi gecerli.
    const guncel = b.no === (b.sohbet.request_count ?? 1);
    const e = b.rezervasyon?.event_id ?? (guncel ? b.sohbet.event_id : null);
    if (e && etkinlikIdleri.has(e)) cocukAl(e).birimler.push(b);
    else ustBirimler.push(b);
  }
  const ustRez: RezervasyonSatiri[] = [];
  for (const r of bagimsizRez) {
    if (r.event_id && etkinlikIdleri.has(r.event_id)) {
      cocukAl(r.event_id).rezervasyonlar.push(r);
    } else {
      ustRez.push(r);
    }
  }

  // --- 5) Kartlar ----------------------------------------------------------
  const kurulusAdi = (musteriId: string | null): string | null =>
    musteriId && musteriId !== userId ? (kurumAdlari[musteriId] ?? 'Kurum') : null;

  const birimProAdi = (b: Birim): string =>
    proAdi(b.sohbet.professional, tamAdliProlar.has(b.sohbet.professional_id));

  const teklifSatiri = (t: TeklifSatiri, kimden: string): IsTeklifi => {
    const d = gorunenDurum(t, simdi);
    return {
      id: t.id,
      kimden,
      tutar: formatQuoteAmount(t.total_amount, t.currency),
      durum: getQuoteStatusLabel(d),
      ton: teklifTonu(d),
      href: `/mesajlar/${t.conversation_id}`,
    };
  };

  /** Bekleyen once, sonra onaylanan, sonra digerleri; icinde en yeni once. */
  const teklifleriDiz = (ciftler: { t: TeklifSatiri; kimden: string }[]) => {
    const sira = (t: TeklifSatiri) => {
      const d = gorunenDurum(t, simdi);
      return d === 'pending' ? 0 : d === 'accepted' ? 1 : 2;
    };
    const dizili = [...ciftler].sort(
      (a, b) => sira(a.t) - sira(b.t) || ms(b.t.created_at) - ms(a.t.created_at)
    );
    return {
      satirlar: dizili
        .slice(0, KART_TEKLIF_SINIRI)
        .map((c) => teklifSatiri(c.t, c.kimden)),
      kalan: Math.max(0, dizili.length - KART_TEKLIF_SINIRI),
      bekleyen: dizili.filter((c) => gorunenDurum(c.t, simdi) === 'pending').length,
      sonZaman: dizili.reduce((en, c) => Math.max(en, ms(c.t.created_at)), 0),
    };
  };

  /** Teklifsiz guncel talep hala acik mi (tarihi gelmedi / yeni yazildi). */
  const teklifsizAcik = (b: Birim): boolean => {
    const s = b.sohbet;
    if (b.no !== (s.request_count ?? 1)) return false;
    return s.event_date
      ? s.event_date >= bugun
      : simdi - ms(s.last_message_at) < ACIK_TALEP_GUNU * GUN_MS;
  };

  const talepKarti = (d: TalepDugumu): Sirali => {
    const { talep } = d;
    const { satirlar, kalan, bekleyen, sonZaman } = teklifleriDiz(
      d.birimler
        .filter((b) => b.teklifler.length > 0)
        .map((b) => ({ t: b.teklifler[0], kimden: birimProAdi(b) }))
    );
    const rez = iyiRezervasyon(d.birimler.map((b) => b.rezervasyon));
    const aktifRez = rez && rez.status !== 'cancelled' ? rez : null;

    let asama: IsAsamasi;
    let durum: string;
    let ton: IsTonu;
    let onay = false;
    if (aktifRez) {
      ({ asama, durum, ton, onay } = rezervasyonDurumu(aktifRez, bugun));
    } else if (talep.status === 'active') {
      asama = 'bekleyen';
      if (bekleyen > 0) {
        durum = `${bekleyen} teklif geldi`;
        ton = 'vurgu';
      } else if (talep.response_deadline && ms(talep.response_deadline) < simdi) {
        durum = 'Son tarih geçti';
        ton = 'soluk';
      } else {
        durum = 'Teklif bekleniyor';
        ton = 'notr';
      }
    } else if (talep.status === 'fulfilled') {
      asama = 'tamamlanan';
      durum = TALEP_DURUMU.fulfilled;
      ton = 'olumlu';
    } else {
      asama = 'sonuclanmayan';
      durum = rez ? 'İptal edildi' : (TALEP_DURUMU[talep.status] ?? 'Kapandı');
      ton = 'soluk';
    }

    const talepYolu = `/teklif-taleplerim/${talep.id}`;
    return {
      is: {
        anahtar: `talep-${talep.id}`,
        tur: 'teklif-topla',
        asama,
        baslik: talep.service_categories?.name_tr ?? 'Teklif talebi',
        ayrinti: parcalar(
          etiketle(turler, talep.event_type),
          teklifTarihiMetni(talep.event_date) ?? 'Tarih belirtilmedi',
          talep.turkish_cities?.name,
          `${talep.recipient_count} profesyonele gönderildi`
        ),
        durum,
        ton,
        href: aktifRez ? `/rezervasyon/${aktifRez.id}` : talepYolu,
        hrefEtiketi: aktifRez
          ? 'Rezervasyonu aç →'
          : satirlar.length > 0
            ? 'Teklifleri karşılaştır →'
            : 'Talebi aç →',
        ekBaglanti: aktifRez ? { href: talepYolu, etiket: 'Tüm teklifler' } : null,
        tutar: aktifRez
          ? formatQuoteAmount(aktifRez.total_amount, aktifRez.currency)
          : null,
        teklifler: satirlar,
        kalanTeklif: kalan,
        kurulus: kurulusAdi(talep.customer_id),
      },
      oncelik: ton === 'vurgu' ? 0 : 1,
      zaman: Math.max(ms(talep.created_at), sonZaman, ms(rez?.created_at)),
      gun: aktifRez?.event_date ?? talep.event_date,
      bekleyenTeklif: asama === 'bekleyen' ? bekleyen : 0,
      tamamlanmaOnayi: onay,
    };
  };

  const birimKarti = (b: Birim): Sirali => {
    const s = b.sohbet;
    const guncel = b.no === (s.request_count ?? 1);
    const rez = b.rezervasyon;
    const aktifRez = rez && rez.status !== 'cancelled' ? rez : null;
    const enYeni = b.teklifler[0] ?? null;
    const bekleyenler = b.teklifler.filter(
      (t) => gorunenDurum(t, simdi) === 'pending'
    );

    let asama: IsAsamasi;
    let durum: string;
    let ton: IsTonu;
    let onay = false;
    let tutarKaynagi: { total_amount: number; currency: string } | null = enYeni;
    if (aktifRez) {
      ({ asama, durum, ton, onay } = rezervasyonDurumu(aktifRez, bugun));
      tutarKaynagi = aktifRez;
    } else if (bekleyenler.length > 0) {
      asama = 'bekleyen';
      durum = 'Teklif geldi';
      ton = 'vurgu';
      tutarKaynagi = bekleyenler[0];
    } else if (rez) {
      asama = 'sonuclanmayan';
      durum = 'İptal edildi';
      ton = 'soluk';
      tutarKaynagi = rez;
    } else if (!enYeni) {
      if (teklifsizAcik(b)) {
        asama = 'bekleyen';
        durum = 'Teklif bekleniyor';
        ton = 'notr';
      } else {
        asama = 'sonuclanmayan';
        durum = 'Teklif gelmedi';
        ton = 'soluk';
      }
    } else {
      const d = gorunenDurum(enYeni, simdi);
      if (d === 'accepted') {
        // Kabul edilmis ama rezervasyon satiri okunamadi: is yine anlasilmis.
        asama = 'yaklasan';
        durum = 'Onaylandı';
        ton = 'olumlu';
      } else {
        asama = 'sonuclanmayan';
        durum = getQuoteStatusLabel(d);
        ton = 'soluk';
      }
    }

    const sohbetYolu = `/mesajlar/${s.id}`;
    // Tek teklifin tutari ve durumu kart basliginda zaten yaziyor; liste
    // yalniz birden cok teklif varsa (yenilenen teklif) acilir.
    const satirlar =
      !aktifRez && b.teklifler.length > 1
        ? b.teklifler
            .slice(0, KART_TEKLIF_SINIRI)
            .map((t) =>
              teklifSatiri(t, `${gunAyMetni(t.created_at) ?? ''} tarihli teklif`.trim())
            )
        : [];
    return {
      is: {
        anahtar: `birim-${b.anahtar}`,
        tur: 'talep',
        asama,
        baslik: birimProAdi(b),
        ayrinti: parcalar(
          etiketle(turler, aktifRez?.event_type ?? (guncel ? s.event_type : null)),
          teklifTarihiMetni(
            aktifRez?.event_date ?? enYeni?.event_date ?? (guncel ? s.event_date : null)
          ) ?? 'Tarih belirtilmedi',
          (aktifRez?.location ?? (guncel ? s.location : null))?.trim(),
          (s.request_count ?? 1) > 1 ? `Talep #${b.no}` : null
        ),
        durum,
        ton,
        href: aktifRez ? `/rezervasyon/${aktifRez.id}` : sohbetYolu,
        hrefEtiketi: aktifRez
          ? 'Rezervasyonu aç →'
          : bekleyenler.length > 0
            ? 'Teklifi incele →'
            : 'Sohbeti aç →',
        ekBaglanti: aktifRez ? { href: sohbetYolu, etiket: 'Sohbet' } : null,
        tutar: tutarKaynagi
          ? formatQuoteAmount(tutarKaynagi.total_amount, tutarKaynagi.currency)
          : null,
        teklifler: satirlar,
        kalanTeklif:
          satirlar.length > 0
            ? Math.max(0, b.teklifler.length - KART_TEKLIF_SINIRI)
            : 0,
        kurulus: kurulusAdi(s.customer_id),
      },
      oncelik: ton === 'vurgu' ? 0 : 1,
      zaman: Math.max(
        ms(enYeni?.created_at),
        ms(rez?.created_at),
        guncel ? ms(s.last_message_at) : 0
      ),
      gun:
        aktifRez?.event_date ?? enYeni?.event_date ?? (guncel ? s.event_date : null),
      bekleyenTeklif: asama === 'bekleyen' ? bekleyenler.length : 0,
      tamamlanmaOnayi: onay,
    };
  };

  const rezKarti = (r: RezervasyonSatiri): Sirali => {
    const { asama, durum, ton, onay } = rezervasyonDurumu(r, bugun);
    return {
      is: {
        anahtar: `rez-${r.id}`,
        tur: 'rezervasyon',
        asama,
        baslik: proAdi(r.professional, r.status !== 'cancelled'),
        ayrinti: parcalar(
          etiketle(turler, r.event_type),
          teklifTarihiMetni(r.event_date) ?? 'Tarih belirtilmedi',
          r.location?.trim()
        ),
        durum,
        ton,
        href: `/rezervasyon/${r.id}`,
        hrefEtiketi: 'Rezervasyonu aç →',
        ekBaglanti: null,
        tutar: formatQuoteAmount(r.total_amount, r.currency),
        teklifler: [],
        kalanTeklif: 0,
        kurulus: kurulusAdi(r.customer_id),
      },
      oncelik: ton === 'vurgu' ? 0 : 1,
      zaman: ms(r.created_at),
      gun: r.event_date,
      bekleyenTeklif: 0,
      tamamlanmaOnayi: onay,
    };
  };

  const etkinlikKarti = (e: EtkinlikSatiri): Sirali => {
    const c = cocuklar.get(e.id);
    const ciftler: { t: TeklifSatiri; kimden: string }[] = [];
    const rezler: RezervasyonSatiri[] = [];
    let acikCocuk = 0;
    const birimiEkle = (b: Birim) => {
      if (b.teklifler[0]) ciftler.push({ t: b.teklifler[0], kimden: birimProAdi(b) });
      if (b.rezervasyon) rezler.push(b.rezervasyon);
    };
    for (const d of c?.talepler ?? []) {
      d.birimler.forEach(birimiEkle);
      if (d.talep.status === 'active') acikCocuk += 1;
    }
    for (const b of c?.birimler ?? []) {
      birimiEkle(b);
      if (!b.teklifler[0] && !b.rezervasyon && teklifsizAcik(b)) acikCocuk += 1;
    }
    rezler.push(...(c?.rezervasyonlar ?? []));
    const cocukVar =
      !!c && c.talepler.length + c.birimler.length + c.rezervasyonlar.length > 0;

    const { satirlar, kalan, bekleyen, sonZaman } = teklifleriDiz(ciftler);
    const onayli = rezler.filter((r) => r.status === 'confirmed');
    const tamamlanan = rezler.filter((r) => r.status === 'completed');
    const onayBekleyen = onayli.some((r) => !!r.completion_requested_at);
    const sonGun = e.end_date ?? e.start_date;
    const gecti = !!sonGun && sonGun < bugun;

    let asama: IsAsamasi;
    let durum: string;
    let ton: IsTonu;
    if (e.status === 'cancelled') {
      asama = 'sonuclanmayan';
      durum = ETKINLIK_DURUMU.cancelled;
      ton = 'soluk';
    } else if (e.status === 'completed') {
      asama = 'tamamlanan';
      durum = ETKINLIK_DURUMU.completed;
      ton = 'olumlu';
    } else if (bekleyen > 0) {
      asama = 'bekleyen';
      durum = `${bekleyen} teklif geldi`;
      ton = 'vurgu';
    } else if (onayBekleyen) {
      asama = 'yaklasan';
      durum = 'Onayın bekleniyor';
      ton = 'vurgu';
    } else if (!gecti && acikCocuk > 0) {
      asama = 'bekleyen';
      durum = 'Teklif bekleniyor';
      ton = 'notr';
    } else if (onayli.length > 0) {
      asama = 'yaklasan';
      durum = gecti ? 'Tarihi geçti' : `${onayli.length} rezervasyon`;
      ton = gecti ? 'notr' : 'olumlu';
    } else if (gecti) {
      asama = tamamlanan.length > 0 ? 'tamamlanan' : 'sonuclanmayan';
      durum = tamamlanan.length > 0 ? ETKINLIK_DURUMU.completed : 'Tarihi geçti';
      ton = tamamlanan.length > 0 ? 'olumlu' : 'soluk';
    } else if (e.status === 'booked' || e.status === 'running') {
      asama = 'yaklasan';
      durum = ETKINLIK_DURUMU[e.status];
      ton = 'olumlu';
    } else {
      asama = 'bekleyen';
      durum =
        e.status === 'draft'
          ? ETKINLIK_DURUMU.draft
          : cocukVar
            ? (ETKINLIK_DURUMU[e.status] ?? e.status)
            : 'Teklif istenmedi';
      ton = 'notr';
    }

    const turAdi = e.event_types?.name_tr ?? etiketle(turler, e.event_type);
    const sehir = e.turkish_cities?.name ?? null;
    const bas = teklifTarihiMetni(e.start_date);
    const son =
      e.end_date && e.end_date !== e.start_date ? teklifTarihiMetni(e.end_date) : null;
    const tarih = bas
      ? son
        ? `${bas} → ${son}`
        : bas
      : e.is_date_flexible
        ? 'Tarih esnek'
        : 'Tarih belirtilmedi';
    const ihtiyac = (e.event_requirements ?? []).length;
    return {
      is: {
        anahtar: `etkinlik-${e.id}`,
        tur: 'etkinlik',
        asama,
        baslik: e.title || parcalar(turAdi, sehir) || 'Etkinlik',
        ayrinti: parcalar(
          e.title ? turAdi : null,
          tarih,
          e.title ? sehir : null,
          e.participant_count ? `${e.participant_count} kişi` : null,
          ihtiyac > 0 ? `${ihtiyac} ihtiyaç` : null
        ),
        durum,
        ton,
        href: `/etkinliklerim/${e.id}`,
        hrefEtiketi: 'Etkinliği aç →',
        ekBaglanti: null,
        tutar: null,
        teklifler: satirlar,
        kalanTeklif: kalan,
        kurulus: e.organization_id ? (orgAdlari[e.organization_id] ?? null) : null,
      },
      oncelik: ton === 'vurgu' ? 0 : 1,
      zaman: Math.max(
        ms(e.created_at),
        sonZaman,
        rezler.reduce((en, r) => Math.max(en, ms(r.created_at)), 0)
      ),
      gun: e.start_date,
      bekleyenTeklif: asama === 'bekleyen' ? bekleyen : 0,
      tamamlanmaOnayi: onayBekleyen,
    };
  };

  const hepsi: Sirali[] = [
    ...etkinlikListesi.map(etkinlikKarti),
    ...ustTalepler.map(talepKarti),
    ...ustBirimler.map(birimKarti),
    ...ustRez.map(rezKarti),
  ];

  const ASAMA_SIRASI: Record<IsAsamasi, number> = {
    bekleyen: 0,
    yaklasan: 1,
    tamamlanan: 2,
    sonuclanmayan: 3,
  };
  hepsi.sort((a, b) => {
    if (a.is.asama !== b.is.asama) {
      return ASAMA_SIRASI[a.is.asama] - ASAMA_SIRASI[b.is.asama];
    }
    if (a.oncelik !== b.oncelik) return a.oncelik - b.oncelik;
    if (a.is.asama === 'yaklasan') {
      // Yakin tarih once; tarihsiz sonda.
      const ag = a.gun ?? '9999-12-31';
      const bg = b.gun ?? '9999-12-31';
      if (ag !== bg) return ag < bg ? -1 : 1;
    }
    return b.zaman - a.zaman;
  });

  const bekleyenler = hepsi.filter((s) => s.is.asama === 'bekleyen');
  return {
    isler: hepsi.map((s) => s.is),
    ozet: {
      acikIs: bekleyenler.length,
      teklifGelenIs: bekleyenler.filter((s) => s.bekleyenTeklif > 0).length,
      kararBekleyenTeklif: bekleyenler.reduce((t, s) => t + s.bekleyenTeklif, 0),
      tamamlanmaOnayiBekleyen: hepsi.filter((s) => s.tamamlanmaOnayi).length,
    },
  };
}
