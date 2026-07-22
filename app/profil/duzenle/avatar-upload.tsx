'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-browser';

type Props = {
  userId: string;
  currentAvatarUrl: string | null;
  fullName: string;
};

export function AvatarUpload({ userId, currentAvatarUrl, fullName }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Client-side validation
    if (file.size > 2 * 1024 * 1024) {
      setError('Dosya 2 MB\'dan büyük olamaz.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Sadece JPG, PNG veya WebP yükleyebilirsin.');
      return;
    }

    setUploading(true);

    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Önce eski avatarları sil (farklı extension olabilir)
      const { data: existing } = await supabase.storage
        .from('avatars')
        .list(userId);
      if (existing && existing.length > 0) {
        const filesToRemove = existing.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from('avatars').remove(filesToRemove);
      }

      // Upload
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Public URL al
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(fileName);

      // Cache-bust için timestamp ekle
      const finalUrl = `${publicUrl}?t=${Date.now()}`;

      // profiles tablosuna kaydet
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: finalUrl })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(finalUrl);
      router.refresh();
    } catch (err: any) {
      setError('Yükleme başarısız: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemove() {
    if (!confirm('Avatarını silmek istediğine emin misin?')) return;

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Storage'tan sil
      const { data: existing } = await supabase.storage
        .from('avatars')
        .list(userId);
      if (existing && existing.length > 0) {
        const filesToRemove = existing.map((f) => `${userId}/${f.name}`);
        await supabase.storage.from('avatars').remove(filesToRemove);
      }

      // profiles'tan temizle
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (updateError) throw updateError;

      setAvatarUrl(null);
      router.refresh();
    } catch (err: any) {
      setError('Silme başarısız: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setUploading(false);
    }
  }

  // Initials fallback
  const initials = fullName
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-24 h-24 rounded-full object-cover border-2 border-line"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-brand-ink flex items-center justify-center text-paper font-display font-semibold text-3xl">
            {initials || '?'}
          </div>
        )}
      </div>

      <div className="flex-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          id="avatar-input"
        />

        <div className="flex items-center gap-3 flex-wrap">
          <label
            htmlFor="avatar-input"
            className={`px-4 py-2 border border-ink text-ink rounded-lg font-display font-medium hover:bg-ink hover:text-paper transition-colors cursor-pointer text-sm ${
              uploading ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {uploading ? 'Yükleniyor...' : avatarUrl ? 'Değiştir' : 'Avatar yükle'}
          </label>

          {avatarUrl && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-sm text-ink-72 hover:text-brand-ink transition-colors"
            >
              Sil
            </button>
          )}
        </div>

        <p className="text-xs text-ink-72 mt-2">
          JPG, PNG veya WebP. Maksimum 2 MB.
        </p>

        {error && (
          <p className="text-sm text-danger mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}