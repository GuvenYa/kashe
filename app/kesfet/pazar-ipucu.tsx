import { formatTL } from '@/app/lib/para';
import {
  GRANULARITY_ETIKETI,
  ornekMetni,
  pazarAraligi,
  type PazarKiyasi,
} from '@/app/lib/fiyat-kiyas';

/**
 * KESFET PAZAR IPUCU (FAZ 9b) — sonuc listesinin ustunde ince serit.
 *
 * 'use client' YOKTUR: sunucu sayfasi hazir kiyasi verir, bilesen yalniz cizer.
 *
 * Yayinli kiyas YOKSA sunucu bu bileseni HIC render etmez — "veri yok" yazisi
 * da konmaz (karar: esik alti gorunmez). Serit yalniz TAM 1 kategori secili
 * iken cikar; coklu secimde hangi rolun kiyasi oldugu belirsiz olurdu.
 *
 * Kesfet sorgusunu, siralamasini ve filtrelerini DEGISTIRMEZ; bu yalniz bir
 * bilgi satiri.
 */
export function PazarIpucu({
  kiyas,
  rolAdi,
}: {
  kiyas: PazarKiyasi;
  rolAdi: string;
}) {
  return (
    <div className="bg-paper-2 border border-line rounded-xl px-4 py-2.5 mb-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
        Pazar kıyası
      </p>
      <p className="text-sm text-ink mt-1 break-words">
        {rolAdi} {GRANULARITY_ETIKETI[kiyas.granularity]} genelde{' '}
        {pazarAraligi(kiyas)} · medyan {formatTL(kiyas.median)} ·{' '}
        {ornekMetni(kiyas)}
      </p>
    </div>
  );
}
