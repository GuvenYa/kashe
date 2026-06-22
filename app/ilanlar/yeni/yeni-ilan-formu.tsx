'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { createListing, updateListing } from '../listings-actions';
import {
  BUDGET_PRESETS,
  type BudgetPresetKey,
  type Listing,
} from '../listings-data';

type Category = {
  id: number;
  name_tr: string;
  emoji: string | null;
};

type City = {
  id: number;
  name: string;
};

type Props = {
  categories: Category[];
  cities: City[];
  initialData?: Listing | null;
};

const EVENT_TYPE_OPTIONS = [
  { key: 'wedding', label: 'Düğün' },
  { key: 'engagement', label: 'Nişan' },
  { key: 'birthday', label: 'Doğum günü' },
  { key: 'baby_shower', label: 'Baby shower' },
  { key: 'graduation', label: 'Mezuniyet' },
  { key: 'circumcision', label: 'Sünnet' },
  { key: 'corporate', label: 'Kurumsal' },
  { key: 'other', label: 'Diğer' },
];

// Proje-temelli kategoriler (etkinlik türü alakasız: oyuncu, model).
// Bunlarda "düğün/sünnet" sormak anlamsız — etkinlik türü alanı gizlenir.
function isProjectBasedCategory(categoryName: string | undefined): boolean {
  const name = (categoryName || '').toLocaleLowerCase('tr');
  return name.includes('oyuncu') || name.includes('model');
}

// Kategori adına göre örnek başlık/açıklama placeholder'ı.
// name_tr'nin içinde geçen anahtar kelimeye göre eşleşir (slug bağımsız).
function getPlaceholders(categoryName: string | undefined): {
  title: string;
  description: string;
} {
  const name = (categoryName || '').toLocaleLowerCase('tr');
  const map: { match: string; title: string; description: string }[] = [
    {
      match: 'fotoğraf',
      title: "Örn: Düğünümüz için profesyonel fotoğrafçı arıyoruz",
      description:
        'Örn: 15 Haziran düğünümüz için dış çekim + tören + after party fotoğrafı çekecek, kıvrak ve deneyimli bir fotoğrafçı arıyoruz. Yaklaşık 6 saatlik çekim, 2 hafta içinde teslim bekliyoruz.',
    },
    {
      match: 'videograf',
      title: "Örn: Nişan töreni için videograf arıyoruz",
      description:
        'Örn: Nişan törenimizi 4K kalitede çekip kısa bir kurgu video hazırlayacak bir videograf arıyoruz. Drone çekimi tercihimiz. Etkinlik 3 saat sürecek.',
    },
    {
      match: 'dj',
      title: "Örn: Doğum günü partisi için DJ arıyoruz",
      description:
        'Örn: 50 kişilik açık hava doğum günü için 4 saatlik performans verecek, ekipmanını getiren bir DJ arıyoruz. Pop ve remix ağırlıklı bir set bekliyoruz.',
    },
    {
      match: 'müzisyen',
      title: "Örn: Akşam yemeği için canlı müzik arıyoruz",
      description:
        'Örn: 30 kişilik özel davette 2 saatlik akustik performans verecek bir müzisyen/grup arıyoruz. Türkçe ve yabancı slow repertuvar tercihimiz.',
    },
    {
      match: 'sunucu',
      title: "Örn: Kurumsal lansman için sunucu arıyoruz",
      description:
        'Örn: 200 kişilik kurumsal lansman etkinliğimizde akışı yönetecek, deneyimli ve diksiyon sahibi bir sunucu arıyoruz. Etkinlik yaklaşık 3 saat.',
    },
    {
      match: 'hostes',
      title: "Örn: Fuar standımız için hostes arıyoruz",
      description:
        'Örn: 3 gün sürecek fuar için standımızda karşılama ve yönlendirme yapacak 2 hostes arıyoruz. İngilizce bilen, sunum yeteneği güçlü kişiler tercih edilir.',
    },
    {
      match: 'oyuncu',
      title: "Örn: Reklam filmi için oyuncu arıyoruz",
      description:
        'Örn: Marka reklam filmimiz için 25-35 yaş arası, kameraya hakim bir oyuncu arıyoruz. 1 günlük çekim, İstanbul. Showreel paylaşmanızı rica ederiz.',
    },
    {
      match: 'model',
      title: "Örn: Katalog çekimi için model arıyoruz",
      description:
        'Örn: Yeni sezon koleksiyonumuzun katalog çekimi için model arıyoruz. 1 günlük stüdyo çekimi. Ölçü ve portfolyo bilgisi paylaşmanızı bekliyoruz.',
    },
    {
      match: 'palyaço',
      title: "Örn: Çocuk doğum günü için palyaço arıyoruz",
      description:
        'Örn: 6 yaş doğum günü partisi için 1 saatlik gösteri yapacak, balon ve animasyon içeren bir palyaço arıyoruz. 15 çocuk olacak.',
    },
    {
      match: 'illüzyon',
      title: "Örn: Etkinlik için illüzyonist arıyoruz",
      description:
        'Örn: Kurumsal gala yemeğimizde masalar arası ve sahne gösterisi yapacak bir illüzyonist arıyoruz. Yaklaşık 1 saatlik performans.',
    },
    {
      match: 'organizasyon',
      title: "Örn: Düğün organizasyonu için ajans arıyoruz",
      description:
        'Örn: 300 kişilik düğünümüzün baştan sona organizasyonunu üstlenecek bir ekip arıyoruz. Mekan, ikram, dekor ve koordinasyon dahil komple hizmet.',
    },
    {
      match: 'ses',
      title: "Örn: Konser için ses & ışık ekibi arıyoruz",
      description:
        'Örn: 500 kişilik açık hava etkinliğimiz için ses ve ışık sistemini kuracak, operasyonunu yönetecek teknik ekip arıyoruz. Mekan keşfi yapılabilir.',
    },
  ];

  const found = map.find((m) => name.includes(m.match));
  return (
    found ?? {
      title: 'Örn: Etkinliğim için profesyonel arıyorum',
      description:
        'Etkinliğin detayları, neye ihtiyacın olduğu, beklediğin sonuç. Net yazılan ilan kaliteli başvuru çeker.',
    }
  );
}

export function YeniIlanFormu({ categories, cities, initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!initialData;

  // Mevcut bütçeyi BUDGET_PRESETS ile eşleştir, yoksa custom
  function detectBudgetPreset(): BudgetPresetKey {
    if (!initialData) return 'open';
    const { budget_min: min, budget_max: max } = initialData;
    if (min === null && max === null) return 'open';
    const match = BUDGET_PRESETS.find(
      (p) => p.min === min && p.max === max
    );
    return (match?.key as BudgetPresetKey) ?? 'custom';
  }

  // Form state — initialData varsa onunla initialize
  const [categoryId, setCategoryId] = useState<number | ''>(
    initialData?.category_id ?? ''
  );
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [requirements, setRequirements] = useState(
    initialData?.requirements ?? ''
  );
  const [eventDate, setEventDate] = useState(initialData?.event_date ?? '');
  const [eventType, setEventType] = useState<string>(
    initialData?.event_type ?? ''
  );
  const [location, setLocation] = useState(initialData?.location ?? '');
  const [cityId, setCityId] = useState<number | ''>(
    initialData?.city_id ?? ''
  );
  const [guestCount, setGuestCount] = useState(
    initialData?.guest_count !== null && initialData?.guest_count !== undefined
      ? String(initialData.guest_count)
      : ''
  );
  const [budgetPreset, setBudgetPreset] = useState<BudgetPresetKey>(
    detectBudgetPreset()
  );
  const [budgetMin, setBudgetMin] = useState(
    initialData?.budget_min !== null && initialData?.budget_min !== undefined
      ? String(initialData.budget_min)
      : ''
  );
  const [budgetMax, setBudgetMax] = useState(
    initialData?.budget_max !== null && initialData?.budget_max !== undefined
      ? String(initialData.budget_max)
      : ''
  );
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [applicationDeadline, setApplicationDeadline] = useState(
    initialData?.application_deadline
      ? initialData.application_deadline.split('T')[0]
      : ''
  );
  // Kimler başvurabilir: 'both' (herkes) | 'professional' | 'agency'
  // null/boş veya iki rol = 'both'
  function detectApplicantRoles(): 'both' | 'professional' | 'agency' {
    const r = initialData?.allowed_applicant_roles;
    if (!r || r.length === 0 || r.length === 2) return 'both';
    if (r[0] === 'professional') return 'professional';
    if (r[0] === 'agency') return 'agency';
    return 'both';
  }
  const [applicantRoles, setApplicantRoles] = useState<
    'both' | 'professional' | 'agency'
  >(detectApplicantRoles());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (categoryId === '') {
      setError('Kategori seçmelisin');
      return;
    }
    if (title.trim().length < 3) {
      setError('Başlık en az 3 karakter olmalı');
      return;
    }
    if (description.trim().length < 10) {
      setError('Açıklama en az 10 karakter olmalı');
      return;
    }

    // Bütçe hesapla
    let finalMin: number | null = null;
    let finalMax: number | null = null;
    const preset = BUDGET_PRESETS.find((p) => p.key === budgetPreset);

    if (budgetPreset === 'custom') {
      if (budgetMin) {
        const v = parseFloat(budgetMin.replace(/\./g, '').replace(',', '.'));
        if (isNaN(v) || v < 0) {
          setError('Geçerli bir minimum bütçe gir');
          return;
        }
        finalMin = v;
      }
      if (budgetMax) {
        const v = parseFloat(budgetMax.replace(/\./g, '').replace(',', '.'));
        if (isNaN(v) || v < 0) {
          setError('Geçerli bir maksimum bütçe gir');
          return;
        }
        finalMax = v;
      }
      if (finalMin !== null && finalMax !== null && finalMin > finalMax) {
        setError('Minimum bütçe maksimumdan büyük olamaz');
        return;
      }
    } else if (preset) {
      finalMin = preset.min;
      finalMax = preset.max;
    }

    let finalGuestCount: number | null = null;
    if (guestCount) {
      const v = parseInt(guestCount, 10);
      if (isNaN(v) || v < 0 || v > 100000) {
        setError('Kişi sayısı 0-100.000 arasında olmalı');
        return;
      }
      finalGuestCount = v;
    }

    // Rol seçimini DB formatına çevir: 'both' → her iki rol (açık değer),
    // tek rol → o rolü içeren dizi.
    // NOT: 'both' artık null DEĞİL — kullanıcı "Herkes" derken profil
    // varsayılanına devretmeyi değil, açıkça ikisini de kastediyor.
    const rolesValue: string[] =
      applicantRoles === 'both'
        ? ['professional', 'agency']
        : [applicantRoles];

    startTransition(async () => {
      if (isEditMode && initialData) {
        // EDIT MODE
        const result = await updateListing({
          id: initialData.id,
          category_id: categoryId,
          title: title.trim(),
          description: description.trim(),
          requirements: requirements.trim() || null,
          event_date: eventDate || null,
          event_type: eventType || null,
          location: location.trim() || null,
          city_id: cityId === '' ? null : cityId,
          guest_count: finalGuestCount,
          budget_min: finalMin,
          budget_max: finalMax,
          application_deadline: applicationDeadline
            ? new Date(applicationDeadline + 'T23:59:59').toISOString()
            : null,
          allowed_applicant_roles: rolesValue,
        });

        if (result.success) {
          router.push(`/ilanlar/${initialData.id}`);
        } else {
          setError(result.error);
        }
      } else {
        // CREATE MODE
        const result = await createListing({
          category_id: categoryId,
          title: title.trim(),
          description: description.trim(),
          requirements: requirements.trim() || null,
          event_date: eventDate || null,
          event_type: eventType || null,
          location: location.trim() || null,
          city_id: cityId === '' ? null : cityId,
          guest_count: finalGuestCount,
          budget_min: finalMin,
          budget_max: finalMax,
          application_deadline: applicationDeadline
            ? new Date(applicationDeadline + 'T23:59:59').toISOString()
            : null,
          allowed_applicant_roles: rolesValue,
          publish_immediately: publishImmediately,
        });

        if (result.success && result.data) {
          router.push(`/ilanlar/${result.data.id}`);
        } else if (!result.success) {
          setError(result.error);
        }
      }
    });
  }

  // Seçili kategorinin adına göre dinamik placeholder
  const selectedCategoryName = categories.find(
    (c) => c.id === categoryId
  )?.name_tr;
  const placeholders = getPlaceholders(selectedCategoryName);
  const isProjectBased = isProjectBasedCategory(selectedCategoryName);

  const showCustomBudget = budgetPreset === 'custom';
  const showPresetInfo = budgetPreset !== 'open' && budgetPreset !== 'custom';
  const selectedPreset = BUDGET_PRESETS.find((p) => p.key === budgetPreset);

  // Bugünün tarihi (min validation için)
  const today = new Date().toISOString().split('T')[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Bölüm 1: Temel */}
      <section className="bg-white border border-line rounded-lg p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-5">
          Temel bilgiler
        </p>

        <div className="space-y-5">
          {/* Kategori */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Kategori <span className="text-terracotta">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                const newId = e.target.value ? parseInt(e.target.value, 10) : '';
                setCategoryId(newId);
                // Proje-temelli kategoriye geçildiyse etkinlik türünü temizle
                const newName = categories.find((c) => c.id === newId)?.name_tr;
                if (isProjectBasedCategory(newName)) {
                  setEventType('');
                }
              }}
              required
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
            >
              <option value="">Kategori seç...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name_tr}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              Hangi tür profesyonel arıyorsun?
            </p>
          </div>

          {/* Başlık */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Başlık <span className="text-terracotta">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={placeholders.title}
              maxLength={200}
              required
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              {title.length} / 200 karakter (en az 3)
            </p>
          </div>

          {/* Açıklama */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Açıklama <span className="text-terracotta">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={placeholders.description}
              rows={6}
              maxLength={5000}
              required
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none"
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              {description.length} / 5000 karakter (en az 10)
            </p>
          </div>

          {/* Gereksinimler */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Gereksinimler{' '}
              <span className="text-ink-72 normal-case tracking-normal">
                (opsiyonel)
              </span>
            </label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Profesyonelin sahip olması gereken nitelikler, deneyim, sertifika, ekipman vs."
              rows={3}
              maxLength={2000}
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition resize-none"
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              {requirements.length} / 2000 karakter
            </p>
          </div>
        </div>
      </section>

      {/* Bölüm 2: Etkinlik */}
      <section className="bg-white border border-line rounded-lg p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-5">
          {isProjectBased ? 'Proje detayları' : 'Etkinlik detayları'}{' '}
          <span className="normal-case tracking-normal">(hepsi opsiyonel)</span>
        </p>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!isProjectBased && (
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
                  Etkinlik türü
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                >
                  <option value="">Seç...</option>
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
                {isProjectBased ? 'Çekim / proje tarihi' : 'Etkinlik tarihi'}
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                min={today}
                className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
                Lokasyon
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Örn: Maltepe Sahil Düğün Salonu"
                maxLength={200}
                className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
                Şehir
              </label>
              <select
                value={cityId}
                onChange={(e) =>
                  setCityId(e.target.value ? parseInt(e.target.value, 10) : '')
                }
                className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
              >
                <option value="">Seç...</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Kişi sayısı
            </label>
            <input
              type="number"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="Örn: 100"
              min={0}
              max={100000}
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
            />
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
              Son başvuru tarihi
            </label>
            <input
              type="date"
              value={applicationDeadline}
              onChange={(e) => setApplicationDeadline(e.target.value)}
              min={today}
              className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
            />
            <p className="text-[10px] text-ink-72 mt-1 font-mono">
              Boş bırakırsan başvurular süresiz açık kalır. Bu tarih geçince yeni başvuru alınmaz.
            </p>
          </div>
        </div>
      </section>

      {/* Bölüm 3: Bütçe */}
      <section className="bg-white border border-line rounded-lg p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-5">
          Bütçe
        </p>

        <div className="space-y-3">
          {BUDGET_PRESETS.map((preset) => (
            <label
              key={preset.key}
              className={`block bg-paper border rounded-lg p-3 cursor-pointer transition ${
                budgetPreset === preset.key
                  ? 'border-terracotta'
                  : 'border-line hover:border-terracotta/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="budget"
                  checked={budgetPreset === preset.key}
                  onChange={() => setBudgetPreset(preset.key)}
                  className="accent-terracotta"
                />
                <span className="text-sm text-ink">{preset.label}</span>
              </div>
            </label>
          ))}

          {showCustomBudget && (
            <div className="grid grid-cols-2 gap-3 mt-3 pl-6">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-72 block mb-1.5">
                  Minimum (TL)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="5.000"
                  className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-72 block mb-1.5">
                  Maksimum (TL)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="15.000"
                  className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 transition"
                />
              </div>
            </div>
          )}

          {showPresetInfo && selectedPreset && (
            <p className="text-xs text-ink-72 italic pl-6 pt-1">
              Profesyoneller bu aralığı görecek
            </p>
          )}
        </div>
      </section>

      {/* Bölüm 3.5: Kimler başvurabilir */}
      <section className="bg-white border border-line rounded-lg p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
          Kimler başvurabilir
        </p>
        <p className="text-xs text-ink-72 mb-4">
          İlanına kimlerin başvurabileceğini sınırla. Boş bırakırsan profilindeki
          varsayılan kullanılır.
        </p>
        <div className="space-y-2">
          {[
            { key: 'both' as const, label: 'Herkes', desc: 'Bireysel profesyoneller ve ajanslar başvurabilir.' },
            { key: 'professional' as const, label: 'Sadece bireysel profesyoneller', desc: 'Ajanslar bu ilana başvuramaz.' },
            { key: 'agency' as const, label: 'Sadece ajanslar', desc: 'Bireysel profesyoneller bu ilana başvuramaz.' },
          ].map((opt) => (
            <label
              key={opt.key}
              className={`block bg-paper border rounded-lg p-4 cursor-pointer transition ${
                applicantRoles === opt.key
                  ? 'border-terracotta'
                  : 'border-line hover:border-terracotta/50'
              }`}
            >
              <div className="flex items-start gap-2">
                <input
                  type="radio"
                  name="applicant-roles"
                  checked={applicantRoles === opt.key}
                  onChange={() => setApplicantRoles(opt.key)}
                  className="mt-1 accent-terracotta"
                />
                <div>
                  <p className="font-medium text-ink text-sm">{opt.label}</p>
                  <p className="text-xs text-ink-72 mt-0.5">{opt.desc}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Bölüm 4: Yayınla / Taslak — sadece create mode */}
      {!isEditMode && (
      <section className="bg-white border border-line rounded-lg p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-4">
          Durum
        </p>
        <div className="space-y-2">
          <label
            className={`block bg-paper border rounded-lg p-4 cursor-pointer transition ${
              publishImmediately
                ? 'border-terracotta'
                : 'border-line hover:border-terracotta/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <input
                type="radio"
                checked={publishImmediately}
                onChange={() => setPublishImmediately(true)}
                className="mt-1 accent-terracotta"
              />
              <div>
                <p className="font-medium text-ink text-sm">Yayınla</p>
                <p className="text-xs text-ink-72 mt-0.5">
                  İlan admin onayına gönderilir. Onaylandıktan sonra ilan
                  tahtasında görünür ve başvuru kabul eder.
                </p>
              </div>
            </div>
          </label>
          <label
            className={`block bg-paper border rounded-lg p-4 cursor-pointer transition ${
              !publishImmediately
                ? 'border-terracotta'
                : 'border-line hover:border-terracotta/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <input
                type="radio"
                checked={!publishImmediately}
                onChange={() => setPublishImmediately(false)}
                className="mt-1 accent-terracotta"
              />
              <div>
                <p className="font-medium text-ink text-sm">
                  Taslak olarak kaydet
                </p>
                <p className="text-xs text-ink-72 mt-0.5">
                  Daha sonra düzenleyip yayınlayabilirsin.
                </p>
              </div>
            </div>
          </label>
        </div>
      </section>
      )}

      {error && (
        <div className="bg-terracotta/10 border border-terracotta/30 text-terracotta text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-3 sticky bottom-4 bg-paper/95 backdrop-blur-sm border border-line rounded-lg p-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Send size={14} strokeWidth={1.75} />
          {isPending
            ? 'Kaydediliyor...'
            : isEditMode
              ? 'Değişiklikleri kaydet'
              : publishImmediately
                ? 'Yayınla'
                : 'Taslak olarak kaydet'}
        </button>
      </div>
    </form>
  );
}