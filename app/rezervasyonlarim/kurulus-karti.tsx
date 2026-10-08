import Link from 'next/link';
import {
  REZERVASYON_DURUM_ETIKETLERI,
  paraMetni,
  tarihMetni,
} from '@/app/ajans/teklifler/teklif-data';

/**
 * FAZ 7c / P1 — teklif seklinde rezervasyon karti (kurulus bolumu).
 *
 * Eski kart (`rezervasyon-karti.tsx`) musteri/profesyonel profillerine dayaniyor;
 * teklif seklinde o sutunlar NULL olabilir (misafir alici) — bu yuzden eski kart
 * ZORLANMAZ, ayri kucuk kart kullanilir.
 */

export type KurulusRezervasyonu = {
  id: string;
  status: string;
  event_date: string | null;
  location: string | null;
  total_amount: number | string;
  currency: string;
  created_at: string;
  teklifBasligi: string;
  /** Satici gorunumunde musteri adi; yoksa kurulus adi gosterilir. */
  musteriAdi: string | null;
  kurulusAdi: string | null;
  versionNo: number | null;
};

const DURUM_SINIFLARI: Record<string, string> = {
  confirmed: 'bg-moss/10 border-moss/30 text-moss',
  completed: 'bg-ink-72/10 border-ink-72/20 text-ink-72',
  cancelled: 'bg-brand-ink/10 border-brand-ink/30 text-brand-ink',
};

export function KurulusKarti({ rez }: { rez: KurulusRezervasyonu }) {
  const durumSinifi =
    DURUM_SINIFLARI[rez.status] ?? 'bg-paper-2 border-line text-ink-72';
  const altSatir = [
    rez.musteriAdi ? `Müşteri: ${rez.musteriAdi}` : rez.kurulusAdi,
    rez.versionNo != null ? `Sürüm ${rez.versionNo}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const etkinlikSatiri = [tarihMetni(rez.event_date), rez.location]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/rezervasyon/${rez.id}`}
      className="block bg-card border border-line rounded-2xl p-5 hover:border-brand-ink transition-colors"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="font-display font-semibold text-ink">
            {rez.teklifBasligi}
          </p>
          {altSatir && (
            <p className="text-sm text-ink-72 mt-0.5">{altSatir}</p>
          )}
          {etkinlikSatiri && (
            <p className="text-sm text-ink-72 mt-0.5">{etkinlikSatiri}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.14em] border px-2.5 py-1 rounded-full ${durumSinifi}`}
          >
            {REZERVASYON_DURUM_ETIKETLERI[rez.status] ?? rez.status}
          </span>
          <p className="font-display font-semibold text-ink mt-2">
            {paraMetni(rez.total_amount, rez.currency) ?? '—'}
          </p>
          <p className="text-xs text-ink-50 mt-0.5">KDV dahil</p>
        </div>
      </div>
    </Link>
  );
}
