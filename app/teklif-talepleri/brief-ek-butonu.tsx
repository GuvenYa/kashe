'use client';

import { useState } from 'react';
import { getQuoteAttachmentUrl } from '@/app/teklif-topla/actions';

type Props = {
  requestId: string;
  attachmentName: string | null;
  attachmentType: string | null;
};

export function BriefEkButonu({ requestId, attachmentName, attachmentType }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setError(null);
    setLoading(true);
    try {
      const result = await getQuoteAttachmentUrl(requestId);
      if ('url' in result) {
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } else {
        setError(result.error);
      }
    } catch {
      setError('Açılamadı.');
    } finally {
      setLoading(false);
    }
  }

  const typeLabel =
    attachmentType === 'image'
      ? 'Görsel'
      : attachmentType === 'pdf'
        ? 'PDF'
        : 'Belge';

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="inline-flex items-center gap-2 px-3 py-2 bg-paper border border-line rounded-lg text-xs text-ink-72 hover:text-terracotta hover:border-terracotta transition disabled:opacity-50"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
        <span className="truncate max-w-[200px]">
          {loading ? 'Açılıyor...' : `${typeLabel} ek: ${attachmentName ?? 'Dosya'}`}
        </span>
      </button>
      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
    </div>
  );
}