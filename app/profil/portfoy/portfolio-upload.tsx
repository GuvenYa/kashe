'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-browser';

type Props = {
  userId: string;
  currentCount: number;
  maxItems: number;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export function PortfolioUpload({ userId, currentCount, maxItems }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const remaining = maxItems - currentCount;
  const canUpload = remaining > 0;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setError(null);

    // Limit kontrolü
    if (files.length > remaining) {
      setError(
        `Maksimum ${maxItems} öğe yükleyebilirsin. Şu an ${remaining} slot kaldı.`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Tip ve boyut kontrolü
    for (const file of files) {
      const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
      const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
      if (!isImage && !isVideo) {
        setError(`"${file.name}" desteklenmeyen tip. Görsel (JPG, PNG, WebP) veya video (MP4, WebM, MOV) yükleyebilirsin.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (isImage && file.size > MAX_IMAGE_SIZE) {
        setError(`"${file.name}" 5 MB'dan büyük (görsel limiti).`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (isVideo && file.size > MAX_VIDEO_SIZE) {
        setError(`"${file.name}" 50 MB'dan büyük (video limiti).`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setUploading(true);
    setProgress({ current: 0, total: files.length });

    const supabase = createClient();
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ current: i + 1, total: files.length });

        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${userId}/${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 8)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('portfolio')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('portfolio').getPublicUrl(fileName);

        const isVideoFile = ALLOWED_VIDEO_TYPES.includes(file.type);
        const { error: dbError } = await supabase.from('portfolio_items').insert({
          profile_id: userId,
          media_url: publicUrl,
          media_type: isVideoFile ? 'video' : 'image',
          caption: null,
        });

        if (dbError) {
          console.error('DB error:', dbError);
          // Storage'tan da sil (atomic değil ama best effort)
          await supabase.storage.from('portfolio').remove([fileName]);
          continue;
        }

        successCount++;
      }

      if (successCount < files.length) {
        setError(
          `${successCount}/${files.length} fotoğraf yüklendi. Bazıları yüklenmedi.`
        );
      }

      router.refresh();
    } catch (err: any) {
      setError('Yükleme başarısız: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="bg-white border border-line rounded-lg p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-1">
            Yükle
          </p>
          <p className="text-sm text-ink-72">
            {currentCount}/{maxItems} öğe · Görsel (max 5 MB) veya video (max 50 MB)
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="portfolio-input"
            disabled={uploading || !canUpload}
          />
          <label
            htmlFor="portfolio-input"
            className={`px-5 py-2.5 rounded-lg font-display font-semibold text-sm transition-all ${
              uploading || !canUpload
                ? 'bg-line text-ink-72 cursor-not-allowed'
                : 'bg-terracotta text-paper hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] cursor-pointer'
            }`}
          >
            {uploading
              ? progress
                ? `Yükleniyor (${progress.current}/${progress.total})...`
                : 'Yükleniyor...'
              : canUpload
              ? '+ Görsel / video ekle'
              : 'Limit doldu'}
          </label>
        </div>
      </div>

      {error && (
        <p className="text-sm text-terracotta">{error}</p>
      )}
    </div>
  );
}