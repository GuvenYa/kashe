'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { recommendProfessionals, type ProMatch } from '@/app/lib/ai-actions';

type Props = {
  categories: { slug: string; name_tr: string }[];
  cities: { id: number; name: string }[];
};

export function ProBulClient({ categories, cities }: Props) {
  const [categorySlug, setCategorySlug] = useState('');
  const [cityId, setCityId] = useState('');
  const [requirement, setRequirement] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ProMatch[] | null>(null);

  async function handleRecommend() {
    setError(null);
    setMatches(null);
    if (!categorySlug) {
      setError('Önce bir kategori seç.');
      return;
    }
    setLoading(true);
    const res = await recommendProfessionals({
      categorySlug,
      cityId: cityId ? parseInt(cityId, 10) : null,
      requirement: requirement.trim(),
    });
    if (res.success) {
      setMatches(res.matches);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }

  const inputClass =
    'w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition';

  return (
    <div>
      <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
        {/* Kategori */}
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
            Kategori <span className="text-danger">*</span>
          </label>
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className={inputClass}
          >
            <option value="">Kategori seç</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name_tr}
              </option>
            ))}
          </select>
        </div>

        {/* Şehir (opsiyonel) */}
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
            Şehir (opsiyonel)
          </label>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className={inputClass}
          >
            <option value="">Tüm şehirler</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Talep */}
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 block mb-2">
            Nasıl bir profesyonel arıyorsun?
          </label>
          <textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            rows={4}
            maxLength={800}
            placeholder="Örn: Düğünümüz için samimi, enerjik, hem Türkçe hem yabancı repertuvara hakim bir DJ arıyorum. Modern ve kaliteli bir ses sistemi getirebilmeli."
            className={`${inputClass} resize-none`}
          />
          <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
            <span className="text-[11px] text-ink-72 font-mono">
              {requirement.length}/800
            </span>
            <button
              type="button"
              onClick={handleRecommend}
              disabled={loading || !categorySlug || requirement.trim().length < 10}
              className="kashe-tap inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-terracotta text-paper font-display font-semibold text-sm hover:bg-ember transition disabled:opacity-50"
            >
              <Sparkles size={16} />
              {loading ? 'Aranıyor…' : 'Profesyonel öner'}
            </button>
          </div>
          {error && <p className="text-sm text-danger mt-2">{error}</p>}
        </div>
      </div>

      {/* Sonuç */}
      {matches && (
        <div className="mt-8">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-4">
            Senin için önerilenler
          </p>

          <div className="space-y-3">
            {matches.map((m) => (
              <Link
                key={m.id}
                href={`/p/${m.id}`}
                className="kashe-tap group block bg-card border border-line rounded-xl p-4 hover:border-terracotta transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-ink mb-1">
                      {m.name}
                    </p>
                    {m.reason && (
                      <p className="text-sm text-ink-72 leading-relaxed">
                        {m.reason}
                      </p>
                    )}
                  </div>
                  <ArrowRight
                    size={18}
                    className="shrink-0 mt-1 text-ink-72 group-hover:text-terracotta transition"
                  />
                </div>
              </Link>
            ))}
          </div>

          <p className="text-[11px] text-ink-72 mt-5 leading-relaxed">
            Bu öneriler yapay zekâ tarafından, yayındaki profiller arasından
            hazırlanmıştır. Yalnızca yol gösterme amaçlıdır; profillerini
            incelemeni öneririz.
          </p>
        </div>
      )}
    </div>
  );
}