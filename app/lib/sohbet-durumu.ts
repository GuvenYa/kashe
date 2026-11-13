import {
  birimleriKur,
  gorunenDurum,
  type IsRezervasyonu,
  type IsTeklifSatiri,
} from '@/app/lib/is-birimleri';
import { formatTL } from '@/app/lib/para';

/**
 * SOHBET DURUMU (Duzeltme 23-A) - sohbet sayfasindaki "Isin durumu" karti.
 *
 * Sohbetin GUNCEL isi (son talebin son parcasi; is merkezleriyle AYNI parca
 * kurali: `birimleriKur`) dort adimda okunur: talep, teklif, rezervasyon,
 * tamamlanma. Saf fonksiyon: sorgu atmaz, saat okumaz (`simdi` disaridan).
 *
 * "Uydurma sayac yok" (DESIGN.md): her satir veritabanindaki gercek bir
 * kayda bakar (teklif durumu, rezervasyon durumu, tamamlanma bildirimi,
 * yorum). Teklif topla yanitlarinin parca ayrimi burada YOK (ek sorgu
 * isterdi); o ayrim yalniz ayni talep numarasinda birden cok talebin
 * yanitlandigi eski kayitlarda fark eder.
 */
export type SohbetTeklifi = {
  id: string;
  total_amount: number;
  currency: string;
  status: IsTeklifSatiri['status'];
  created_at: string;
  expires_at: string;
  event_date?: string | null;
  request_no?: number | null;
};

export type SohbetRezervasyonu = {
  id: string;
  quote_id: string | null;
  status: IsRezervasyonu['status'];
  completion_requested_at: string | null;
  created_at: string;
  /** Rezervasyonun etkinlik gunu (YYYY-MM-DD ya da tam zaman). */
  event_date?: string | null;
};

export type SohbetDurumSatiri = { metin: string; tamam: boolean };

export type SohbetDurumu = {
  baslik: string;
  /** Is tamamlandi (durum noktasi yesil). */
  tamam: boolean;
  /** Bakan taraftan is bekleniyor (dar ekran seridinde pembe nokta). */
  vurgu: boolean;
  /** 0 - 100. Iptal edilen iste 0. */
  ilerleme: number;
  satirlar: SohbetDurumSatiri[];
  /** Guncel isin rezervasyonu (varsa); "Rezervasyonu ac" baglantisi icin. */
  rezervasyonId: string | null;
  /** Guncel talebin numarasi (ayni kisiyle kacinci is). */
  talepNo: number;
};

/** Rezervasyonun etkinlik gunu (YYYY-MM-DD) ya da null. */
function eventGunu(
  liste: SohbetRezervasyonu[],
  id: string | undefined
): string | null {
  const g = liste.find((r) => r.id === id)?.event_date;
  return g ? g.slice(0, 10) : null;
}

const BITEN_TEKLIF: Record<string, string> = {
  declined: 'Teklif reddedildi',
  expired: 'Teklifin süresi doldu',
  withdrawn: 'Teklif geri çekildi',
};

export function sohbetDurumu(girdi: {
  sohbetId: string;
  /** `conversations.request_count` (bos ise 1). */
  talepSayisi: number | null;
  teklifler: SohbetTeklifi[];
  rezervasyonlar: SohbetRezervasyonu[];
  /** Musteri ya da kurum ekip uyesi bakiyor. */
  musteriTarafi: boolean;
  /** Yalniz musteri tarafinda: 'yok' = yorum hakki / cagrisi yok. */
  yorum: 'yok' | 'bekliyor' | 'yayinda';
  simdi: number;
  /** Istanbul gunu (YYYY-MM-DD); verilirse "etkinlik gunu geldi" ayirt edilir. */
  bugun?: string;
}): SohbetDurumu {
  const { musteriTarafi, simdi } = girdi;
  const talepNo = girdi.talepSayisi ?? 1;

  const { birimler } = birimleriKur({
    sohbetler: [
      {
        id: girdi.sohbetId,
        customer_id: '',
        professional_id: '',
        event_date: null,
        event_type: null,
        location: null,
        event_id: null,
        request_count: talepNo,
        last_message_at: null,
        karsi: null,
      },
    ],
    teklifler: girdi.teklifler.map((t) => ({
      id: t.id,
      conversation_id: girdi.sohbetId,
      total_amount: t.total_amount,
      currency: t.currency,
      status: t.status,
      created_at: t.created_at,
      expires_at: t.expires_at,
      event_date: t.event_date ?? null,
      request_no: t.request_no ?? null,
    })),
    rezervasyonlar: girdi.rezervasyonlar.map((r) => ({
      id: r.id,
      quote_id: r.quote_id,
      conversation_id: girdi.sohbetId,
      customer_id: null,
      professional_id: null,
      event_date: null,
      event_type: null,
      location: null,
      total_amount: 0,
      currency: 'TRY',
      status: r.status,
      event_id: null,
      completion_requested_at: r.completion_requested_at,
      created_at: r.created_at,
      karsi: null,
    })),
    yanitlar: [],
  });

  const guncel = birimler.find((b) => b.guncel) ?? null;
  const teklifler = guncel?.teklifler ?? [];
  const rez = guncel?.rezervasyon ?? null;

  const kabul = teklifler.find((t) => t.status === 'accepted') ?? null;
  const bekleyen =
    teklifler.find((t) => gorunenDurum(t, simdi) === 'pending') ?? null;
  const enYeni = teklifler[0] ?? null;

  const iptal = rez?.status === 'cancelled';
  const bitti = rez?.status === 'completed';
  const onayli = rez?.status === 'confirmed';
  const onayBekliyor = onayli && !!rez?.completion_requested_at;
  // Rezervasyon sayfasindaki kuralla ayni: gun <= bugun (Istanbul).
  const rezGunu = eventGunu(girdi.rezervasyonlar, rez?.id);
  const gunGeldi =
    onayli && !!girdi.bugun && !!rezGunu && rezGunu <= girdi.bugun;

  // ---- Baslik ---------------------------------------------------------------
  let baslik: string;
  let vurgu = false;
  if (bitti) {
    baslik = 'İş tamamlandı';
  } else if (iptal) {
    baslik = 'Rezervasyon iptal edildi';
  } else if (onayBekliyor) {
    baslik = musteriTarafi
      ? 'Tamamlanma onayın bekleniyor'
      : 'Müşteri onayı bekleniyor';
    vurgu = musteriTarafi;
  } else if (gunGeldi) {
    // Tarih gecince profesyonel isi dogrudan tamamlayabilir (is ondan bekleniyor).
    baslik = 'Etkinlik günü geldi';
    vurgu = !musteriTarafi;
  } else if (onayli) {
    baslik = 'Rezervasyon onaylı';
  } else if (kabul) {
    // Kabul edilmis teklif var, rezervasyon satiri gorunmuyor (eski kayit).
    baslik = 'Teklif onaylandı';
  } else if (bekleyen) {
    baslik = musteriTarafi
      ? 'Teklif geldi, yanıtın bekleniyor'
      : 'Teklif gönderildi, yanıt bekleniyor';
    vurgu = musteriTarafi;
  } else if (enYeni) {
    baslik = BITEN_TEKLIF[gorunenDurum(enYeni, simdi)] ?? 'Teklif sonuçlanmadı';
    vurgu = !musteriTarafi;
  } else {
    baslik = musteriTarafi ? 'Teklif bekleniyor' : 'Teklifin bekleniyor';
    vurgu = !musteriTarafi;
  }

  // ---- Satirlar -------------------------------------------------------------
  const satirlar: SohbetDurumSatiri[] = [];

  const talepAdi = talepNo > 1 ? `Talep #${talepNo}` : 'Talep';
  satirlar.push({
    metin: musteriTarafi ? `${talepAdi} iletildi` : `${talepAdi} geldi`,
    tamam: true,
  });

  if (kabul) {
    satirlar.push({
      metin: `Teklif onaylandı: ${formatTL(kabul.total_amount)}`,
      tamam: true,
    });
  } else if (bekleyen) {
    satirlar.push({
      metin: musteriTarafi
        ? `Teklif geldi: ${formatTL(bekleyen.total_amount)}`
        : `Teklif gönderildi: ${formatTL(bekleyen.total_amount)}`,
      tamam: true,
    });
  } else if (enYeni) {
    satirlar.push({
      metin: `${BITEN_TEKLIF[gorunenDurum(enYeni, simdi)] ?? 'Teklif sonuçlanmadı'}; yeni teklif bekleniyor`,
      tamam: false,
    });
  } else {
    satirlar.push({
      metin: musteriTarafi ? 'Teklif bekleniyor' : 'Teklif vermen bekleniyor',
      tamam: false,
    });
  }

  if (iptal) {
    satirlar.push({ metin: 'Rezervasyon iptal edildi', tamam: false });
  } else if (rez) {
    satirlar.push({
      metin: 'Rezervasyon oluştu, iletişim bilgileri açık',
      tamam: true,
    });
  } else if (kabul) {
    // Teklif onayli ama rezervasyon satiri bu hesaba gorunmuyor (eski kayit).
    satirlar.push({ metin: 'Rezervasyon bu hesapta görünmüyor', tamam: false });
  } else if (bekleyen) {
    satirlar.push({
      metin: musteriTarafi
        ? 'Onaylarsan rezervasyon oluşur, iletişim bilgileri açılır'
        : 'Müşteri onaylayınca rezervasyon oluşur, iletişim bilgileri açılır',
      tamam: false,
    });
  } else {
    satirlar.push({
      metin: 'Teklif onaylanınca rezervasyon oluşur',
      tamam: false,
    });
  }

  if (!iptal) {
    if (bitti) {
      satirlar.push({ metin: 'İş tamamlandı', tamam: true });
    } else if (onayBekliyor) {
      satirlar.push({
        metin: musteriTarafi
          ? 'Tamamlandığı bildirildi, onayın bekleniyor'
          : 'Tamamlandığını bildirdin, müşteri onayı bekleniyor',
        tamam: false,
      });
    } else if (gunGeldi) {
      satirlar.push({
        metin: musteriTarafi
          ? 'Etkinlik günü geldi; iş tamamlanınca burada işaretlenir'
          : 'Etkinlik günü geldi; işi tamamlandı olarak işaretleyebilirsin',
        tamam: false,
      });
    } else {
      satirlar.push({ metin: 'İş tamamlanınca burada işaretlenir', tamam: false });
    }
  }

  if (musteriTarafi && bitti && girdi.yorum !== 'yok') {
    satirlar.push(
      girdi.yorum === 'yayinda'
        ? { metin: 'Yorumun yayında', tamam: true }
        : { metin: 'Yorumun bekleniyor', tamam: false }
    );
  }

  const tamamSayisi = satirlar.filter((s) => s.tamam).length;
  const ilerleme = iptal ? 0 : Math.round((100 * tamamSayisi) / satirlar.length);

  return {
    baslik,
    tamam: !!bitti,
    vurgu,
    ilerleme,
    satirlar,
    rezervasyonId: rez?.id ?? null,
    talepNo,
  };
}
