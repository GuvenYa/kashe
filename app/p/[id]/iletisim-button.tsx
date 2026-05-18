'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { startConversation } from '@/app/mesajlar/actions';
import {
  EVENT_TYPES,
  BUDGET_RANGES,
  type EventTypeKey,
  type BudgetRangeKey,
} from '@/app/mesajlar/data';

type Props = {
  professionalId: string;
  professionalName: string;
  isLoggedIn: boolean;
  currentUserIsProfessional: boolean;
  isOwnProfile: boolean;
};

export function IletisimButton({
  professionalId,
  professionalName,
  isLoggedIn,
  currentUserIsProfessional,
  isOwnProfile,
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [message, setMessage] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState<EventTypeKey | ''>('');
  const [location, setLocation] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [budgetRange, setBudgetRange] = useState<BudgetRangeKey | ''>('');

  // Body scroll lock
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [modalOpen]);

  // ESC ile kapat
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  // Bugünün tarihi — date input'un min değeri için
  const todayStr = new Date().toISOString().split('T')[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const guestCountNum = guestCount.trim() ? parseInt(guestCount, 10) : null;
    if (guestCountNum !== null && (isNaN(guestCountNum) || guestCountNum < 0)) {
      setError('Kişi sayısı geçersiz.');
      return;
    }

    startTransition(async () => {
      const result = await startConversation({
        professional_id: professionalId,
        message: message.trim(),
        event_date: eventDate || null,
        event_type: eventType || null,
        location: location.trim() || null,
        guest_count: guestCountNum,
        budget_range: budgetRange || null,
      });

      if (result.success && result.conversationId) {
        router.push(`/mesajlar/${result.conversationId}`);
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  // Kendi profili
  if (isOwnProfile) {
    return (
      <div className="bg-paper border border-line rounded-lg p-6">
        <p className="text-ink-72 text-sm">
          Bu senin profilin. Müşteriler buradan sana mesaj gönderebilir.
        </p>
      </div>
    );
  }

  // Profesyonelin başka profesyonele mesajı
  if (currentUserIsProfessional) {
    return (
      <div className="bg-paper border border-line rounded-lg p-6">
        <p className="text-ink-72 text-sm">
          Profesyonel hesabıyla başka profesyonellere mesaj gönderemezsin.
        </p>
      </div>
    );
  }

  // Giriş yapmamış
  if (!isLoggedIn) {
    return (
      <div className="bg-terracotta/8 border border-terracotta/20 rounded-lg p-6">
        <h2 className="font-display text-xl text-ink mb-2">İletişime geç</h2>
        <p className="text-ink-72 text-sm mb-4">
          Mesaj göndermek için Kashe&apos;ye üye olman veya giriş yapman gerekiyor.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href={`/giris?redirect=/p/${professionalId}`}
            className="px-5 py-2.5 border border-ink text-ink rounded-lg font-display font-medium hover:bg-ink hover:text-paper transition-colors"
          >
            Giriş yap
          </Link>
          <Link
            href={`/uye-ol?redirect=/p/${professionalId}`}
            className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
          >
            Üye ol
          </Link>
        </div>
      </div>
    );
  }

  // Login + müşteri → İletişim butonu
  return (
    <>
      <div className="bg-terracotta/8 border border-terracotta/20 rounded-lg p-6 md:p-8">
        <h2 className="font-display text-xl text-ink mb-2">Talep gönder</h2>
        <p className="text-ink-72 text-sm mb-4">
          Etkinlik detaylarını paylaş, profesyonel sana daha hızlı ve doğru yanıt versin.
        </p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
        >
          Talep gönder
        </button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" aria-hidden="true" />

          <div
            className="relative bg-paper rounded-lg shadow-xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-display text-xl text-ink">
                <em className="text-terracotta not-italic italic font-medium">
                  {professionalName}
                </em>
                &apos;a talep gönder
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-ink-72 hover:text-ink p-2 -mr-2 transition-colors"
                aria-label="Kapat"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* SECTION: Etkinlik detayları */}
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-3">
                  Etkinlik detayları
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="event-type" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                      Etkinlik türü
                    </label>
                    <select
                      id="event-type"
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as EventTypeKey | '')}
                      className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                    >
                      <option value="">Seç...</option>
                      {EVENT_TYPES.map((et) => (
                        <option key={et.key} value={et.key}>
                          {et.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="event-date" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                      Etkinlik tarihi
                    </label>
                    <input
                      id="event-date"
                      type="date"
                      min={todayStr}
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="location" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                      Lokasyon
                    </label>
                    <input
                      id="location"
                      type="text"
                      maxLength={200}
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                      placeholder="Beşiktaş, İstanbul"
                    />
                  </div>
                  <div>
                    <label htmlFor="guest-count" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                      Kişi sayısı (yaklaşık)
                    </label>
                    <input
                      id="guest-count"
                      type="number"
                      min={0}
                      max={100000}
                      value={guestCount}
                      onChange={(e) => setGuestCount(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                      placeholder="örn. 80"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="budget-range" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                    Bütçe aralığı
                  </label>
                  <select
                    id="budget-range"
                    value={budgetRange}
                    onChange={(e) => setBudgetRange(e.target.value as BudgetRangeKey | '')}
                    className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                  >
                    <option value="">Seç...</option>
                    {BUDGET_RANGES.map((br) => (
                      <option key={br.key} value={br.key}>
                        {br.label}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-ink-72 mt-3">
                  Tüm alanlar opsiyonel — sadece bildiklerini doldur.
                </p>
              </div>

              {/* SECTION: Mesaj */}
              <div className="pt-4 border-t border-line">
                <label htmlFor="message" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Mesajın <span className="text-terracotta">*</span>
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none"
                  placeholder="Merhaba, etkinliğim için sizden bilgi almak istiyorum. Düşündüğüm konseptten kısaca bahsetmem gerekirse..."
                />
                <p className="text-xs text-ink-72 mt-1.5">
                  {message.length}/2000 karakter
                </p>
              </div>

              {error && (
                <div className="px-4 py-3 bg-terracotta/10 border border-terracotta/30 rounded-lg text-sm text-terracotta">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                  className="px-5 py-2.5 text-ink-72 hover:text-ink font-display font-medium transition-colors disabled:opacity-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !message.trim()}
                  className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isPending ? 'Gönderiliyor...' : 'Talebi gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}