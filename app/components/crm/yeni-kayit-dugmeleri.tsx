'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * FAZ 8b — "Yeni kisi" / "Yeni firsat" dugmeleri (`PanelBaslik` sag alani).
 *
 * NEDEN URL DURUMU: dugmeler basligin SAGINDA, form ise basligin ALTINDA tam
 * genislikte duruyor — iki ayri mount noktasi. Ortak durumu bir React state'i
 * olarak paylasmak, sunucu bileseninden istemci bilesenine FONKSIYON gecirmek
 * ya da iki yuzeyi tek bilesende birlestirip formu daracik bir alana sikistirmak
 * demekti. `?yeni=kisi|firsat` ikisini de cozer: her iki bilesen de ayni
 * parametreyi okur, sunucu sinirini hicbir fonksiyon gecmez.
 *
 * (Sunucudan istemciye fonksiyon prop'u gecirmek D2'de uretimi dusurdu.)
 *
 * Yetki kontrolu CAGIRANIN isi: `canManageCrm` yoksa bu bilesen hic render
 * edilmez (kontrol iki yerde yazilmaz).
 */
const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors';
const BTN_IKINCIL =
  'kashe-tap px-4 py-2 border border-line text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink transition-colors';

export function YeniKayitDugmeleri() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const acik = params.get('yeni');

  function ac(hangi: 'kisi' | 'firsat') {
    const p = new URLSearchParams(params.toString());
    if (acik === hangi) p.delete('yeni');
    else p.set('yeni', hangi);
    // Panel acikken form acilmasin: iki katman ust uste gelirdi.
    p.delete('firsat');
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => ac('kisi')}
        aria-pressed={acik === 'kisi'}
        className={BTN_IKINCIL}
      >
        Yeni kişi
      </button>
      <button
        type="button"
        onClick={() => ac('firsat')}
        aria-pressed={acik === 'firsat'}
        className={BTN_BIRINCIL}
      >
        Yeni fırsat
      </button>
    </div>
  );
}
