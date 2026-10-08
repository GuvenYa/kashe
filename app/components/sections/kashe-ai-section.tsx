import Link from 'next/link';
import { Calendar, Users } from 'lucide-react';
import { KasheMark } from '@/app/components/ui/kashe-mark';

/**
 * KASHE AI — koyu lacivert bant (sayfadaki iki koyu yuzeyden biri).
 *
 * Ozne "yapay zeka" degil KASHE: urun konusuyor, teknoloji degil. "Kashe"
 * sozcugu brand-accent ile ayrisir; marka isareti eyebrow'da TEK kez gecer.
 *
 * Ornek diyalog bloklari KURGUSALDIR ve bilerek rakamsizdir: butce, fiyat,
 * marka ya da kisi adi icermez (CLAUDE.md — uydurma veri yok; yapay zeka rakam
 * uretmez). "Eksik: baslangic saati?" cipi modelin uydurmak yerine SORDUGUNU
 * gosterir.
 *
 * Gradyan yalniz kartin ust kenarindaki 3 px cizgi (DESIGN.md renk yasaklari:
 * cok sayida gradyan / glow / glassmorphism yok).
 */

type Cip = { metin: string; ton?: 'sky' };

type AiKart = {
  href: string;
  ikon: 'takvim' | 'kisiler';
  baslik: string;
  aciklama: string;
  girdi: string;
  cipler: Cip[];
  bag: string;
};

const KARTLAR: AiKart[] = [
  {
    href: '/etkinlik-sihirbazi',
    ikon: 'takvim',
    baslik: 'Etkinlik Planlama',
    aciklama: 'Hangi rollere ihtiyacın var, kaç kişilik bir ekip gerekir?',
    girdi: '250 kişilik bayi toplantısı, 14 Mayıs, Ankara',
    cipler: [
      { metin: '1 sunucu' },
      { metin: '4 hostes' },
      { metin: '1 DJ' },
      { metin: 'Teknik ekip' },
      { metin: 'Eksik: başlangıç saati?', ton: 'sky' },
    ],
    bag: 'Sihirbazı aç →',
  },
  {
    href: '/pro-bul',
    ikon: 'kisiler',
    baslik: 'Profesyonel Bulma',
    aciklama: 'Sana en uygun profesyoneli gerekçesiyle önerelim.',
    girdi: 'Düğünde caz repertuvarı olan bir şarkıcı arıyorum, İstanbul',
    cipler: [
      { metin: 'Şarkıcı' },
      { metin: 'İstanbul' },
      { metin: 'Caz repertuvarı' },
      { metin: 'Gerekçeli 5 öneri' },
    ],
    bag: 'Profesyonel bul →',
  },
];

export function KasheAiSection() {
  return (
    <section className="bg-paper px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-ink text-paper p-8 md:p-12 lg:p-14">
          {/* Tek ince marka cizgisi — sayfadaki yegane ek gradyan */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px] bg-gradient-brand"
          />

          <div className="inline-flex items-center gap-2.5 mb-6">
            <KasheMark variant="dark" title="" className="w-5 h-5" />
            <span className="font-body font-semibold text-[11px] uppercase tracking-[0.2em] text-paper-72">
              Kashe AI
            </span>
          </div>

          <h2 className="font-display font-semibold text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.03em] text-paper max-w-2xl mb-4">
            Ne aradığını bilmiyor musun?
            <br className="hidden md:block" />{' '}
            <span className="text-brand-accent">Kashe</span> sana yardım etsin.
          </h2>

          <p className="font-body text-base md:text-lg text-paper-72 leading-[1.6] max-w-xl mb-8">
            Etkinliğini bir iki cümleyle anlat, gerisini Kashe&apos;ye bırak:
            hangi rollere ihtiyacın olduğunu çıkarır, eksik bilgiyi uydurmaz,
            sorar. Kimi aradığını söyle; en uygun profilleri nedeniyle önersin.
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            {KARTLAR.map((k) => (
              <Link
                key={k.href}
                href={k.href}
                className="kashe-tap group block bg-ink-2 border border-paper-14 rounded-2xl p-6 md:p-7 hover:border-brand-accent transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-brand-accent/15 text-brand-accent flex items-center justify-center mb-4">
                  {k.ikon === 'takvim' ? (
                    <Calendar size={20} />
                  ) : (
                    <Users size={20} />
                  )}
                </div>

                <p className="font-display font-semibold text-xl text-paper">
                  {k.baslik}
                </p>
                <p className="text-sm text-paper-72 leading-relaxed mt-1.5">
                  {k.aciklama}
                </p>

                {/* Ornek diyalog — girdi (tirnakli) + cikti cipleri */}
                <div className="mt-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-50 mb-2">
                    Örnek
                  </p>
                  <p className="text-sm text-paper italic border-l-2 border-brand-accent pl-3">
                    &ldquo;{k.girdi}&rdquo;
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {k.cipler.map((c) => (
                      <span
                        key={c.metin}
                        className={
                          c.ton === 'sky'
                            ? 'font-body text-xs text-sky bg-sky/15 rounded-full px-2.5 py-1'
                            : 'font-body text-xs text-paper bg-paper-14 rounded-full px-2.5 py-1'
                        }
                      >
                        {c.metin}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Kartin TAMAMI zaten baglanti; icine ikinci bir baglanti
                    etiketi konmaz. Dugme gorunumu span ile verilir. */}
                <span className="inline-flex w-full sm:w-auto justify-center items-center gap-2 mt-6 rounded-lg bg-paper text-ink font-display font-semibold text-base px-6 py-3 transition-colors group-hover:bg-brand-accent-soft">
                  {k.bag}
                </span>
              </Link>
            ))}
          </div>

          {/* Sinir notu — model rakam uretmez, kritik islem yapmaz kurali
              kullaniciya da yazili soylenir (CLAUDE.md degismez kurallar 3-4). */}
          <p className="mt-8 font-body text-xs text-paper-50 leading-relaxed max-w-xl">
            Kashe AI öneri üretir; fiyat belirlemez, rezervasyon yapmaz. Son
            karar her zaman sende.
          </p>
        </div>
      </div>
    </section>
  );
}
