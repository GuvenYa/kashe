'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateProfile } from './actions';
import { AvatarUpload } from './avatar-upload';
import { isProfessional, isBusiness } from '@/app/lib/profile-helpers';
import type { Profile, TurkishCity, ServiceCategory } from '@/app/lib/types';

// Telefon yardımcıları (kayıt formuyla tutarlı)
function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('90')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 8));
  if (digits.length > 8) parts.push(digits.slice(8, 10));
  return parts.join(' ');
}

function phoneDigits(masked: string): string {
  return masked.replace(/\D/g, '').slice(0, 10);
}

// DB'deki +905XXXXXXXXX (veya eski/serbest format) → maskeli 5XX XXX XX XX
function maskFromStored(stored: string | null): string {
  if (!stored) return '';
  return formatPhone(stored);
}

type Props = {
  profile: Profile;
  cities: TurkishCity[];
  categories: ServiceCategory[];
};

export function DuzenleForm({ profile, cities, categories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState(profile.full_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  // Telefon: DB'de +905XXXXXXXXX formatında. Maskeli görünüme (5XX XXX XX XX) çevirip göster.
  const [phone, setPhone] = useState(maskFromStored(profile.phone));
  const [cityId, setCityId] = useState<string>(
    profile.city_id ? String(profile.city_id) : ''
  );
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string>(
    profile.primary_category_id ? String(profile.primary_category_id) : ''
  );
  const [companyName, setCompanyName] = useState(profile.company_name || '');

  const showProfessionalFields = isProfessional(profile);
  const showBusinessFields = isBusiness(profile);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append('full_name', fullName);
    formData.append('bio', bio);
    // Telefon: doluysa +90 dahil tam format, eksik/boşsa boş string
    const digits = phoneDigits(phone);
    const fullPhone = digits.length === 10 ? `+90${digits}` : '';
    formData.append('phone', fullPhone);
    formData.append('city_id', cityId);
    formData.append('primary_category_id', primaryCategoryId);
    formData.append('company_name', companyName);

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

        {showBusinessFields && (
          <div>
            <label htmlFor="company_name" className={labelClass}>
              Şirket adı <span className="text-terracotta">*</span>
            </label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              maxLength={200}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
              placeholder="Şirketinin tam adı"
            />
          </div>
        )}

        {showProfessionalFields && (
          <div>
            <label htmlFor="primary_category_id" className={labelClass}>
              Ana hizmet kategorisi <span className="text-terracotta">*</span>
            </label>
            <select
              id="primary_category_id"
              name="primary_category_id"
              value={primaryCategoryId}
              onChange={(e) => setPrimaryCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">Bir kategori seç</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.emoji ? `${cat.emoji} ${cat.name_tr}` : cat.name_tr}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-72 mt-1.5">
              Ekstra hizmetlerini ileride profil sayfanda ekleyebilirsin.
            </p>
          </div>
        )}

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
          <div className="flex items-stretch gap-2">
            <span className="inline-flex items-center px-3 bg-white border border-line rounded-lg text-ink font-mono text-sm select-none">
              +90
            </span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className={`${inputClass} flex-1`}
              placeholder="5XX XXX XX XX"
            />
          </div>
          {phone && phoneDigits(phone).length > 0 && phoneDigits(phone).length < 10 && (
            <p className="text-xs text-terracotta mt-1.5">
              Numara eksik görünüyor (10 hane: 5XX XXX XX XX)
            </p>
          )}
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
            placeholder={
              showProfessionalFields
                ? 'Deneyimlerinden, sunduğun hizmetin özelliklerinden bahset...'
                : showBusinessFields
                ? 'Şirketinden, ne tür etkinlikler düzenlediğinizden bahset...'
                : 'Kendinden, ilgi alanlarından bahset...'
            }
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