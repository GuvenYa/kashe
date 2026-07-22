import Link from 'next/link';
import { ReactNode } from 'react';
import { TopNav } from '@/app/components/sections/top-nav';
import { Eyebrow } from '@/app/components/ui/eyebrow';
import {
  LEGAL_OPERATOR,
  LEGAL_LAST_UPDATED,
} from '@/app/lib/legal-meta';

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

/**
 * Yasal sayfa (gizlilik, kullanım koşulları) için paylaşılan kabuk.
 * Tutarlı görünüm + kuruluş aşaması uyarısı + son güncelleme tarihi.
 */
export function LegalPageShell({
  eyebrow,
  title,
  subtitle,
  children,
}: Props) {
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          {/* Geri linki */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-72 hover:text-brand-ink transition-colors mb-6"
          >
            <span>←</span>
            Ana sayfa
          </Link>

          {/* Header */}
          <div className="mb-10 md:mb-12">
            <Eyebrow variant="inline" className="mb-3">
              {eyebrow}
            </Eyebrow>
            <h1 className="font-display font-light text-4xl md:text-5xl text-ink tracking-[-0.03em] leading-[1.05]">
              {title}
            </h1>
            <p className="text-base text-ink-72 mt-3 max-w-xl leading-relaxed">
              {subtitle}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50 mt-4">
              Son güncelleme · {LEGAL_LAST_UPDATED}
            </p>
          </div>

          {/* Kuruluş aşaması uyarısı (lansman öncesi) */}
          {LEGAL_OPERATOR.isPreLaunch && (
            <div className="bg-brand-ink-08 border border-brand-ink/25 rounded-2xl p-5 mb-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink mb-2">
                Önemli uyarı
              </p>
              <p className="text-sm text-ink leading-relaxed">
                Kashe şu an kuruluş aşamasındadır. Tüzel kişilik ve VERBİS
                kaydı işlemleri tamamlandıkça bu metinler güncellenecek; nihai
                hukuki incelemenin ardından son hâli yayınlanacaktır.
                Mevcut metin platformun mevcut işleyişine ilişkin
                taslak bilgilendirmedir.
              </p>
            </div>
          )}

          {/* İçerik */}
          <article className="legal-prose space-y-7 text-ink leading-relaxed">
            {children}
          </article>

          {/* Footer linki */}
          <div className="mt-16 pt-8 border-t border-line text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-50">
              Sorun mu var? <a href="mailto:kasheofficial@gmail.com" className="text-brand-ink hover:underline">kasheofficial@gmail.com</a>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

/**
 * Yasal sayfa içeriğinde kullanılacak başlık/paragraf bileşenleri.
 * Tutarlı tipografi için.
 */
export function LegalSection({
  number,
  title,
  children,
}: {
  number?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display font-medium text-2xl text-ink mb-4 leading-tight">
        {number && (
          <span className="font-mono text-sm text-brand-ink mr-3 align-middle">
            {number}
          </span>
        )}
        {title}
      </h2>
      <div className="space-y-3 text-[15px] text-ink-72 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function LegalSubsection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ml-0 mt-5">
      <h3 className="font-display font-semibold text-base text-ink mb-2">
        {title}
      </h3>
      <div className="space-y-2 text-[15px] text-ink-72 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export function LegalList({
  items,
}: {
  items: (ReactNode | { label: string; description: ReactNode })[];
}) {
  return (
    <ul className="space-y-2 pl-0">
      {items.map((item, i) => {
        if (typeof item === 'object' && item !== null && 'label' in item) {
          return (
            <li key={i} className="flex gap-3 text-[15px] text-ink-72">
              <span className="text-brand-ink shrink-0 mt-1">•</span>
              <div>
                <span className="font-semibold text-ink">{item.label}:</span>{' '}
                {item.description}
              </div>
            </li>
          );
        }
        return (
          <li key={i} className="flex gap-3 text-[15px] text-ink-72">
            <span className="text-brand-ink shrink-0 mt-1">•</span>
            <div>{item}</div>
          </li>
        );
      })}
    </ul>
  );
}
