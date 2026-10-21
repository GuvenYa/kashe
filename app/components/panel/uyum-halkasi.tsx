/**
 * UYUM HALKASI (D3) — aday kartindaki eslesme puani.
 *
 * 'use client' YOKTUR: hem sunucu sayfasi hem istemci paneli import edebilir.
 *
 * RAKAM URETMEZ. Puan `match_candidates.match_score` sutunundan gelir
 * (`run_event_match` hesaplar); bu bilesen aldigi yuzdeyi cizer, esik
 * hesaplamaz, yeniden olceklendirmez. Esikler YALNIZ RENK secer:
 *   >= 80 moss (yesil) · 60-79 brand-ink (lacivert) · altinda ink-50 (soluk)
 * Renk bir yargi degil okunurluk araci: dusuk puanli aday listede kalir,
 * yalniz goz once yuksek olana gider.
 *
 * Renkler `var(--color-*)` ile verilir: SVG `stroke` icin Tailwind utility
 * uretmek gerekmez (DESIGN.md 8 — uretilen CSS'te kural arama derdi olmaz).
 */
const R = 14;
const CEVRE = 2 * Math.PI * R;

function renk(yuzde: number): string {
  if (yuzde >= 80) return 'var(--color-moss)';
  if (yuzde >= 60) return 'var(--color-brand-ink)';
  return 'var(--color-ink-50)';
}

export function UyumHalkasi({
  yuzde,
  boyut = 40,
}: {
  /** 0-100 tam sayi (`uyumYuzdesi` ile sinirlanmis gelir). */
  yuzde: number;
  /** Kenar uzunlugu (px). Kart icinde 40, genis kartta 48. */
  boyut?: number;
}) {
  const deger = Math.max(0, Math.min(100, Math.round(yuzde)));
  const dolu = (deger / 100) * CEVRE;
  const c = renk(deger);

  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: boyut, height: boyut }}
      title={`Uyum puanı %${deger}`}
    >
      <svg
        width={boyut}
        height={boyut}
        viewBox="0 0 36 36"
        aria-hidden="true"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          stroke="var(--color-ink-12)"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          stroke={c}
          strokeWidth="3"
          strokeLinecap={deger > 0 ? 'round' : 'butt'}
          strokeDasharray={`${dolu} ${CEVRE - dolu}`}
        />
      </svg>
      <span
        className="absolute font-display font-semibold tabular-nums leading-none"
        style={{ color: c, fontSize: Math.round(boyut * 0.26) }}
      >
        %{deger}
      </span>
      <span className="sr-only">Uyum puanı yüzde {deger}</span>
    </span>
  );
}
