'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateProfile } from './actions';
import { AvatarUpload } from './avatar-upload';
import type { Profile, TurkishCity } from '@/app/lib/types';

type Props = {
  profile: Profile;
  cities: TurkishCity[];
};

export function DuzenleForm({ profile, cities }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState(profile.full_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [cityId, setCityId] = useState<string>(
    profile.city_id ? String(profile.city_id) : ''
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append('full_name', fullName);
    formData.append('bio', bio);
    formData.append('phone', phone);
    formData.append('city_id', cityId);

    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result.success) {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 1500);
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  const inputClass =
    'w-full px-4 py-3 bg-white border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition';

  const labelClass =
    'block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2';

  return (
    <div className="space-y-8">
      <div className="bg-white border border-line rounded-lg p-6">
        <p className={labelClass + ' !mb-4'}>Profil fotoğrafı</p>
        <AvatarUpload
          userId={profile.id}
          currentAvatarUrl={profile.avatar_url}
          fullName={fullName || profile.full_name || 'K'}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="full_name" className={labelClass}>
            Ad Soyad <span className="text-terracotta">*</span>
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            maxLength={100}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
            placeholder="Adın Soyadın"
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={profile.email}
            disabled
            className={`${inputClass} bg-paper opacity-60 cursor-not-allowed`}
          />
          <p className="text-xs text-ink-72 mt-1.5">
            Email adresi değiştirilemez.
          </p>
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Telefon
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            maxLength={20}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            placeholder="0555 555 55 55"
          />
        </div>

        <div>
          <label htmlFor="city_id" className={labelClass}>
            Şehir
          </label>
          <select
            id="city_id"
            name="city_id"
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className={inputClass}
          >
            <option value="">Şehir seç</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bio" className={labelClass}>
            Hakkımda
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={5}
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={`${inputClass} resize-none`}
            placeholder="Kendinden, deneyimlerinden bahset..."
          />
          <p className="text-xs text-ink-72 mt-1.5">
            {bio.length}/500 karakter
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 bg-terracotta/10 border border-terracotta/30 rounded-lg text-sm text-terracotta">
            {error}
          </div>
        )}

        {success && (
          <div className="px-4 py-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-700">
            Bilgilerin kaydedildi.
          </div>
        )}

        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
          <Link
            href="/profil"
            className="px-6 py-3 text-ink-72 hover:text-ink font-display font-medium transition-colors"
          >
            İptal
          </Link>
        </div>
      </form>
    </div>
  );
}