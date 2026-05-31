'use client';

import { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import {
  banUser,
  unbanUser,
  makeAdmin,
  removeAdmin,
} from '@/app/admin/actions';

type UserData = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  role: string;
  is_admin: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
};

type Props = {
  user: UserData;
  isCurrentUser: boolean;
};

type ModalMode = null | 'ban' | 'unban' | 'make-admin' | 'remove-admin';

export function KullaniciAksiyonlar({ user, isCurrentUser }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [banReason, setBanReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Menu dışı tıklama
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-aksiyon-menu]')) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const displayName =
    (user.role === 'business' || user.role === 'agency') && user.company_name
      ? user.company_name
      : user.full_name || user.email || 'Bu kullanıcı';

  function openModal(mode: ModalMode) {
    setMenuOpen(false);
    setError(null);
    setBanReason('');
    setModalMode(mode);
  }

  function closeModal() {
    if (isPending) return;
    setModalMode(null);
    setError(null);
    setBanReason('');
  }

  async function handleConfirm() {
    setError(null);

    startTransition(async () => {
      let result: { success: true } | { success: false; error: string };

      if (modalMode === 'ban') {
        result = await banUser(user.id, banReason);
      } else if (modalMode === 'unban') {
        result = await unbanUser(user.id);
      } else if (modalMode === 'make-admin') {
        result = await makeAdmin(user.id);
      } else if (modalMode === 'remove-admin') {
        result = await removeAdmin(user.id);
      } else {
        return;
      }

      if (result.success) {
        closeModal();
      } else {
        setError(result.error);
      }
    });
  }

  // Kendi hesabımıza aksiyon kapalı
  if (isCurrentUser) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
        Sen
      </span>
    );
  }

  // Modal içeriği
  const modalContent = modalMode ? (
    <div className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-2xl max-w-md w-full p-6 md:p-7 shadow-xl">
        {modalMode === 'ban' && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-2">
              Hesabı askıya al
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-2 leading-tight">
              <em className="text-terracotta">{displayName}</em>&apos;ı askıya al?
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-4">
              Kullanıcı login olamayacak ve &ldquo;Hesabın askıya alındı&rdquo;
              sayfasını görecek. İstediğin zaman geri açabilirsin.
            </p>

            <label className="block mb-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 block mb-1.5">
                Sebep <span className="text-terracotta">*</span>
              </span>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Spam, sahte profil, taciz vb. — kullanıcı görür"
                rows={3}
                maxLength={500}
                disabled={isPending}
                className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none disabled:opacity-60"
              />
              <p className="text-[10px] text-ink-50 mt-1 text-right font-mono">
                {banReason.length}/500
              </p>
            </label>
          </>
        )}

        {modalMode === 'unban' && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss mb-2">
              Askıyı kaldır
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-2 leading-tight">
              <em className="text-moss">{displayName}</em>&apos;ın askısı
              kaldırılsın mı?
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-5">
              Kullanıcı tekrar login olabilir ve platformu kullanabilir.
            </p>
            {user.suspension_reason && (
              <div className="bg-paper-2/50 border border-line rounded-lg p-3 mb-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-50 mb-1">
                  Önceki askı sebebi
                </p>
                <p className="text-[13px] text-ink-72 leading-relaxed">
                  {user.suspension_reason}
                </p>
              </div>
            )}
          </>
        )}

        {modalMode === 'make-admin' && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta mb-2">
              Admin yetkisi ver
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-2 leading-tight">
              <em className="text-terracotta">{displayName}</em>&apos;a admin
              yetkisi verilsin mi?
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-5">
              Bu kullanıcı admin paneline erişebilir, başka kullanıcıları
              banlayabilir/yönetebilir. Sadece güvendiğin kişilere ver.
            </p>
          </>
        )}

        {modalMode === 'remove-admin' && (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ember mb-2">
              Admin yetkisini kaldır
            </p>
            <h3 className="font-display font-semibold text-xl text-ink mb-2 leading-tight">
              <em className="text-ember">{displayName}</em>&apos;ın admin
              yetkisi kaldırılsın mı?
            </h3>
            <p className="text-sm text-ink-72 leading-relaxed mb-5">
              Bu kullanıcı artık admin paneline erişemeyecek. Hesabı silinmez,
              normal kullanıcı haline döner.
            </p>
          </>
        )}

        {error && (
          <p className="text-xs text-terracotta mb-4 bg-terracotta/8 border border-terracotta/20 rounded-lg p-3">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={closeModal}
            disabled={isPending}
            className="kashe-tap flex-1 px-4 py-2.5 border border-line text-ink-72 rounded-xl font-display font-semibold text-sm hover:bg-paper-2 transition disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              isPending ||
              (modalMode === 'ban' && banReason.trim().length < 5)
            }
            className={`kashe-tap flex-1 px-4 py-2.5 rounded-xl font-display font-semibold text-sm transition disabled:opacity-60 shadow-[3px_3px_0_rgba(26,18,14,0.12)] ${
              modalMode === 'unban'
                ? 'bg-moss text-paper hover:bg-moss/85'
                : modalMode === 'remove-admin'
                  ? 'bg-ember text-paper hover:bg-ember/85'
                  : 'bg-terracotta text-paper hover:bg-ember'
            }`}
          >
            {isPending
              ? '...'
              : modalMode === 'ban'
                ? 'Askıya al'
                : modalMode === 'unban'
                  ? 'Askıyı kaldır'
                  : modalMode === 'make-admin'
                    ? 'Admin yap'
                    : 'Yetkiyi kaldır'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative inline-block" data-aksiyon-menu>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="kashe-tap px-3 py-1.5 rounded-lg border border-line text-ink-72 hover:text-ink hover:border-ink-72 transition font-mono text-[10px] uppercase tracking-[0.14em]"
        >
          Aksiyonlar ▾
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-line rounded-xl shadow-[0_12px_40px_-12px_rgba(26,18,14,0.22)] py-1 z-30">
            {user.suspended_at ? (
              <MenuItem
                onClick={() => openModal('unban')}
                color="moss"
                label="Askıyı kaldır"
              />
            ) : (
              <MenuItem
                onClick={() => openModal('ban')}
                color="terracotta"
                label="Askıya al"
              />
            )}

            {user.is_admin ? (
              <MenuItem
                onClick={() => openModal('remove-admin')}
                color="ember"
                label="Admin yetkisini kaldır"
              />
            ) : (
              <MenuItem
                onClick={() => openModal('make-admin')}
                color="ink"
                label="Admin yap"
              />
            )}
          </div>
        )}
      </div>

      {mounted && modalContent
        ? createPortal(modalContent, document.body)
        : null}
    </>
  );
}

function MenuItem({
  onClick,
  color,
  label,
}: {
  onClick: () => void;
  color: 'terracotta' | 'moss' | 'ember' | 'ink';
  label: string;
}) {
  const colorClass = {
    terracotta: 'text-terracotta hover:bg-terracotta/8',
    moss: 'text-moss hover:bg-moss/8',
    ember: 'text-ember hover:bg-ember/8',
    ink: 'text-ink-72 hover:bg-paper-2 hover:text-ink',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full text-left px-4 py-2 text-sm transition-colors ${colorClass[color]}`}
    >
      {label}
    </button>
  );
}
