import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { GorusForm } from '../gorus-form';
import type { Testimonial } from '@/app/lib/testimonials';

export const metadata = { title: 'Görüşü düzenle — Admin' };

export default async function GorusDuzenlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('testimonials')
    .select('*')
    .eq('id', id)
    .single();

  if (!data) notFound();

  const testimonial = data as Testimonial;

  return (
    <div className="px-5 md:px-8 py-6 md:py-8">
      <Link
        href="/admin/gorusler"
        className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 hover:text-brand-ink transition-colors inline-flex items-center gap-1.5 mb-5"
      >
        ← Görüşler
      </Link>
      <h1 className="font-display text-3xl text-ink tracking-tight mb-6">
        Görüşü düzenle
      </h1>
      <GorusForm testimonial={testimonial} />
    </div>
  );
}
