'use client';

import {
  IC_KALEM_KAYNAK_ETIKETLERI,
  marjYuzdesi,
  paraMetni,
  type IcKalemSatiri,
  type KalemSatiri,
} from '../teklif-data';

/**
 * TEKLIF KALEM TABLOSU (D1b-3 / madde 2).
 *
 * Eski gizli maliyet KARTI KALKTI: ayni kalemler iki ayri listede iki kez
 * duruyordu ve ajans "bu satirin maliyeti ne" sorusunu iki yerde arastiriyordu.
 * Maliyet ile marj artik AYNI TABLONUN son iki sutunu.
 *
 * YETKI: ic maliyet sutunlari `maliyetGorulur` ile kosullu RENDER edilir — yetki
 * yoksa DOM'da da yoktur (gizlenen bir sutun degil). Veri yolu degismedi:
 * `listProposalInternalItems` / `upsertProposalItemCost` (yalniz RPC).
 *
 * TEMBEL YUKLEME: ic maliyet sutun basliginda "Yukle" dugmesi var; basilmadan
 * RPC hic cagrilmaz ve hucreler "—" gosterir. Eskiden bu bir akordeondu; sutun
 * basligina tasindi cunku artik acilacak ayri bir kart yok.
 *
 * ISTEMCIDE HESAP YOK: satir toplami, ara toplam, KDV ve genel toplam DB'den
 * gelir. Buradaki tek turetme marj YUZDESI (`marjYuzdesi`, DB'nin `margin_rate`
 * alanindan) ve ic maliyet x adet carpimi — ikisi de GOSTERIM, fiyat uretmez.
 */
const ALAN =
  'px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';
const BTN_IKINCIL =
  'kashe-tap px-3 py-1.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink hover:text-brand-ink transition-colors disabled:opacity-50';
const BASLIK_HUCRE =
  'py-2 pr-3 font-normal font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50';

function sayi(v: string): number | null {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export type IcMaliyetYazma = {
  itemId: string;
  internalCost: number;
  note: string | null;
};

export function TeklifKalemTablosu({
  kalemler,
  icKalemler,
  duzenlenebilir,
  dondurulmus,
  maliyetGorulur,
  maliyetYazilir,
  maliyetYukleniyor,
  maliyetHatasi,
  onMaliyetYukle,
  onMaliyetYaz,
  kalemGuncelle,
  kalemEkle,
  silmeIstegi,
  silOnayi,
  silOnayla,
  silVazgec,
  aciklamaRefleri,
  kaydediliyor,
  kaydedildi,
  isPending,
}: {
  kalemler: KalemSatiri[];
  /** `null` = henuz yuklenmedi (RPC cagrilmadi). */
  icKalemler: IcKalemSatiri[] | null;
  duzenlenebilir: boolean;
  dondurulmus: boolean;
  maliyetGorulur: boolean;
  maliyetYazilir: boolean;
  maliyetYukleniyor: boolean;
  maliyetHatasi: string | null;
  onMaliyetYukle: () => void;
  onMaliyetYaz: (girdi: IcMaliyetYazma) => void;
  kalemGuncelle: (
    itemId: string,
    alan: Partial<{
      description: string;
      quantity: number;
      unitPrice: number;
      isVisible: boolean;
    }>
  ) => void;
  kalemEkle: () => void;
  silmeIstegi: (itemId: string) => void;
  /** Silme onayi bekleyen kalem kimligi. */
  silOnayi: string | null;
  silOnayla: (itemId: string) => void;
  silVazgec: () => void;
  aciklamaRefleri: React.RefObject<Record<string, HTMLInputElement | null>>;
  kaydediliyor: string | null;
  kaydedildi: string | null;
  isPending: boolean;
}) {
  const icHarita = new Map<string, IcKalemSatiri>();
  for (const k of icKalemler ?? []) icHarita.set(k.item_id, k);

  /** Ic maliyet hucresinin degeri: birim maliyet x adet (gosterim). */
  function icToplam(ic: IcKalemSatiri | undefined): string | null {
    if (!ic || ic.internal_cost == null) return null;
    const birim = Number(ic.internal_cost);
    const adet = Number(ic.quantity);
    if (!Number.isFinite(birim) || !Number.isFinite(adet)) return null;
    return paraMetni(birim * adet);
  }

  const icSutunSayisi = maliyetGorulur ? 2 : 0;

  // ---------------------------------------------------------------------------
  // Hucre parcalari — tablo ve kart modu AYNI mantigi paylasir
  // ---------------------------------------------------------------------------
  function AciklamaGirdisi({ k }: { k: KalemSatiri }) {
    if (!duzenlenebilir) {
      return <p className="text-sm text-ink">{k.description}</p>;
    }
    return (
      <input
        ref={(el) => {
          aciklamaRefleri.current[k.id] = el;
        }}
        type="text"
        defaultValue={k.description}
        aria-label="Kalem açıklaması"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== k.description) kalemGuncelle(k.id, { description: v });
        }}
        className={`${ALAN} w-full`}
      />
    );
  }

  function AdetGirdisi({ k }: { k: KalemSatiri }) {
    if (!duzenlenebilir) {
      return <p className="text-sm text-ink-72 tabular-nums">{k.quantity}</p>;
    }
    return (
      <input
        type="text"
        inputMode="decimal"
        defaultValue={String(k.quantity)}
        aria-label="Adet"
        onBlur={(e) => {
          const n = sayi(e.target.value);
          if (n !== null && n !== Number(k.quantity)) {
            kalemGuncelle(k.id, { quantity: n });
          }
        }}
        className={`${ALAN} w-full`}
      />
    );
  }

  function BirimGirdisi({ k }: { k: KalemSatiri }) {
    if (!duzenlenebilir) {
      return (
        <p className="text-sm text-ink-72 tabular-nums">
          {paraMetni(k.unit_client_price) ?? '—'}
        </p>
      );
    }
    return (
      <input
        type="text"
        inputMode="decimal"
        /* 0 ise bos gelir ki placeholder gorunsun; bos birakilirsa 0 kalir */
        defaultValue={
          Number(k.unit_client_price) === 0 ? '' : String(k.unit_client_price)
        }
        aria-label="Birim fiyat"
        placeholder="0"
        onBlur={(e) => {
          const n = sayi(e.target.value);
          if (n !== null && n !== Number(k.unit_client_price)) {
            kalemGuncelle(k.id, { unitPrice: n });
          }
        }}
        className={`${ALAN} w-full`}
      />
    );
  }

  function GorunurKutusu({ k }: { k: KalemSatiri }) {
    return (
      <input
        type="checkbox"
        checked={k.is_visible_to_client}
        disabled={!duzenlenebilir || isPending}
        aria-label="Müşteriye görünür"
        onChange={(e) => kalemGuncelle(k.id, { isVisible: e.target.checked })}
        className="w-4 h-4 accent-brand-ink"
      />
    );
  }

  /** Ic maliyet hucresi — yalniz `maliyetGorulur` dalinda cagrilir. */
  function IcMaliyetHucresi({ k }: { k: KalemSatiri }) {
    const ic = icHarita.get(k.id);
    if (icKalemler === null) {
      return <span className="text-sm text-ink-50">—</span>;
    }
    const yazilabilir = maliyetYazilir && !dondurulmus;
    return (
      <div className="space-y-1">
        {yazilabilir ? (
          <input
            type="text"
            inputMode="decimal"
            defaultValue={ic?.internal_cost != null ? String(ic.internal_cost) : ''}
            aria-label="Birim iç maliyet"
            placeholder="Birim"
            onBlur={(e) => {
              const n = sayi(e.target.value);
              if (n === null) return;
              if (ic?.internal_cost != null && n === Number(ic.internal_cost)) {
                return;
              }
              onMaliyetYaz({
                itemId: k.id,
                internalCost: n,
                note: ic?.private_note ?? null,
              });
            }}
            className={`${ALAN} w-full`}
          />
        ) : (
          <p className="text-sm text-ink tabular-nums">
            {ic?.internal_cost != null
              ? (paraMetni(ic.internal_cost) ?? '—')
              : '—'}
          </p>
        )}
        {/* Birim x adet: hucrenin ustundeki deger BIRIM, satir toplami bu. */}
        {icToplam(ic) && (
          <p className="text-[11px] text-ink-50 tabular-nums">
            satır {icToplam(ic)}
          </p>
        )}
        {ic?.source && (
          <p className="text-[11px] text-ink-50">
            {IC_KALEM_KAYNAK_ETIKETLERI[ic.source] ?? ic.source}
          </p>
        )}
        {yazilabilir ? (
          <input
            type="text"
            defaultValue={ic?.private_note ?? ''}
            aria-label="İç not"
            placeholder="Not (isteğe bağlı)"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v === (ic?.private_note ?? '')) return;
              if (ic?.internal_cost == null) return;
              onMaliyetYaz({
                itemId: k.id,
                internalCost: Number(ic.internal_cost),
                note: v || null,
              });
            }}
            className={`${ALAN} w-full text-xs`}
          />
        ) : (
          ic?.private_note && (
            <p className="text-[11px] text-ink-72" title={ic.private_note}>
              {ic.private_note}
            </p>
          )
        )}
      </div>
    );
  }

  /** Marj hucresi — tutar + yuzde; ikisi de DB alanlarindan. */
  function MarjHucresi({ k }: { k: KalemSatiri }) {
    const ic = icHarita.get(k.id);
    if (icKalemler === null) {
      return <span className="text-sm text-ink-50">—</span>;
    }
    const marj = marjYuzdesi(ic?.margin_rate);
    const tutar = ic?.markup_amount != null ? paraMetni(ic.markup_amount) : null;
    if (!tutar && marj === null) {
      return <span className="text-sm text-ink-50">—</span>;
    }
    return (
      <div className="tabular-nums">
        <p className="text-sm text-ink">{tutar ?? '—'}</p>
        {marj !== null && <p className="text-[11px] text-ink-50">%{marj}</p>}
      </div>
    );
  }

  function KaydetIsareti({ id }: { id: string }) {
    if (kaydediliyor === id) {
      return <span className="text-[11px] text-ink-50">Kaydediliyor…</span>;
    }
    if (kaydedildi === id) {
      return <span className="text-[11px] text-moss">Kaydedildi</span>;
    }
    return null;
  }

  function SilOnayi({ k }: { k: KalemSatiri }) {
    if (silOnayi !== k.id) return null;
    return (
      <div className="mt-2 px-3 py-2 bg-paper border border-line-strong rounded-lg flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ink">Bu kalem silinecek. Emin misin?</p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={isPending}
            onClick={() => silOnayla(k.id)}
            className="kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50"
          >
            Sil
          </button>
          <button type="button" onClick={silVazgec} className={BTN_IKINCIL}>
            Vazgeç
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  return (
    <div className="bg-card border border-line rounded-lg p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <p className="font-display font-semibold text-ink">Kalemler</p>
        <div className="flex items-center gap-2 flex-wrap">
          {dondurulmus && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72">
              Gönderildi — kilitli
            </span>
          )}
          {maliyetGorulur && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 bg-paper-2 border border-line px-2 py-0.5 rounded">
              İç maliyet gizli — yalnız ticari yetkililer
            </span>
          )}
        </div>
      </div>

      {duzenlenebilir && (
        <p className="text-xs text-ink-50 mb-3">
          Değişiklikler alandan çıkınca kaydedilir.
        </p>
      )}
      {!duzenlenebilir && <div className="mb-3" />}

      {maliyetGorulur && maliyetHatasi && (
        <p className="text-sm text-danger mb-3">{maliyetHatasi}</p>
      )}

      {kalemler.length === 0 ? (
        <p className="text-sm text-ink-72">Henüz kalem yok.</p>
      ) : (
        <>
          {/* ---------------- md+ : tablo ---------------- */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-line-strong">
                  <th className={BASLIK_HUCRE}>Kalem</th>
                  <th className={`${BASLIK_HUCRE} w-20`}>Adet</th>
                  <th className={`${BASLIK_HUCRE} w-32`}>Birim fiyat</th>
                  <th className={`${BASLIK_HUCRE} w-32 text-right`}>Toplam</th>
                  <th className={`${BASLIK_HUCRE} w-28 text-center`}>
                    Müşteriye görünür
                  </th>
                  {maliyetGorulur && (
                    <>
                      <th className={`${BASLIK_HUCRE} w-40`}>
                        <span className="block">İç maliyet</span>
                        {icKalemler === null && (
                          <button
                            type="button"
                            onClick={onMaliyetYukle}
                            disabled={maliyetYukleniyor}
                            className="mt-1 kashe-tap font-mono text-[10px] uppercase tracking-[0.12em] text-brand-ink hover:underline disabled:opacity-50"
                          >
                            {maliyetYukleniyor ? 'Yükleniyor…' : 'Yükle'}
                          </button>
                        )}
                      </th>
                      <th className={`${BASLIK_HUCRE} w-28`}>Marj</th>
                    </>
                  )}
                  <th className={`${BASLIK_HUCRE} w-16`} />
                </tr>
              </thead>
              <tbody>
                {kalemler.map((k) => (
                  <tr
                    key={k.id}
                    className={
                      k.is_visible_to_client
                        ? 'border-b border-line align-top'
                        : 'border-b border-line align-top text-ink-50'
                    }
                  >
                    <td className="py-3 pr-3">
                      <AciklamaGirdisi k={k} />
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {!k.is_visible_to_client && (
                          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-50 bg-paper-2 border border-line px-1.5 py-0.5 rounded-full">
                            gizli
                          </span>
                        )}
                        <KaydetIsareti id={k.id} />
                      </div>
                      <SilOnayi k={k} />
                    </td>
                    <td className="py-3 pr-3">
                      <AdetGirdisi k={k} />
                    </td>
                    <td className="py-3 pr-3">
                      <BirimGirdisi k={k} />
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <p className="font-display font-semibold text-ink tabular-nums">
                        {paraMetni(k.total_client_price) ?? '—'}
                      </p>
                    </td>
                    <td className="py-3 pr-3 text-center">
                      <GorunurKutusu k={k} />
                    </td>
                    {maliyetGorulur && (
                      <>
                        <td className="py-3 pr-3">
                          <IcMaliyetHucresi k={k} />
                        </td>
                        <td className="py-3 pr-3">
                          <MarjHucresi k={k} />
                        </td>
                      </>
                    )}
                    <td className="py-3 text-right">
                      {duzenlenebilir && (
                        <button
                          type="button"
                          onClick={() => silmeIstegi(k.id)}
                          disabled={isPending}
                          className={BTN_IKINCIL}
                        >
                          Sil
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---------------- md alti : kart modu ---------------- */}
          <div className="md:hidden space-y-2">
            {maliyetGorulur && icKalemler === null && (
              <button
                type="button"
                onClick={onMaliyetYukle}
                disabled={maliyetYukleniyor}
                className={`${BTN_IKINCIL} w-full`}
              >
                {maliyetYukleniyor ? 'Yükleniyor…' : 'İç maliyeti yükle'}
              </button>
            )}
            {kalemler.map((k) => (
              <div
                key={k.id}
                className={
                  k.is_visible_to_client
                    ? 'border border-line rounded-lg p-3 space-y-2'
                    : 'border border-line rounded-lg p-3 space-y-2 opacity-60'
                }
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mb-1">
                    Kalem
                  </p>
                  <AciklamaGirdisi k={k} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mb-1">
                      Adet
                    </p>
                    <AdetGirdisi k={k} />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mb-1">
                      Birim fiyat
                    </p>
                    <BirimGirdisi k={k} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
                    Toplam
                  </span>
                  <span className="font-display font-semibold text-ink tabular-nums">
                    {paraMetni(k.total_client_price) ?? '—'}
                  </span>
                </div>
                <label className="flex items-center gap-2 text-xs text-ink-72">
                  <GorunurKutusu k={k} />
                  Müşteriye görünür
                </label>

                {maliyetGorulur && (
                  <div className="pt-2 border-t border-line space-y-2">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mb-1">
                        İç maliyet
                      </p>
                      <IcMaliyetHucresi k={k} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
                        Marj
                      </span>
                      <MarjHucresi k={k} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <KaydetIsareti id={k.id} />
                  {duzenlenebilir && (
                    <button
                      type="button"
                      onClick={() => silmeIstegi(k.id)}
                      disabled={isPending}
                      className={BTN_IKINCIL}
                    >
                      Sil
                    </button>
                  )}
                </div>
                <SilOnayi k={k} />
              </div>
            ))}
          </div>
        </>
      )}

      {duzenlenebilir && (
        <button
          type="button"
          onClick={kalemEkle}
          disabled={isPending}
          className={`${BTN_IKINCIL} mt-3`}
        >
          + Kalem ekle
        </button>
      )}

      {maliyetGorulur && dondurulmus && icKalemler !== null && (
        <p className="mt-3 text-xs text-ink-50">
          Sürüm gönderildi; iç maliyet salt okunur.
        </p>
      )}

      {/* Sutun sayisi degisken: gizli kalem toplama girmez kurali DB'de. */}
      <p className="mt-3 text-xs text-ink-50">
        Gizli kalemler müşteriye gösterilmez ve toplama girmez
        {icSutunSayisi > 0 ? '; iç maliyet yalnız kuruluş içinde görünür' : ''}.
      </p>
    </div>
  );
}
