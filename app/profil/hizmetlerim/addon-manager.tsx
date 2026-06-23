'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createAddon,
  updateAddon,
  deleteAddon,
  toggleAddonActive,
  type AddonFormData,
} from './addon-actions';
import type { ServiceAddon } from '@/app/lib/types';

type Props = {
  serviceId: string;
  addons: ServiceAddon[];
};

function parsePrice(s: string): number | null {
  const cleaned = s.trim().replace(/\./g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function formatPrice(price: number): string {
  return `₺${Math.round(price).toLocaleString('tr-TR')}`;
}

export function AddonManager({ serviceId, addons }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state (ekleme + düzenleme ortak)
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

  function resetForm() {
    setFormOpen(false);
    setEditingId(null);
    setTitle('');
    setPrice('');
    setDescription('');
    setError(null);
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(addon: ServiceAddon) {
    setEditingId(addon.id);
    setTitle(addon.title);
    setPrice(String(addon.price));
    setDescription(addon.description || '');
    setError(null);
    setFormOpen(true);
  }

  function handleSubmit() {
    setError(null);
    const parsedPrice = parsePrice(price);
    if (!title.trim()) {
      setError('Ekstra adı gerekli.');
      return;
    }
    if (parsedPrice === null) {
      setError('Geçerli bir fiyat gir (ücretsiz için 0).');
      return;
    }

    const data: AddonFormData = {
      service_id: serviceId,
      title: title.trim(),
      description: description.trim() || null,
      price: parsedPrice,
    };

    startTransition(async () => {
      const result = editingId
        ? await updateAddon(editingId, data)
        : await createAddon(data);
      if (result.success) {
        resetForm();
        router.refresh();
      } else {
        setError(result.error || 'Hata');
      }
    });
  }

  function handleDelete(addonId: string) {
    if (!confirm('Bu ekstrayı silmek istediğine emin misin?')) return;
    startTransition(async () => {
      const result = await deleteAddon(addonId);
      if (!result.success) setError(result.error || 'Hata');
      else router.refresh();
    });
  }

  function handleToggle(addon: ServiceAddon) {
    startTransition(async () => {
      const result = await toggleAddonActive(addon.id, !addon.is_active);
      if (!result.success) setError(result.error || 'Hata');
      else router.refresh();
    });
  }

  const sorted = [...addons].sort((a, b) => a.created_at && b.created_at
    ? a.created_at.localeCompare(b.created_at) : 0);

  return (
    <div className="mt-4 pt-4 border-t border-line/60">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
          Ekstralar {addons.length > 0 && `(${addons.length})`}
        </p>
        {!formOpen && (
          <button
            type="button"
            onClick={openCreate}
            className="text-xs text-terracotta hover:underline"
          >
            + Ekstra ekle
          </button>
        )}
      </div>

      {/* Mevcut ekstralar */}
      {sorted.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {sorted.map((addon) => (
            <div
              key={addon.id}
              className={`flex items-center gap-3 text-sm py-1.5 px-2.5 rounded-lg bg-paper ${
                addon.is_active ? '' : 'opacity-50'
              }`}
            >
              <span className="flex-1 min-w-0">
                <span className="text-ink truncate">{addon.title}</span>
                {addon.description && (
                  <span className="block text-[11px] text-ink-72 truncate">
                    {addon.description}
                  </span>
                )}
              </span>
              <span className="font-medium text-ink shrink-0">
                {addon.price > 0 ? `+${formatPrice(addon.price)}` : 'Ücretsiz'}
              </span>
              <span className="flex items-center gap-1.5 shrink-0 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleToggle(addon)}
                  disabled={isPending}
                  className="text-ink-72 hover:text-ink disabled:opacity-50"
                  title={addon.is_active ? 'Pasife al' : 'Aktife al'}
                >
                  {addon.is_active ? '◉' : '○'}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(addon)}
                  disabled={isPending}
                  className="text-ink hover:text-terracotta disabled:opacity-50"
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(addon.id)}
                  disabled={isPending}
                  className="text-ink-72 hover:text-terracotta disabled:opacity-50"
                >
                  Sil
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Ekle/düzenle formu (inline) */}
      {formOpen && (
        <div className="bg-paper rounded-lg p-3 space-y-2 border border-line">
          <div className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Ekstra adı (örn. Drone çekimi)"
              className="flex-1 px-3 py-2 bg-card border border-line rounded text-sm text-ink focus:outline-none focus:border-terracotta transition"
            />
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Fiyat ₺"
              className="w-28 px-3 py-2 bg-card border border-line rounded text-sm text-ink focus:outline-none focus:border-terracotta transition"
            />
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="Kısa açıklama (opsiyonel)"
            className="w-full px-3 py-2 bg-card border border-line rounded text-sm text-ink focus:outline-none focus:border-terracotta transition"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="text-xs px-3 py-1.5 bg-terracotta text-paper rounded font-medium hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? 'Kaydediliyor...' : editingId ? 'Kaydet' : 'Ekle'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isPending}
              className="text-xs text-ink-72 hover:text-ink disabled:opacity-50"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {!formOpen && addons.length === 0 && (
        <p className="text-xs text-ink-72/70 italic">
          Henüz ekstra yok. Drone, ek saat, ikinci kişi gibi opsiyonel hizmetler ekleyebilirsin.
        </p>
      )}

      {error && !formOpen && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}