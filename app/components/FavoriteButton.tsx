'use client';

import { useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { addFavorite, removeFavorite } from '@/app/favoriler/actions';

type FavoriteButtonProps = {
  professionalId: string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
  userRole: string | null;
  variant?: 'card' | 'detail';
};

export default function FavoriteButton({
  professionalId,
  initialFavorited,
  isLoggedIn,
  userRole,
  variant = 'card',
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  function handleClick(e: React.MouseEvent) {
    // Kartın içindeyse parent Link'in tetiklenmesini engelle
    e.preventDefault();
    e.stopPropagation();

    // Giriş yapmamış kullanıcı
    if (!isLoggedIn) {
      showToast('Favorilere eklemek için giriş yap');
      return;
    }

    // Müşteri değilse (profesyonel veya kurumsal kalp basamaz)
    if (userRole !== 'client') {
      showToast('Sadece müşteri hesapları favori ekleyebilir');
      return;
    }

    // Optimistic update — UI hemen değişsin, network sonra
    const newFavorited = !favorited;
    setFavorited(newFavorited);

    startTransition(async () => {
      const result = newFavorited
        ? await addFavorite(professionalId)
        : await removeFavorite(professionalId);

      if (!result.success) {
        // Revert + hata göster
        setFavorited(!newFavorited);
        showToast(result.error ?? 'Bir hata oluştu');
      }
    });
  }

  // Variant-bazlı boyutlar
  const sizes = {
    card: { btn: 36, icon: 18 },
    detail: { btn: 44, icon: 22 },
  };
  const { btn, icon } = sizes[variant];

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={favorited ? 'Favorilerden çıkar' : 'Favorilere ekle'}
        aria-pressed={favorited}
        style={{
          width: `${btn}px`,
          height: `${btn}px`,
          borderRadius: '50%',
          border: '1px solid rgba(26, 18, 14, 0.12)',
          backgroundColor: 'rgba(250, 247, 240, 0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isPending ? 'wait' : 'pointer',
          transition: 'transform 0.15s ease, background-color 0.15s ease',
          opacity: isPending ? 0.6 : 1,
          padding: 0,
        }}
        onMouseEnter={(e) => {
          if (!isPending) e.currentTarget.style.transform = 'scale(1.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <Heart
          size={icon}
          strokeWidth={2}
          fill={favorited ? '#C8442A' : 'none'}
          color={favorited ? '#C8442A' : '#1A120E'}
          style={{
            transition: 'fill 0.2s ease',
          }}
        />
      </button>

      {/* Toast — fixed position, ekranın altında */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1A120E',
            color: '#FAF7F0',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'var(--font-geist), sans-serif',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
            zIndex: 9999,
            animation: 'kasheFadeInUpToast 0.25s ease-out',
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}