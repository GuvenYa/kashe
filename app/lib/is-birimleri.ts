import type { QuoteStatus } from '@/app/mesajlar/quotes-data';

/**
 * IS BIRIMLERI (Duzeltme 15-A / 15-B) - sohbet tekliflerini "is"lere ayiran
 * ortak mantik. Musterinin "Etkinliklerim" ve profesyonelin "Islerim" merkezi
 * AYNI birimleri gorur; fark yalniz bakis (kimin adi yazar, hangi durum
 * kimden is bekler). Saf fonksiyonlar: sorgu atmaz, saat okumaz.
 *
 *   - Is birimi = (sohbet, talep numarasi) icinde bir PARCA. Parca iki yerde
 *     biter / baslar: KABUL EDILEN teklif isi kapatir (ardindan gelen teklif
 *     yeni istir) ve bir teklif topla talebinin YANITI yeni is baslatir.
 *     Duzeltme 12 oncesi kayitlarda (ve tur verisinde) ayni profesyonelle
 *     yapilan butun isler 1 numarada duruyor; parcalanmazsa tek karta sikisip
 *     rezervasyonlar gorunmez oluyordu.
 *   - Teklif `request_no` ile, rezervasyon `quote_id` ile birime baglanir.
 *   - Teklif topla yaniti: yanit akisi once teklifi yazar, hemen ardindan
 *     aliciya `responded_at` koyar (app/teklif-topla/actions.ts); bu yuzden
 *     yanit anindan onceki SON teklif o talebin teklifidir. Genis zaman payi
 *     kullanilmaz: dakikalar arayla verilen iki yanit ayni teklife baglanir,
 *     ikinci talep teklifsiz gorunurdu (15-A onizleme turu).
 */
export type KisiOzeti = {
  full_name: string | null;
  company_name: string | null;
  role: string;
} | null;

export type IsSohbeti = {
  id: string;
  customer_id: string;
  professional_id: string;
  event_date: string | null;
  event_type: string | null;
  location: string | null;
  event_id: string | null;
  request_count: number | null;
  last_message_at: string | null;
  /** Karsi taraf: musteri bakisinda profesyonel, satici bakisinda musteri. */
  karsi: KisiOzeti;
};

export type IsTeklifSatiri = {
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

export type IsRezervasyonu = {
  id: string;
  quote_id: string | null;
  conversation_id: string | null;
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
  karsi: KisiOzeti;
};

export type IsBirimi = {
  anahtar: string;
  sohbet: IsSohbeti;
  no: number;
  /**
   * Sohbetin GUNCEL talebinin son parcasi. Sohbetin tur / tarih / yer /
   * etkinlik bagi "en son is"e aittir (Yol A); yalniz bu birim onlari kullanir.
   */
  guncel: boolean;
  /** En yeni once. */
  teklifler: IsTeklifSatiri[];
  rezervasyon: IsRezervasyonu | null;
};

/** Bir teklif topla alicisinin yaniti (talep basina alici basina bir satir). */
export type TalepYaniti = {
  talepId: string;
  /** `quote_requests.created_at` */
  talepAcilis: string;
  conversationId: string | null;
  respondedAt: string | null;
};

export function ms(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return isNaN(t) ? 0 : t;
}

/** Gunluk is 'expired' yazana kadar suresi gecmis bekleyen teklif dolmus gorunur. */
export function gorunenDurum(t: IsTeklifSatiri, simdi: number): QuoteStatus {
  return t.status === 'pending' && ms(t.expires_at) < simdi ? 'expired' : t.status;
}

const REZ_SIRASI: Record<IsRezervasyonu['status'], number> = {
  confirmed: 0,
  completed: 1,
  cancelled: 2,
};

/** Onayli > tamamlanan > iptal; esitlikte en yeni. */
export function iyiRezervasyon(
  liste: (IsRezervasyonu | null)[]
): IsRezervasyonu | null {
  const dolu = liste.filter((r): r is IsRezervasyonu => !!r);
  dolu.sort(
    (a, b) =>
      REZ_SIRASI[a.status] - REZ_SIRASI[b.status] ||
      ms(b.created_at) - ms(a.created_at)
  );
  return dolu[0] ?? null;
}

/** Saat payi: uygulama sunucusu ile veritabani saati arasindaki fark icin. */
const YANIT_PAYI_MS = 30_000;

export type IsBirimleri = {
  birimler: IsBirimi[];
  /** talep id -> o talebin yanit birimleri */
  talepBirimleri: Map<string, IsBirimi[]>;
  /** Bir talebe ait birimlerin anahtarlari (ayrica kart acmazlar). */
  sahiplenilen: Set<string>;
  /** Birime baglanamayan ya da birimde ikinci kalan rezervasyonlar. */
  bagimsizRez: IsRezervasyonu[];
};

export function birimleriKur(girdi: {
  sohbetler: IsSohbeti[];
  /** Sira onemsiz. */
  teklifler: IsTeklifSatiri[];
  rezervasyonlar: IsRezervasyonu[];
  yanitlar: TalepYaniti[];
}): IsBirimleri {
  const sohbetler = new Map<string, IsSohbeti>();
  for (const s of girdi.sohbetler) sohbetler.set(s.id, s);

  // --- Teklif topla yanitlari: hangi teklif hangi talebin yaniti -----------
  const sohbetTeklifleri = new Map<string, IsTeklifSatiri[]>();
  for (const t of girdi.teklifler) {
    const liste = sohbetTeklifleri.get(t.conversation_id);
    if (liste) liste.push(t);
    else sohbetTeklifleri.set(t.conversation_id, [t]);
  }
  for (const liste of sohbetTeklifleri.values()) {
    liste.sort((a, b) => ms(a.created_at) - ms(b.created_at));
  }
  /** teklif id -> yaniti oldugu talep id */
  const yanitTeklifi = new Map<string, string>();
  // Eski talep once: ayni teklife iki talep baglanmaz.
  const yanitlar = [...girdi.yanitlar].sort(
    (a, b) => ms(a.talepAcilis) - ms(b.talepAcilis)
  );
  for (const y of yanitlar) {
    if (!y.conversationId) continue;
    const alt = ms(y.talepAcilis);
    const liste = sohbetTeklifleri.get(y.conversationId) ?? [];
    let aday: IsTeklifSatiri | null = null;
    if (y.respondedAt) {
      const ust = ms(y.respondedAt) + YANIT_PAYI_MS;
      for (const t of liste) {
        const z = ms(t.created_at);
        if (z < alt || z > ust || yanitTeklifi.has(t.id)) continue;
        aday = t; // liste eskiden yeniye: son uygun teklif kalir
      }
    } else {
      // `responded_at` bos (eski kayit): talepten sonraki ilk bos teklif.
      aday =
        liste.find((t) => ms(t.created_at) >= alt && !yanitTeklifi.has(t.id)) ??
        null;
    }
    if (aday) yanitTeklifi.set(aday.id, y.talepId);
  }

  // --- Birimler -------------------------------------------------------------
  const birimler: IsBirimi[] = [];
  const teklifBirimi = new Map<string, IsBirimi>();
  const gruplar = new Map<
    string,
    { sohbet: IsSohbeti; no: number; teklifler: IsTeklifSatiri[] }
  >();
  for (const t of girdi.teklifler) {
    const s = sohbetler.get(t.conversation_id);
    if (!s) continue;
    const no = t.request_no ?? 1;
    const anahtar = `${s.id}#${no}`;
    let g = gruplar.get(anahtar);
    if (!g) {
      g = { sohbet: s, no, teklifler: [] };
      gruplar.set(anahtar, g);
    }
    g.teklifler.push(t);
  }
  for (const [anahtar, g] of gruplar) {
    const eskidenYeniye = [...g.teklifler].sort(
      (a, b) => ms(a.created_at) - ms(b.created_at)
    );
    let acik: IsBirimi | null = null;
    let son: IsBirimi | null = null;
    let parca = 0;
    for (const t of eskidenYeniye) {
      if (!acik || yanitTeklifi.has(t.id)) {
        acik = {
          anahtar: `${anahtar}#${parca}`,
          sohbet: g.sohbet,
          no: g.no,
          guncel: false,
          teklifler: [],
          rezervasyon: null,
        };
        parca += 1;
        birimler.push(acik);
        son = acik;
      }
      acik.teklifler.unshift(t);
      teklifBirimi.set(t.id, acik);
      if (t.status === 'accepted') acik = null;
    }
    if (son && g.no === (g.sohbet.request_count ?? 1)) son.guncel = true;
  }
  // Sohbetin GUNCEL talebi teklif almamis olsa da bir istir ("teklif bekleniyor").
  for (const s of girdi.sohbetler) {
    const no = s.request_count ?? 1;
    if (gruplar.has(`${s.id}#${no}`)) continue;
    birimler.push({
      anahtar: `${s.id}#${no}#0`,
      sohbet: s,
      no,
      guncel: true,
      teklifler: [],
      rezervasyon: null,
    });
  }

  // --- Rezervasyonlar birime baglanir ---------------------------------------
  const bagimsizRez: IsRezervasyonu[] = [];
  for (const r of girdi.rezervasyonlar) {
    const b = r.quote_id ? teklifBirimi.get(r.quote_id) : undefined;
    if (!b) {
      bagimsizRez.push(r);
    } else if (!b.rezervasyon) {
      b.rezervasyon = r;
    } else {
      // Ayni birime ikinci rezervasyon (iptal sonrasi yeniden anlasma gibi):
      // iyisi birimde kalir, digeri KAYBOLMAZ, kendi kartiyla gorunur.
      const iyi = iyiRezervasyon([b.rezervasyon, r]) ?? r;
      bagimsizRez.push(iyi === r ? b.rezervasyon : r);
      b.rezervasyon = iyi;
    }
  }

  // --- Talepler yanit birimlerini sahiplenir --------------------------------
  // Yanit teklifi kendi parcasini baslattigi icin her yanitin birimi ayridir.
  const sahiplenilen = new Set<string>();
  const talepBirimleri = new Map<string, IsBirimi[]>();
  for (const [teklifId, talepId] of yanitTeklifi) {
    const b = teklifBirimi.get(teklifId);
    if (!b || sahiplenilen.has(b.anahtar)) continue;
    sahiplenilen.add(b.anahtar);
    const liste = talepBirimleri.get(talepId);
    if (liste) liste.push(b);
    else talepBirimleri.set(talepId, [b]);
  }

  return { birimler, talepBirimleri, sahiplenilen, bagimsizRez };
}
