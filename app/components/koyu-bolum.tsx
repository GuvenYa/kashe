import type { ReactNode } from 'react';
import { KasheMark } from '@/app/components/ui/kashe-mark';

/**
 * KOYU BOLUM (D4, desen 8) — lacivert kapanis yuzeyi.
 *
 * 'use client' YOKTUR: sunucu sayfalari dogrudan render eder.
 *
 * NEDEN DUZ LACIVERT, GRADYAN ZEMIN DEGIL: eski `FooterCTA` tum zemini
 * `--gradient-brand` ile boyuyordu ve gradyanin HICBIR noktasinda beyaz govde
 * metni 4,5:1 kontrasti gecmiyordu (kod icindeki T7 notu). Duz `ink` zeminde
 * `paper-72` govde metni rahatca gecer; gradyan kendi isine — marka isareti ve
 * ust kenardaki 3 px serit — doner.
 *
 * OLCULU KULLANIM: sayfa basina EN FAZLA BIR tane. Ana sayfada `KasheAiSection`
 * ve `AjanslarSection` zaten koyu; bu yuzden orada yalniz kapanis CTA'si bu
 * bilesene gecti (iki koyu yuzey ust uste gelmesin).
 *
 * ISIMA: iki radyal katman, `--glow-accent` (sag alt pembe) ve `--glow-sky`
 * (sol ust cyan) degiskenlerinden. Degerler `globals.css`'te; burada hex YOK.
 * DESIGN.md "cok sayida gradyan / glow" yasaginin SINIRLI istisnasi: iki
 * katman, tek bolumde, sayfa basina bir kez.
 */

/** Koyu zeminde birincil dugme — beyaz zemin, `ink` metin (19,3:1). */
export const KOYU_BTN_BIRINCIL =
  'kashe-tap inline-flex items-center gap-2 bg-white text-ink font-display font-semibold rounded-lg px-8 py-3.5 text-base hover:bg-paper transition-colors';

/** Ikincil dugme — kenarlikli, saydam zemin. */
export const KOYU_BTN_IKINCIL =
  'kashe-tap inline-flex items-center gap-2 border border-paper-14 text-paper font-display font-semibold rounded-lg px-8 py-3.5 text-base hover:border-brand-accent transition-colors';

export function KoyuBolum({
  eyebrow,
  baslik,
  basliketiketi = 'h2',
  altMetin,
  isaret = false,
  baglanti,
  yogunluk = 'tam',
  children,
}: {
  /** Mono eyebrow, pembe; cizgi YOK (eski CTA'daki iki yan cizgi kalkti). */
  eyebrow: string;
  /** Vurgu `<em className="not-italic text-brand-accent">` ile verilir. */
  baslik: ReactNode;
  /** Sayfanin tek h1'i bu blokta ise 'h1' (ornek `/premium`). */
  basliketiketi?: 'h1' | 'h2';
  altMetin?: ReactNode;
  /** Ustte beyaz Kashe isareti (56 px). */
  isaret?: boolean;
  /** Altta mono kucuk baglanti (videodaki "KASHE.NET" gibi). */
  baglanti?: { href: string; etiket: string };
  /** `tam`: kenardan kenara bolum · `kart`: `max-w-7xl` icinde yuvarlak kart. */
  yogunluk?: 'tam' | 'kart';
  /** CTA dugmeleri ve varsa dip notu. */
  children?: ReactNode;
}) {
  const Baslik = basliketiketi;
  const kart = yogunluk === 'kart';

  // Kosullu ifade sinifin TAMAMININ yerine gecer: `${` bitisik yazilmaz
  // (CLAUDE.md — bitisik yazim sinifi uretilen CSS'ten sessizce dusuruyor).
  const dis = kart ? 'bg-paper py-14 md:py-20' : '';
  const orta = kart ? 'max-w-7xl mx-auto px-6 md:px-9' : '';
  const govde = kart
    ? 'relative overflow-hidden rounded-3xl bg-ink text-paper text-center px-8 md:px-16 lg:px-24 py-16 md:py-20'
    : 'relative overflow-hidden bg-ink text-paper text-center px-6 md:px-12 py-20 md:py-28';

  const icerik = (
    <div className={govde}>
      {/* Ust kenarda ince marka seridi — gradyanin bu yuzeydeki TEK yeri. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-brand"
      />

      {/* Isima katmanlari: dekoratif, tiklamayi engellemez. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'var(--glow-accent)' }}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'var(--glow-sky)' }}
      />

      <div className="relative max-w-3xl mx-auto">
        {isaret && (
          <KasheMark
            variant="dark"
            title=""
            className="w-14 h-14 mx-auto mb-7"
          />
        )}

        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-accent mb-6">
          {eyebrow}
        </p>

        <Baslik className="font-display font-semibold text-4xl md:text-5xl lg:text-6xl leading-[1.02] tracking-[-0.035em] text-paper">
          {baslik}
        </Baslik>

        {altMetin && (
          <p className="font-body text-lg md:text-xl text-paper-72 leading-[1.55] mt-6">
            {altMetin}
          </p>
        )}

        {children && <div className="mt-10">{children}</div>}

        {baglanti && (
          <a
            href={baglanti.href}
            className="kashe-tap inline-block mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-sky hover:text-paper transition-colors"
          >
            {baglanti.etiket}
          </a>
        )}
      </div>
    </div>
  );

  // `tam` yogunlukta ara sarmalayici yok: bolum kenardan kenara akar.
  if (!kart) return <section className={dis}>{icerik}</section>;

  return (
    <section className={dis}>
      <div className={orta}>{icerik}</div>
    </section>
  );
}
