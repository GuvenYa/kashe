'use client';

import { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { createCategoryRequest } from '@/app/lib/category-request-actions';

type Props = {
  isLoggedIn: boolean;
  /** CTA tasarım varyantı:
   *  - 'inline': küçük link/cümle (anasayfa Categories altında)
   *  - 'block': kart benzeri vurgulu (keşfet sidebar altında)
   */
  variant?: 'inline' | 'block';
  /** Mevcut kategori slug'ları — anlık "zaten var" uyarısı için */
  existingSlugs?: string[];
};

/** Türkçe başlıktan slug üretir (action ile aynı mantık) */
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

const EVENT_OPTIONS = [
  { value: '', label: 'Seçim yapma (opsiyonel)' },
  { value: 'wedding', label: 'Düğün' },
  { value: 'engagement', label: 'Nişan / Kına' },
  { value: 'birthday', label: 'Doğum günü' },
  { value: 'corporate', label: 'Kurumsal etkinlik' },
  { value: 'baby', label: 'Bebek / cinsiyet partisi' },
  { value: 'other', label: 'Diğer' },
];

export function KategoriTalepCta({
  isLoggedIn,
  variant = 'inline',
  existingSlugs = [],
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventContext, setEventContext] = useState('');

  // Portal sadece client tarafında mount olunca çalışır (SSR uyumlu)
  useEffect(() => {
    setMounted(true);
  }, []);

  function handleOpen() {
    if (!isLoggedIn) {
      setModalOpen(true);
      return;
    }
    setSuccess(false);
    setError(null);
    setName('');
    setDescription('');
    setEventContext('');
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isLoggedIn) return;

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Kategori adı çok kısa.');
      return;
    }
    if (trimmed.length > 60) {
      setError('Kategori adı en fazla 60 karakter olabilir.');
      return;
    }

    startTransition(async () => {
      const result = await createCategoryRequest({
        categoryName: trimmed,
        description: description.trim() || null,
        eventContext: eventContext || null,
      });
      if (result.success) {
        setSuccess(true);
        setName('');
        setDescription('');
        setEventContext('');
      } else {
        setError(result.error);
      }
    });
  }

  // Yazılan isim mevcut bir kategoriyle eşleşiyor mu? (anlık uyarı)
  const trimmedName = name.trim();
  const matchedExisting =
    trimmedName.length >= 2 &&
    existingSlugs.includes(slugifyTr(trimmedName));

  // CTA tetik bileşeni — iki varyant
  const trigger =
    variant === 'block' ? (
      <button
        type="button"
        onClick={handleOpen}
        className="kashe-tap w-full bg-card border border-line rounded-2xl p-5 text-left hover:border-terracotta transition-all group"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-1.5">
          Aklında başka bir şey mi var?
        </p>
        <p className="font-display font-semibold text-base text-ink leading-snug mb-1 group-hover:text-terracotta transition-colors">
          Aradığın <em className="text-terracotta">kategori</em> burada yok mu?
        </p>
        <p className="text-xs text-ink-72 leading-relaxed">
          Bize öner — Kashe'ye eklemeyi değerlendirelim.
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta inline-flex items-center gap-1 mt-3 group-hover:translate-x-1 transition-transform">
          Kategori öner →
        </span>
      </button>
    ) : (
      <button
        type="button"
        onClick={handleOpen}
        className="kashe-tap inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-terracotta hover:text-ember transition-colors group"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-terracotta inline-block" />
        Aradığın kategori yok mu? Bize öner
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </button>
    );

  // Modal içeriği — portal ile body'ye render edilir, böylece DOM hiyerarşisi
  // veya overflow:hidden parent'lar nedeniyle kesilmez. z-[100] TopNav (z-50) üzerinde.
  const modalContent = modalOpen ? (
    <div className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-2xl max-w-md w-full p-6 md:p-7 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Başarı durumu */}
        {success ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-moss/10 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M5 13l4 4L19 7" stroke="var(--color-moss)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss mb-2">
              Önerin alındı
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-2 leading-tight">
              Teşekkürler.
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-5">
              Önerini değerlendireceğiz. Yeterli talep birikince yeni
              kategori olarak Kashe'ye ekleyeceğiz.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="kashe-tap px-5 py-2.5 bg-ink text-paper rounded-xl font-display font-semibold text-sm hover:bg-ink/85 transition shadow-[3px_3px_0_rgba(26,18,14,0.12)]"
            >
              Kapat
            </button>
          </div>
        ) : !isLoggedIn ? (
          // Giriş yapmamışsa — kısa CTA modal'da
          <div className="text-center py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-2">
              Kategori önerisi
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-2 leading-tight">
              Önce <em className="text-terracotta">üye ol</em>.
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-5">
              Kategori önerisi göndermek için kısa bir kayıt gerekiyor —
              hangi taleplerin senden geldiğini bilelim.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="kashe-tap flex-1 px-4 py-2.5 border border-line text-ink-72 rounded-xl font-display font-semibold text-sm hover:bg-paper-2 transition"
              >
                Vazgeç
              </button>
              <a
                href="/uye-ol"
                className="kashe-tap flex-1 px-4 py-2.5 bg-terracotta text-paper rounded-xl font-display font-semibold text-sm hover:bg-ember transition text-center shadow-[3px_3px_0_var(--color-terracotta-12)]"
              >
                Üye ol →
              </a>
            </div>
          </div>
        ) : (
          // Asıl form
          <form onSubmit={handleSubmit}>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-2">
              Kategori önerisi
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-2 leading-tight">
              Aradığın <em className="text-terracotta">kategori</em> yok mu?
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-5">
              Önerini gönder — talep yoğunluğuna göre yeni kategori
              ekliyoruz.
            </p>

            {/* Kategori adı */}
            <label className="block mb-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 block mb-1.5">
                Kategori adı <span className="text-danger">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Sihirbaz, Drone operatörü..."
                maxLength={60}
                required
                disabled={isPending}
                className={`w-full px-3 py-2.5 bg-paper border rounded-lg text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:ring-2 transition disabled:opacity-60 ${
                  matchedExisting
                    ? 'border-terracotta focus:border-terracotta focus:ring-terracotta-08'
                    : 'border-line focus:border-terracotta focus:ring-terracotta-08'
                }`}
              />
              {matchedExisting && (
                <p className="text-[11px] text-terracotta mt-1.5 leading-relaxed">
                  Bu kategori zaten mevcut. Keşfet sayfasından filtreleyerek
                  bulabilirsin.
                </p>
              )}
            </label>

            {/* Açıklama */}
            <label className="block mb-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 block mb-1.5">
                Ne aradığını birkaç cümle yazabilirsin
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Hangi etkinlik için, nasıl bir hizmet bekliyorsun..."
                rows={3}
                maxLength={280}
                disabled={isPending}
                className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition resize-none disabled:opacity-60"
              />
              <p className="text-[10px] text-ink-50 mt-1 text-right font-mono">
                {description.length}/280
              </p>
            </label>

            {/* Etkinlik bağlamı */}
            <label className="block mb-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 block mb-1.5">
                Etkinlik bağlamı
              </span>
              <select
                value={eventContext}
                onChange={(e) => setEventContext(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition disabled:opacity-60"
              >
                {EVENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {error && (
              <p className="text-xs text-danger mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isPending}
                className="kashe-tap flex-1 px-4 py-2.5 border border-line text-ink-72 rounded-xl font-display font-semibold text-sm hover:bg-paper-2 transition disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={isPending || name.trim().length < 2 || matchedExisting}
                className="kashe-tap flex-1 px-4 py-2.5 bg-terracotta text-paper rounded-xl font-display font-semibold text-sm hover:bg-ember transition disabled:opacity-60 shadow-[3px_3px_0_var(--color-terracotta-12)]"
              >
                {isPending ? '...' : 'Gönder'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger}
      {mounted && modalContent ? createPortal(modalContent, document.body) : null}
    </>
  );
}
