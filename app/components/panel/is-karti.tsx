import Link from 'next/link';
import { BaglantiBekleme } from '@/app/components/ui/baglanti-bekleme';
import {
  IS_TURU_ETIKETI,
  type Is,
  type IsAsamasi,
  type IsTonu,
} from '@/app/lib/isler';

/**
 * IS KARTI ve SEKMELERI (Duzeltme 15-A / 15-B) - is merkezlerinin ortak cizimi.
 *
 * Gorsel dil ekip kurma ekranindan: segment gorunumlu sekmeler, `rounded-xl`
 * kart, mono etiketler. Saf gorunum; veri `app/lib/isler.ts` modelinde gelir.
 */
const TON: Record<IsTonu, string> = {
  vurgu: 'text-brand-accent',
  olumlu: 'text-moss',
  notr: 'text-ink',
  soluk: 'text-ink-50',
};

export function IsSekmeleri({
  sekmeler,
  secili,
  temelYol,
}: {
  sekmeler: { anahtar: IsAsamasi; etiket: string; sayi: number }[];
  secili: IsAsamasi;
  /** Sekme adresi: `<temelYol>?sekme=<anahtar>`. */
  temelYol: string;
}) {
  return (
    <nav
      aria-label="İş aşaması"
      className="max-w-full inline-flex items-center gap-1 bg-paper-2 border border-line rounded-xl p-1 flex-wrap"
    >
      {sekmeler.map((s) => {
        const etkin = s.anahtar === secili;
        return (
          <Link
            key={s.anahtar}
            href={`${temelYol}?sekme=${s.anahtar}`}
            aria-current={etkin ? 'page' : undefined}
            className={
              etkin
                ? 'kashe-tap px-3 py-1.5 rounded-lg border text-xs font-display font-semibold bg-card border-line-strong text-ink'
                : 'kashe-tap px-3 py-1.5 rounded-lg border border-transparent text-xs font-display font-semibold text-ink-72 hover:text-ink'
            }
          >
            {s.etiket}{' '}
            <span
              className={
                etkin ? 'tabular-nums text-brand-accent' : 'tabular-nums text-ink-50'
              }
            >
              {s.sayi}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function IsKarti({ is }: { is: Is }) {
  return (
    <li className="bg-card border border-line rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 flex-wrap font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
            <span className="px-2 py-0.5 rounded bg-paper-2 border border-line text-ink-72">
              {IS_TURU_ETIKETI[is.tur]}
            </span>
            {is.kurulus && <span>{is.kurulus} adına</span>}
          </p>
          <p className="font-display font-semibold text-ink mt-2 break-words">
            {is.baslik}
          </p>
          {is.ayrinti && (
            <p className="text-sm text-ink-72 mt-0.5 break-words">{is.ayrinti}</p>
          )}
        </div>
        <div className="text-right shrink-0 max-w-[45%]">
          {is.tutar && (
            <p className="font-display font-semibold text-ink tabular-nums">
              {is.tutar}
            </p>
          )}
          <p
            className={`font-mono text-[10px] uppercase tracking-[0.12em] mt-0.5 ${TON[is.ton]}`}
          >
            {is.durum}
          </p>
        </div>
      </div>

      {is.teklifler.length > 0 && (
        <ul className="mt-3 border border-line rounded-lg divide-y divide-line">
          {is.teklifler.map((t) => (
            <li key={t.id}>
              <Link
                href={t.href}
                className="kashe-tap flex items-center justify-between gap-3 px-3 py-2 hover:bg-paper transition-colors rounded-lg"
              >
                <span className="min-w-0 text-sm text-ink truncate">{t.kimden}</span>
                <span className="shrink-0 flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink tabular-nums">
                    {t.tutar}
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.12em] ${TON[t.ton]}`}
                  >
                    {t.durum}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {is.kalanTeklif > 0 && (
        <p className="text-xs text-ink-72 mt-1.5">+{is.kalanTeklif} teklif daha</p>
      )}

      <div className="mt-3 flex items-center gap-4 flex-wrap">
        <Link
          href={is.href}
          className="kashe-tap text-sm font-semibold text-brand-ink hover:underline"
        >
          {is.hrefEtiketi}
          {/* Duzeltme 21-A: hedef sayfa agir olabilir (etkinlik sayfasi 5 - 6 sn). */}
          <BaglantiBekleme />
        </Link>
        {is.ekBaglanti && (
          <Link
            href={is.ekBaglanti.href}
            className="kashe-tap text-sm text-ink-72 hover:text-ink hover:underline"
          >
            {is.ekBaglanti.etiket}
          </Link>
        )}
      </div>
    </li>
  );
}
