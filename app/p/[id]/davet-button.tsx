'use client';

import { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  getMyListingsForInvite,
  inviteProfessionalToListing,
} from '@/app/ilanlar/invitations-actions';
import { type OnBehalfBusiness } from '@/app/components/on-behalf-selector';

type Props = {
  professionalId: string;
  professionalName: string;
  isLoggedIn: boolean;
  currentUserIsProfessional: boolean;
  isOwnProfile: boolean;
  /** manager+ kurum üyeliği — doluysa profil rolü professional olsa da davet açık
   *  (davet modalı kendi + kurum ilanlarını gösterir, dilim 3b). */
  writableBusinesses?: OnBehalfBusiness[];
};

type ListingOption = {
  id: string;
  title: string;
  alreadyInvited: boolean;
  alreadyApplied: boolean;
};

export function DavetButton({
  professionalId,
  professionalName,
  isLoggedIn,
  currentUserIsProfessional,
  isOwnProfile,
  writableBusinesses = [],
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [listings, setListings] = useState<ListingOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [message, setMessage] = useState('');

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

  async function openModal() {
    setModalOpen(true);
    setError(null);
    setSuccess(null);
    setLoading(true);
    const result = await getMyListingsForInvite(professionalId);
    setLoading(false);
    if (result.success && result.listings) {
      setListings(result.listings);
      // İlk uygun ilanı otomatik seç
      const firstAvailable = result.listings.find(
        (l) => !l.alreadyInvited && !l.alreadyApplied
      );
      if (firstAvailable) setSelectedId(firstAvailable.id);
    } else {
      setError(result.error || 'İlanların yüklenemedi.');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedId) {
      setError('Bir ilan seç.');
      return;
    }

    startTransition(async () => {
      const result = await inviteProfessionalToListing({
        listingId: selectedId,
        professionalId,
        message: message.trim() || undefined,
      });
      if (result.success) {
        setSuccess('Davet gönderildi! Profesyonel yanıtladığında haberin olacak.');
        // Listeyi güncelle: bu ilan artık "davetli"
        setListings((prev) =>
          prev.map((l) =>
            l.id === selectedId ? { ...l, alreadyInvited: true } : l
          )
        );
        setSelectedId('');
        setMessage('');
        router.refresh();
      } else {
        setError(result.error || 'Davet gönderilemedi.');
      }
    });
  }

  // Görünürlük: kendi profili değil + (müşteri/kurumsal VEYA manager+ kurum üyesi).
  // Profesyonel-üye kurum ilanına davet edebilir (dilim 3b) → writableBusinesses doluysa açık.
  if (
    isOwnProfile ||
    (currentUserIsProfessional && writableBusinesses.length === 0)
  )
    return null;

  // Giriş yapmamışsa: tıklayınca üye ol'a yönlendir
  function handleClick() {
    if (!isLoggedIn) {
      router.push(`/uye-ol?redirect=/p/${professionalId}`);
      return;
    }
    openModal();
  }

  const selectableListings = listings.filter(
    (l) => !l.alreadyInvited && !l.alreadyApplied
  );

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex-1 px-5 py-3 bg-transparent border border-ink text-ink rounded-lg font-display font-semibold text-sm hover:bg-ink hover:text-paper transition-all text-center"
      >
        İlanıma Davet Et
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
                {' '}ilanına davet et
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

            <div className="p-6 space-y-5">
              {loading ? (
                <p className="text-sm text-ink-72 py-8 text-center">İlanların yükleniyor...</p>
              ) : listings.length === 0 ? (
                <div className="py-6 text-center space-y-3">
                  <p className="text-ink-72 text-sm">
                    Yayında açık ilanın yok. Önce bir ilan açman gerekiyor.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/ilanlar/yeni')}
                    className="inline-block px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
                  >
                    Yeni ilan aç
                  </button>
                </div>
              ) : success ? (
                <div className="py-4 space-y-4">
                  <div className="px-4 py-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-700">
                    {success}
                  </div>
                  {selectableListings.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSuccess(null)}
                      className="text-sm text-terracotta hover:text-ink font-medium transition-colors"
                    >
                      Başka bir ilana da davet et →
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <p className="text-sm text-ink-72">
                    Bu profesyoneli yayındaki ilanlarından birine davet et. Kabul ederse ilanına başvurmuş olur.
                  </p>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                      İlan seç <span className="text-danger">*</span>
                    </label>
                    <div className="space-y-2">
                      {listings.map((l) => {
                        const disabled = l.alreadyInvited || l.alreadyApplied;
                        const note = l.alreadyApplied
                          ? 'Zaten başvurmuş'
                          : l.alreadyInvited
                          ? 'Davet gönderildi'
                          : null;
                        return (
                          <label
                            key={l.id}
                            className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                              disabled
                                ? 'border-line bg-paper/50 opacity-60 cursor-not-allowed'
                                : selectedId === l.id
                                ? 'border-terracotta bg-terracotta/5 cursor-pointer'
                                : 'border-line hover:border-terracotta/50 cursor-pointer'
                            }`}
                          >
                            <input
                              type="radio"
                              name="listing"
                              value={l.id}
                              checked={selectedId === l.id}
                              disabled={disabled}
                              onChange={() => setSelectedId(l.id)}
                              className="accent-terracotta"
                            />
                            <span className="flex-1 text-sm text-ink">{l.title}</span>
                            {note && (
                              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72">
                                {note}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="invite-message" className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                      Davet mesajı (opsiyonel)
                    </label>
                    <textarea
                      id="invite-message"
                      rows={3}
                      maxLength={1000}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Profilini beğendim, ilanım için seni davet etmek istiyorum..."
                      className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition resize-none"
                    />
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
                      disabled={isPending || !selectedId}
                      className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isPending ? 'Gönderiliyor...' : 'Daveti gönder'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}