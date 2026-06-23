'use client';

import { useState } from 'react';
import { getApplicationAttachmentUrl } from '@/app/ilanlar/listings-actions';
import { MediaLightbox } from '@/app/components/media-lightbox';

type Props = {
  applicationId: string;
  attachmentPath: string;
  attachmentType: string | null;
  attachmentName: string | null;
};

/**
 * Başvuru ekini gösterir. Tıklayınca signed URL üretir:
 * resim → lightbox, PDF/doc → yeni sekme.
 * Başvuran ve ilan sahibi erişebilir (server tarafında doğrulanır).
 */
export function ApplicationAttachment({
  applicationId,
  attachmentPath,
  attachmentType,
  attachmentName,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const isImage = attachmentType === 'image';

  async function open() {
    setError(null);
    setLoading(true);
    try {
      const result = await getApplicationAttachmentUrl(
        applicationId,
        attachmentPath
      );
      if ('error' in result) {
        setError(result.error);
        return;
      }
      if (isImage) {
        setLightboxUrl(result.url);
      } else {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={loading}
        className="flex items-center gap-2.5 rounded-lg border border-line bg-paper/40 px-3 py-2 w-full text-left hover:border-[#1E3A5F] transition disabled:opacity-50"
      >
        <span className="shrink-0 w-9 h-9 rounded-lg bg-[#1E3A5F]/10 flex items-center justify-center">
          {isImage ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-ink truncate">
            {attachmentName || 'Ek dosya'}
          </span>
          <span className="block text-[10px] text-ink-72">
            {loading ? 'Açılıyor...' : isImage ? 'Görseli aç' : 'Dosyayı aç'}
          </span>
        </span>
      </button>

      {error && <p className="text-xs text-danger mt-1">{error}</p>}

      <MediaLightbox
        items={lightboxUrl ? [{ url: lightboxUrl, type: 'image' }] : []}
        index={lightboxUrl ? 0 : null}
        onClose={() => setLightboxUrl(null)}
        onNavigate={() => {}}
      />
    </>
  );
}
