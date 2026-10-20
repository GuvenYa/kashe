import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * VERI TABLOSU — panel listelerinin tek tablosu.
 *
 * `md` ALTINDA TABLO YOKTUR: her satir kendi kartina doner ve her alan kendi
 * etiketiyle alt alta yazilir. Neden: dort-bes sutunlu bir tablo 375 px'te ya
 * tasiyor ya da okunmaz hale geliyor (hijyen tarama 1'de ayni sorun RFP
 * tablolarinda olculdu).
 *
 * `sayisal` sutun saga yaslanir ve `tabular-nums` alir (rakamlar hizalanir).
 */
export type VeriSutunu = {
  anahtar: string;
  baslik: string;
  /** Saga yasli + tabular-nums (tutar, adet). */
  sayisal?: boolean;
  /** Kart modunda etiket gizlenir (ornek: baslik sutunu kendi basina anlasilir). */
  kartEtiketiGizle?: boolean;
  /**
   * `lg` ALTINDA gizlenir (tabloda; kart modunda yine gorunur).
   *
   * Bes sutunlu bir tablo 1024 px altinda sikisip okunmaz hale geliyor; ikincil
   * sutun once dusurulur, satirin kimligi (baslik) ve sayilari kalir.
   */
  dar?: boolean;
};

export type VeriSatiri = {
  anahtar: string;
  hucreler: Record<string, ReactNode>;
  /** Satirin tamami baglanti olur. */
  href?: string;
  /** `bg-brand-accent-soft` — dikkat isteyen satir (son tarih gecmis vb.). */
  vurgu?: boolean;
};

export function VeriTablosu({
  sutunlar,
  satirlar,
  bosMetin = 'Kayıt yok.',
}: {
  sutunlar: VeriSutunu[];
  satirlar: VeriSatiri[];
  bosMetin?: string;
}) {
  if (satirlar.length === 0) {
    return <p className="text-sm text-ink-72 py-2">{bosMetin}</p>;
  }

  return (
    <>
      {/* Telefon — kart modu */}
      <div className="space-y-2 md:hidden">
        {satirlar.map((satir) => {
          const govde = (
            <div
              className={
                satir.vurgu
                  ? 'rounded-lg border border-line bg-brand-accent-soft p-3'
                  : 'rounded-lg border border-line bg-card p-3'
              }
            >
              <dl className="space-y-1">
                {sutunlar.map((sutun) => (
                  <div
                    key={sutun.anahtar}
                    className={
                      sutun.kartEtiketiGizle
                        ? 'text-sm text-ink'
                        : 'flex gap-1.5 text-xs'
                    }
                  >
                    {!sutun.kartEtiketiGizle && (
                      <dt className="text-ink-50 shrink-0">{sutun.baslik}:</dt>
                    )}
                    <dd
                      className={
                        sutun.kartEtiketiGizle
                          ? 'font-medium'
                          : 'text-ink-72 min-w-0'
                      }
                    >
                      {satir.hucreler[sutun.anahtar] ?? '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
          return satir.href ? (
            <Link key={satir.anahtar} href={satir.href} className="block">
              {govde}
            </Link>
          ) : (
            <div key={satir.anahtar}>{govde}</div>
          );
        })}
      </div>

      {/* md+ — tablo */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 border-b border-line-strong">
              {sutunlar.map((sutun) => (
                <th
                  key={sutun.anahtar}
                  className={[
                    sutun.sayisal ? 'py-2 pl-3 font-normal text-right' : 'py-2 pr-3 font-normal',
                    sutun.dar ? 'hidden lg:table-cell' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {sutun.baslik}
                </th>
              ))}
              <th className="py-2 w-6" />
            </tr>
          </thead>
          <tbody>
            {satirlar.map((satir) => (
              <tr
                key={satir.anahtar}
                className={
                  satir.vurgu
                    ? 'border-b border-line bg-brand-accent-soft'
                    : 'border-b border-line'
                }
              >
                {sutunlar.map((sutun) => (
                  <td
                    key={sutun.anahtar}
                    className={[
                      sutun.sayisal
                        ? 'py-3 pl-3 text-right text-ink tabular-nums whitespace-nowrap'
                        : 'py-3 pr-3 text-ink-72',
                      sutun.dar ? 'hidden lg:table-cell' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {satir.hucreler[sutun.anahtar] ?? '—'}
                  </td>
                ))}
                <td className="py-3 text-right">
                  {satir.href && (
                    <Link
                      href={satir.href}
                      className="kashe-tap text-brand-ink hover:underline"
                      aria-label="Ayrıntı"
                    >
                      →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
