'use client';

import { useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { ProfileExperience, ExperienceGroup } from '@/app/lib/category-fields';
import {
  createExperience,
  updateExperience,
  deleteExperience,
  moveExperience,
  type ExperienceKind,
  type ExperienceFormData,
} from './actions';

const INPUT =
  'w-full px-4 py-3 bg-card border border-line rounded-lg text-ink placeholder:text-ink-72/50 focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition text-sm';
const LABEL =
  'block text-xs font-mono uppercase tracking-[0.16em] text-ink-72 mb-2';

const SECTIONS: {
  kind: ExperienceKind;
  title: string;
  description: string;
  empty: string;
  addLabel: string;
}[] = [
  {
    kind: 'work',
    title: 'İş Deneyimi',
    description: 'Sahne, kurumsal, festival — çalıştığın işler.',
    empty: 'Henüz iş deneyimi eklemedin.',
    addLabel: 'İş deneyimi ekle',
  },
  {
    kind: 'education',
    title: 'Eğitim & Sertifikalar',
    description: 'Aldığın eğitimler, kurslar, sertifikalar.',
    empty: 'Henüz eğitim/sertifika eklemedin.',
    addLabel: 'Eğitim ekle',
  },
  {
    kind: 'award',
    title: 'Ödüller',
    description: 'Kazandığın ödüller, dereceler.',
    empty: 'Henüz ödül eklemedin.',
    addLabel: 'Ödül ekle',
  },
];

type FormState = {
  kind: ExperienceKind;
  row: ProfileExperience | null; // null → ekleme
};

export function DeneyimClient({
  experiences,
  workGroups,
  archetype,
}: {
  experiences: ProfileExperience[];
  workGroups: ExperienceGroup[];
  archetype: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isMoving, startMove] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const byKind = (k: ExperienceKind) =>
    experiences
      .filter((e) => e.kind === k)
      .sort((a, b) => a.sort_order - b.sort_order);

  function handleMove(id: string, direction: 'up' | 'down') {
    startMove(async () => {
      await moveExperience(id, direction);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startDelete(async () => {
      await deleteExperience(id);
      setConfirmId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-10">
      {SECTIONS.map((section) => {
        const rows = byKind(section.kind);
        return (
          <section key={section.kind}>
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h2 className="font-display font-semibold text-xl text-ink">
                  {section.title}{' '}
                  <span className="text-ink-72 text-lg">({rows.length})</span>
                </h2>
                <p className="text-sm text-ink-72 mt-0.5">{section.description}</p>
              </div>
              {rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setForm({ kind: section.kind, row: null })}
                  className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-terracotta text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
                >
                  <span className="text-base leading-none">+</span> Ekle
                </button>
              )}
            </div>

            {rows.length === 0 ? (
              // B6 — boş durum: ikon + tek cümle + mercan aksiyon linki
              <div className="bg-card border border-line rounded-xl p-8 text-center">
                <div className="w-11 h-11 rounded-full bg-terracotta/8 flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <p className="text-ink-72 text-sm mb-3">{section.empty}</p>
                <button
                  type="button"
                  onClick={() => setForm({ kind: section.kind, row: null })}
                  className="font-display font-semibold text-sm text-terracotta hover:text-ember transition-colors"
                >
                  İlk kaydını ekle →
                </button>
              </div>
            ) : (
              <div className="bg-card border border-line rounded-xl px-5">
                {rows.map((row, i) => {
                  const orgText = [row.organization, row.location]
                    .filter(Boolean)
                    .join(', ');
                  const meta = [row.period_label, orgText].filter(Boolean).join(' · ');
                  const groupLabel =
                    section.kind === 'work' && row.group_key
                      ? workGroups.find((g) => g.key === row.group_key)?.label ??
                        'Diğer'
                      : null;
                  return (
                    <div
                      key={row.id}
                      className="flex items-start gap-3 py-4 border-b border-line last:border-0"
                    >
                      <div className="flex flex-col gap-1 pt-0.5">
                        <button
                          type="button"
                          disabled={i === 0 || isMoving}
                          onClick={() => handleMove(row.id, 'up')}
                          className="text-ink-72 hover:text-terracotta disabled:opacity-25 disabled:hover:text-ink-72 transition-colors"
                          aria-label="Yukarı taşı"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                        </button>
                        <button
                          type="button"
                          disabled={i === rows.length - 1 || isMoving}
                          onClick={() => handleMove(row.id, 'down')}
                          className="text-ink-72 hover:text-terracotta disabled:opacity-25 disabled:hover:text-ink-72 transition-colors"
                          aria-label="Aşağı taşı"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-semibold text-ink">{row.title}</span>
                          {groupLabel && (
                            <span className="font-mono text-[9px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border border-terracotta/30 text-terracotta bg-terracotta/5">
                              {groupLabel}
                            </span>
                          )}
                        </div>
                        {row.subtitle && (
                          <div className="text-sm text-ink-72 mt-0.5">{row.subtitle}</div>
                        )}
                        {meta && (
                          <div className="text-xs text-ink-72 mt-1 font-mono">{meta}</div>
                        )}
                        {row.description && (
                          <p className="text-sm text-ink-72 leading-relaxed mt-1.5">{row.description}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {confirmId === row.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id)}
                              disabled={isDeleting}
                              className="text-xs font-mono uppercase tracking-[0.12em] text-terracotta border border-terracotta rounded px-2.5 py-1.5 hover:bg-terracotta hover:text-paper transition-colors disabled:opacity-50"
                            >
                              {isDeleting ? '...' : 'Evet, sil'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              disabled={isDeleting}
                              className="text-xs font-mono uppercase tracking-[0.12em] text-ink-72 hover:text-ink transition-colors"
                            >
                              Vazgeç
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setForm({ kind: section.kind, row })}
                              className="text-xs font-mono uppercase tracking-[0.12em] text-ink-72 hover:text-terracotta transition-colors"
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(row.id)}
                              className="text-xs font-mono uppercase tracking-[0.12em] text-ink-72 hover:text-danger transition-colors"
                            >
                              Sil
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {form && (
        <ExperienceModal
          kind={form.kind}
          row={form.row}
          workGroups={workGroups}
          archetype={archetype}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

const KIND_TITLES: Record<ExperienceKind, string> = {
  work: 'İş Deneyimi',
  education: 'Eğitim / Sertifika',
  award: 'Ödül',
};

// A4 — arketipe göre örnek başlık/kurum/ödül placeholder'ları.
const EXP_EXAMPLES: Record<
  string,
  { work: string; education: string; award: string; org: string; subtitle: string }
> = {
  sahne: { work: 'Rezidan DJ', education: 'Ses Mühendisliği Sertifikası', award: 'Yılın Çıkış DJ’i — Local Beats Awards', org: 'Klein Garten', subtitle: 'Haftalık set' },
  cast: { work: 'Ana rol / Defile', education: 'Oyunculuk Atölyesi', award: 'En İyi Yeni Yüz — Fashion TV Model Awards', org: 'XYZ Ajans / Vogue TR', subtitle: 'Kampanya / sezon' },
  produksiyon: { work: 'Düğün & Etkinlik Çekimi', education: 'Fotoğrafçılık Sertifikası', award: 'Yılın Düğün Fotoğrafçısı', org: 'Studio Işık', subtitle: 'Proje / seri' },
  uzmanlik: { work: 'Konferans Çevirmeni', education: 'Mütercim-Tercümanlık Lisansı', award: 'Yılın Çevirmeni', org: 'TÜYAP / Kurumsal', subtitle: 'Görev / dönem' },
};
const DEFAULT_EXP = EXP_EXAMPLES.sahne;

function ExperienceModal({
  kind,
  row,
  workGroups,
  archetype,
  onClose,
  onSaved,
}: {
  kind: ExperienceKind;
  row: ProfileExperience | null;
  workGroups: ExperienceGroup[];
  archetype: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(row?.title ?? '');
  const [subtitle, setSubtitle] = useState(row?.subtitle ?? '');
  const [organization, setOrganization] = useState(row?.organization ?? '');
  const [location, setLocation] = useState(row?.location ?? '');
  const [periodLabel, setPeriodLabel] = useState(row?.period_label ?? '');
  const [description, setDescription] = useState(row?.description ?? '');
  const [groupKey, setGroupKey] = useState(row?.group_key ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ex = EXP_EXAMPLES[archetype ?? ''] ?? DEFAULT_EXP;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const data: ExperienceFormData = {
      kind,
      group_key: kind === 'work' ? (groupKey || null) : null,
      title,
      subtitle: subtitle || null,
      organization: organization || null,
      location: location || null,
      period_label: periodLabel || null,
      description: description || null,
    };
    startTransition(async () => {
      const result = row
        ? await updateExperience(row.id, data)
        : await createExperience(data);
      if (result.success) onSaved();
      else setError(result.error ?? 'Bir hata oluştu.');
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" aria-hidden="true" />
      <div
        className="relative bg-paper rounded-lg shadow-xl max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-line px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-display text-xl text-ink">
            {row ? 'Düzenle' : 'Ekle'} ·{' '}
            <em className="text-terracotta not-italic italic font-medium">
              {KIND_TITLES[kind]}
            </em>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-72 hover:text-ink p-2 -mr-2 transition-colors"
            aria-label="Kapat"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="exp-title" className={LABEL}>
              Başlık <span className="text-danger">*</span>
            </label>
            <input
              id="exp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              placeholder={kind === 'work' ? ex.work : kind === 'education' ? ex.education : ex.award}
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="exp-subtitle" className={LABEL}>Alt başlık</label>
            <input
              id="exp-subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              maxLength={150}
              placeholder={ex.subtitle}
              className={INPUT}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="exp-org" className={LABEL}>Kurum / Mekan</label>
              <input
                id="exp-org"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                maxLength={150}
                placeholder={ex.org}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="exp-loc" className={LABEL}>Konum</label>
              <input
                id="exp-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={120}
                placeholder="İstanbul"
                className={INPUT}
              />
            </div>
          </div>

          <div className={kind === 'work' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
            <div>
              <label htmlFor="exp-period" className={LABEL}>Dönem</label>
              <input
                id="exp-period"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                maxLength={80}
                placeholder="2022 – halen / Mayıs 2026"
                className={INPUT}
              />
            </div>
            {kind === 'work' && (
              <div>
                <label htmlFor="exp-group" className={LABEL}>Grup</label>
                <select
                  id="exp-group"
                  value={groupKey}
                  onChange={(e) => setGroupKey(e.target.value)}
                  className={INPUT}
                >
                  {workGroups.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                  <option value="">Diğer</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="exp-desc" className={LABEL}>Açıklama (opsiyonel)</label>
            <textarea
              id="exp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Kısa bir açıklama…"
              className={`${INPUT} resize-none`}
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-danger-08 border border-danger/30 rounded-lg text-sm text-danger">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-5 py-2.5 text-ink-72 hover:text-ink font-display font-medium transition-colors disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isPending || title.trim().length === 0}
              className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isPending ? 'Kaydediliyor…' : row ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
