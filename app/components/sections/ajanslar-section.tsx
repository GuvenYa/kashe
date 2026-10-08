import { Button } from "@/app/components/ui/button";
import { OrnekRozeti } from "@/app/components/ui/ornek-rozeti";

/**
 * AJANSLAR — organizasyon firmalari, ajanslar ve menajerler icin bolum.
 *
 * Renk: eyebrow ve metin vurgulari `ink-blue` — DESIGN.md'de bu ton ajans/kurumsal
 * kimligin rengi olarak tanimli. Kurumsal bolumuyle ayni duzen (solda metin, sagda
 * ornek kart), farkli zemin (paper) ve farkli vurgu rengi.
 *
 * LISTE YALNIZ BUGUN CALISANI ANLATIR (9 Ekim 2026 karari): bes madde de uretimde.
 * Henuz olmayan ozellik ana sayfaya yazilmaz — "yakinda" / "gelistiriliyor" etiketi
 * de kullanilmaz; yol haritasi ayri belgelerin isi.
 *
 * FIYAT YAZILMAZ. Ornek kartta para birimi, marka ve kisi adi gecmez.
 */

type Madde = { baslik: string; metin: string };

// Bes maddenin uretimdeki karsiligi: /ajans/ekipler + /profil/ekibim (1),
// /ajans/havuz + internal.organization_talent_rates (2), /ajans/teklifler +
// internal.proposal_internal_items (3), /portal/teklif/[token] +
// booking_from_proposal (4), /ajans/rfp (5).
const YETENEKLER: Madde[] = [
  {
    baslik: "Ekip ve profil",
    metin:
      "Ekibinizi davet edin; kabul eden her üyenin profilinde ajansınız görünür.",
  },
  {
    baslik: "Özel yetenek havuzu",
    metin:
      "Kashe hesabı olmayan profesyonellerinizi ve iç ücretlerini kaydedin. Havuz yalnız size görünür, pazaryerine açılmaz.",
  },
  {
    baslik: "Teklif, iç maliyet ve marj",
    metin:
      "Teklifinizi sürümleyin. İç maliyet ve marjınız yalnız ekibinize görünür; müşteri yalnız teklifi görür.",
  },
  {
    baslik: "Müşteri onayı tek bağlantıyla",
    metin:
      "Müşteriniz teklifi bağlantıdan inceler, onaylar ya da revizyon ister. Onaylanan teklif rezervasyona dönüşür.",
  },
  {
    baslik: "Kurumsal teklif taleplerine yanıt",
    metin:
      "Kurumların açtığı taleplere davetle katılın, yanıtınızı aynı teklif editöründen gönderin.",
  },
];

export function AjanslarSection({
  ajansPaneli = false,
}: {
  /** `proposals.view` yetkili ajans kurulusu olan girisli kullanici. */
  ajansPaneli?: boolean;
}) {
  return (
    <section id="ajanslar" className="bg-paper border-t border-line scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* ——— SOL: metin ——— */}
          <div>
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-blue">
                <span className="w-6 h-px bg-ink-blue inline-block"></span>
                Organizasyon firmaları, ajanslar ve menajerler için
              </span>
            </div>

            <h2 className="font-display font-semibold text-4xl md:text-5xl lg:text-[56px] leading-[1.03] tracking-[-0.03em] text-ink mb-6">
              Ekibinizi, müşterilerinizi ve tekliflerinizi{" "}
              <em className="text-ink-blue not-italic italic">
                tek çalışma alanında
              </em>{" "}
              yönetin.
            </h2>

            <p className="text-lg text-ink-72 leading-[1.55] mb-10 max-w-xl">
              Kashe&apos;de ajanslar rakip değil, müşteridir. Ajans profilinizi
              açın, ekibinizi davet edin; müşteriler hem ekibinizi hem sizi
              keşfetsin. Eksik rolleri pazaryerinden tamamlayın.
            </p>

            <ul className="space-y-3.5 mb-10">
              {YETENEKLER.map((m) => (
                <li key={m.baslik} className="flex gap-3 items-start">
                  <span
                    className="mt-2 w-1.5 h-1.5 rounded-full bg-ink-blue shrink-0"
                    aria-hidden="true"
                  />
                  <p className="text-base leading-[1.5] text-ink-72">
                    <span className="font-medium text-ink">{m.baslik}</span> —{' '}
                    {m.metin}
                  </p>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href={ajansPaneli ? "/ajans/teklifler" : "/uye-ol/ajans"}>
                <Button variant="primary" size="lg">
                  {ajansPaneli
                    ? "Ajans paneline gidin →"
                    : "Ajans hesabı açın →"}
                </Button>
              </a>
              <a href="mailto:info@kashe.net?subject=Ajans%20demo">
                <Button variant="secondary" size="lg" className="border-ink">
                  Demo isteyin
                </Button>
              </a>
            </div>

            {!ajansPaneli && (
              <p className="mt-4 text-sm text-ink-50">
                Ajans hesabınız var mı?{' '}
                <a
                  href="/giris?redirect=/ajans/teklifler"
                  className="underline text-ink"
                >
                  Giriş yapın
                </a>
              </p>
            )}
          </div>

          {/* ——— SAĞ: örnek teklif kartı (koyu; Kashe AI kartiyla ayni imza) ——— */}
          <div className="relative lg:pt-10">
            <div className="relative overflow-hidden bg-ink border border-paper-14 rounded-2xl p-6 md:p-8 shadow-[0_24px_60px_-28px_rgba(4,13,38,0.45)]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[3px] bg-gradient-brand"
              />

              <div className="flex items-start justify-between gap-3 mb-6 pb-4 border-b border-paper-14">
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-sky mb-1.5">
                    Ajans paneli · Teklif
                  </p>
                  <p className="font-display text-base text-paper leading-tight">
                    Teklif · Kurumsal yıl sonu daveti
                  </p>
                </div>
                <OrnekRozeti ton="koyu" />
              </div>

              <div className="space-y-4">
                <KartSatiri label="Ekip" value="1 sunucu · 1 DJ · 4 hostes" />
                <KartSatiri label="Kaynak" value="3 özel havuz · 3 pazaryeri" />
                <KartSatiri label="Sürüm" value="2 · müşteriye gönderildi" />
              </div>

              {/* Durum seridi — bolumun ozu musteri onayi; fiyat satiri YOK */}
              <div className="grid grid-cols-3 gap-2 pt-4 mt-5 border-t border-paper-14">
                <DurumAdimi cubuk="bg-paper-50" etiket="text-paper-50" ad="Taslak" />
                <DurumAdimi cubuk="bg-sky" etiket="text-paper-72" ad="Gönderildi" />
                <DurumAdimi
                  cubuk="bg-brand-accent"
                  etiket="text-brand-accent"
                  ad="Müşteri onayı"
                  etkin
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KartSatiri({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-50">
        {label}
      </span>
      <span className="text-right font-medium text-base text-paper">
        {value}
      </span>
    </div>
  );
}

function DurumAdimi({
  cubuk,
  etiket,
  ad,
  etkin = false,
}: {
  cubuk: string;
  etiket: string;
  ad: string;
  etkin?: boolean;
}) {
  return (
    <div>
      <span
        className={`block h-1 rounded-full ${cubuk}`}
        aria-hidden="true"
      />
      <span
        className={`mt-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] ${etiket}`}
      >
        {ad}
        {etkin && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
      </span>
    </div>
  );
}
