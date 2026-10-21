'use client';

import { Pencil } from 'lucide-react';
import { tarihMetni, KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import { formatTLAralik } from '@/app/lib/para';

/**
 * "ETKINLIGINI ANLADIM." OZETI (D3, desen 3) — sihirbazin cikarim ozeti.
 *
 * Eski "Brief'ten anladiklarimiz" cip seridinin yerine gecer. AYNI VERI (URL
 * durumu) ve AYNI tiklama davranisi: kutuya basmak ilgili adima goturur, yani
 * yapay zekanin cikarimi gorunur ve duzeltilebilir kalir.
 *
 * Cip seridinden iki fark:
 *   1. Alti kutu her zaman cizilir — EKSIK olan da gorunur ("— · ekle").
 *      Serit yalniz DOLU alanlari gosterdigi icin kullanici neyi atladigini
 *      gormuyordu.
 *   2. Butce ve roller de ozete girer (serit yalniz tur/sehir/tarih tasiyordu).
 *
 * RAKAM URETMEZ: butce `formatTLAralik` ile, tarih `tarihMetni` ile bicimlenir;
 * katilimci sayisi URL'den geldigi gibi yazilir. Tahmin, yuvarlama, "yaklasik"
 * gibi turetme YOK.
 *
 * Bu bir ISTEMCI bileseni ve cagirani (`sihirbaz-client`) da istemci: `onAdim`
 * fonksiyon prop'u SUNUCU sinirini gecmez.
 */

/** "Esnek · Mart" icin yalniz ay adi (tam tarih yoksa yil anlamsiz). */
function ayAdi(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('tr-TR', {
    month: 'long',
    timeZone: KASHE_SAAT_DILIMI,
  });
}

type Kutu = {
  etiket: string;
  /** null = eksik; kutu soluk cizilir ve "— · ekle" yazar. */
  deger: string | null;
  adim: number;
  vurgu?: boolean;
};

function OzetKutusu({
  kutu,
  onAdim,
}: {
  kutu: Kutu;
  onAdim: (adim: number) => void;
}) {
  const dolu = kutu.deger !== null;
  const kabuk = dolu
    ? kutu.vurgu
      ? 'border-brand-accent/30 bg-brand-accent/[0.04] hover:border-brand-accent/60'
      : 'border-line bg-card hover:border-brand-ink/40'
    : 'border-line border-dashed bg-paper-2 hover:border-brand-ink/40';
  const etiketRengi =
    dolu && kutu.vurgu ? 'text-brand-accent' : 'text-ink-50';
  const degerRengi = dolu ? 'text-ink' : 'text-ink-50';

  return (
    <button
      type="button"
      onClick={() => onAdim(kutu.adim)}
      className={`kashe-tap group relative text-left rounded-xl border p-4 transition-colors ${kabuk}`}
    >
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.16em] mb-1.5 pr-5 ${etiketRengi}`}
      >
        {kutu.etiket}
      </p>
      <p
        className={`font-display font-semibold leading-snug break-words ${degerRengi}`}
      >
        {dolu ? kutu.deger : '— · ekle'}
      </p>
      <Pencil
        size={12}
        className="absolute top-3.5 right-3.5 text-ink-32 group-hover:text-brand-ink"
        aria-hidden="true"
      />
    </button>
  );
}

export function AnladimOzeti({
  turEtiketi,
  sehirAdi,
  ilce,
  tarih,
  bitis,
  esnek,
  katilimci,
  butceMin,
  butceMax,
  rolAdlari,
  onAdim,
}: {
  turEtiketi: string;
  sehirAdi: string;
  ilce: string;
  tarih: string;
  bitis: string;
  esnek: boolean;
  katilimci: string;
  butceMin: string;
  butceMax: string;
  /** Secilen kategorilerin Turkce adlari (sirali). */
  rolAdlari: string[];
  onAdim: (adim: number) => void;
}) {
  const tarihDegeri = (() => {
    if (esnek) {
      const ay = tarih ? ayAdi(tarih) : null;
      return ay ? `Esnek · ${ay}` : 'Esnek';
    }
    if (!tarih) return null;
    const bas = tarihMetni(tarih);
    if (!bas) return null;
    if (bitis && bitis !== tarih) {
      const son = tarihMetni(bitis);
      return son ? `${bas} → ${son}` : bas;
    }
    return bas;
  })();

  const butce = formatTLAralik(
    butceMin ? Number(butceMin) : null,
    butceMax ? Number(butceMax) : null
  );

  const kutular: Kutu[] = [
    { etiket: 'Etkinlik türü', deger: turEtiketi || null, adim: 1 },
    {
      etiket: 'Şehir',
      deger: sehirAdi ? [sehirAdi, ilce].filter(Boolean).join(' / ') : null,
      adim: 2,
    },
    { etiket: 'Tarih', deger: tarihDegeri, adim: 3 },
    {
      etiket: 'Katılımcı',
      deger: katilimci ? `${katilimci} kişi` : null,
      adim: 3,
    },
    { etiket: 'Bütçe', deger: butce || null, adim: 3, vurgu: true },
    {
      etiket: 'Roller',
      deger: rolAdlari.length > 0 ? rolAdlari.join(' · ') : null,
      adim: 4,
    },
  ];

  return (
    <div className="mb-6">
      {/* Eyebrow: kisa pembe cizgi + etiket (desen 3). */}
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="h-0.5 w-6 rounded-full bg-brand-accent shrink-0"
          aria-hidden="true"
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
          Kashe AI · Etkinlik planlama asistanı
        </p>
      </div>

      {/* Sayfanin h1'i yukarida ("Etkinliğini kur, sana uyanları görelim.");
          bu baslik onun ALTINDA bir bolum basligi oldugu icin h2. */}
      <h2 className="font-display font-semibold text-2xl md:text-3xl text-ink tracking-tight">
        Etkinliğini{' '}
        <em className="not-italic text-brand-accent">anladım</em>.
      </h2>
      <p className="text-sm text-ink-72 mt-2 leading-relaxed">
        Anlattıklarından şu kısıtları çıkardım; eşleşme bunlara göre yapılacak.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
        {kutular.map((k) => (
          <OzetKutusu key={k.etiket} kutu={k} onAdim={onAdim} />
        ))}
      </div>
    </div>
  );
}
