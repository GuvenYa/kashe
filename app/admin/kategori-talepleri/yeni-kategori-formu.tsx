'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addCategory } from '@/app/admin/actions';

// Türkçe başlıktan slug önizleme (action'daki ile aynı mantık)
function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  return input
    .trim()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

type Props = {
  // Talepten oluşturuluyorsa: ön-dolu ad + talep id (onaylama için)
  initialName?: string;
  fromRequestId?: string;
  // Tetikleyici buton etiketi ve stili (talep kartında farklı görünsün)
  triggerLabel?: string;
  triggerVariant?: 'primary' | 'inline';
  // Eklendikten sonra paneli kapat (talep kartında tek seferlik)
  closeOnSuccess?: boolean;
};

export function YeniKategoriFormu({
  initialName = '',
  fromRequestId,
  triggerLabel = 'Yeni kategori ekle',
  triggerVariant = 'primary',
  closeOnSuccess = false,
}: Props = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [nameTr, setNameTr] = useState(initialName);
  const [slugEdited, setSlugEdited] = useState(false);
  const [slug, setSlug] = useState(initialName ? slugifyTr(initialName) : '');
  const [emoji, setEmoji] = useState('');
  const [description, setDescription] = useState('');

  // Başlık değişince slug otomatik türesin (admin elle düzenlemediyse)
  function handleNameChange(value: string) {
    setNameTr(value);
    if (!slugEdited) {
      setSlug(slugifyTr(value));
    }
  }

  function resetForm() {
    setNameTr('');
    setSlug('');
    setSlugEdited(false);
    setEmoji('');
    setDescription('');
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (nameTr.trim().length < 2) {
      setError('Kategori adı en az 2 karakter olmalı.');
      return;
    }

    startTransition(async () => {
      const result = await addCategory({
        name_tr: nameTr,
        slug: slug,
        emoji: emoji || null,
        description: description || null,
        from_request_id: fromRequestId ?? null,
      });
      if (result.success) {
        setSuccess(`"${nameTr.trim()}" kategorisi eklendi.`);
        router.refresh();
        if (closeOnSuccess) {
          // Talep kartında: kısa süre sonra paneli kapat
          setTimeout(() => setOpen(false), 1200);
        } else {
          resetForm();
        }
      } else {
        setError(result.error || 'Eklenemedi.');
      }
    });
  }

  if (!open) {
    if (triggerVariant === 'inline') {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="kashe-tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold border border-line text-ink-72 hover:border-moss hover:text-moss transition"
        >
          <span className="text-sm leading-none">+</span> {triggerLabel}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="kashe-tap inline-flex items-center gap-2 px-4 py-2.5 bg-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-brand-ink)] transition-all"
      >
        <span className="text-base leading-none">+</span> {triggerLabel}
      </button>
    );
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-lg text-ink">
          Yeni kategori ekle
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            resetForm();
            setSuccess(null);
          }}
          className="text-ink-72 hover:text-ink p-1 transition-colors"
          aria-label="Kapat"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Kategori adı <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={nameTr}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Örn: Karikatürist"
              maxLength={80}
              required
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Emoji
            </label>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🎨"
              maxLength={4}
              className="w-20 px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm text-center focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition"
            />
          </div>
        </div>

        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
            Slug <span className="text-ink-72 normal-case tracking-normal">(URL — otomatik üretilir)</span>
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            placeholder="karikaturist"
            maxLength={60}
            className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm font-mono focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition"
          />
          <p className="text-[10px] text-ink-72 mt-1 font-mono">
            /kategori/{slug || '...'} adresinde görünür. Türkçe karakter ve boşluk olmamalı.
          </p>
        </div>

        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
            Açıklama <span className="text-ink-72 normal-case tracking-normal">(opsiyonel)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kategori sayfasında görünecek kısa açıklama."
            rows={2}
            maxLength={500}
            className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition resize-none"
          />
        </div>

        {error && (
          <div className="bg-danger-08 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-moss/10 border border-moss/30 text-moss text-sm rounded-lg px-4 py-3">
            {success}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending || nameTr.trim().length < 2}
            className="kashe-tap inline-flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? 'Ekleniyor...' : 'Kategoriyi ekle'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              resetForm();
              setSuccess(null);
            }}
            disabled={isPending}
            className="px-5 py-2.5 text-ink-72 hover:text-ink font-display font-medium text-sm transition-colors disabled:opacity-50"
          >
            Kapat
          </button>
        </div>
      </form>
    </div>
  );
}