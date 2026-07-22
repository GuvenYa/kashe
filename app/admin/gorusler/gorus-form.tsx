'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createTestimonial,
  updateTestimonial,
  type TestimonialFormData,
} from './actions';
import type { Testimonial } from '@/app/lib/testimonials';

type Props = {
  testimonial?: Testimonial | null; // edit modu
};

export function GorusForm({ testimonial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!testimonial;

  const [authorName, setAuthorName] = useState(testimonial?.author_name ?? '');
  const [authorRole, setAuthorRole] = useState(testimonial?.author_role ?? '');
  const [body, setBody] = useState(testimonial?.body ?? '');
  const [rating, setRating] = useState<number>(testimonial?.rating ?? 5);
  const [sortOrder, setSortOrder] = useState<string>(
    String(testimonial?.sort_order ?? 0)
  );
  const [sourceNote, setSourceNote] = useState(testimonial?.source_note ?? '');
  const [isPublished, setIsPublished] = useState<boolean>(
    testimonial?.is_published ?? false
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedSort = parseInt(sortOrder, 10);
    const data: TestimonialFormData = {
      author_name: authorName.trim(),
      author_role: authorRole.trim() || null,
      body: body.trim(),
      rating,
      sort_order: Number.isNaN(parsedSort) ? 0 : parsedSort,
      source_note: sourceNote.trim() || null,
      is_published: isPublished,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateTestimonial(testimonial!.id, data)
        : await createTestimonial(data);

      if (result.success) {
        router.push('/admin/gorusler');
        router.refresh();
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  const inputClass =
    'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';
  const labelClass =
    'block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Görünen ad */}
      <div>
        <label htmlFor="g-name" className={labelClass}>
          Görünen ad <span className="text-danger">*</span>
        </label>
        <input
          id="g-name"
          type="text"
          required
          maxLength={120}
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className={inputClass}
          placeholder="Örn: Selin A."
        />
      </div>

      {/* Rol / etiket */}
      <div>
        <label htmlFor="g-role" className={labelClass}>
          Rol / etiket
        </label>
        <input
          id="g-role"
          type="text"
          maxLength={120}
          value={authorRole}
          onChange={(e) => setAuthorRole(e.target.value)}
          className={inputClass}
          placeholder="Örn: Müşteri · İstanbul  ·  DJ · Ankara"
        />
        <p className="text-xs text-ink-72 mt-1.5">
          Kartta adın altında görünür. Boş bırakabilirsin.
        </p>
      </div>

      {/* Görüş metni */}
      <div>
        <label htmlFor="g-body" className={labelClass}>
          Görüş metni <span className="text-danger">*</span>
        </label>
        <textarea
          id="g-body"
          rows={5}
          required
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={`${inputClass} resize-y`}
          placeholder="Kullanıcının Kashe deneyimini anlatan kısa alıntı."
        />
        <p className="text-xs text-ink-72 mt-1.5">{body.length}/2000</p>
      </div>

      {/* Puan + Sıra — yan yana */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className={labelClass}>Puan</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} yıldız`}
                className={`w-10 h-10 rounded-lg border text-lg leading-none transition-colors ${
                  n <= rating
                    ? 'bg-brand-ink/10 border-brand-ink text-brand-accent'
                    : 'bg-card border-line text-ink-50/40 hover:border-ink-72'
                }`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-72 mt-1.5">Seçili: {rating}/5</p>
        </div>

        <div>
          <label htmlFor="g-sort" className={labelClass}>
            Sıra (sort_order)
          </label>
          <input
            id="g-sort"
            type="number"
            step={1}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className={inputClass}
            placeholder="0"
          />
          <p className="text-xs text-ink-72 mt-1.5">
            Küçük önce gelir. Ana sayfada ilk 3 yayındaki gösterilir.
          </p>
        </div>
      </div>

      {/* İç not */}
      <div>
        <label htmlFor="g-note" className={labelClass}>
          İç not (kamuya kapalı)
        </label>
        <textarea
          id="g-note"
          rows={2}
          maxLength={1000}
          value={sourceNote}
          onChange={(e) => setSourceNote(e.target.value)}
          className={`${inputClass} resize-none`}
          placeholder="Nereden geldi, izin durumu vb. Yalnız admin görür."
        />
      </div>

      {/* Durum */}
      <div>
        <label className={labelClass}>Durum</label>
        <div className="flex gap-3">
          {[
            { key: false, label: 'Taslak' },
            { key: true, label: 'Yayında' },
          ].map((opt) => (
            <button
              key={String(opt.key)}
              type="button"
              onClick={() => setIsPublished(opt.key)}
              className={`px-4 py-2 rounded-lg text-sm font-display font-medium border transition-colors ${
                isPublished === opt.key
                  ? 'bg-brand-ink text-paper border-brand-ink'
                  : 'bg-card text-ink-72 border-line hover:border-ink-72'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-72 mt-1.5">
          Taslak yalnızca adminlere görünür. Yayında olan ana sayfada
          gösterilmeye hazır olur.
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 bg-danger-08 border border-danger/30 rounded-lg text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-line">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-brand-ink)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending
            ? 'Kaydediliyor...'
            : isEdit
              ? 'Değişiklikleri kaydet'
              : 'Görüşü oluştur'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/gorusler')}
          disabled={isPending}
          className="px-5 py-2.5 text-ink-72 hover:text-ink font-display font-medium transition-colors disabled:opacity-50"
        >
          İptal
        </button>
      </div>
    </form>
  );
}
