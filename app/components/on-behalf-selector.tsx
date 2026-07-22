'use client';

export type OnBehalfBusiness = { business_id: string; business_name: string };

type Props = {
  businesses: OnBehalfBusiness[];
  /** Kullanıcı kendi adına oluşturmaya uygun mu (profil rolü uygunsa) */
  canSelfCreate: boolean;
  /** Seçili değer: null = kendi adına, aksi kurum id'si */
  value: string | null;
  onChange: (v: string | null) => void;
};

/**
 * "Kimin adına" seçici — manager+ kurum üyeliği olan kullanıcılara formda gösterilir.
 * businesses boşsa hiç render edilmez (form bugünkü gibi davranır).
 */
export function OnBehalfSelector({
  businesses,
  canSelfCreate,
  value,
  onChange,
}: Props) {
  if (businesses.length === 0) return null;

  const optionClass = (active: boolean) =>
    `text-left px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
      active
        ? 'bg-brand-ink text-paper border-brand-ink'
        : 'bg-paper text-ink-72 border-line hover:border-brand-ink/50'
    }`;

  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
        Kimin adına?
      </label>
      <div className="flex flex-col gap-2">
        {canSelfCreate && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={optionClass(value === null)}
          >
            Kendi adıma
          </button>
        )}
        {businesses.map((b) => (
          <button
            key={b.business_id}
            type="button"
            onClick={() => onChange(b.business_id)}
            className={optionClass(value === b.business_id)}
          >
            Kurum adına: {b.business_name}
          </button>
        ))}
      </div>
    </div>
  );
}
