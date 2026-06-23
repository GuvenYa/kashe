'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, Wallet, Lightbulb } from 'lucide-react';
import {
  analyzeEventNeeds,
  type EventNeedSuggestion,
} from '@/app/lib/ai-actions';

type Props = {
  categories: { slug: string; name_tr: string }[];
};

export function EtkinlikPlanlaClient({ categories }: Props) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    categories: EventNeedSuggestion[];
    budgetEstimate: string;
    tip: string;
  } | null>(null);

  async function handleAnalyze() {
    setError(null);
    setResult(null);
    setLoading(true);
    const res = await analyzeEventNeeds({
      eventDescription: description.trim(),
      categories,
    });
    if (res.success) {
      setResult({
        categories: res.categories,
        budgetEstimate: res.budgetEstimate,
        tip: res.tip,
      });
    } else {
      setError(res.error);
    }
    setLoading(false);
  }

  return (
    <div>
      {/* Giriş alanı */}
      <div className="bg-card border border-line rounded-2xl p-5">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Örn: Eylül ayında İstanbul'da 150 kişilik bir düğün yapıyoruz. Bahçe düğünü olacak, akşam başlayıp gece devam edecek. Hem fotoğraf hem eğlence tarafını düşünüyoruz."
          className="w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta-08 transition resize-none"
        />
        <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
          <span className="text-[11px] text-ink-72 font-mono">
            {description.length}/1000
          </span>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || description.trim().length < 10}
            className="kashe-tap inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-terracotta text-paper font-display font-semibold text-sm hover:bg-ember transition disabled:opacity-50"
          >
            <Sparkles size={16} />
            {loading ? 'Analiz ediliyor…' : 'Analiz et'}
          </button>
        </div>
        {error && <p className="text-sm text-danger mt-3">{error}</p>}
      </div>

      {/* Sonuç */}
      {result && (
        <div className="mt-8">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72 mb-4">
            Önerilen profesyoneller
          </p>

          <div className="space-y-3">
            {result.categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/kategori/${cat.slug}`}
                className="kashe-tap group block bg-card border border-line rounded-xl p-4 hover:border-terracotta transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-ink mb-1">
                      {cat.name}
                    </p>
                    {cat.reason && (
                      <p className="text-sm text-ink-72 leading-relaxed">
                        {cat.reason}
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

          {/* Bütçe */}
          {result.budgetEstimate && (
            <div className="mt-4 flex items-start gap-3 bg-card border border-line rounded-xl p-4">
              <Wallet size={18} className="shrink-0 mt-0.5 text-terracotta" />
              <div>
                <p className="font-display font-semibold text-ink text-sm mb-0.5">
                  Tahmini bütçe
                </p>
                <p className="text-sm text-ink-72">{result.budgetEstimate}</p>
              </div>
            </div>
          )}

          {/* İpucu */}
          {result.tip && (
            <div className="mt-3 flex items-start gap-3 bg-terracotta/5 border border-terracotta/20 rounded-xl p-4">
              <Lightbulb size={18} className="shrink-0 mt-0.5 text-terracotta" />
              <p className="text-sm text-ink-72 leading-relaxed">{result.tip}</p>
            </div>
          )}

          <p className="text-[11px] text-ink-72 mt-5 leading-relaxed">
            Bu öneriler yapay zekâ tarafından hazırlanmıştır, yalnızca yol
            gösterme amaçlıdır. Etkinliğinin ihtiyaçları farklılık gösterebilir.
          </p>
        </div>
      )}
    </div>
  );
}