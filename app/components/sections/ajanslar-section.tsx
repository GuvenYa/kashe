import { Button } from "@/app/components/ui/button";
import { OrnekRozeti } from "@/app/components/ui/ornek-rozeti";

/**
 * AJANSLAR — organizasyon firmalari, ajanslar ve menajerler icin bolum.
 *
 * Renk: eyebrow ve kart vurgulari `ink-blue` — DESIGN.md'de bu ton ajans/kurumsal
 * kimligin rengi olarak tanimli. Kurumsal bolumuyle ayni duzen (solda metin, sagda
 * ornek kart), farkli zemin (paper) ve farkli vurgu rengi.
 *
 * FIYAT YAZILMAZ. "Gelistiriliyor" maddeleri bugun calisan ozellik DEGIL; etiketi
 * bu yuzden kartin ustunde duruyor.
 */

type Madde = { baslik: string; metin: string };

// Bugun uretimde olan uc yuzey: /ajans/ekipler + /ajans/havuz + /ajans/teklifler
// (musteri onayi /portal/teklif/[token] baglantisiyla aliniyor).
const BUGUN: Madde[] = [
  {
    baslik: "Ajans profili ve ekip sayfası",
    metin:
      "Ekibinizi davet edin; kabul eden her üyenin profilinde ajansınız görünür.",
  },
  {
    baslik: "Özel yetenek havuzu",
    metin:
      "Kashe hesabı olmayan profesyonellerinizi de kaydedin. Havuz yalnız size görünür, pazaryerine açılmaz.",
  },
  {
    baslik: "Teklif ve müşteri onayı",
    metin:
      "Teklifinizi oluşturun, müşterinize bağlantıyla gönderin, onayı platformda alın. İç maliyetiniz müşteriye görünmez.",
  },
];

const GELISTIRILIYOR: Madde[] = [
  {
    baslik: "Brief'ten otomatik ekip kurgusu",
    metin: "Rol, tarih, bütçe ve müsaitlik kısıtları altında ekip alternatifleri.",
  },
  {
    baslik: "Maliyet ve marj kısıtlı teklif alternatifleri",
    metin: "En uygun, en ekonomik ve hedef marja uygun seçenekler yan yana.",
  },
  {
    baslik: "İnsan onaylı operasyon asistanı",
    metin:
      "Görev, risk ve taslak teklif üretir; bağlayıcı işlemleri siz onaylarsınız.",
  },
];

export function AjanslarSection() {
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

            {/* BUGÜN */}
            <div className="mb-9">
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss bg-moss/10 border border-moss/40 px-2.5 py-1 rounded-full">
                  Erken erişim
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                  Bugün
                </span>
              </div>
              <MaddeListesi maddeler={BUGUN} />
            </div>

            {/* GELİŞTİRİLİYOR */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                  Geliştiriliyor
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                  2027 pilot programı
                </span>
              </div>
              <MaddeListesi maddeler={GELISTIRILIYOR} soluk />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href="mailto:info@kashe.net?subject=Tasarim%20ortagi%20programi">
                <Button variant="primary" size="lg">
                  Tasarım ortağı olun →
                </Button>
              </a>
              <a href="/uye-ol/ajans">
                <Button variant="secondary" size="lg" className="border-ink">
                  Ajans hesabı açın
                </Button>
              </a>
            </div>
          </div>

          {/* ——— SAĞ: örnek teklif kartı ——— */}
          <div className="relative lg:pt-10">
            <div className="bg-card border border-line rounded-2xl p-6 md:p-8 shadow-[0_18px_44px_-24px_rgba(4,13,38,0.25)]">
              <div className="flex items-start justify-between gap-3 mb-6 pb-4 border-b border-line">
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-blue mb-1.5">
                    Event OS
                  </p>
                  <p className="font-display text-base text-ink leading-tight">
                    Teklif · Kurumsal yıl sonu daveti
                  </p>
                </div>
                <OrnekRozeti />
              </div>

              <div className="space-y-4">
                <KartSatiri label="Ekip" value="1 sunucu · 1 DJ · 4 hostes" />
                <KartSatiri label="Kaynak" value="3 özel havuz, 3 pazaryeri" />
                <KartSatiri
                  label="Durum"
                  value="Müşteri onayı bekleniyor"
                  vurgu
                />
              </div>
            </div>

            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50 text-center">
              ↑ Örnek bir ajans teklif kartı
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MaddeListesi({
  maddeler,
  soluk = false,
}: {
  maddeler: Madde[];
  soluk?: boolean;
}) {
  return (
    <ul className="space-y-3.5">
      {maddeler.map((m) => (
        <li key={m.baslik} className="flex gap-3 items-start">
          <span
            className={
              soluk
                ? 'mt-2 w-1.5 h-1.5 rounded-full bg-ink-32 shrink-0'
                : 'mt-2 w-1.5 h-1.5 rounded-full bg-ink-blue shrink-0'
            }
            aria-hidden="true"
          />
          <p
            className={
              soluk
                ? 'text-base leading-[1.5] text-ink-50'
                : 'text-base leading-[1.5] text-ink-72'
            }
          >
            <span className={soluk ? 'font-medium text-ink-72' : 'font-medium text-ink'}>
              {m.baslik}
            </span>{' '}
            — {m.metin}
          </p>
        </li>
      ))}
    </ul>
  );
}

function KartSatiri({
  label,
  value,
  vurgu = false,
}: {
  label: string;
  value: string;
  vurgu?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
        {label}
      </span>
      <span
        className={
          vurgu
            ? 'text-right font-medium text-base text-ink-blue'
            : 'text-right font-medium text-base text-ink'
        }
      >
        {value}
      </span>
    </div>
  );
}
