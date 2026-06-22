import Link from 'next/link';
import { Sparkles, Calendar, Users } from 'lucide-react';

export function KasheAiSection() {
  return (
    <section className="px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white border border-line rounded-3xl p-8 md:p-12 relative overflow-hidden">
          {/* Dekoratif arka plan parıltısı */}
          <div
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-terracotta/10 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative">
            <div className="inline-flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-terracotta" />
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
                Kashe AI
              </p>
            </div>

            <h2 className="font-display text-3xl md:text-4xl text-ink tracking-tight max-w-2xl">
              Ne aradığını bilmiyor musun?{' '}
              <em className="text-terracotta not-italic italic font-medium">
                Yapay zekâ
              </em>{' '}
              sana yol göstersin.
            </h2>
            <p className="text-ink-72 mt-4 leading-relaxed max-w-xl">
              Etkinliğini anlat, hangi profesyonellere ihtiyacın olduğunu öğren.
              Ya da nasıl biri aradığını söyle, sana en uygun profilleri bulalım.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 mt-8">
              <Link
                href="/etkinlik-planla"
                className="kashe-tap group flex items-start gap-3 bg-paper border border-line rounded-2xl p-5 hover:border-terracotta transition"
              >
                <div className="w-10 h-10 shrink-0 rounded-xl bg-terracotta/10 flex items-center justify-center">
                  <Calendar size={18} className="text-terracotta" />
                </div>
                <div>
                  <p className="font-display font-semibold text-ink mb-1">
                    Etkinlik Planlama
                  </p>
                  <p className="text-sm text-ink-72 leading-relaxed">
                    Hangi hizmetlere ihtiyacın var, tahmini bütçen ne?
                  </p>
                </div>
              </Link>

              <Link
                href="/pro-bul"
                className="kashe-tap group flex items-start gap-3 bg-paper border border-line rounded-2xl p-5 hover:border-terracotta transition"
              >
                <div className="w-10 h-10 shrink-0 rounded-xl bg-terracotta/10 flex items-center justify-center">
                  <Users size={18} className="text-terracotta" />
                </div>
                <div>
                  <p className="font-display font-semibold text-ink mb-1">
                    Profesyonel Bulma
                  </p>
                  <p className="text-sm text-ink-72 leading-relaxed">
                    Sana en uygun profesyoneli gerekçesiyle önerelim.
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}