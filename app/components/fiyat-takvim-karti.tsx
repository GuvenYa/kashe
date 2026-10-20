'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { AvailabilityCalendar } from '@/app/components/availability-calendar';
import { takvimiAc } from '@/app/lib/tarih-girdisi';
import { formatTL } from '@/app/lib/para';
import { IletisimButton } from '@/app/p/[id]/iletisim-button';
import { RezervasyonButton } from '@/app/p/[id]/rezervasyon-button';
import type { OnBehalfBusiness } from '@/app/components/on-behalf-selector';

/**
 * FIYAT / TAKVIM KARTI (D2) — profilin sag sutunundaki islem karti.
 *
 * NE YAPAR: fiyat gosterir, musaitlik takvimini acar ve kullanicinin sectigi
 * tarih/sehir/kisi bilgisini CTA'lara on-doldurma olarak verir.
 *
 * NE YAPMAZ: fiyat HESAPLAMAZ (en dusuk fiyat sunucuda bulunur), takvimi
 * DEGISTIRMEZ (`editable={false}`; dolu gunler tiklanamaz) ve mesaj/rezervasyon
 * GONDERMEZ — CTA'lar `children` olarak gelen mevcut dugmelerdir. Eylemler ve
 * formlar D2'de degismedi; kart yalniz onlari besler.
 *
 * `lg` ALTI: takvim varsayilan KAPALI bir acilir bolum. Telefonda kart kimlik
 * satirinin altinda tek sutun duruyor; acik bir takvim sayfanin yarisini
 * kaplayip asil icerigi asagi itiyordu.
 *
 * CTA'LAR NEDEN BURADA RENDER EDILIYOR: cagiran (`ProfessionalProfile`) bir
 * SUNUCU bileseni. Sunucudan istemci bilesenine fonksiyon (render-prop)
 * gecirilemez — ilk surum `cta={(dolgu) => ...}` ile uretimde "Functions
 * cannot be passed to Client Components" hatasi verdi. Kart bu yuzden
 * dugmelerin DUZ prop'larini alir ve `IletisimButton` / `RezervasyonButton`'i
 * kendi icinde kurar; eylemler yine o bilesenlerin icindedir.
 */
const ALAN =
  'w-full px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';
const ETIKET =
  'block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1';

export function FiyatTakvimKarti({
  enDusukFiyat,
  blockedDates,
  bookedDates,
  varsayilanSehir,
  cta,
  altAlan,
}: {
  /** Sunucuda bulunan en dusuk paket/hizmet fiyati; yoksa null. */
  enDusukFiyat: number | null;
  blockedDates: string[];
  bookedDates: string[];
  varsayilanSehir: string | null;
  /**
   * CTA dugmelerinin prop'lari (serilestirilebilir). Verilmezse kart yalniz
   * fiyat + takvim gosterir (kendi profiline bakan sahip).
   */
  cta?: {
    professionalId: string;
    professionalName: string;
    categorySlug: string | null;
    isLoggedIn: boolean;
    currentUserIsProfessional: boolean;
    isOwnProfile: boolean;
    writableBusinesses: OnBehalfBusiness[];
    /** Favori / paylas / sikayet ikon satiri (istemci elemanlari). */
    actionBar?: ReactNode;
  };
  /** Kartin altindaki ek alan (davet / havuz kisa yolu). */
  altAlan?: ReactNode;
}) {
  const [tarih, setTarih] = useState('');
  const [sehir, setSehir] = useState(varsayilanSehir ?? '');
  const [kisi, setKisi] = useState('');
  const [takvimAcik, setTakvimAcik] = useState(false);

  const kisiSayisi = (() => {
    const n = Number(kisi);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  })();

  const dolgu = {
    tarih: tarih.trim() || null,
    sehir: sehir.trim() || null,
    kisi: kisiSayisi,
  };

  const takvim = (
    <>
      <AvailabilityCalendar
        blockedDates={blockedDates}
        bookedDates={bookedDates}
        editable={false}
        selectedDate={tarih || null}
        onSelect={(iso) => setTarih(iso)}
      />
      <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-ink-72">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-moss/40" aria-hidden />
          Müsait
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-ink-72/40" aria-hidden />
          Dolu
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-accent" aria-hidden />
          Seçilen
        </span>
      </div>
    </>
  );

  return (
    <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
      {/* Fiyat */}
      <div>
        {enDusukFiyat !== null ? (
          <>
            <p className="font-display text-3xl text-ink tabular-nums leading-none">
              {formatTL(enDusukFiyat)}&apos;den
            </p>
            <p className="text-xs text-ink-72 mt-1">
              Paketlerden başlayan fiyat
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-2xl text-ink leading-tight">
              Fiyat teklifle
            </p>
            <p className="text-xs text-ink-72 mt-1">
              Yayında sabit fiyatlı paket yok; teklif isteyebilirsin.
            </p>
          </>
        )}
      </div>

      {/* Takvim — lg+ acik, altinda acilir bolum */}
      <div className="hidden lg:block border-t border-line pt-4">{takvim}</div>
      <div className="lg:hidden border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setTakvimAcik((v) => !v)}
          aria-expanded={takvimAcik}
          className="kashe-tap w-full flex items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-brand-ink"
        >
          Müsaitlik
          <span aria-hidden>{takvimAcik ? '−' : '+'}</span>
        </button>
        {takvimAcik && <div className="mt-3">{takvim}</div>}
      </div>

      {/* Alanlar — hepsi istege bagli */}
      <div className="border-t border-line pt-4 space-y-3">
        <div>
          <label className={ETIKET} htmlFor="fiyat-karti-tarih">
            Tarih
          </label>
          <input
            id="fiyat-karti-tarih"
            type="date"
            value={tarih}
            onClick={takvimiAc}
            onChange={(e) => setTarih(e.target.value)}
            className={ALAN}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ETIKET} htmlFor="fiyat-karti-sehir">
              Şehir
            </label>
            <input
              id="fiyat-karti-sehir"
              type="text"
              value={sehir}
              onChange={(e) => setSehir(e.target.value.slice(0, 80))}
              className={ALAN}
            />
          </div>
          <div>
            <label className={ETIKET} htmlFor="fiyat-karti-kisi">
              Kişi
            </label>
            <input
              id="fiyat-karti-kisi"
              type="number"
              min={1}
              inputMode="numeric"
              value={kisi}
              onChange={(e) => setKisi(e.target.value)}
              className={ALAN}
            />
          </div>
        </div>
      </div>

      {/* CTA'lar — mevcut dugmeler, on-doldurma ile */}
      {cta && (
        <div className="space-y-2">
          <IletisimButton
            professionalId={cta.professionalId}
            professionalName={cta.professionalName}
            categorySlug={cta.categorySlug}
            isLoggedIn={cta.isLoggedIn}
            currentUserIsProfessional={cta.currentUserIsProfessional}
            isOwnProfile={cta.isOwnProfile}
            writableBusinesses={cta.writableBusinesses}
            variant="primary-accent"
            onDolgu={dolgu}
          />
          <RezervasyonButton
            professionalId={cta.professionalId}
            professionalName={cta.professionalName}
            isLoggedIn={cta.isLoggedIn}
            currentUserIsProfessional={cta.currentUserIsProfessional}
            isOwnProfile={cta.isOwnProfile}
            writableBusinesses={cta.writableBusinesses}
            variant="outline-ink"
            initialDate={dolgu.tarih}
          />
          {cta.actionBar}
        </div>
      )}

      {altAlan}
    </div>
  );
}
