import Link from 'next/link';
import { Sparkles, Calendar, Users, ArrowRight } from 'lucide-react';
import { TopNav } from '@/app/components/sections/top-nav';

export const metadata = {
  title: 'Kashe AI — Yapay Zekâ Asistanı',
  description:
    'Kashe AI ile etkinliğin için hangi profesyonellere ihtiyacın olduğunu keşfet, sana en uygun profesyonelleri bul.',
};

const TOOLS = [
  {
    href: '/etkinlik-planla',
    icon: Calendar,
    title: 'Etkinlik Planlama Asistanı',
    desc: 'Etkinliğini anlat, hangi profesyonellere ihtiyacın olduğunu ve tahmini bütçeni öğren.',
  },
  {
    href: '/pro-bul',
    icon: Users,
    title: 'Profesyonel Bulma',
    desc: 'Nasıl bir profesyonel aradığını anlat, sana en uygun profilleri gerekçesiyle önerelim.',
  },
];

export default function KasheAiPage() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-terracotta" />
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
                Kashe AI
              </p>
            </div>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
              Yapay zekâ,{' '}
              <em className="text-terracotta not-italic italic font-medium">
                senin yanında
              </em>
              .
            </h1>
            <p className="text-ink-72 mt-4 leading-relaxed max-w-xl">
              Etkinliğini planlarken ne yapacağını bilemiyorsan ya da doğru
              profesyoneli ararken kayboluyorsan, Kashe AI sana yol göstersin.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="kashe-tap group flex flex-col h-full bg-white border border-line rounded-2xl p-6 hover:border-terracotta transition"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-terracotta/10 flex items-center justify-center">
                      <Icon size={20} className="text-terracotta" />
                    </div>
                    <ArrowRight
                      size={18}
                      className="text-ink-72 group-hover:text-terracotta transition"
                    />
                  </div>
                  <p className="font-display font-semibold text-lg text-ink mb-1.5">
                    {tool.title}
                  </p>
                  <p className="text-sm text-ink-72 leading-relaxed">
                    {tool.desc}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}