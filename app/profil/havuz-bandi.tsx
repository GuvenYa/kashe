'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import { claimTalentRecordById } from '@/app/lib/havuz-claim-actions';

export type HavuzBandiSatiri = {
  recordId: string;
  organizationName: string;
};

// localStorage ayni sekmede olay yayinlamaz; abonelige gerek yok — deger yalniz
// "Simdi degil" tiklamasiyla degisir, o da ayri state'te tutulur.
function abone(): () => void {
  return () => {};
}

/**
 * Daha once gizlenen kayit id'lerini virgulle birlesik METIN olarak doner.
 * `useSyncExternalStore` anlik goruntuyu deger esitligiyle karsilastirir; her
 * cagrida yeni bir dizi/Set donmek sonsuz render olur, metin degeri guvenlidir.
 * localStorage okunamazsa bos metin -> band gorunur kalir (guvenli taraf).
 */
function gizlenenler(satirlar: HavuzBandiSatiri[]): string {
  try {
    return satirlar
      .filter(
        (s) => window.localStorage.getItem(`havuz-band-${s.recordId}`) === '1'
      )
      .map((s) => s.recordId)
      .join(',');
  } catch {
    return '';
  }
}

/**
 * "Sizi havuzuna eklemis" bandi. Kayitlar `claimable_talent_records_for_me`
 * RPC'sinden sunucuda gelir; burada yalniz sahiplenme ve yerel gizleme var.
 * "Simdi degil" sunucuya YAZILMAZ — yalniz bu tarayicida gizlenir.
 */
export function HavuzBandi({ satirlar }: { satirlar: HavuzBandiSatiri[] }) {
  const [isPending, startTransition] = useTransition();
  const [gizli, setGizli] = useState<string[]>([]);
  const [tamamlanan, setTamamlanan] = useState<string[]>([]);
  const [hata, setHata] = useState<string | null>(null);

  // Sunucuda localStorage yok: sunucu anlik goruntusu bos metin, hidrasyondan
  // sonra gercek deger gelir. (Efekt + setState yerine bu yol; cascading render yok.)
  const oncedenGizli = useSyncExternalStore(
    abone,
    () => gizlenenler(satirlar),
    () => ''
  );

  function simdiDegil(recordId: string) {
    setGizli((o) => [...o, recordId]);
    try {
      window.localStorage.setItem(`havuz-band-${recordId}`, '1');
    } catch {
      /* yoksay — yalniz bu oturumda gizli kalir */
    }
  }

  function sahiplen(recordId: string) {
    setHata(null);
    startTransition(async () => {
      const res = await claimTalentRecordById(recordId);
      if (res.success) setTamamlanan((o) => [...o, recordId]);
      else setHata(res.error);
    });
  }

  const gizliSet = new Set([
    ...oncedenGizli.split(',').filter(Boolean),
    ...gizli,
  ]);
  const gorunen = satirlar.filter((s) => !gizliSet.has(s.recordId));
  if (gorunen.length === 0) return null;

  return (
    <div className="mb-8 space-y-3">
      {hata && (
        <p className="px-4 py-3 bg-danger/8 border border-danger/25 rounded-lg text-sm text-danger">
          {hata}
        </p>
      )}
      {gorunen.map((s) => {
        const bitti = tamamlanan.includes(s.recordId);
        return (
          <div
            key={s.recordId}
            className="px-4 py-3 bg-brand-ink-08 border border-brand-ink/25 rounded-lg flex items-center justify-between gap-4 flex-wrap"
          >
            {bitti ? (
              <p className="text-sm text-ink">
                Kayıt profiline bağlandı. <strong>{s.organizationName}</strong>{' '}
                artık seni havuzunda Kashe üyesi olarak görüyor.
              </p>
            ) : (
              <>
                <p className="text-sm text-ink">
                  <strong>{s.organizationName}</strong> seni yetenek havuzuna
                  ekledi.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => sahiplen(s.recordId)}
                    disabled={isPending}
                    className="kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50"
                  >
                    {isPending ? 'İşleniyor…' : 'Sahiplen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => simdiDegil(s.recordId)}
                    className="kashe-tap px-4 py-2 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors"
                  >
                    Şimdi değil
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
