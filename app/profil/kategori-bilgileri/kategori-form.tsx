'use client';

import { useState, useTransition } from 'react';
import {
  getCategoryFields,
  getModuleTitle,
  getQuickLabel,
  getQuickInput,
  getFieldExample,
  MODULE_REGISTRY,
  SERVICE_REGION_OPTIONS,
  CALISMA_SEKLI_OPTIONS,
  FOLLOWERS_RANGES,
  PLATFORM_OPTIONS,
  SKILL_LEVELS,
  CATEGORY_PARAM_SUGGESTIONS,
  ARCHETYPE_TAGLINE_EXAMPLES,
  type ModuleKey,
  type ModuleFieldDef,
} from '@/app/lib/category-fields';
import { EVENT_TYPES } from '@/app/mesajlar/data';
import { saveCategoryAttributes } from './actions';

const INPUT =
  'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition text-sm';
const LABEL = 'block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2';
const EYEBROW = 'font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink';
const CARD = 'bg-card border border-line rounded-xl p-6';

type ModulesState = Record<string, Record<string, unknown>>;
type Rec = Record<string, unknown>;

function initModules(
  moduleKeys: ModuleKey[],
  src: Record<string, Rec>
): ModulesState {
  const out: ModulesState = {};
  for (const mkey of moduleKeys) {
    const def = MODULE_REGISTRY[mkey];
    const existing = (src[mkey] ?? {}) as Rec;
    const fs: Record<string, unknown> = {};
    for (const f of def.fields) {
      if (f.type === 'documents') continue;
      const ev = existing[f.key];
      switch (f.type) {
        case 'chips':
        case 'bullet_list':
        case 'language_pairs':
          fs[f.key] = Array.isArray(ev) ? ev : [];
          break;
        case 'text':
        case 'physical':
        case 'age_range':
          fs[f.key] = typeof ev === 'string' ? ev : '';
          break;
        case 'key_value':
          fs[f.key] =
            ev && typeof ev === 'object'
              ? Object.entries(ev as Rec).map(([k, v]) => ({
                  key: k,
                  value: String(v),
                }))
              : [];
          break;
        case 'social_reach':
          fs[f.key] = Array.isArray(ev) ? ev : [];
          break;
      }
    }
    out[mkey] = fs;
  }
  return out;
}

function buildModulesPayload(
  moduleKeys: ModuleKey[],
  state: ModulesState
): Record<string, Rec> {
  const out: Record<string, Rec> = {};
  for (const mkey of moduleKeys) {
    const def = MODULE_REGISTRY[mkey];
    const fs = state[mkey] ?? {};
    const data: Rec = {};
    for (const f of def.fields) {
      if (f.type === 'documents') continue;
      const v = fs[f.key];
      switch (f.type) {
        case 'chips':
        case 'bullet_list':
        case 'language_pairs':
        case 'social_reach':
          data[f.key] = v ?? [];
          break;
        case 'text':
        case 'physical':
        case 'age_range':
          data[f.key] = v ?? '';
          break;
        case 'key_value': {
          const rec: Record<string, string> = {};
          for (const row of (v as { key: string; value: string }[]) ?? []) {
            if (row.key?.trim() && row.value?.trim())
              rec[row.key.trim()] = row.value.trim();
          }
          data[f.key] = rec;
          break;
        }
      }
    }
    out[mkey] = data;
  }
  return out;
}

export function KategoriForm({
  slug,
  initialAttributes,
}: {
  slug: string;
  initialAttributes: Record<string, unknown>;
}) {
  const preset = getCategoryFields(slug)!;
  const moduleKeys = preset.modules.map((m) => m.key);
  // TEK-YER: quick bölümü preset.quickInfo'nun tamamını gösterir; türetilmiş anahtarlar
  // (boy/yaş/dil_cifti) zaten quickInfo'dan çıkarıldı, ilgili modüllerinde düzenlenir.
  const quickKeys = preset.quickInfo;

  const init = initialAttributes;
  const [serviceRegion, setServiceRegion] = useState(
    (init.service_region as string) ?? ''
  );
  const [experienceLabel, setExperienceLabel] = useState(
    (init.experience_label as string) ?? ''
  );
  // Çalışma şekli — ORTAK alan; yoksa eski quick.calisma_sekli'den OKU (tek yön, çift yazma yok).
  const [calismaSekli, setCalismaSekli] = useState(
    (init.calisma_sekli as string) ??
      ((init.quick as Record<string, string> | undefined)?.calisma_sekli ?? '')
  );
  // Etkinlik türleri — ORTAK alan (tüm kategoriler); ilanlar taksonomisi (EVENT_TYPES key'leri).
  const [etkinlikTurleri, setEtkinlikTurleri] = useState<string[]>(
    Array.isArray(init.etkinlik_turleri) ? (init.etkinlik_turleri as string[]) : []
  );
  const [logistics, setLogistics] = useState<Record<string, boolean>>(
    (init.logistics as Record<string, boolean>) ?? {}
  );
  const [skills, setSkills] = useState<{ name: string; level: number }[]>(
    (init.skills as { name: string; level: number }[]) ?? []
  );
  const [taglines, setTaglines] = useState<Record<string, string>>(
    (init.section_taglines as Record<string, string>) ?? {}
  );
  const [quick, setQuick] = useState<Record<string, string>>(
    (init.quick as Record<string, string>) ?? {}
  );
  const [modules, setModules] = useState<ModulesState>(() =>
    initModules(moduleKeys, (init.modules as Record<string, Rec>) ?? {})
  );
  const summaryInit = (init.summary as {
    title?: string;
    body?: string;
    stats?: string[];
  }) ?? {};
  const [summary, setSummary] = useState<{
    title: string;
    body: string;
    stats: string[];
  }>({
    title: summaryInit.title ?? '',
    body: summaryInit.body ?? '',
    stats: summaryInit.stats ?? [],
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setModuleField = (mkey: string, fkey: string, val: unknown) =>
    setModules((m) => ({ ...m, [mkey]: { ...(m[mkey] ?? {}), [fkey]: val } }));

  function handleSave() {
    setError(null);
    const payload: Record<string, unknown> = {
      service_region: serviceRegion,
      experience_label: experienceLabel,
      calisma_sekli: calismaSekli,
      etkinlik_turleri: etkinlikTurleri,
      logistics,
      skills,
      section_taglines: taglines,
      quick,
      modules: buildModulesPayload(moduleKeys, modules),
    };
    if (preset.archetype === 'uzmanlik') payload.summary = summary;

    startTransition(async () => {
      // Başarıda action /profil'e redirect eder (buraya normal result gelmez);
      // yalnız hata durumunu ele al — form sayfada kalır, state korunur.
      const result = await saveCategoryAttributes(payload);
      if (result && !result.success) setError(result.error ?? 'Kaydedilemedi.');
    });
  }

  const hasFiziksel = moduleKeys.includes('fiziksel');

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Cast fiziksel bilgilendirme (form başında, KVKK) */}
      {hasFiziksel && (
        <div className="bg-brand-ink/5 border border-brand-ink/15 rounded-xl px-5 py-4 text-[13px] text-ink-72 leading-relaxed">
          Bu alanlar isteğe bağlıdır ve beyanınıza dayanır; profilinizde
          &quot;Kullanıcı beyanı&quot; etiketiyle gösterilir.
        </div>
      )}

      {/* uzmanlik özet bandı */}
      {preset.archetype === 'uzmanlik' && (
        <section className={CARD}>
          <div className={EYEBROW}>Özet</div>
          <p className="text-[13px] text-ink-72 mt-1 mb-4">
            Public profilinde medya yerine gösterilecek kısa tanıtım.
          </p>
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Başlık</label>
              <input
                value={summary.title}
                onChange={(e) => setSummary((s) => ({ ...s, title: e.target.value }))}
                maxLength={100}
                className={INPUT}
                placeholder="Tek cümlelik başlık"
              />
            </div>
            <div>
              <label className={LABEL}>Metin (2-3 cümle)</label>
              <textarea
                value={summary.body}
                onChange={(e) => setSummary((s) => ({ ...s, body: e.target.value }))}
                maxLength={600}
                rows={3}
                className={`${INPUT} resize-none`}
              />
            </div>
            <StatsEditor
              stats={summary.stats}
              onChange={(stats) => setSummary((s) => ({ ...s, stats }))}
            />
          </div>
        </section>
      )}

      {/* Hızlı bilgiler (quickInfo) */}
      {quickKeys.length > 0 && (
        <section className={CARD}>
          <div className={EYEBROW}>Hızlı Bilgiler</div>
          <p className="text-[13px] text-ink-72 mt-1 mb-4">
            Hakkımda bölümünün altında özetlenen bilgiler.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickKeys.map((k) => (
              <QuickField
                key={k}
                slug={slug}
                fieldKey={k}
                label={getQuickLabel(preset, k)}
                value={quick[k] ?? ''}
                onChange={(v) => setQuick((q) => ({ ...q, [k]: v }))}
              />
            ))}
          </div>
        </section>
      )}

      {/* D1 — Bölüm sloganları (Özet/Hızlı bilgilerden hemen sonra; katlanır DEĞİL) */}
      <section className={CARD}>
        <div className={EYEBROW}>Bölüm sloganları</div>
        <p className="text-[13px] text-ink-72 mt-1 mb-4">
          Bölüm başlıklarının altında görünen vitrin cümleleri — profilini
          listeden ayıran satırlar.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(
            [
              ['hakkimda', 'Hakkımda'],
              ['hizmetler', 'Hizmetler'],
              ['deneyim', 'Deneyim'],
              ['egitim', 'Eğitim'],
            ] as const
          ).map(([k, label]) => (
            <div key={k}>
              <label className={LABEL}>{label}</label>
              <input
                value={taglines[k] ?? ''}
                onChange={(e) => setTaglines((t) => ({ ...t, [k]: e.target.value }))}
                maxLength={200}
                className={INPUT}
                placeholder={ARCHETYPE_TAGLINE_EXAMPLES[preset.archetype]?.[k]}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Ortak alanlar */}
      <section className={CARD}>
        <div className={EYEBROW}>Genel</div>
        <div className="space-y-4 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Hizmet bölgesi</label>
              <select
                value={serviceRegion}
                onChange={(e) => setServiceRegion(e.target.value)}
                className={INPUT}
              >
                <option value="">Belirtilmemiş</option>
                {SERVICE_REGION_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Çalışma şekli</label>
              <select
                value={calismaSekli}
                onChange={(e) => setCalismaSekli(e.target.value)}
                className={INPUT}
              >
                <option value="">Belirtilmemiş</option>
                {CALISMA_SEKLI_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Deneyim</label>
              <input
                value={experienceLabel}
                onChange={(e) => setExperienceLabel(e.target.value)}
                maxLength={120}
                placeholder="örn. 6 yıl · 150+ etkinlik"
                className={INPUT}
              />
              <p className="text-[11px] text-ink-72/70 mt-1">
                Süre + iş kalıbı yaz (rail&apos;de tek satır gösterilir); çıplak sayı girme.
              </p>
            </div>
          </div>

          {/* Etkinlik türleri — ORTAK çoklu çip (ilanlar taksonomisi; Keşfet filtresine bağlı) */}
          <div>
            <label className={LABEL}>Hizmet verdiğin etkinlik türleri</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((et) => {
                const on = etkinlikTurleri.includes(et.key);
                return (
                  <button
                    key={et.key}
                    type="button"
                    onClick={() =>
                      setEtkinlikTurleri((prev) =>
                        prev.includes(et.key)
                          ? prev.filter((k) => k !== et.key)
                          : [...prev, et.key]
                      )
                    }
                    className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors ${
                      on
                        ? 'bg-brand-ink text-white border-brand-ink'
                        : 'bg-card text-ink-72 border-line hover:border-brand-ink'
                    }`}
                  >
                    {et.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink-72/70 mt-1.5">
              Keşfet&apos;te etkinlik türüne göre filtrelenirsin.
            </p>
          </div>

          {preset.logisticsChecks.length > 0 && (
            <div>
              <label className={LABEL}>Lojistik</label>
              <div className="flex flex-col gap-2">
                {preset.logisticsChecks.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-start gap-2.5 text-sm text-ink cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!logistics[c.key]}
                      onChange={(e) =>
                        setLogistics((l) => ({ ...l, [c.key]: e.target.checked }))
                      }
                      className="mt-0.5 accent-brand-ink w-4 h-4"
                    />
                    <span>
                      <span className="font-medium">{c.label}</span>
                      <span className="text-ink-72"> — {c.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <SkillsEditor
            skills={skills}
            withLevels={preset.skillsWithLevels}
            onChange={setSkills}
          />
        </div>
      </section>

      {/* Kategori modülleri */}
      {preset.modules.map((ref) => {
        const def = MODULE_REGISTRY[ref.key];
        const fields = def.fields.filter((f) => f.type !== 'documents');
        if (fields.length === 0) return null;
        return (
          <section key={ref.key} className={CARD}>
            <div className={EYEBROW}>{getModuleTitle(ref)}</div>
            {ref.key === 'diller_belgeler' && (
              <p className="text-[12px] text-ink-72/80 mt-1">
                Belge yükleme ve doğrulama süreci ayrıca yapılacak — burada yalnız
                dilleri eklersin.
              </p>
            )}
            <div className="space-y-4 mt-3">
              {fields.map((f) => (
                <ModuleField
                  key={f.key}
                  type={f.type}
                  label={preset.labelOverrides?.[f.key] ?? f.label}
                  note={f.note}
                  example={getFieldExample(slug, f)}
                  options={f.options}
                  allowCustom={f.allowCustom}
                  suggestions={
                    f.type === 'key_value'
                      ? CATEGORY_PARAM_SUGGESTIONS[slug]?.[f.key]
                      : undefined
                  }
                  value={modules[ref.key]?.[f.key]}
                  onChange={(v) => setModuleField(ref.key, f.key, v)}
                />
              ))}
            </div>
          </section>
        );
      })}


      {/* Sabit kaydet çubuğu */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-line px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm">
            {error && <span className="text-danger">{error}</span>}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="px-6 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] disabled:opacity-50 transition-all"
          >
            {isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick alanı — getQuickInput ile select / çoklu-çip / serbest metin ───
function QuickField({
  slug,
  fieldKey,
  label,
  value,
  onChange,
}: {
  slug: string;
  fieldKey: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const input = getQuickInput(slug, fieldKey);

  if (input.kind === 'multi') {
    return (
      <MultiChipField
        label={label}
        value={value}
        options={input.options}
        allowCustom={input.allowCustom}
        onChange={onChange}
      />
    );
  }

  if (input.kind === 'select') {
    return (
      <div>
        <label className={LABEL}>{label}</label>
        <select value={value} onChange={(e) => onChange(e.target.value)} className={INPUT}>
          <option value="">Belirtilmemiş</option>
          {input.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={120}
        className={INPUT}
      />
    </div>
  );
}

// ─── Çoklu-çip alanı (ceviri/enstruman/etkinlik) — değerler " · " ile birleşir ───
function MultiChipField({
  label,
  value,
  options,
  allowCustom,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  allowCustom: boolean;
  onChange: (v: string) => void;
}) {
  const [custom, setCustom] = useState('');
  const selected = value ? value.split('·').map((s) => s.trim()).filter(Boolean) : [];
  const commit = (arr: string[]) => onChange(arr.join(' · '));
  const toggle = (opt: string) =>
    commit(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  const addCustom = () => {
    const t = custom.trim();
    if (t && !selected.includes(t)) commit([...selected, t]);
    setCustom('');
  };
  const customChips = selected.filter((s) => !options.includes(s));

  const chip = (opt: string, on: boolean) => (
    <button
      key={opt}
      type="button"
      onClick={() => toggle(opt)}
      className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors ${
        on
          ? 'bg-brand-ink text-white border-brand-ink'
          : 'bg-card text-ink-72 border-line hover:border-brand-ink'
      }`}
    >
      {opt}
      {on && allowCustom && !options.includes(opt) ? ' ×' : ''}
    </button>
  );

  return (
    <div className="md:col-span-2">
      <label className={LABEL}>{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => chip(opt, selected.includes(opt)))}
        {allowCustom && customChips.map((opt) => chip(opt, true))}
      </div>
      {allowCustom && (
        <div className="flex items-center gap-2 mt-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Başka bir seçenek ekle"
            maxLength={40}
            className={INPUT}
          />
          <AddBtn label="Ekle" onClick={addCustom} />
        </div>
      )}
    </div>
  );
}

// ─── Modül alanı (tipe göre kontrol) ───
function ModuleField({
  type,
  label,
  note,
  example,
  options,
  allowCustom,
  suggestions,
  value,
  onChange,
}: {
  type: string;
  label: string;
  note?: string;
  example?: string;
  options?: readonly string[];
  allowCustom?: boolean;
  suggestions?: string[];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const labelEl = (
    <label className={LABEL}>
      {label}
      {note && <span className="ml-2 normal-case tracking-normal text-ink-72/70 text-[11px]">· {note}</span>}
    </label>
  );

  if (type === 'chips' || type === 'bullet_list') {
    const arr = (value as string[]) ?? [];
    const multiline = type !== 'chips';
    const sep = multiline ? '\n' : ', ';
    const display = arr.join(sep);
    const onText = (t: string) =>
      onChange(
        (multiline ? t.split('\n') : t.split(',')).map((s) => s.replace(/^\s+/, ''))
      );
    return (
      <div>
        {labelEl}
        {multiline ? (
          <textarea
            value={display}
            onChange={(e) => onText(e.target.value)}
            rows={3}
            placeholder={example ?? 'Her satıra bir madde'}
            className={`${INPUT} resize-none`}
          />
        ) : (
          <input
            value={display}
            onChange={(e) => onText(e.target.value)}
            placeholder={example ? `Virgülle ayır: ${example}` : 'Virgülle ayır'}
            className={INPUT}
          />
        )}
      </div>
    );
  }

  // C3 — Diller: tercüman'da çeviri yönü ("TR ↔ EN"), diğerlerinde tek dil ("Türkçe").
  // Placeholder + etiket kategoriye göre example'dan türetilir.
  if (type === 'language_pairs') {
    const arr = (value as string[]) ?? [];
    const isPair = (example ?? '').includes('↔');
    const ph = example ? example.split(',')[0].trim() : 'Türkçe';
    const update = (i: number, v: string) =>
      onChange(arr.map((x, idx) => (idx === i ? v : x)));
    return (
      <div>
        {labelEl}
        <p className="text-[11px] text-ink-72/70 mb-2">
          {isPair ? 'Her satır bir çeviri yönü — örn. TR ↔ EN.' : 'Her satıra bir dil ekle.'}
        </p>
        <div className="flex flex-col gap-2">
          {arr.map((pair, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={pair}
                onChange={(e) => update(i, e.target.value)}
                placeholder={ph}
                maxLength={80}
                className={`${INPUT} flex-1`}
              />
              <RemoveBtn onClick={() => onChange(arr.filter((_, idx) => idx !== i))} />
            </div>
          ))}
          <AddBtn
            label={isPair ? 'Dil çifti ekle' : 'Dil ekle'}
            onClick={() => onChange([...arr, ''])}
          />
        </div>
      </div>
    );
  }

  if (type === 'text') {
    return (
      <div>
        {labelEl}
        <textarea
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={example}
          className={`${INPUT} resize-none`}
        />
      </div>
    );
  }

  if (type === 'physical') {
    const cur = (value as string) ?? '';
    // hair/eyes → select; hair ayrıca serbest giriş (datalist). Boy/Beden/Ayak serbest metin.
    if (options && options.length > 0) {
      if (allowCustom) {
        const listId = `dl-${label}`;
        return (
          <div>
            {labelEl}
            <input
              value={cur}
              onChange={(e) => onChange(e.target.value)}
              list={listId}
              maxLength={60}
              placeholder={example ?? 'Seç ya da yaz'}
              className={INPUT}
            />
            <datalist id={listId}>
              {options.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
        );
      }
      return (
        <div>
          {labelEl}
          <select
            value={cur}
            onChange={(e) => onChange(e.target.value)}
            className={INPUT}
          >
            <option value="">Belirtilmemiş</option>
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div>
        {labelEl}
        <input
          value={cur}
          onChange={(e) => onChange(e.target.value)}
          maxLength={60}
          placeholder={example}
          className={INPUT}
        />
      </div>
    );
  }

  // Yaş ARALIĞI — iki sayı (min–max); kesin yaş YOK. Fiziksel modülünde.
  if (type === 'age_range') {
    const raw = (value as string) ?? '';
    const [min, max] = raw.split(/[–-]/).map((s) => s.trim());
    const set = (lo: string, hi: string) =>
      onChange(lo || hi ? `${lo || ''}–${hi || ''}` : '');
    return (
      <div>
        {labelEl}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={min ?? ''}
            onChange={(e) => set(e.target.value, max ?? '')}
            placeholder="Alt"
            className={INPUT}
          />
          <span className="text-ink-72">–</span>
          <input
            type="number"
            min={0}
            value={max ?? ''}
            onChange={(e) => set(min ?? '', e.target.value)}
            placeholder="Üst"
            className={INPUT}
          />
        </div>
      </div>
    );
  }

  if (type === 'key_value') {
    const rows = (value as { key: string; value: string }[]) ?? [];
    const update = (i: number, patch: Partial<{ key: string; value: string }>) =>
      onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    // C4 — kullanılmamış önerilen etiketler (tek tıkla satır ekler)
    const usedKeys = rows.map((r) => r.key.trim());
    const openSuggestions = (suggestions ?? []).filter((s) => !usedKeys.includes(s));
    return (
      <div>
        {labelEl}
        {openSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {openSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange([...rows, { key: s, value: '' }])}
                className="px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-brand-ink/5 border border-brand-ink/20 text-brand-ink hover:bg-brand-ink/10 transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={r.key}
                onChange={(e) => update(i, { key: e.target.value })}
                placeholder="örn. Minimum süre"
                className={`${INPUT} flex-1`}
              />
              <input
                value={r.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="örn. Yarım gün"
                className={`${INPUT} flex-1`}
              />
              <RemoveBtn onClick={() => onChange(rows.filter((_, idx) => idx !== i))} />
            </div>
          ))}
          <AddBtn label="Satır ekle" onClick={() => onChange([...rows, { key: '', value: '' }])} />
        </div>
      </div>
    );
  }

  if (type === 'social_reach') {
    const rows = (value as { platform: string; followers_range: string }[]) ?? [];
    const update = (
      i: number,
      patch: Partial<{ platform: string; followers_range: string }>
    ) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    return (
      <div>
        {labelEl}
        <p className="text-[11px] text-ink-72/70 mb-2">
          Yalnız platform + takipçi aralığı — bağlantı/kullanıcı adı istenmez.
        </p>
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={r.platform}
                onChange={(e) => update(i, { platform: e.target.value })}
                className={`${INPUT} flex-1`}
              >
                <option value="">Platform</option>
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={r.followers_range}
                onChange={(e) => update(i, { followers_range: e.target.value })}
                className={`${INPUT} flex-1`}
              >
                <option value="">Aralık</option>
                {FOLLOWERS_RANGES.map((fr) => (
                  <option key={fr} value={fr}>{fr}</option>
                ))}
              </select>
              <RemoveBtn onClick={() => onChange(rows.filter((_, idx) => idx !== i))} />
            </div>
          ))}
          <AddBtn
            label="Platform ekle"
            onClick={() => onChange([...rows, { platform: '', followers_range: '' }])}
          />
        </div>
      </div>
    );
  }

  return null;
}

// ─── Yetenekler ───
function SkillsEditor({
  skills,
  withLevels,
  onChange,
}: {
  skills: { name: string; level: number }[];
  withLevels: boolean;
  onChange: (s: { name: string; level: number }[]) => void;
}) {
  const update = (i: number, patch: Partial<{ name: string; level: number }>) =>
    onChange(skills.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  return (
    <div>
      <label className={LABEL}>Yetenekler</label>
      <div className="flex flex-col gap-2">
        {skills.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={s.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Yetenek adı"
              maxLength={60}
              className={`${INPUT} flex-1 min-w-0`}
            />
            {withLevels && (
              <select
                value={s.level || ''}
                onChange={(e) => update(i, { level: Number(e.target.value) })}
                className={`${INPUT} w-36 shrink-0`}
              >
                <option value="">Seviye (opsiyonel)</option>
                {SKILL_LEVELS.map((lv) => (
                  <option key={lv.value} value={lv.value}>{lv.label}</option>
                ))}
              </select>
            )}
            <RemoveBtn onClick={() => onChange(skills.filter((_, idx) => idx !== i))} />
          </div>
        ))}
        <AddBtn
          label="Yetenek ekle"
          onClick={() => onChange([...skills, { name: '', level: 0 }])}
        />
      </div>
    </div>
  );
}

// ─── Stat çipleri (uzmanlik, max 3) — C1: TEK metin input ───
function StatsEditor({
  stats,
  onChange,
}: {
  stats: string[];
  onChange: (s: string[]) => void;
}) {
  const update = (i: number, v: string) =>
    onChange(stats.map((s, idx) => (idx === i ? v : s)));
  return (
    <div>
      <label className={LABEL}>İstatistik çipleri (en fazla 3)</label>
      <div className="flex flex-col gap-2">
        {stats.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={s}
              onChange={(e) => update(i, e.target.value)}
              placeholder="örn. 300+ konferans"
              maxLength={60}
              className={`${INPUT} flex-1`}
            />
            <RemoveBtn onClick={() => onChange(stats.filter((_, idx) => idx !== i))} />
          </div>
        ))}
        {stats.length < 3 && (
          <AddBtn label="Çip ekle" onClick={() => onChange([...stats, ''])} />
        )}
      </div>
    </div>
  );
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start inline-flex items-center gap-1.5 text-sm font-display font-semibold text-brand-ink hover:text-brand-ink-deep transition-colors"
    >
      <span className="text-base leading-none">+</span> {label}
    </button>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-ink-72 hover:text-danger transition-colors p-1"
      aria-label="Kaldır"
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
