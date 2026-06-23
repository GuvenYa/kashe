'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { applyToListing } from '../listings-actions';
import { getApplicationTemplates } from '@/app/lib/message-templates';
import { createClient } from '@/app/lib/supabase-browser';

const MAX_APP_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const APP_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const APP_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function appAttachmentKind(mime: string): 'image' | 'pdf' | 'doc' | null {
  if (APP_IMAGE_TYPES.includes(mime)) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (APP_DOC_TYPES.includes(mime)) return 'doc';
  return null;
}

type Props = {
  listingId: string;
  listingTitle: string;
  categorySlug: string | null;
  open: boolean;
  onClose: () => void;
};

export function ApplyModal({ listingId, listingTitle, categorySlug, open, onClose }: Props) {
  const templates = getApplicationTemplates(categorySlug);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [coverMessage, setCoverMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [includeAmount, setIncludeAmount] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function resetForm() {
    setCoverMessage('');
    setAmount('');
    setIncludeAmount(false);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!appAttachmentKind(selected.type)) {
      setError('Desteklenmeyen dosya tipi. Görsel, PDF veya Word ekleyebilirsin.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (selected.size > MAX_APP_FILE_SIZE) {
      setError("Dosya 20 MB'dan büyük olamaz.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(selected);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (coverMessage.trim().length < 20) {
      setError('Başvuru mesajın en az 20 karakter olmalı');
      return;
    }

    let proposedAmount: number | null = null;
    if (includeAmount) {
      const parsed = parseFloat(amount.replace(/\./g, '').replace(',', '.'));
      if (isNaN(parsed) || parsed <= 0) {
        setError('Geçerli bir fiyat gir veya fiyat teklifini kapat');
        return;
      }
      proposedAmount = parsed;
    }

    startTransition(async () => {
      let attachment:
        | { path: string; type: 'image' | 'pdf' | 'doc'; name: string }
        | null = null;

      // Dosya seçildiyse önce storage'a yükle
      if (file) {
        const kind = appAttachmentKind(file.type);
        if (!kind) {
          setError('Desteklenmeyen dosya tipi.');
          return;
        }
        setUploading(true);
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            setError('Oturum bulunamadı.');
            setUploading(false);
            return;
          }
          const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
          const path = `${user.id}/${listingId}/${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('application-attachments')
            .upload(path, file, { cacheControl: '3600', upsert: false });
          if (upErr) {
            setError('Dosya yüklenemedi: ' + upErr.message);
            setUploading(false);
            return;
          }
          attachment = { path, type: kind, name: file.name };
        } catch (err) {
          setError(
            'Yükleme hatası: ' +
              (err instanceof Error ? err.message : 'bilinmeyen')
          );
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      const result = await applyToListing({
        listing_id: listingId,
        cover_message: coverMessage.trim(),
        proposed_amount: proposedAmount,
        attachment,
      });

      if (result.success) {
        resetForm();
        onClose();
        router.refresh();
      } else {
        setError(result.error);
        // Başvuru başarısızsa yüklenen dosyayı temizle
        if (attachment) {
          const supabase = createClient();
          await supabase.storage
            .from('application-attachments')
            .remove([attachment.path]);
        }
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-paper rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-line p-5 sticky top-0 bg-paper z-10 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-1">
              İlana başvur
            </p>
            <h2 className="font-display text-2xl text-ink leading-tight line-clamp-2">
              {listingTitle}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-ink-72 hover:text-ink text-2xl leading-none w-8 h-8 flex items-center justify-center shrink-0 ml-3"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Başvuru mesajı */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Başvuru mesajın
            </label>
            {templates.length > 0 && (
              <div className="mb-2.5 rounded-lg border border-[#1E3A5F]/20 bg-[#1E3A5F]/[0.05] p-2.5">
                <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#1E3A5F] mb-1.5 flex items-center gap-1">
                  <span aria-hidden="true">✎</span>
                  Hazır taslak — tıkla, sonra düzenle
                </p>
                <div className="flex flex-col gap-2">
                  {templates.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCoverMessage(tpl)}
                      className="text-left text-[12px] leading-relaxed text-ink-72 bg-card border border-line rounded-lg px-3 py-2.5 hover:border-[#1E3A5F] hover:text-ink hover:shadow-[2px_2px_0_#1E3A5F] hover:-translate-y-0.5 transition-all"
                    >
                      {tpl}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea
              value={coverMessage}
              onChange={(e) => setCoverMessage(e.target.value)}
              placeholder="Kendini ve neden bu işe uygun olduğunu kısaca anlat. Benzer deneyimlerin, uzmanlıklarını, müsaitlik durumunu belirt."
              rows={6}
              maxLength={2000}
              className="w-full px-4 py-3 bg-card border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 transition resize-none"
              required
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              {coverMessage.length} / 2000 karakter (en az 20)
            </p>
          </div>

          {/* Fiyat teklifi (opsiyonel) */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={includeAmount}
                onChange={(e) => setIncludeAmount(e.target.checked)}
                className="accent-[#1E3A5F] w-4 h-4"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
                Fiyat teklifim de var
              </span>
            </label>

            {includeAmount && (
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10.000"
                  className="w-full px-4 py-3 pr-12 bg-card border border-line rounded-lg text-ink text-lg font-medium focus:outline-none focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20 transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-72 text-sm font-mono">
                  TL
                </span>
              </div>
            )}

            {!includeAmount && (
              <p className="text-xs text-ink-72">
                Fiyat teklifin opsiyonel. Boş bırakırsan ilan sahibi seninle
                iletişime geçtiğinde konuşabilirsin.
              </p>
            )}
          </div>

          {/* Dosya eki (opsiyonel) */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Dosya ekle (opsiyonel)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="hidden"
              id="apply-file-input"
            />
            {file ? (
              <div className="flex items-center gap-3 bg-card border border-line rounded-lg px-3 py-2.5">
                <span className="shrink-0 w-9 h-9 rounded-lg bg-[#1E3A5F]/10 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-ink truncate">
                    {file.name}
                  </span>
                  <span className="block text-[10px] text-ink-72">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="shrink-0 text-ink-72 hover:text-terracotta text-lg leading-none w-7 h-7 flex items-center justify-center"
                  aria-label="Dosyayı kaldır"
                >
                  ×
                </button>
              </div>
            ) : (
              <label
                htmlFor="apply-file-input"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-card border border-line rounded-lg text-sm text-ink-72 hover:text-[#1E3A5F] hover:border-[#1E3A5F] transition cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                CV, portfolyo veya örnek iş ekle
              </label>
            )}
            <p className="text-[10px] text-ink-72 mt-1.5">
              Görsel, PDF veya Word · max 20 MB
            </p>
          </div>

          {error && (
            <div className="bg-terracotta/10 border border-terracotta/30 text-terracotta text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Butonlar */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-5 py-3 border border-line text-ink-72 rounded-lg font-display font-semibold text-sm hover:bg-card transition"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#1E3A5F] text-white rounded-lg font-display font-semibold text-sm hover:bg-[#142745] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send size={14} strokeWidth={1.75} />
              {uploading
                ? 'Dosya yükleniyor...'
                : isPending
                ? 'Gönderiliyor...'
                : 'Başvuruyu gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}