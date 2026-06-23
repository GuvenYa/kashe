'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { updateProfile } from './actions';
import { generateProfileBio } from '@/app/lib/ai-actions';
import { AvatarUpload } from './avatar-upload';
import { AttributesEditor } from './attributes-editor';
import { isProfessional, isBusiness } from '@/app/lib/profile-helpers';
import { getFilterFields } from '@/app/lib/filter-config';
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

  // AI bio yardımcısı
  const [aiBioKeywords, setAiBioKeywords] = useState('');
  const [aiBioLoading, setAiBioLoading] = useState(false);
  const [aiBioError, setAiBioError] = useState<string | null>(null);

  async function handleGenerateBio() {
    setAiBioError(null);
    setAiBioLoading(true);
    const categoryName =
      categories.find((c) => String(c.id) === primaryCategoryId)?.name_tr || '';
    const result = await generateProfileBio({
      categoryName,
      keywords: aiBioKeywords.trim(),
      isAgency: profile.role === 'agency',
    });
    if (result.success) {
      setBio(result.text);
    } else {
      setAiBioError(result.error);
    }
    setAiBioLoading(false);
  }

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

  // İlan sahibi varsayılanı: ilanlarına genelde kimler başvursun
  // 'both' | 'professional' | 'agency' (DB: text[] — both=iki rol/null)
  function detectDefaultRoles(): 'both' | 'professional' | 'agency' {
    const r = (profile as { default_allowed_applicant_roles?: string[] | null })
      .default_allowed_applicant_roles;
    if (!r || r.length === 0 || r.length === 2) return 'both';
    if (r[0] === 'professional') return 'professional';
    if (r[0] === 'agency') return 'agency';
    return 'both';
  }
  const [defaultApplicantRoles, setDefaultApplicantRoles] = useState<
    'both' | 'professional' | 'agency'
  >(detectDefaultRoles());

 const initialAttributes: Record<string, string | string[]> =
    (profile.attributes as Record<string, string | string[]>) || {};
  const [attributes, setAttributes] = useState(initialAttributes);

  const showProfessionalFields = isProfessional(profile);
  const showBusinessFields = isBusiness(profile);
  // İlan açabilen roller (client/business) başvuru kısıtı varsayılanını görür.
  // professional/agency ilana başvuran taraftır, ilan açmaz.
  const showApplicantRolesDefault =
    profile.role === 'client' || profile.role === 'business';

  // Seçili kategorinin slug'ını bul (filter-config slug'a göre çalışır)
  const selectedCategorySlug = primaryCategoryId
    ? categories.find((c) => String(c.id) === primaryCategoryId)?.slug ?? null
    : null;
  const filterFields = getFilterFields(selectedCategorySlug);

  function handleAttrChange(key: string, value: string | string[]) {
    setAttributes((prev) => ({ ...prev, [key]: value }));
  }

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
    formData.append('attributes', JSON.stringify(attributes));
    formData.append('default_applicant_roles', defaultApplicantRoles);

    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result.success) {
        setSuccess(true);
        // Başarı mesajını kısa süre göster, sonra profil sayfasına dön
        setTimeout(() => {
          router.push('/profil');
          router.refresh();
        }, 1200);
      } else {
        setError(result.error || 'Bir hata oluştu.');
      }
    });
  }

  const inputClass =
    'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition';

  const labelClass =
    'block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2';

  return (
    <div className="space-y-8">
      <div className="bg-card border border-line rounded-lg p-6">
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
              onChange={(e) => {
                const newId = e.target.value;
                setPrimaryCategoryId(newId);
                // Kategori değişti → eski kategorinin attribute'ları artık geçersiz,
                // temizle ki jsonb'de çöp kalmasın ve keşfet filtresi şaşmasın.
                // (Aynı kategori tekrar seçilirse mevcut değerler korunsun diye kontrol)
                if (newId !== primaryCategoryId) {
                  setAttributes({});
                }
              }}
              className={inputClass}
            >
              <option value="">Bir kategori seç</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name_tr}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-72 mt-1.5">
              Ekstra hizmetlerini ileride profil sayfanda ekleyebilirsin.
            </p>
          </div>
        )}

        {showProfessionalFields && filterFields.length > 0 && (
          <AttributesEditor
            fields={filterFields}
            values={attributes}
            onChange={handleAttrChange}
          />
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
            <span className="inline-flex items-center px-3 bg-card border border-line rounded-lg text-ink font-mono text-sm select-none">
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
            <p className="text-xs text-danger mt-1.5">
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
            {showProfessionalFields && (
              <div className="mb-3 bg-paper border border-line rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-terracotta" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
                    AI ile Hakkımda yaz
                  </span>
                </div>
                <p className="text-[11px] text-ink-72 mb-2 leading-relaxed">
                  Kategorini seç, istersen birkaç detay ekle (deneyim, tarz,
                  uzmanlık). Yapay zekâ senin için bir taslak yazsın — sonra
                  düzenleyebilirsin.
                </p>
                <input
                  type="text"
                  value={aiBioKeywords}
                  onChange={(e) => setAiBioKeywords(e.target.value)}
                  placeholder="Örn: 8 yıl deneyim, düğün ve kurumsal, modern tarz"
                  maxLength={500}
                  className={`${inputClass} mb-2`}
                />
                <button
                  type="button"
                  onClick={handleGenerateBio}
                  disabled={aiBioLoading}
                  className="kashe-tap inline-flex items-center gap-1.5 px-3 py-2 rounded bg-terracotta text-paper font-mono text-[10px] uppercase tracking-[0.16em] hover:bg-ember transition disabled:opacity-50"
                >
                  <Sparkles size={13} />
                  {aiBioLoading ? 'Yazıyor…' : 'AI ile yaz'}
                </button>
                {aiBioError && (
                  <p className="text-[11px] text-danger mt-2">{aiBioError}</p>
                )}
              </div>
            )}
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

        {showApplicantRolesDefault && (
          <div>
            <label className={labelClass}>İlanlarıma kimler başvursun</label>
            <p className="text-xs text-ink-72 mb-3 -mt-1">
              Yeni ilanların için varsayılan. Her ilanda ayrıca
              değiştirebilirsin.
            </p>
            <div className="space-y-2">
              {[
                { key: 'both' as const, label: 'Herkes (profesyonel + ajans)' },
                { key: 'professional' as const, label: 'Sadece bireysel profesyoneller' },
                { key: 'agency' as const, label: 'Sadece ajanslar' },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2 bg-card border rounded-lg p-3 cursor-pointer transition ${
                    defaultApplicantRoles === opt.key
                      ? 'border-terracotta'
                      : 'border-line hover:border-terracotta/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="default-applicant-roles"
                    checked={defaultApplicantRoles === opt.key}
                    onChange={() => setDefaultApplicantRoles(opt.key)}
                    className="accent-terracotta"
                  />
                  <span className="text-sm text-ink">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

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