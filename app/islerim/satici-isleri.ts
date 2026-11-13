import type { createClient } from '@/app/lib/supabase-server';
import { etkinlikTurleri } from '@/app/lib/etkinlik-turleri';
import { etiketle } from '@/app/lib/etkinlik-turu';
import { gunAyMetni, istanbulGunu } from '@/app/lib/tarih';
import {
  formatQuoteAmount,
  getQuoteStatusLabel,
  teklifTarihiMetni,
} from '@/app/mesajlar/quotes-data';
import type { Is, IsAsamasi, IsTeklifi, IsTonu } from '@/app/lib/isler';
import { BRIEF_TERCIH_UYE_ADI, briefKonumu } from '@/app/lib/brief-anahtarlari';
import {
  birimleriKur,
  gorunenDurum,
  ms,
  type IsBirimi,
  type IsRezervasyonu,
  type IsSohbeti,
  type IsTeklifSatiri,
  type KisiOzeti,
} from '@/app/lib/is-birimleri';

/**
 * PROFESYONEL IS MERKEZI VERISI (Duzeltme 15-B, bulgu 129 - Fahri satir 34).
 *
 * Profesyonelin isi dort yere dagilmisti: gelen teklif topla talepleri,
 * verdigi teklifler, rezervasyonlar ve sohbetlerdeki dogrudan talepler. Bu
 * modul hepsini okuyup musteri merkeziyle AYNI is birimlerine indirir
 * (`app/lib/is-birimleri.ts`); fark bakistadir: kartta musterinin adi yazar,
 * "vurgu" profesyonelden is beklenen durumdur (yanit ver, isi tamamla).
 *
 * Asamalar: bekleyen = "Yanit bekleyen" (teklif vermedigi talepler),
 * teklif = "Teklif verdiklerim" (musterinin kararini bekleyen), yaklasan =
 * "Anlasilan" (onayli rezervasyon), tamamlanan, sonuclanmayan.
 *
 * Yalniz OKUR; yeni DB nesnesi yok, gorunurluk mevcut RLS ile ayni. Kapsam
 * kisinin KENDI sohbetleridir (`professional_id` = kendisi); ajansin ona
 * atadigi sohbetler ajans panelinde kalir.
 */
type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

type AliciSatiri = {
  id: string;
  status: string;
  conversation_id: string | null;
  created_at: string;
  responded_at: string | null;
  quote_requests: {
    id: string;
    status: string;
    created_at: string;
    event_date: string | null;
    event_type: string | null;
    response_deadline: string | null;
    /** Duzeltme 18-C: ilce / mekan yazildiysa kartta sehir yerine o gorunur. */
    brief_data: Record<string, unknown> | null;
    service_categories: { name_tr: string } | null;
    turkish_cities: { name: string } | null;
    customer: KisiOzeti;
  } | null;
};

type DoluAlici = AliciSatiri & {
  quote_requests: NonNullable<AliciSatiri['quote_requests']>;
};

type Sirali = {
  is: Is;
  /** 0 = profesyonelden is bekleniyor (ustte). */
  oncelik: number;
  /** Son hareket (ms); yeni once. */
  zaman: number;
  /** Etkinlik gunu "YYYY-MM-DD". */
  gun: string | null;
  tamamlanmayiBekliyor: boolean;
};

export type SaticiIsleri = {
  /** Asamaya, sonra oncelige gore dizili. */
  isler: Is[];
  ozet: {
    /** "Yanit bekleyen" + "Teklif verdiklerim": musteriyle henuz anlasilmamis isler. */
    acikTalep: number;
    /** Bunlardan teklif verilmis olanlar. */
    teklifVerilen: number;
    /** Profesyonelin yanitini bekleyen (son tarihi gecmemis) talepler. */
    yanitBekleyen: number;
    /** Tarihi gecmis, "tamamlandi" isaretlenmemis onayli isler. */
    tamamlanmayiBekleyen: number;
  };
};

const GUN_MS = 86_400_000;
/** Tarihsiz, teklifsiz dogrudan talep bu kadar gun "bekleyen" sayilir. */
const ACIK_TALEP_GUNU = 30;
const KART_TEKLIF_SINIRI = 3;

/** Satici sorgusu sohbetin brief'ini de okur (tercih edilen ekip uyesi). */
type SaticiSohbeti = IsSohbeti & {
  brief_data?: Record<string, unknown> | null;
};

/** Brief'teki "tercih edilen ekip uyesi" adi (sunucunun yazdigi kamu adi). */
function tercihUyesi(s: IsSohbeti): string | null {
  const ad = (s as SaticiSohbeti).brief_data?.[BRIEF_TERCIH_UYE_ADI];
  return typeof ad === 'string' && ad.trim() ? ad.trim() : null;
}

function parcalar(...p: (string | null | undefined | false)[]): string | null {
  const dolu = p.filter((x): x is string => !!x);
  return dolu.length > 0 ? dolu.join(' · ') : null;
}

/** Musteri adi: kurum unvani, yoksa ad (teklif talepleri sayfasiyla ayni). */
function musteriAdi(k: KisiOzeti): string {
  return k?.company_name || k?.full_name || 'Müşteri';
}

type BirimDurumu = {
  asama: IsAsamasi;
  durum: string;
  ton: IsTonu;
  tamamla: boolean;
  /** Kartin gittigi rezervasyon (varsa). */
  acilanRez: IsRezervasyonu | null;
  tutar: string | null;
};

export async function saticiIsleri(
  supabase: SunucuIstemcisi,
  userId: string
): Promise<SaticiIsleri> {
  const turler = await etkinlikTurleri({ hepsi: true });

  const [aliciSonuc, sohbetSonuc, teklifSonuc, rezSonuc] = await Promise.all([
    supabase
      .from('quote_request_recipients')
      .select(
        `
        id, status, conversation_id, created_at, responded_at,
        quote_requests (
          id, status, created_at, event_date, event_type, response_deadline, brief_data,
          service_categories (name_tr),
          turkish_cities (name),
          customer:profiles!quote_requests_customer_id_fkey (full_name, company_name, role)
        )
      `
      )
      .eq('professional_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('conversations')
      .select(
        `
        id, customer_id, professional_id, event_date, event_type, location,
        event_id, request_count, last_message_at, brief_data,
        karsi:profiles!conversations_customer_id_fkey (full_name, company_name, role)
      `
      )
      .eq('professional_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(300),
    supabase
      .from('quotes')
      .select(
        `
        id, conversation_id, total_amount, currency, status, created_at,
        expires_at, event_date, request_no,
        conversations!inner (professional_id)
      `
      )
      .eq('conversations.professional_id', userId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('bookings')
      .select(
        `
        id, quote_id, conversation_id, customer_id, professional_id,
        event_date, event_type, location, total_amount, currency, status,
        event_id, completion_requested_at, created_at,
        karsi:profiles!bookings_customer_id_fkey (full_name, company_name, role)
      `
      )
      .eq('professional_id', userId)
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  for (const [ad, sonuc] of [
    ['alici', aliciSonuc],
    ['sohbet', sohbetSonuc],
    ['teklif', teklifSonuc],
    ['rezervasyon', rezSonuc],
  ] as const) {
    if (sonuc.error) {
      console.error('[islerim merkez]', ad, sonuc.error.code, sonuc.error.message);
    }
  }

  const aliciListesi = ((aliciSonuc.data ?? []) as unknown as AliciSatiri[]).filter(
    (a): a is DoluAlici => !!a.quote_requests
  );
  const sohbetListesi = (sohbetSonuc.data ?? []) as unknown as SaticiSohbeti[];
  const teklifListesi = (teklifSonuc.data ?? []) as unknown as IsTeklifSatiri[];
  // Teklif sekli rezervasyonlar (FAZ 7c, `quote_id` bos) kurulus yuzeylerinde.
  const rezListesi = ((rezSonuc.data ?? []) as unknown as IsRezervasyonu[]).filter(
    (r) => !!r.quote_id
  );

  const simdi = Date.now();
  const bugun = istanbulGunu();

  const { birimler, talepBirimleri, sahiplenilen, bagimsizRez } = birimleriKur({
    sohbetler: sohbetListesi,
    teklifler: teklifListesi,
    rezervasyonlar: rezListesi,
    yanitlar: aliciListesi.map((a) => ({
      talepId: a.quote_requests.id,
      talepAcilis: a.quote_requests.created_at,
      conversationId: a.conversation_id,
      respondedAt: a.responded_at,
    })),
  });

  // --- Durum kurallari (profesyonel bakisi) ---------------------------------
  const rezDurumu = (
    r: IsRezervasyonu
  ): { asama: IsAsamasi; durum: string; ton: IsTonu; tamamla: boolean } => {
    if (r.status === 'completed') {
      return { asama: 'tamamlanan', durum: 'Tamamlandı', ton: 'olumlu', tamamla: false };
    }
    if (r.status === 'cancelled') {
      return { asama: 'sonuclanmayan', durum: 'İptal edildi', ton: 'soluk', tamamla: false };
    }
    // Duzeltme 12-F: tarihten once tamamlanma onayi istendi, sira musteride.
    if (r.completion_requested_at) {
      return {
        asama: 'yaklasan',
        durum: 'Müşteri onayı bekleniyor',
        ton: 'notr',
        tamamla: false,
      };
    }
    // Tarihi gecti: isi "tamamlandi" isaretlemek profesyonelin isi.
    if (r.event_date && r.event_date < bugun) {
      return {
        asama: 'yaklasan',
        durum: 'Tamamlanmayı bekliyor',
        ton: 'vurgu',
        tamamla: true,
      };
    }
    return {
      asama: 'yaklasan',
      durum: 'Rezervasyon onaylandı',
      ton: 'olumlu',
      tamamla: false,
    };
  };

  /** Teklifsiz guncel talep hala acik mi (tarihi gelmedi / yeni yazildi). */
  const teklifsizAcik = (b: IsBirimi): boolean => {
    const s = b.sohbet;
    if (!b.guncel || b.teklifler.length > 0) return false;
    return s.event_date
      ? s.event_date >= bugun
      : simdi - ms(s.last_message_at) < ACIK_TALEP_GUNU * GUN_MS;
  };

  const birimDurumu = (b: IsBirimi): BirimDurumu => {
    const rez = b.rezervasyon;
    const aktifRez = rez && rez.status !== 'cancelled' ? rez : null;
    const enYeni = b.teklifler[0] ?? null;
    const bekleyenler = b.teklifler.filter(
      (t) => gorunenDurum(t, simdi) === 'pending'
    );
    const tutar = (k: { total_amount: number; currency: string } | null) =>
      k ? formatQuoteAmount(k.total_amount, k.currency) : null;

    if (aktifRez) {
      return { ...rezDurumu(aktifRez), acilanRez: aktifRez, tutar: tutar(aktifRez) };
    }
    if (bekleyenler.length > 0) {
      return {
        asama: 'teklif',
        durum: 'Yanıt bekleniyor',
        ton: 'notr',
        tamamla: false,
        acilanRez: null,
        tutar: tutar(bekleyenler[0]),
      };
    }
    if (rez) {
      return { ...rezDurumu(rez), acilanRez: rez, tutar: tutar(rez) };
    }
    if (!enYeni) {
      return teklifsizAcik(b)
        ? {
            asama: 'bekleyen',
            durum: 'Teklif bekliyor',
            ton: 'vurgu',
            tamamla: false,
            acilanRez: null,
            tutar: null,
          }
        : {
            asama: 'sonuclanmayan',
            durum: 'Yanıtlanmadı',
            ton: 'soluk',
            tamamla: false,
            acilanRez: null,
            tutar: null,
          };
    }
    const d = gorunenDurum(enYeni, simdi);
    if (d === 'accepted') {
      // Kabul edilmis ama rezervasyon satiri okunamadi: is yine anlasilmis.
      return {
        asama: 'yaklasan',
        durum: 'Onaylandı',
        ton: 'olumlu',
        tamamla: false,
        acilanRez: null,
        tutar: tutar(enYeni),
      };
    }
    return {
      asama: 'sonuclanmayan',
      durum: getQuoteStatusLabel(d),
      ton: 'soluk',
      tamamla: false,
      acilanRez: null,
      tutar: tutar(enYeni),
    };
  };

  /** Birden cok teklif varsa (yenilenen teklif) kartin altinda listelenir. */
  const teklifSatirlari = (b: IsBirimi, gizle: boolean): IsTeklifi[] => {
    if (gizle || b.teklifler.length < 2) return [];
    return b.teklifler.slice(0, KART_TEKLIF_SINIRI).map((t) => {
      const iptal = b.rezervasyon?.status === 'cancelled' && t.status === 'accepted';
      const d = gorunenDurum(t, simdi);
      return {
        id: t.id,
        kimden: `${gunAyMetni(t.created_at) ?? ''} tarihli teklif`.trim(),
        tutar: formatQuoteAmount(t.total_amount, t.currency),
        durum: iptal ? 'İptal edildi' : getQuoteStatusLabel(d),
        ton: iptal || (d !== 'pending' && d !== 'accepted') ? 'soluk' : d === 'pending' ? 'notr' : 'olumlu',
        href: `/mesajlar/${t.conversation_id}`,
      };
    });
  };

  const birimZamani = (b: IsBirimi): number =>
    Math.max(
      ms(b.teklifler[0]?.created_at),
      ms(b.rezervasyon?.created_at),
      b.guncel ? ms(b.sohbet.last_message_at) : 0
    );

  const birimGunu = (b: IsBirimi): string | null =>
    b.rezervasyon?.event_date ??
    b.teklifler[0]?.event_date ??
    (b.guncel ? b.sohbet.event_date : null);

  // --- Kartlar -------------------------------------------------------------
  const birimKarti = (b: IsBirimi): Sirali => {
    const s = b.sohbet;
    const rez = b.rezervasyon;
    // Duzeltme 16-A: ajans hesabinda musterinin tercih ettigi ekip uyesi
    // (profilden "ajans uzerinden teklif al" ya da 15-E yonlendirmesi) kartta
    // yazar; brief sohbetin GUNCEL talebine aittir.
    const tercih = b.guncel ? tercihUyesi(s) : null;
    const d = birimDurumu(b);
    const sohbetYolu = `/mesajlar/${s.id}`;
    const satirlar = teklifSatirlari(b, !!rez && rez.status !== 'cancelled');
    return {
      is: {
        anahtar: `birim-${b.anahtar}`,
        tur: 'talep',
        asama: d.asama,
        baslik: musteriAdi(s.karsi),
        ayrinti: parcalar(
          etiketle(turler, rez?.event_type ?? (b.guncel ? s.event_type : null)),
          teklifTarihiMetni(birimGunu(b)) ?? 'Tarih belirtilmedi',
          (rez?.location ?? (b.guncel ? s.location : null))?.trim(),
          tercih ? `Tercih: ${tercih}` : null,
          (s.request_count ?? 1) > 1 ? `Talep #${b.no}` : null
        ),
        durum: d.durum,
        ton: d.ton,
        href: d.acilanRez ? `/rezervasyon/${d.acilanRez.id}` : sohbetYolu,
        hrefEtiketi: d.acilanRez
          ? 'Rezervasyonu aç →'
          : d.asama === 'bekleyen'
            ? 'Teklif ver →'
            : 'Sohbeti aç →',
        ekBaglanti: d.acilanRez ? { href: sohbetYolu, etiket: 'Sohbet' } : null,
        tutar: d.tutar,
        teklifler: satirlar,
        kalanTeklif:
          satirlar.length > 0
            ? Math.max(0, b.teklifler.length - KART_TEKLIF_SINIRI)
            : 0,
        kurulus: null,
      },
      oncelik: d.ton === 'vurgu' ? 0 : 1,
      zaman: birimZamani(b),
      gun: birimGunu(b),
      tamamlanmayiBekliyor: d.tamamla,
    };
  };

  const aliciKarti = (a: DoluAlici): Sirali => {
    const talep = a.quote_requests;
    const b = talepBirimleri.get(talep.id)?.[0] ?? null;
    // Teklif talepleri sayfasinda bu talebin karti (brief, ek, teklif formu).
    const talepYolu = `/teklif-talepleri#talep-${a.id}`;
    const sohbetYolu = a.conversation_id ? `/mesajlar/${a.conversation_id}` : null;

    let d: BirimDurumu;
    if (b) {
      d = birimDurumu(b);
    } else if (a.status === 'declined') {
      d = { asama: 'sonuclanmayan', durum: 'İlgilenmedin', ton: 'soluk', tamamla: false, acilanRez: null, tutar: null };
    } else if (a.status === 'quoted') {
      // Teklif verilmis ama teklif satiri okunamadi (liste siniri).
      d = { asama: 'teklif', durum: 'Teklif verildi', ton: 'notr', tamamla: false, acilanRez: null, tutar: null };
    } else if (talep.status !== 'active') {
      d = {
        asama: 'sonuclanmayan',
        durum: talep.status === 'expired' ? 'Süresi doldu' : 'Talep kapandı',
        ton: 'soluk',
        tamamla: false,
        acilanRez: null,
        tutar: null,
      };
    } else if (talep.response_deadline && ms(talep.response_deadline) < simdi) {
      // Talep acik duruyor (teklif verilebilir) ama musterinin suresi doldu.
      d = { asama: 'bekleyen', durum: 'Son tarih geçti', ton: 'soluk', tamamla: false, acilanRez: null, tutar: null };
    } else {
      d = {
        asama: 'bekleyen',
        durum: a.status === 'sent' ? 'Yeni talep' : 'Teklif bekliyor',
        ton: 'vurgu',
        tamamla: false,
        acilanRez: null,
        tutar: null,
      };
    }

    const yanitlanmadi = !b && d.asama === 'bekleyen';
    const satirlar = b
      ? teklifSatirlari(b, !!b.rezervasyon && b.rezervasyon.status !== 'cancelled')
      : [];
    const gun = (b ? (b.rezervasyon?.event_date ?? b.teklifler[0]?.event_date) : null) ?? talep.event_date;
    return {
      is: {
        anahtar: `alici-${a.id}`,
        tur: 'teklif-topla',
        asama: d.asama,
        baslik: musteriAdi(talep.customer),
        ayrinti: parcalar(
          talep.service_categories?.name_tr,
          etiketle(turler, b?.rezervasyon?.event_type ?? talep.event_type),
          teklifTarihiMetni(gun) ?? 'Tarih belirtilmedi',
          // Duzeltme 18-C: talepte ilce / mekan varsa o ("Kadikoy, Istanbul").
          briefKonumu(talep.brief_data) ?? talep.turkish_cities?.name
        ),
        durum: d.durum,
        ton: d.ton,
        href: d.acilanRez
          ? `/rezervasyon/${d.acilanRez.id}`
          : yanitlanmadi || !sohbetYolu
            ? talepYolu
            : sohbetYolu,
        hrefEtiketi: d.acilanRez
          ? 'Rezervasyonu aç →'
          : yanitlanmadi
            ? 'Teklif ver →'
            : sohbetYolu
              ? 'Sohbeti aç →'
              : 'Talebi aç →',
        ekBaglanti:
          d.acilanRez && sohbetYolu
            ? { href: sohbetYolu, etiket: 'Sohbet' }
            : !yanitlanmadi && sohbetYolu
              ? { href: talepYolu, etiket: 'Talep' }
              : null,
        tutar: d.tutar,
        teklifler: satirlar,
        kalanTeklif:
          b && satirlar.length > 0
            ? Math.max(0, b.teklifler.length - KART_TEKLIF_SINIRI)
            : 0,
        kurulus: null,
      },
      oncelik: d.ton === 'vurgu' ? 0 : 1,
      zaman: Math.max(ms(a.created_at), b ? birimZamani(b) : 0),
      gun,
      tamamlanmayiBekliyor: d.tamamla,
    };
  };

  const rezKarti = (r: IsRezervasyonu): Sirali => {
    const d = rezDurumu(r);
    return {
      is: {
        anahtar: `rez-${r.id}`,
        tur: 'rezervasyon',
        asama: d.asama,
        baslik: musteriAdi(r.karsi),
        ayrinti: parcalar(
          etiketle(turler, r.event_type),
          teklifTarihiMetni(r.event_date) ?? 'Tarih belirtilmedi',
          r.location?.trim()
        ),
        durum: d.durum,
        ton: d.ton,
        href: `/rezervasyon/${r.id}`,
        hrefEtiketi: 'Rezervasyonu aç →',
        ekBaglanti: r.conversation_id
          ? { href: `/mesajlar/${r.conversation_id}`, etiket: 'Sohbet' }
          : null,
        tutar: formatQuoteAmount(r.total_amount, r.currency),
        teklifler: [],
        kalanTeklif: 0,
        kurulus: null,
      },
      oncelik: d.ton === 'vurgu' ? 0 : 1,
      zaman: ms(r.created_at),
      gun: r.event_date,
      tamamlanmayiBekliyor: d.tamamla,
    };
  };

  const hepsi: Sirali[] = [
    ...aliciListesi.map(aliciKarti),
    ...birimler.filter((b) => !sahiplenilen.has(b.anahtar)).map(birimKarti),
    ...bagimsizRez.map(rezKarti),
  ];

  const gecmisSirasi = (s: Sirali): number =>
    s.gun ? ms(`${s.gun}T00:00:00Z`) : s.zaman;
  const ASAMA_SIRASI: Record<IsAsamasi, number> = {
    bekleyen: 0,
    teklif: 1,
    yaklasan: 2,
    tamamlanan: 3,
    sonuclanmayan: 4,
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
    if (a.is.asama === 'tamamlanan' || a.is.asama === 'sonuclanmayan') {
      // Gecmis isler etkinlik gunune gore, en yakin gecmis once.
      return gecmisSirasi(b) - gecmisSirasi(a);
    }
    return b.zaman - a.zaman;
  });

  const bekleyenler = hepsi.filter((s) => s.is.asama === 'bekleyen');
  const teklifVerilen = hepsi.filter((s) => s.is.asama === 'teklif').length;
  return {
    isler: hepsi.map((s) => s.is),
    ozet: {
      acikTalep: bekleyenler.length + teklifVerilen,
      teklifVerilen,
      yanitBekleyen: bekleyenler.filter((s) => s.is.ton === 'vurgu').length,
      tamamlanmayiBekleyen: hepsi.filter((s) => s.tamamlanmayiBekliyor).length,
    },
  };
}
