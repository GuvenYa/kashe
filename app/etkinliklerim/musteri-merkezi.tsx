import Link from 'next/link';
import {
  PanelBaslik,
  DurumKarti,
  IsKarti,
  IsSekmeleri,
  type DurumSatiri,
} from '@/app/components/panel';
import { VurguEtiketi } from '@/app/components/ui/vurgu-etiketi';
import { asamaMi, type IsAsamasi } from '@/app/lib/isler';
import type { MusteriIsleri } from './musteri-isleri';

/**
 * MUSTERI "ETKINLIKLERIM" MERKEZI (Duzeltme 15-A, bulgu 128 - Fahri satir 33).
 *
 * Tek sayfa, uc sekme: Teklif bekleyen / Yaklasan / Tamamlanan (+ doluysa
 * Sonuclanmayan). Her is bir kart; teklifler kartin altinda. Eski "Gelen
 * teklifler" ve "Rezervasyonlar" sayfalari yasiyor (kartlar oraya gider),
 * menude tek madde kaldi.
 *
 * Gorsel dil ekip kurma ekranindan (DESIGN.md bolum 9, "Ortak parcalar").
 * Saf gorunum: veri `musteri-isleri.ts`ten hazir gelir.
 */
// `teklif` asamasi yalniz profesyonel merkezinde dolar (bkz. app/lib/isler.ts);
// burada tip tam olsun diye yazili, sekmesi gosterilmez.
const SEKME_ETIKETI: Record<IsAsamasi, string> = {
  bekleyen: 'Teklif bekleyen',
  teklif: 'Teklif verilen',
  yaklasan: 'Yaklaşan',
  tamamlanan: 'Tamamlanan',
  sonuclanmayan: 'Sonuçlanmayan',
};

const BOS_METIN: Record<IsAsamasi, { baslik: string; metin: string }> = {
  bekleyen: {
    baslik: 'Teklif bekleyen işin yok',
    metin: 'Bir kez anlat, profesyonellerden teklif topla; gelenler burada kart kart görünür.',
  },
  teklif: {
    baslik: 'Teklif verilen işin yok',
    metin: 'Bu sekme profesyonel hesaplarında kullanılır.',
  },
  yaklasan: {
    baslik: 'Yaklaşan işin yok',
    metin: 'Bir teklifi onayladığında rezervasyonun burada görünür.',
  },
  tamamlanan: {
    baslik: 'Tamamlanan işin yok',
    metin: 'Tamamlanan rezervasyonların burada birikir.',
  },
  sonuclanmayan: {
    baslik: 'Sonuçlanmayan işin yok',
    metin: 'İptal edilen ya da teklif almadan kapanan işler burada görünür.',
  },
};

/** Sekmede en cok bu kadar kart (en yeniler). */
const GOSTERIM_SINIRI = 40;

const BIRINCIL_DUGME =
  'inline-flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all whitespace-nowrap';
const IKINCIL_DUGME =
  'inline-flex items-center gap-2 px-4 py-2.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors whitespace-nowrap';

export function MusteriMerkezi({
  veri,
  sekme,
  kurum = null,
}: {
  veri: MusteriIsleri;
  sekme: string | undefined;
  /**
   * Duzeltme 16-B: merkez kurum panelinden acildi (kurumun kendi hesabi).
   * "Yeni etkinlik" kurulusa baglanir; ajans teklif talepleri (RFP) ayri
   * sayfada oldugu ustte yazar.
   */
  kurum?: { id: string; name: string } | null;
}) {
  const { isler, ozet } = veri;
  const sayi: Record<IsAsamasi, number> = {
    bekleyen: 0,
    teklif: 0,
    yaklasan: 0,
    tamamlanan: 0,
    sonuclanmayan: 0,
  };
  for (const is of isler) sayi[is.asama] += 1;

  // Sonuclanmayan sekmesi yalniz doluysa (Fahri'nin uc sekmesi sade kalsin).
  const asamalar: IsAsamasi[] = ['bekleyen', 'yaklasan', 'tamamlanan'];
  if (sayi.sonuclanmayan > 0) asamalar.push('sonuclanmayan');

  // Adres secmediyse ilk dolu sekme acilir.
  const secili: IsAsamasi =
    asamaMi(sekme) && asamalar.includes(sekme)
      ? sekme
      : (asamalar.find((a) => sayi[a] > 0) ?? 'bekleyen');

  const secilenler = isler.filter((is) => is.asama === secili);
  const gosterilen = secilenler.slice(0, GOSTERIM_SINIRI);
  const hicYok = isler.length === 0;

  const dikkat = (metin: string) => (
    <span className="text-ink font-medium">{metin}</span>
  );
  const satirlar: DurumSatiri[] = [
    ozet.acikIs > 0
      ? {
          metin: `Açık ${ozet.acikIs} işin ${ozet.teklifGelenIs} tanesine teklif geldi`,
          tamam: ozet.teklifGelenIs === ozet.acikIs,
        }
      : { metin: 'Teklif bekleyen açık işin yok', tamam: true },
    ozet.kararBekleyenTeklif > 0
      ? {
          metin: dikkat(`${ozet.kararBekleyenTeklif} teklif kararını bekliyor`),
          tamam: false,
        }
      : { metin: 'Karar bekleyen teklif yok', tamam: true },
  ];
  if (ozet.tamamlanmaOnayiBekleyen > 0) {
    satirlar.push({
      metin: dikkat(
        `${ozet.tamamlanmaOnayiBekleyen} rezervasyon tamamlanma onayını bekliyor`
      ),
      tamam: false,
    });
  }
  const durumBasligi =
    ozet.kararBekleyenTeklif > 0
      ? 'Kararını bekleyen teklif var'
      : ozet.tamamlanmaOnayiBekleyen > 0
        ? 'Onayını bekleyen rezervasyon var'
        : ozet.acikIs > 0
          ? 'Teklifler toplanıyor'
          : sayi.yaklasan > 0
            ? 'Yaklaşan işlerin hazır'
            : 'Açık işin yok';

  return (
    <div className="max-w-3xl">
      <PanelBaslik
        eyebrow="Etkinliklerim"
        altNot="Talep, teklif ve rezervasyonların iş iş bir arada: teklif bekleyenler, yaklaşanlar, tamamlananlar."
        sagAlan={
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={
                kurum
                  ? `/etkinlik-sihirbazi?kurulus=${kurum.id}`
                  : '/etkinlik-sihirbazi'
              }
              className={IKINCIL_DUGME}
            >
              Yeni etkinlik
            </Link>
            <Link href="/teklif-topla" className={BIRINCIL_DUGME}>
              <span className="text-base leading-none">+</span>
              Teklif topla
            </Link>
          </div>
        }
      >
        <em className="not-italic font-medium text-brand-accent">Etkinliklerin</em>{' '}
        tek yerde
      </PanelBaslik>

      {kurum && (
        <p className="mb-6 rounded-xl border border-line bg-paper-2 px-4 py-3 text-sm text-ink-72">
          Etkinliklerin, profesyonellerden gelen teklifler ve rezervasyonların
          burada; onayladığın ajans tekliflerinin rezervasyonları da dahil.
          Ajanslara açtığın teklif talepleri etkinliğin kartında görünür;
          ajans tekliflerini karşılaştırmak ve yeni talep açmak için:{' '}
          <Link href="/kurumsal/rfp" className="kashe-tap text-brand-ink hover:underline">
            Teklif talepleri
          </Link>
        </p>
      )}

      {hicYok ? (
        <div className="bg-card border border-line rounded-xl p-8 sm:p-12 text-center">
          <p className="font-display text-xl text-ink mb-2">Henüz işin yok</p>
          <p className="text-ink-72 text-sm mb-6 max-w-md mx-auto">
            Bir kez anlat, birden fazla profesyonelden teklif al; ya da
            etkinliğini kur, ihtiyaç listesi hazır gelsin.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Link href="/teklif-topla" className={BIRINCIL_DUGME}>
              Teklif topla
            </Link>
            <Link href="/etkinlik-sihirbazi" className={IKINCIL_DUGME}>
              Etkinlik sihirbazı
            </Link>
            <Link href="/kashe-ai" className={IKINCIL_DUGME}>
              Kashe AI ile anlat
            </Link>
          </div>
        </div>
      ) : (
        <>
          <DurumKarti
            baslik={durumBasligi}
            tamam={
              ozet.kararBekleyenTeklif === 0 && ozet.tamamlanmaOnayiBekleyen === 0
            }
            ilerleme={
              ozet.acikIs > 0 ? (ozet.teklifGelenIs / ozet.acikIs) * 100 : 100
            }
            satirlar={satirlar}
            // Kutu etiketi kisa tutulur: dar ekranda uc kutu yan yana ve
            // "Tamamlanan" kutuya sigmiyordu (375 px turu).
            kutular={[
              { etiket: 'Bekleyen', deger: sayi.bekleyen },
              { etiket: 'Yaklaşan', deger: sayi.yaklasan },
              { etiket: 'Biten', deger: sayi.tamamlanan },
            ]}
          />

          <div className="mt-8 flex items-center justify-between gap-3 flex-wrap">
            <VurguEtiketi>Aşamaya göre</VurguEtiketi>
            <IsSekmeleri
              sekmeler={asamalar.map((a) => ({
                anahtar: a,
                etiket: SEKME_ETIKETI[a],
                sayi: sayi[a],
              }))}
              secili={secili}
              temelYol="/etkinliklerim"
            />
          </div>

          {gosterilen.length === 0 ? (
            <div className="mt-4 bg-card border border-line rounded-xl p-8 text-center">
              <p className="font-display text-lg text-ink mb-1">
                {BOS_METIN[secili].baslik}
              </p>
              <p className="text-ink-72 text-sm max-w-md mx-auto">
                {BOS_METIN[secili].metin}
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {gosterilen.map((is) => (
                <IsKarti key={is.anahtar} is={is} />
              ))}
            </ul>
          )}
          {secilenler.length > gosterilen.length && (
            <p className="text-xs text-ink-72 mt-3">
              En yeni {gosterilen.length} iş gösteriliyor (toplam{' '}
              {secilenler.length}).
            </p>
          )}

          <p className="text-xs text-ink-72 mt-8">
            Ayrı listeler:{' '}
            <Link
              href="/teklif-taleplerim"
              className="kashe-tap text-brand-ink hover:underline"
            >
              gelen teklifler
            </Link>
            {' · '}
            <Link
              href="/rezervasyonlarim"
              className="kashe-tap text-brand-ink hover:underline"
            >
              rezervasyonlar
            </Link>
            {' · '}
            <Link href="/mesajlar" className="kashe-tap text-brand-ink hover:underline">
              mesajlar
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
