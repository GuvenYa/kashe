'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { leaveAgency } from '@/app/ajans/agency-actions';
import { leaveTeam } from '@/app/kurumsal/business-actions';

/**
 * Uyelikten ayrilma (Duzeltme 15-C). Eylemler (`org_member_leave`) FAZ 10a'dan
 * beri vardi; ekrani yoktu. Iki adim: once uyari, sonra onay. Ayrilinca
 * kurulus paneli erisimi kalkar; geri donmek icin yeniden davet gerekir.
 */
export function UyeliktenAyril({
  membershipId,
  ajans,
  kurulusAdi,
}: {
  membershipId: string;
  ajans: boolean;
  kurulusAdi: string;
}) {
  const router = useRouter();
  const [onay, setOnay] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, baslat] = useTransition();

  function ayril() {
    setHata(null);
    baslat(async () => {
      const sonuc = ajans
        ? await leaveAgency(membershipId)
        : await leaveTeam(membershipId);
      if (!sonuc.success) {
        setHata(sonuc.error ?? 'Ayrılma tamamlanamadı.');
        return;
      }
      router.push('/profil');
      router.refresh();
    });
  }

  return (
    <div className="mt-3">
      <p className="text-sm text-ink-72">
        Ayrılırsan {kurulusAdi} panelini ve kuruluşun etkinliklerini göremezsin.
        Kendi profilin, tekliflerin ve rezervasyonların etkilenmez. Geri dönmek
        için yeniden davet edilmen gerekir.
      </p>
      <div className="flex items-center gap-3 flex-wrap mt-3">
        {!onay ? (
          <button
            type="button"
            onClick={() => setOnay(true)}
            className="kashe-tap px-4 py-2 border border-line rounded-lg text-sm text-ink-72 hover:border-danger hover:text-danger transition-colors"
          >
            {ajans ? 'Ajanstan ayrıl' : 'Kurumdan ayrıl'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={ayril}
              disabled={bekliyor}
              className="kashe-tap px-4 py-2 bg-danger text-paper rounded-lg font-display font-semibold text-sm disabled:opacity-50"
            >
              {bekliyor ? 'Ayrılıyor…' : 'Evet, ayrıl'}
            </button>
            <button
              type="button"
              onClick={() => setOnay(false)}
              disabled={bekliyor}
              className="kashe-tap px-4 py-2 border border-line rounded-lg text-sm text-ink-72 hover:text-ink"
            >
              Vazgeç
            </button>
          </>
        )}
      </div>
      {hata && (
        <p role="alert" className="text-sm text-danger mt-2">
          {hata}
        </p>
      )}
    </div>
  );
}
