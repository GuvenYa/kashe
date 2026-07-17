'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createQuoteRequest } from './actions';
import { createClient } from '@/app/lib/supabase-browser';
import {
  getBriefFields,
  getBriefIntro,
  type BriefField,
} from '@/app/lib/brief-config';
import {
  OnBehalfSelector,
  type OnBehalfBusiness,
} from '@/app/components/on-behalf-selector';

type Category = { id: number; slug: string; name_tr: string };
type City = { id: number; name: string };

const MAX_BRIEF_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const BRIEF_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BRIEF_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function briefAttachmentKind(mime: string): 'image' | 'pdf' | 'doc' | null {
  if (BRIEF_IMAGE_TYPES.includes(mime)) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (BRIEF_DOC_TYPES.includes(mime)) return 'doc';
  return null;
}

const RECIPIENT_OPTIONS = [
  { value: 5, label: '5 profesyonel', hint: 'Dar ve kontrollü' },
  { value: 10, label: '10 profesyonel', hint: 'Önerilen' },
  { value: 20, label: '20 profesyonel', hint: 'Daha fazla teklif' },
];

const DEADLINE_OPTIONS = [
  { value: 1, label: '24 saat' },
  { value: 2, label: '48 saat' },
  { value: 3, label: '3 gün' },
  { value: 7, label: '1 hafta' },
];

const TARGET_ROLE_OPTIONS: {
  value: 'both' | 'professional' | 'agency';
  label: string;
  hint: string;
}[] = [
  { value: 'both', label: 'Hepsi', hint: 'Profesyonel + ajans' },
  { value: 'professional', label: 'Profesyonel', hint: 'Bireysel' },
  { value: 'agency', label: 'Ajans', hint: 'Sadece ajanslar' },
];

export function TeklifToplaFormu({
  categories,
  cities,
  writableBusinesses = [],
  canSelfCreate = true,
}: {
  categories: Category[];
  cities: City[];
  writableBusinesses?: OnBehalfBusiness[];
  canSelfCreate?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // "Kimin adına": null = kendi adına; kendi adına uygun değilse ilk kurum default
  const [onBehalfBusinessId, setOnBehalfBusinessId] = useState<string | null>(
    canSelfCreate ? null : writableBusinesses[0]?.business_id ?? null
  );

  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [cityId, setCityId] = useState<number | ''>('');
  const [briefValues, setBriefValues] = useState<Record<string, string>>({});
  const [recipientCount, setRecipientCount] = useState(10);
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [shareBudget, setShareBudget] = useState(true);
  const [targetRole, setTargetRole] = useState<'both' | 'professional' | 'agency'>('both');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!briefAttachmentKind(selected.type)) {
      setError('Desteklenmeyen dosya tipi. Görsel, PDF veya Word ekleyebilirsin.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (selected.size > MAX_BRIEF_FILE_SIZE) {
      setError("Dosya 20 MB'dan büyük olamaz.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(selected);
  }

  const selectedSlug =
    categoryId === ''
      ? null
      : categories.find((c) => c.id === categoryId)?.slug ?? null;
  const briefFields: BriefField[] = getBriefFields(selectedSlug);
  const briefIntro = getBriefIntro(selectedSlug);

  function setField(key: string, value: string) {
    setBriefValues((prev) => ({ ...prev, [key]: value }));
  }

  const todayStr = new Date().toISOString().split('T')[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (categoryId === '') {
      setError('Önce bir kategori seç.');
      return;
    }

    for (const f of briefFields) {
      if (f.required && !(briefValues[f.key] && briefValues[f.key].trim())) {
        setError(`"${f.label}" alanı zorunlu.`);
        return;
      }
    }

    let legacyEventType: string | null = null;
    let legacyEventDate: string | null = null;

    for (const f of briefFields) {
      const raw = briefValues[f.key]?.trim();
      if (!raw || !f.legacyColumn) continue;
      if (f.legacyColumn === 'event_type') legacyEventType = raw;
      if (f.legacyColumn === 'event_date') legacyEventDate = raw;
    }

    const cleanBrief: Record<string, string> = {};
    for (const f of briefFields) {
      const raw = briefValues[f.key]?.trim();
      if (raw) cleanBrief[f.key] = raw;
    }

    // Bütçe parse (Türkçe binlik ayraç temizle)
    const parseBudget = (s: string): number | null => {
      const cleaned = s.trim().replace(/\./g, '').replace(',', '.');
      if (cleaned === '') return null;
      const n = parseFloat(cleaned);
      return isNaN(n) || n < 0 ? null : n;
    };
    const bMin = parseBudget(budgetMin);
    const bMax = parseBudget(budgetMax);

    if (bMin !== null && bMax !== null && bMin > bMax) {
      setError('Minimum bütçe maksimumdan büyük olamaz.');
      return;
    }

    const targetRoles: ('professional' | 'agency')[] =
      targetRole === 'both'
        ? ['professional', 'agency']
        : [targetRole];

    startTransition(async () => {
      let attachment:
        | { path: string; type: 'image' | 'pdf' | 'doc'; name: string }
        | null = null;

      // Dosya seçildiyse önce storage'a yükle
      if (file) {
        const kind = briefAttachmentKind(file.type);
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
          const path = `${user.id}/${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('quote-attachments')
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

      const result = await createQuoteRequest({
        on_behalf_business_id: onBehalfBusinessId,
        category_id: categoryId,
        city_id: cityId === '' ? null : cityId,
        brief_data: Object.keys(cleanBrief).length > 0 ? cleanBrief : null,
        event_date: legacyEventDate,
        event_type: legacyEventType,
        budget_min: bMin,
        budget_max: bMax,
        share_budget: shareBudget,
        response_deadline_days: deadlineDays,
        recipient_count: recipientCount,
        target_roles: targetRoles,
        attachment,
      });

      if (result.success && result.data) {
        router.push('/teklif-taleplerim');
      } else if (!result.success) {
        setError(result.error);
        // Talep başarısızsa yüklenen dosyayı temizle
        if (attachment) {
          const supabase = createClient();
          await supabase.storage
            .from('quote-attachments')
            .remove([attachment.path]);
        }
      }
    });
  }

  const inputClass =
    'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Kimin adına (manager+ kurum üyesine görünür) */}
      {writableBusinesses.length > 0 && (
        <section className="bg-card border border-line rounded-lg p-6">
          <OnBehalfSelector
            businesses={writableBusinesses}
            canSelfCreate={canSelfCreate}
            value={onBehalfBusinessId}
            onChange={setOnBehalfBusinessId}
          />
        </section>
      )}

      {/* Bölüm 1: Kategori + şehir */}
      <section className="bg-card border border-line rounded-lg p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-5">
          Ne arıyorsun?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
              Kategori <span className="text-danger">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(
                  e.target.value ? parseInt(e.target.value, 10) : ''
                );
                setBriefValues({});
              }}
              required
              className={inputClass}
            >
              <option value="">Kategori seç...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name_tr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
              Şehir
            </label>
            <select
              value={cityId}
              onChange={(e) =>
                setCityId(e.target.value ? parseInt(e.target.value, 10) : '')
              }
              className={inputClass}
            >
              <option value="">Tüm şehirler</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              Şehir seçersen sadece o şehirdeki profesyonellere gider
            </p>
          </div>
        </div>
      </section>

      {/* Bölüm 2: Brief */}
      {categoryId !== '' && (
        <section className="bg-card border border-line rounded-lg p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
            Etkinlik detayları
          </p>
          {briefIntro && (
            <p className="text-sm text-ink-72 mb-4 -mt-1">{briefIntro}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {briefFields
              .filter(
                (field) =>
                  field.legacyColumn !== 'location' &&
                  field.legacyColumn !== 'budget_range'
              )
              .map((field) => {
              const value = briefValues[field.key] ?? '';
              const wrapperClass =
                field.type === 'textarea' ? 'md:col-span-2' : '';
              return (
                <div key={field.key} className={wrapperClass}>
                  <label
                    htmlFor={`brief-${field.key}`}
                    className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2"
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-terracotta"> *</span>
                    )}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      id={`brief-${field.key}`}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Seç...</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      id={`brief-${field.key}`}
                      rows={3}
                      maxLength={1000}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={`${inputClass} resize-none`}
                    />
                  ) : field.type === 'date' ? (
                    <input
                      id={`brief-${field.key}`}
                      type="date"
                      min={todayStr}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className={inputClass}
                    />
                  ) : field.type === 'number' ? (
                    <input
                      id={`brief-${field.key}`}
                      type="number"
                      min={0}
                      max={100000}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={inputClass}
                    />
                  ) : (
                    <input
                      id={`brief-${field.key}`}
                      type="text"
                      maxLength={200}
                      value={value}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={inputClass}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ink-72 mt-3">
            Yıldızlı (*) alanlar zorunlu — diğerlerini bildiğin kadar doldur.
          </p>
        </section>
      )}

      {/* Bölüm 3: Gönderim ayarları */}
      {categoryId !== '' && (
        <section className="bg-card border border-line rounded-lg p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-5">
            Gönderim ayarları
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Kimlere gönderilsin?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TARGET_ROLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`block bg-paper border rounded-lg p-3 cursor-pointer transition ${
                      targetRole === opt.value
                        ? 'border-terracotta'
                        : 'border-line hover:border-terracotta/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="targetRole"
                        checked={targetRole === opt.value}
                        onChange={() => setTargetRole(opt.value)}
                        className="accent-terracotta"
                      />
                      <span className="text-sm text-ink font-medium">
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-72 mt-1 ml-6 font-mono uppercase tracking-[0.1em]">
                      {opt.hint}
                    </p>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-ink-72 mt-1.5 font-mono">
                Premium profesyoneller önce listelenir
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Kaç profesyonele gönderilsin?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {RECIPIENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`block bg-paper border rounded-lg p-3 cursor-pointer transition ${
                      recipientCount === opt.value
                        ? 'border-terracotta'
                        : 'border-line hover:border-terracotta/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="recipientCount"
                        checked={recipientCount === opt.value}
                        onChange={() => setRecipientCount(opt.value)}
                        className="accent-terracotta"
                      />
                      <span className="text-sm text-ink font-medium">
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-72 mt-1 ml-6 font-mono uppercase tracking-[0.1em]">
                      {opt.hint}
                    </p>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Teklif dönüş süresi
              </label>
              <select
                value={deadlineDays}
                onChange={(e) => setDeadlineDays(parseInt(e.target.value, 10))}
                className={inputClass}
              >
                {DEADLINE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Bütçe aralığın (opsiyonel)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="Min ₺"
                  className={inputClass}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="Max ₺"
                  className={inputClass}
                />
              </div>
              <p className="text-[10px] text-ink-72 mt-1.5 font-mono">
                Boş bırakabilirsin — profesyoneller yine teklif verir
              </p>
            </div>

            {/* Dosya eki (opsiyonel) */}
            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2">
                Dosya ekle (opsiyonel)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="hidden"
                id="brief-file-input"
              />
              {file ? (
                <div className="flex items-center gap-3 bg-card border border-line rounded-lg px-3 py-2.5">
                  <span className="shrink-0 w-9 h-9 rounded-lg bg-terracotta/10 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
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
                  htmlFor="brief-file-input"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-card border border-line rounded-lg text-sm text-ink-72 hover:text-terracotta hover:border-terracotta transition cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Örnek görsel, plan veya brief ekle
                </label>
              )}
              <p className="text-[10px] text-ink-72 mt-1.5">
                Görsel, PDF veya Word · max 20 MB
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shareBudget}
                onChange={(e) => setShareBudget(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-terracotta cursor-pointer"
              />
              <span className="text-sm text-ink-72 leading-snug">
                Bütçe bilgimi profesyonellerle paylaş. Kapatırsan teklifler
                bütçeni görmeden gelir.
              </span>
            </label>
          </div>
        </section>
      )}

      {error && (
        <div className="bg-danger-08 border border-danger/30 text-danger text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {categoryId !== '' && (
        <div className="flex gap-3 sticky bottom-4 bg-paper/95 backdrop-blur-sm border border-line rounded-lg p-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] disabled:opacity-50 transition-all"
          >
            {uploading
              ? 'Dosya yükleniyor...'
              : isPending
              ? 'Gönderiliyor...'
              : 'Teklif talebini gönder'}
          </button>
        </div>
      )}
    </form>
  );
}