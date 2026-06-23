import Link from 'next/link';
import { Sparkles, Calendar, Users } from 'lucide-react';

export function KasheAiSection() {
  return (
    <section className="bg-paper px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-7xl mx-auto">
        <div className="bg-card border border-line rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="relative">
            <div className="inline-flex items-center gap-2.5 mb-6">
              <Sparkles size={16} className="text-terracotta" />
              <span className="font-body font-semibold text-[11px] uppercase tracking-[0.2em] text-terracotta">
                Kashe AI
              </span>
            </div>

            <h2 className="font-display font-semibold text-3xl md:text-4xl lg:text-5xl text-ink leading-[1.1] tracking-[-0.03em] max-w-2xl mb-4">
              Ne aradığını bilmiyor musun?{' '}
              <em className="text-terracotta not-italic italic">
                Yapay zekâ
              </em>{' '}
              sana yol göstersin.
            </h2>
            <p className="font-body text-base text-ink-72 leading-[1.6] max-w-xl mb-8">
              Etkinliğini anlat, hangi profesyonellere ihtiyacın olduğunu öğren.
              Ya da nasıl biri aradığını söyle, sana en uygun profilleri bulalım.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
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