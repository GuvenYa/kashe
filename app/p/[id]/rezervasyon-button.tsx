'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startConversation } from '@/app/mesajlar/actions';

type Props = {
  professionalId: string;
  professionalName: string;
  isLoggedIn: boolean;
  currentUserIsProfessional: boolean;
  isOwnProfile: boolean;
};

export function RezervasyonButton({
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

  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

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

  // Anonim akış: kayıt/giriş sonrası profile dönünce bekleyen rezervasyonu gönder
  useEffect(() => {
    if (!isLoggedIn || currentUserIsProfessional || isOwnProfile) return;

    const key = `kashe_pending_booking_${professionalId}`;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(key);
    } catch {
      return;
    }
    if (!stored) return;

    let payload: Parameters<typeof startConversation>[0] | null = null;
    try {
      payload = JSON.parse(stored);
    } catch {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* yoksay */
      }
      return;
    }

    if (!payload || payload.professional_id !== professionalId) return;

    try {
      sessionStorage.removeItem(key);
    } catch {
      /* yoksay */
    }

    startTransition(async () => {
      const result = await startConversation(payload!);
      if (result.success && result.conversationId) {
        router.push(`/mesajlar/${result.conversationId}`);
      } else {
        setEventDate(payload!.event_date || '');
        setLocation(payload!.location || '');
        setMessage(payload!.message || '');
        setError(result.error || 'Rezervasyon talebin otomatik gönderilemedi. Lütfen tekrar dene.');
        setModalOpen(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, professionalId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!eventDate) {
      setError('Rezervasyon için tarih zorunludur.');
      return;
    }
    if (!message.trim()) {
      setError('Kısa bir mesaj ekle.');
      return;
    }

    const payload = {
      professional_id: professionalId,
      message: message.trim(),
      event_date: eventDate,
      event_type: null,
      location: location.trim() || null,
      guest_count: null,
      budget_range: null,
      brief_data: null,
      request_type: 'booking_request' as const,
    };

    if (!isLoggedIn) {
      try {
        sessionStorage.setItem(
          `kashe_pending_booking_${professionalId}`,
          JSON.stringify(payload)
        );
      } catch {
        /* graceful degradation */
      }
      router.push(`/uye-ol?redirect=/p/${professionalId}`);
      return;
    }

    startTransition(async () => {
      const result = await startConversation(payload);
      if (result.success && result.conversationId) {
        router.push(`/mesajlar/${result.conversationId}`);
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  // Görünürlük: kendi profili veya profesyonel ise gösterme (kutu seviyesinde de kontrol var)
  if (isOwnProfile || currentUserIsProfessional) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex-1 px-5 py-3 bg-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all text-center"
      >
        Rezervasyon Talebi
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" aria-hidden="true" />
          <div
            className="relative bg-paper rounded-lg shadow-xl max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-display text-xl text-ink">
                <em className="text-terracotta not-italic italic font-medium">
                  {professionalName}
                </em>
                {' '}için rezervasyon talebi
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
              <p className="text-sm text-ink-72">
                Belirli bir tarih için doğrudan rezervasyon talebi gönder. Profesyonel uygunluğunu onaylarsa ilerleyebilirsiniz.
              </p>

              <div>
                <label htmlFor="booking-date" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Tarih <span className="text-terracotta">*</span>
                </label>
                <input
                  id="booking-date"
                  type="date"
                  min={todayStr}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                />
              </div>

              <div>
                <label htmlFor="booking-location" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Yer / Lokasyon
                </label>
                <input
                  id="booking-location"
                  type="text"
                  maxLength={200}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="örn. İstanbul, Beşiktaş"
                  className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                />
              </div>

              <div>
                <label htmlFor="booking-message" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Mesajın <span className="text-terracotta">*</span>
                </label>
                <textarea
                  id="booking-message"
                  required
                  rows={4}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Merhaba, belirttiğim tarih için sizi rezerve etmek istiyorum. Etkinlik hakkında kısaca..."
                  className="w-full px-4 py-3 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none"
                />
                <p className="text-xs text-ink-72 mt-1.5">{message.length}/2000 karakter</p>
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
                  disabled={isPending || !eventDate || !message.trim()}
                  className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isPending ? 'Gönderiliyor...' : 'Rezervasyon talebi gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}