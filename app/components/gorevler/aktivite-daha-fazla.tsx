'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Aktivite akisinin "daha fazla" kabi.
 *
 * Satirlar SUNUCUDA uretilir (cumle kurma ve ad cozme orada); bu bilesen yalniz
 * ilk N satirdan sonrasini gizleyip acar. Boylece istemciye `activity_logs`
 * ham verisi (diff, kimlikler) HIC inmez.
 */
export function AktiviteDahaFazla({
  ilk,
  kalan,
  kalanSayisi,
}: {
  ilk: ReactNode;
  kalan: ReactNode;
  kalanSayisi: number;
}) {
  const [acik, setAcik] = useState(false);
  return (
    <>
      {ilk}
      {acik && kalan}
      {kalanSayisi > 0 && !acik && (
        <button
          type="button"
          onClick={() => setAcik(true)}
          className="kashe-tap mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink hover:underline"
        >
          {kalanSayisi} kayıt daha →
        </button>
      )}
    </>
  );
}
