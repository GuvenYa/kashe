'use client';

import { useState, useTransition } from 'react';
import {
  getCategoryFields,
  getModuleTitle,
  MODULE_REGISTRY,
  SERVICE_REGION_OPTIONS,
  FOLLOWERS_RANGES,
  SKILL_LEVELS,
  QUICK_LABELS,
  type ModuleKey,
} from '@/app/lib/category-fields';
import { saveCategoryAttributes } from './actions';

const INPUT =
  'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition text-sm';
const LABEL = 'block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2';
const EYEBROW = 'font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-terracotta';
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
  // 'deneyim' quick alanı experience_label'dan TÜRETİLİR → formda ayrı girdi gösterme.
  const quickKeys = preset.quickInfo.filter((k) => k !== 'deneyim');

  const init = initialAttributes;
  const [serviceRegion, setServiceRegion] = useState(
    (init.service_region as string) ?? ''
  );
  const [experienceLabel, setExperienceLabel] = useState(
    (init.experience_label as string) ?? ''
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
    stats?: { label: string; value: string }[];
  }) ?? {};
  const [summary, setSummary] = useState({
    title: summaryInit.title ?? '',
    body: summaryInit.body ?? '',
    stats: summaryInit.stats ?? [],
  });

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setModuleField = (mkey: string, fkey: string, val: unknown) =>
    setModules((m) => ({ ...m, [mkey]: { ...(m[mkey] ?? {}), [fkey]: val } }));

  function handleSave() {
    setError(null);
    const payload: Record<string, unknown> = {
      service_region: serviceRegion,
      experience_label: experienceLabel,
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
        <div className="bg-terracotta/5 border border-terracotta/15 rounded-xl px-5 py-4 text-[13px] text-ink-72 leading-relaxed">
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
                fieldKey={k}
                label={QUICK_LABELS[k] ?? k}
                value={quick[k] ?? ''}
                onChange={(v) => setQuick((q) => ({ ...q, [k]: v }))}
              />
            ))}
          </div>
        </section>
      )}

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
              <label className={LABEL}>Deneyim</label>
              <input
                value={experienceLabel}
                onChange={(e) => setExperienceLabel(e.target.value)}
                maxLength={120}
                placeholder="9 yıl · 400+ etkinlik"
                className={INPUT}
              />
            </div>
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
                      className="mt-0.5 accent-terracotta w-4 h-4"
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
                dil çiftlerini düzenlersin.
              </p>
            )}
            <div className="space-y-4 mt-3">
              {fields.map((f) => (
                <ModuleField
                  key={f.key}
                  type={f.type}
                  label={f.label}
                  note={f.note}
                  value={modules[ref.key]?.[f.key]}
                  onChange={(v) => setModuleField(ref.key, f.key, v)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Gelişmiş — section taglines (katlanır) */}
      <section className={CARD}>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="w-full flex items-center justify-between"
        >
          <span className={EYEBROW}>Gelişmiş — Bölüm başlıkları</span>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-ink-72 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {advancedOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {(
              [
                ['hakkimda', 'Hakkımda tagline'],
                ['hizmetler', 'Hizmetler tagline'],
                ['deneyim', 'Deneyim tagline'],
                ['egitim', 'Eğitim tagline'],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <label className={LABEL}>{label}</label>
                <input
                  value={taglines[k] ?? ''}
                  onChange={(e) =>
                    setTaglines((t) => ({ ...t, [k]: e.target.value }))
                  }
                  maxLength={200}
                  className={INPUT}
                  placeholder="Kısa başlık"
                />
              </div>
            ))}
          </div>
        )}
      </section>

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
            className="px-6 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] disabled:opacity-50 transition-all"
          >
            {isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick alanı (yaş aralığı özel: iki sayı) ───
function QuickField({
  fieldKey,
  label,
  value,
  onChange,
}: {
  fieldKey: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  if (fieldKey === 'oynayabildigi_yas_araligi') {
    const [min, max] = value.split(/[–-]/).map((s) => s.trim());
    const set = (lo: string, hi: string) =>
      onChange(lo || hi ? `${lo || ''}–${hi || ''}` : '');
    return (
      <div>
        <label className={LABEL}>{label}</label>
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

// ─── Modül alanı (tipe göre kontrol) ───
function ModuleField({
  type,
  label,
  note,
  value,
  onChange,
}: {
  type: string;
  label: string;
  note?: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const labelEl = (
    <label className={LABEL}>
      {label}
      {note && <span className="ml-2 normal-case tracking-normal text-ink-72/70 text-[11px]">· {note}</span>}
    </label>
  );

  if (type === 'chips' || type === 'bullet_list' || type === 'language_pairs') {
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
            placeholder={type === 'language_pairs' ? 'Her satıra bir çift: TR → EN' : 'Her satıra bir madde'}
            className={`${INPUT} resize-none`}
          />
        ) : (
          <input
            value={display}
            onChange={(e) => onText(e.target.value)}
            placeholder="Virgülle ayır: House, Techno, Deep House"
            className={INPUT}
          />
        )}
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
          className={`${INPUT} resize-none`}
        />
      </div>
    );
  }

  if (type === 'physical') {
    return (
      <div>
        {labelEl}
        <input
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          maxLength={60}
          className={INPUT}
        />
      </div>
    );
  }

  if (type === 'key_value') {
    const rows = (value as { key: string; value: string }[]) ?? [];
    const update = (i: number, patch: Partial<{ key: string; value: string }>) =>
      onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    return (
      <div>
        {labelEl}
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={r.key}
                onChange={(e) => update(i, { key: e.target.value })}
                placeholder="Etiket"
                className={`${INPUT} flex-1`}
              />
              <input
                value={r.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="Değer"
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
              <input
                value={r.platform}
                onChange={(e) => update(i, { platform: e.target.value })}
                placeholder="Instagram"
                className={`${INPUT} flex-1`}
              />
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
              placeholder="Beatmatching"
              maxLength={60}
              className={`${INPUT} flex-1`}
            />
            {withLevels && (
              <select
                value={s.level || ''}
                onChange={(e) => update(i, { level: Number(e.target.value) })}
                className={`${INPUT} w-28`}
              >
                <option value="">Seviye</option>
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

// ─── Stat çipleri (uzmanlik, max 3) ───
function StatsEditor({
  stats,
  onChange,
}: {
  stats: { label: string; value: string }[];
  onChange: (s: { label: string; value: string }[]) => void;
}) {
  const update = (i: number, patch: Partial<{ label: string; value: string }>) =>
    onChange(stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  return (
    <div>
      <label className={LABEL}>İstatistik çipleri (en fazla 3)</label>
      <div className="flex flex-col gap-2">
        {stats.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={s.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="400+"
              maxLength={40}
              className={`${INPUT} w-32`}
            />
            <input
              value={s.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="etkinlik"
              maxLength={40}
              className={`${INPUT} flex-1`}
            />
            <RemoveBtn onClick={() => onChange(stats.filter((_, idx) => idx !== i))} />
          </div>
        ))}
        {stats.length < 3 && (
          <AddBtn
            label="Çip ekle"
            onClick={() => onChange([...stats, { label: '', value: '' }])}
          />
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
      className="self-start inline-flex items-center gap-1.5 text-sm font-display font-semibold text-terracotta hover:text-ember transition-colors"
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
