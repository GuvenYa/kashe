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
import type { SaticiIsleri } from './satici-isleri';

/**
 * PROFESYONEL "ISLERIM" MERKEZI (Duzeltme 15-B, bulgu 129 - Fahri satir 34).
 *
 * Tek sayfa, dort sekme: Yanit bekleyen / Teklif verdiklerim / Anlasilan /
 * Tamamlanan (+ doluysa Sonuclanmayan). Musteri merkeziyle ayni kart ve ayni
 * gorsel dil (DESIGN.md bolum 9, "Ortak parcalar"); iki taraf ayni isi ayni
 * kartta gorur. Eski "Teklif talepleri", "Verdigim teklifler" ve
 * "Rezervasyonlar" sayfalari yasiyor (kartlar oraya gider), menude tek madde.
 *
 * Saf gorunum: veri `satici-isleri.ts`ten hazir gelir.
 */
const SEKME_ETIKETI: Record<IsAsamasi, string> = {
  bekleyen: 'Yanıt bekleyen',
  teklif: 'Teklif verdiklerim',
  yaklasan: 'Anlaşılan',
  tamamlanan: 'Tamamlanan',
  sonuclanmayan: 'Sonuçlanmayan',
};

const BOS_METIN: Record<IsAsamasi, { baslik: string; metin: string }> = {
  bekleyen: {
    baslik: 'Yanıtını bekleyen talep yok',
    metin: 'Müşterilerin sana gönderdiği talepler burada görünür; teklif verince "Teklif verdiklerim"e geçer.',
  },
  teklif: {
    baslik: 'Müşteride bekleyen teklifin yok',
    metin: 'Verdiğin teklifler, müşteri karar verene kadar burada durur.',
  },
  yaklasan: {
    baslik: 'Anlaşılan işin yok',
    metin: 'Müşteri teklifini onayladığında rezervasyon burada görünür.',
  },
  tamamlanan: {
    baslik: 'Tamamlanan işin yok',
    metin: 'Tamamlanan rezervasyonların burada birikir.',
  },
  sonuclanmayan: {
    baslik: 'Sonuçlanmayan işin yok',
    metin: 'İptal edilen, reddedilen ya da süresi dolan işler burada görünür.',
  },
};

/** Sekmede en cok bu kadar kart (en yeniler). */
const GOSTERIM_SINIRI = 40;

const IKINCIL_DUGME =
  'inline-flex items-center gap-2 px-4 py-2.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors whitespace-nowrap';

export function SaticiMerkezi({
  veri,
  sekme,
  ajansUzerinden = null,
  ajansHesabi = false,
}: {
  veri: SaticiIsleri;
  sekme: string | undefined;
  /**
   * Duzeltme 15-E: "ajansim uzerinden" tercihi aciksa ajansin adi. Yeni
   * talepler ajansa gittigi icin burada gorunmez; kullanici bunu bilsin.
   */
  ajansUzerinden?: string | null;
  /**
   * Duzeltme 16-A: merkez ajans panelinden acildi (ajansin kendi hesabi).
   * Kurumsal RFP teklifleri ayri akista; kullanici nerede oldugunu bilsin.
   */
  ajansHesabi?: boolean;
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

  // Sonuclanmayan sekmesi yalniz doluysa (Fahri'nin dort sekmesi sade kalsin).
  const asamalar: IsAsamasi[] = ['bekleyen', 'teklif', 'yaklasan', 'tamamlanan'];
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
    ozet.acikTalep > 0
      ? {
          metin: `Açık ${ozet.acikTalep} talebin ${ozet.teklifVerilen} tanesine teklif verdin`,
          tamam: ozet.teklifVerilen === ozet.acikTalep,
        }
      : { metin: 'Açık talep yok', tamam: true },
    ozet.yanitBekleyen > 0
      ? {
          metin: dikkat(`${ozet.yanitBekleyen} talep yanıtını bekliyor`),
          tamam: false,
        }
      : { metin: 'Yanıtını bekleyen talep yok', tamam: true },
  ];
  if (ozet.tamamlanmayiBekleyen > 0) {
    satirlar.push({
      metin: dikkat(
        `${ozet.tamamlanmayiBekleyen} iş tamamlandı olarak işaretlenmeyi bekliyor`
      ),
      tamam: false,
    });
  }
  const durumBasligi =
    ozet.yanitBekleyen > 0
      ? 'Yanıtını bekleyen talep var'
      : ozet.tamamlanmayiBekleyen > 0
        ? 'Tamamlanmayı bekleyen iş var'
        : ozet.teklifVerilen > 0
          ? 'Tekliflerin müşteride'
          : sayi.yaklasan > 0
            ? 'Yaklaşan işlerin hazır'
            : 'Bekleyen işin yok';

  return (
    <div className="max-w-3xl">
      <PanelBaslik
        eyebrow="İşlerim"
        altNot="Gelen talepler, verdiğin teklifler ve rezervasyonların iş iş bir arada: yanıt bekleyenler, teklif verdiklerin, anlaşılanlar, tamamlananlar."
        sagAlan={
          <Link href="/takvimim" className={IKINCIL_DUGME}>
            Takvim
          </Link>
        }
      >
        <em className="not-italic font-medium text-brand-accent">İşlerin</em> tek
        yerde
      </PanelBaslik>

      {ajansUzerinden && (
        <p className="mb-6 rounded-xl border border-line bg-paper-2 px-4 py-3 text-sm text-ink-72">
          Sana gelen yeni talepler{' '}
          <span className="font-semibold text-ink">{ajansUzerinden}</span>{' '}
          üzerinden yanıtlanıyor; burada kendi sohbetlerin ve önceki işlerin
          görünür.{' '}
          <Link href="/kurulus/uyelik" className="kashe-tap text-brand-ink hover:underline">
            Tercihi değiştir
          </Link>
        </p>
      )}

      {ajansHesabi && (
        <p className="mb-6 rounded-xl border border-line bg-paper-2 px-4 py-3 text-sm text-ink-72">
          Burada pazaryerinden ajansına gelen talepler, sohbetten verdiğin
          teklifler ve rezervasyonlar görünür. Teklif dosyaların (kurumsal
          RFP yanıtları dahil) etkinliklerinle birlikte:{' '}
          <Link href="/etkinliklerim" className="kashe-tap text-brand-ink hover:underline">
            Etkinlikler
          </Link>
        </p>
      )}

      {hicYok ? (
        <div className="bg-card border border-line rounded-xl p-8 sm:p-12 text-center">
          <p className="font-display text-xl text-ink mb-2">Henüz işin yok</p>
          <p className="text-ink-72 text-sm mb-6 max-w-md mx-auto">
            Profilin yayında ve onaylıysa sana uygun talepler buraya düşer.
            Beklerken profilini güçlendirebilir ya da açık ilanlara
            başvurabilirsin.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Link href="/profil/duzenle" className={IKINCIL_DUGME}>
              Profilini düzenle
            </Link>
            <Link href="/ilanlar" className={IKINCIL_DUGME}>
              İlanlara bak
            </Link>
          </div>
        </div>
      ) : (
        <>
          <DurumKarti
            baslik={durumBasligi}
            tamam={ozet.yanitBekleyen === 0 && ozet.tamamlanmayiBekleyen === 0}
            ilerleme={
              ozet.acikTalep > 0 ? (ozet.teklifVerilen / ozet.acikTalep) * 100 : 100
            }
            satirlar={satirlar}
            // Kutu etiketi kisa tutulur: dar ekranda uc kutu yan yana.
            kutular={[
              { etiket: 'Bekleyen', deger: sayi.bekleyen },
              { etiket: 'Teklif', deger: sayi.teklif },
              { etiket: 'Onaylı', deger: sayi.yaklasan },
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
              temelYol="/islerim"
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
              href="/teklif-talepleri"
              className="kashe-tap text-brand-ink hover:underline"
            >
              teklif talepleri
            </Link>
            {' · '}
            <Link href="/tekliflerim" className="kashe-tap text-brand-ink hover:underline">
              verdiğim teklifler
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
