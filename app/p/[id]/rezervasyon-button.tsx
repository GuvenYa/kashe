'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  startConversation,
  sendMessageWithAttachment,
} from '@/app/mesajlar/actions';
import { createClient } from '@/app/lib/supabase-browser';
import {
  MAX_ATTACHMENT_SIZE,
  ATTACHMENT_ACCEPT,
  attachmentKind,
} from '@/app/lib/attachments';
import {
  OnBehalfSelector,
  type OnBehalfBusiness,
} from '@/app/components/on-behalf-selector';

type Props = {
  professionalId: string;
  professionalName: string;
  isLoggedIn: boolean;
  currentUserIsProfessional: boolean;
  isOwnProfile: boolean;
  writableBusinesses?: OnBehalfBusiness[];
  variant?: 'default' | 'outline-emerald';
};

export function RezervasyonButton({
  professionalId,
  professionalName,
  isLoggedIn,
  currentUserIsProfessional,
  isOwnProfile,
  writableBusinesses = [],
  variant = 'default',
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  // Pro-as-buyer: her ziyaretçi kendi adına — customer koltuğu — rezervasyon talebi gönderebilir.
  const canSelfCreate = true;
  const [onBehalfBusinessId, setOnBehalfBusinessId] = useState<string | null>(
    canSelfCreate ? null : writableBusinesses[0]?.business_id ?? null
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  // Saat seçimi — saat (00-23) + dakika (00/15/30/45) ayrı select.
  // State "HH:MM" formatında tutulur; parçalanıp birleştirilir.
  const HOURS = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, '0')
  );
  const MINUTES = ['00', '15', '30', '45'];

  function splitTime(t: string): { h: string; m: string } {
    if (!t) return { h: '', m: '' };
    const [h, m] = t.split(':');
    return { h: h ?? '', m: m ?? '' };
  }

  function setTimePart(
    current: string,
    setter: (v: string) => void,
    part: 'h' | 'm',
    value: string
  ) {
    const { h, m } = splitTime(current);
    const newH = part === 'h' ? value : h;
    const newM = part === 'm' ? value : m;
    // İkisi de boşsa temizle; biri seçildiyse diğerine varsayılan ver
    if (!newH && !newM) {
      setter('');
      return;
    }
    setter(`${newH || '00'}:${newM || '00'}`);
  }

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
    if (!isLoggedIn || isOwnProfile) return;

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
        setStartTime(payload!.start_time || '');
        setEndTime(payload!.end_time || '');
        setLocation(payload!.location || '');
        setMessage(payload!.message || '');
        setError(result.error || 'Rezervasyon talebin otomatik gönderilemedi. Lütfen tekrar dene.');
        setModalOpen(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, professionalId]);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    setError(null);
    if (!attachmentKind(file.type)) {
      setError(
        'Desteklenmeyen dosya tipi. Görsel, PDF veya Word gönderebilirsin.'
      );
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setError("Dosya 20 MB'dan büyük olamaz.");
      return;
    }
    setSelectedFile(file);
  }

  function removeFile() {
    setSelectedFile(null);
  }

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
      start_time: startTime || null,
      end_time: endTime || null,
      on_behalf_business_id: onBehalfBusinessId,
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

      if (!result.success || !result.conversationId) {
        setError(result.error || 'Bir hata oluştu.');
        return;
      }

      const convId = result.conversationId;

      // Dosya seçildiyse: konuşma açıldıktan sonra eki yükle + ayrı mesaj gönder.
      if (selectedFile) {
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const kind = attachmentKind(selectedFile.type);
          if (user && kind) {
            const ext =
              selectedFile.name.split('.').pop()?.toLowerCase() || 'bin';
            const path = `${user.id}/${convId}/${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 8)}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from('message-attachments')
              .upload(path, selectedFile, {
                cacheControl: '3600',
                upsert: false,
              });
            if (!upErr) {
              await sendMessageWithAttachment(
                convId,
                { path, type: kind, name: selectedFile.name },
                ''
              );
            }
          }
        } catch {
          /* ek başarısız — konuşma yine de açıldı */
        }
      }

      router.push(`/mesajlar/${convId}`);
    });
  }

  // Görünürlük: yalnız kendi profilinde gizle (pro-as-buyer: professional ziyaretçi de görür).
  if (isOwnProfile) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={
          variant === 'outline-emerald'
            ? 'w-full py-3 bg-transparent border-[1.5px] border-terracotta text-terracotta rounded-xl font-display font-semibold text-[15px] hover:bg-terracotta/5 transition-colors text-center'
            : 'flex-1 px-5 py-3 bg-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all text-center'
        }
      >
        Rezervasyon Talebi
      </button>

      {modalOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
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

              {/* Kimin adına (manager+ kurum üyesine görünür) */}
              {writableBusinesses.length > 0 && (
                <OnBehalfSelector
                  businesses={writableBusinesses}
                  canSelfCreate={canSelfCreate}
                  value={onBehalfBusinessId}
                  onChange={setOnBehalfBusinessId}
                />
              )}

              <div>
                <label htmlFor="booking-date" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Tarih <span className="text-danger">*</span>
                </label>
                <input
                  id="booking-date"
                  type="date"
                  min={todayStr}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Saat <span className="text-ink-72/60 normal-case tracking-normal">(opsiyonel)</span>
                </label>
                <div className="space-y-2.5">
                  {/* Başlangıç */}
                  <div className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-[11px] font-mono uppercase tracking-[0.12em] text-ink-72">Başlangıç</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={splitTime(startTime).h}
                        onChange={(e) => setTimePart(startTime, setStartTime, 'h', e.target.value)}
                        className="flex-1 px-3 py-3 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
                        aria-label="Başlangıç saati"
                      >
                        <option value="">--</option>
                        {HOURS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <span className="text-ink-72 font-medium">:</span>
                      <select
                        value={splitTime(startTime).m}
                        onChange={(e) => setTimePart(startTime, setStartTime, 'm', e.target.value)}
                        className="flex-1 px-3 py-3 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
                        aria-label="Başlangıç dakikası"
                      >
                        <option value="">--</option>
                        {MINUTES.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* Bitiş */}
                  <div className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-[11px] font-mono uppercase tracking-[0.12em] text-ink-72">Bitiş</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={splitTime(endTime).h}
                        onChange={(e) => setTimePart(endTime, setEndTime, 'h', e.target.value)}
                        className="flex-1 px-3 py-3 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
                        aria-label="Bitiş saati"
                      >
                        <option value="">--</option>
                        {HOURS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <span className="text-ink-72 font-medium">:</span>
                      <select
                        value={splitTime(endTime).m}
                        onChange={(e) => setTimePart(endTime, setEndTime, 'm', e.target.value)}
                        className="flex-1 px-3 py-3 bg-card border border-line rounded-lg text-ink focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
                        aria-label="Bitiş dakikası"
                      >
                        <option value="">--</option>
                        {MINUTES.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
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
                  className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition"
                />
              </div>

              <div>
                <label htmlFor="booking-message" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Mesajın <span className="text-danger">*</span>
                </label>
                <textarea
                  id="booking-message"
                  required
                  rows={4}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Merhaba, belirttiğim tarih için sizi rezerve etmek istiyorum. Etkinlik hakkında kısaca..."
                  className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition resize-none"
                />
                <p className="text-xs text-ink-72 mt-1.5">{message.length}/2000 karakter</p>
              </div>

              {/* Dosya eki (opsiyonel) */}
              <div>
                <p className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                  Dosya ekle{' '}
                  <span className="text-ink-72/60 normal-case tracking-normal">
                    (opsiyonel)
                  </span>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ATTACHMENT_ACCEPT}
                  onChange={handleFileSelected}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex items-center gap-2.5 rounded-lg border border-line bg-card px-3 py-2.5">
                    <span className="shrink-0 w-9 h-9 rounded-lg bg-terracotta/10 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-ink truncate">
                      {selectedFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="shrink-0 text-ink-72 hover:text-terracotta transition-colors p-1"
                      aria-label="Dosyayı kaldır"
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-line rounded-lg text-sm text-ink-72 hover:text-terracotta hover:border-terracotta transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Dosya seç
                  </button>
                )}
                <p className="text-xs text-ink-72 mt-2">
                  Görsel, PDF veya Word · en fazla 20 MB
                </p>
              </div>

              {error && (
                <div className="px-4 py-3 bg-danger-08 border border-danger/30 rounded-lg text-sm text-danger">
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
        </div>,
        document.body
      )}
    </>
  );
}