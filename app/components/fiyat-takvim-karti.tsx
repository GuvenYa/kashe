'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AvailabilityCalendar } from '@/app/components/availability-calendar';
import { TarihSecici } from '@/app/components/ui/tarih-secici';
import { formatTL } from '@/app/lib/para';
import { useProfilIslem } from '@/app/p/[id]/profil-islem-baglami';
import { IletisimButton } from '@/app/p/[id]/iletisim-button';
import { IlSecici, ilEslestir, type Il } from '@/app/components/ui/il-secici';
import { RezervasyonButton } from '@/app/p/[id]/rezervasyon-button';
import type { OnBehalfBusiness } from '@/app/components/on-behalf-selector';
import type {
  EkipSecenegi,
  HizmetSecenegi,
} from '@/app/lib/teklif-secenekleri';

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
 * gecirilemez — ilk surum `cta prop'u bir render fonksiyonu` ile uretimde "Functions
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
  cta,
  altAlan,
  iller = [],
  saglayiciIli = null,
  yalnizKendiSehri = false,
  hizmetSecenekleri = [],
  ajansMi = false,
  ekipSecenekleri = [],
  tercihUyeId = null,
  teklifModaliAcik = false,
}: {
  /** Sunucuda bulunan en dusuk paket/hizmet fiyati; yoksa null. */
  enDusukFiyat: number | null;
  blockedDates: string[];
  bookedDates: string[];
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
    /** Etkinlikten gelindiyse (`?etkinlik=`) sohbet o etkinlige baglanir. */
    etkinlikId?: string | null;
    /** Favori / paylas / sikayet ikon satiri (istemci elemanlari). */
    actionBar?: ReactNode;
  };
  /** Kartin altindaki ek alan (davet / havuz kisa yolu). */
  altAlan?: ReactNode;
  /**
   * Duzeltme 10-D: 81 il (il secici). Verilmezse sehir alani CIZILMEZ —
   * serbest metne geri donulmez (bulgu 82).
   */
  iller?: Il[];
  /** Saglayicinin ili (listenin basinda; sehir disi notu bununla karsilasir). */
  saglayiciIli?: string | null;
  /** `service_region` "Yalnizca kendi sehri" ise secici tek ile kilitlenir. */
  yalnizKendiSehri?: boolean;
  /** Duzeltme 10-F3: modaldeki hizmet / paket secenekleri (bosken secim yok). */
  hizmetSecenekleri?: HizmetSecenegi[];
  ajansMi?: boolean;
  /** Duzeltme 11-B2: ajans modalindaki "Ekipten tercih" secenekleri. */
  ekipSecenekleri?: EkipSecenegi[];
  /** Duzeltme 11-B5: `?tercih=` ile gelen ekip uyesi secili baslar. */
  tercihUyeId?: string | null;
  /** Teklif modali ACIK baslar (gecerli `?tercih=` ile gelindiyse). */
  teklifModaliAcik?: boolean;
}) {
  // Degerler BAGLAMDAN: mobil alt CTA cubugu ayni durumu okuyor (D2-ek).
  // Kart kendi state ini tutsaydi, cubuktaki dugmeler kartta girilen tarihi
  // goremezdi (aralarinda sunucu bileseni var).
  const {
    tarih,
    sehir,
    kisi,
    tarihAta,
    sehirAta,
    kisiAta,
    hamTarih,
    hamSehir,
    hamKisi,
  } = useProfilIslem();
  const [takvimAcik, setTakvimAcik] = useState(false);
  // Duzeltme 14-A: tarih alani kartin KENDI takvimini gosterir (ikinci bir
  // takvim acilmaz): lg'de gorunen takvime kaydirir, altinda acilir bolumu acar.
  const genisTakvim = useRef<HTMLDivElement>(null);
  const darTakvim = useRef<HTMLDivElement>(null);
  function takvimiGoster() {
    setTakvimAcik(true);
    const hedef = [genisTakvim.current, darTakvim.current].find(
      (el) => el && el.offsetParent !== null
    );
    hedef?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /**
   * Secili il: baglam METIN tasiyor (eski dolgu ve mobil CTA cubugu ayni
   * degeri okuyor). Listeyle eslesmeyen metin secimi BOS gosterir — uydurma
   * il yazilmaz (Duzeltme 10-D3).
   */
  const secilenIl = yalnizKendiSehri && saglayiciIli
    ? saglayiciIli
    : ilEslestir(hamSehir, iller);

  const dolgu = { tarih, sehir, kisi };

  const takvim = (
    <>
      <AvailabilityCalendar
        blockedDates={blockedDates}
        bookedDates={bookedDates}
        editable={false}
        selectedDate={hamTarih || null}
        onSelect={(iso) => tarihAta(iso)}
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
      <div ref={genisTakvim} className="hidden lg:block border-t border-line pt-4">{takvim}</div>
      <div ref={darTakvim} className="lg:hidden border-t border-line pt-4">
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
          {/* Duzeltme 14-A: Turkce tarih metni + hizli secimler (dolu gune denk
              gelirse ilk musait gune kayar); dugme kartin takvimini gosterir. */}
          <TarihSecici
            id="fiyat-karti-tarih"
            deger={hamTarih}
            onDegis={tarihAta}
            doluGunler={[...blockedDates, ...bookedDates]}
            disTakvim={takvimiGoster}
            className={ALAN}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ETIKET} htmlFor="fiyat-karti-sehir">
              Şehir
            </label>
            {/* Duzeltme 10-D: serbest metin yerine IL SECICI. Secilen il modala
                on-dolgu olarak gider (mevcut `onDolgu` yolu); eski metin dolgusu
                bir il adiyla eslesirse secili baslar. */}
            {iller.length > 0 ? (
              <IlSecici
                id="fiyat-karti-sehir"
                iller={iller}
                deger={secilenIl}
                oncelikliIl={saglayiciIli}
                sabitIl={yalnizKendiSehri ? saglayiciIli : null}
                onChange={(ad) => sehirAta(ad)}
                className={ALAN}
              />
            ) : (
              /* Il listesi gelmediyse eski serbest metin (bos secici yerine). */
              <input
                id="fiyat-karti-sehir"
                type="text"
                value={hamSehir}
                onChange={(e) => sehirAta(e.target.value.slice(0, 80))}
                className={ALAN}
              />
            )}
            {yalnizKendiSehri && saglayiciIli && (
              <p className="text-[11px] text-ink-72 mt-1">
                Bu profesyonel yalnız {saglayiciIli} içinde hizmet veriyor.
              </p>
            )}
            {!yalnizKendiSehri &&
              saglayiciIli &&
              secilenIl !== '' &&
              secilenIl !== saglayiciIli && (
                <p className="text-[11px] text-ink-72 mt-1">
                  Şehir dışı: ulaşım ve konaklama teklife eklenebilir.
                </p>
              )}
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
              value={hamKisi}
              onChange={(e) => kisiAta(e.target.value)}
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
            etkinlikId={cta.etkinlikId ?? null}
            iller={iller}
            saglayiciIli={saglayiciIli}
            yalnizKendiSehri={yalnizKendiSehri}
            hizmetSecenekleri={hizmetSecenekleri}
            ajansMi={ajansMi}
            ekipSecenekleri={ekipSecenekleri}
            tercihUyeId={tercihUyeId}
            acikBaslat={teklifModaliAcik}
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
            initialLocation={dolgu.sehir}
            iller={iller}
            saglayiciIli={saglayiciIli}
            yalnizKendiSehri={yalnizKendiSehri}
          />
          {cta.actionBar}
        </div>
      )}

      {altAlan}
    </div>
  );
}
