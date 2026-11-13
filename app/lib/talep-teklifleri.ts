import {
  birimleriKur,
  ms,
  type IsSohbeti,
  type IsTeklifSatiri,
  type TalepYaniti,
} from '@/app/lib/is-birimleri';

/**
 * TEKLIF TOPLA TALEBININ TEKLIFLERI (Duzeltme 16-C) - karsilastirma sayfasi
 * (`/teklif-taleplerim/[id]`) icin. Saf fonksiyon: sorgu atmaz.
 *
 * Sayfa eskiden her alicinin sohbetindeki EN YENI teklifi gosteriyordu. Cift
 * basina tek sohbet oldugu icin ayni profesyonel baska bir talebe ya da
 * dogrudan bir talebe sonradan teklif verdiyse bu talebin sayfasinda O teklif
 * gorunuyordu (yanlis tutar ve kapsam; "en uygun" siralamasi da yanlis
 * cikabiliyordu). Merkezdeki eslestirme (15-A) buraya tasindi:
 *
 *   - Hangi teklif hangi talebin yaniti: `birimleriKur` (app/lib/is-birimleri.ts)
 *     ile AYNI kural - yanit anindan onceki son teklif o talebin teklifidir;
 *     ardindan gelen duzeltmeler (kabul edilene kadar) ayni ise aittir.
 *     Talebin teklifi = yanit biriminin en yeni teklifi.
 *   - Eslestirme icin bu sohbetlerdeki BUTUN taleplerin yanitlari gerekir
 *     (bir teklif iki talebe baglanmaz; eski talep once).
 *   - Yedek: eslesmeyen sohbette (yanit zamani yazilmamis eski kayit) talep
 *     acildiktan SONRA verilmis ve baska bir talebe baglanmamis en yeni teklif.
 *     O da yoksa teklif gosterilmez (baska isin teklifi gosterilmez).
 *
 * Donus: sohbet kimligi -> o talebe ait teklifin kimligi.
 */
export function talepTeklifleriniEsle(girdi: {
  talepId: string;
  /** `quote_requests.created_at` */
  talepAcilis: string;
  /** Bu talebe teklif veren alicilarin sohbetleri. */
  sohbetIdleri: string[];
  /** Bu sohbetlerdeki butun teklifler (sira onemsiz). */
  teklifler: IsTeklifSatiri[];
  /** Bu sohbetlerde yanitlanmis BUTUN talepler (bu talep dahil). */
  yanitlar: TalepYaniti[];
}): Map<string, string> {
  const sohbetler: IsSohbeti[] = girdi.sohbetIdleri.map((id) => ({
    id,
    customer_id: '',
    professional_id: '',
    event_date: null,
    event_type: null,
    location: null,
    event_id: null,
    request_count: null,
    last_message_at: null,
    karsi: null,
  }));

  const { talepBirimleri } = birimleriKur({
    sohbetler,
    teklifler: girdi.teklifler,
    rezervasyonlar: [],
    yanitlar: girdi.yanitlar,
  });

  const sonuc = new Map<string, string>();
  /** Baska bir talebe baglanmis teklifler (yedekte kullanilmaz). */
  const baskasinin = new Set<string>();
  for (const [talepId, birimler] of talepBirimleri) {
    for (const b of birimler) {
      if (talepId === girdi.talepId) {
        const enYeni = b.teklifler[0];
        if (enYeni && !sonuc.has(b.sohbet.id)) sonuc.set(b.sohbet.id, enYeni.id);
      } else {
        for (const t of b.teklifler) baskasinin.add(t.id);
      }
    }
  }

  const acilis = ms(girdi.talepAcilis);
  for (const id of girdi.sohbetIdleri) {
    if (sonuc.has(id)) continue;
    const aday = girdi.teklifler
      .filter(
        (t) =>
          t.conversation_id === id &&
          ms(t.created_at) >= acilis &&
          !baskasinin.has(t.id)
      )
      .sort((a, b) => ms(b.created_at) - ms(a.created_at))[0];
    if (aday) sonuc.set(id, aday.id);
  }
  return sonuc;
}

/**
 * KARSILASTIRMA SAYFASINDA TEKLIFIN KARAR DURUMU (Duzeltme 17-B). Saf.
 *
 *   - 'onayli': musteri bu teklifi onayladi ve rezervasyonu iptal olmadi.
 *   - 'acik'  : karar bekliyor (bekliyor + suresi dolmamis).
 *   - 'kapali': reddedildi, geri cekildi, suresi doldu ya da onaylandiktan
 *               sonra rezervasyonu iptal edildi.
 *
 * "En uygun" rozeti ve "en uygun teklifi sec" cagrisi yalniz 'acik' teklifler
 * icindir: eskiden reddedilmis ya da suresi dolmus teklif de en dusuk tutarsa
 * "En uygun" gorunuyordu.
 */
export type TeklifKarari = 'onayli' | 'acik' | 'kapali';

export function teklifKarari(
  teklif: { status: string; expires_at: string },
  iptal: boolean,
  simdi: Date
): TeklifKarari {
  if (iptal) return 'kapali';
  if (teklif.status === 'accepted') return 'onayli';
  if (teklif.status !== 'pending') return 'kapali';
  return new Date(teklif.expires_at) < simdi ? 'kapali' : 'acik';
}

/** Siralama: onayli teklif en ustte, sonra karar bekleyenler, sonra kapananlar. */
export const TEKLIF_KARAR_SIRASI: Record<TeklifKarari, number> = {
  onayli: 0,
  acik: 1,
  kapali: 2,
};
