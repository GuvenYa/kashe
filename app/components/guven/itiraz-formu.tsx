'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { itirazAc } from '@/app/lib/guven-actions';
import { ITIRAZ_MAX, ITIRAZ_MIN } from '@/app/lib/guven';

/**
 * GUVEN ITIRAZ FORMU (FAZ 9c).
 *
 * Kullanicinin metni OLDUGU GIBI gonderilir; bicimleme ya da kisaltma yok.
 * Uzunluk siniri DB CHECK'iyle AYNI (`guven.ts` tek kaynak): dugme 20 karakter
 * altinda kilitli kalir, boylece kullanici bos bir sunucu turu beklemez —
 * ama kurali asil DB uygular.
 *
 * `kapaliBaslar`: ilk itirazda form acik gelir; onceki bir itiraz
 * incelendi/kapatildi ise form kapali baslar ve dugmeyle acilir (kullanici
 * kazara ikinci bir itiraz acmasin).
 */
export function ItirazFormu({
  providerId,
  kapaliBaslar = false,
}: {
  providerId: string;
  kapaliBaslar?: boolean;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(!kapaliBaslar);
  const [metin, setMetin] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  const uzunluk = metin.trim().length;
  const gecerli = uzunluk >= ITIRAZ_MIN && uzunluk <= ITIRAZ_MAX;

  function gonder() {
    setHata(null);
    basla(async () => {
      const res = await itirazAc(providerId, metin);
      if (!res.ok) {
        setHata(res.error);
        return;
      }
      // Basaride form kapanir; `revalidatePath` kartin itiraz blogunu
      // yeniden cizer (durum rozeti ve mesaj sunucudan gelir).
      setMetin('');
      setAcik(false);
      router.refresh();
    });
  }

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="kashe-tap mt-3 text-sm text-brand-ink hover:underline"
      >
        Yeni itiraz aç
      </button>
    );
  }

  return (
    <div className="mt-3">
      <p className="font-display font-semibold text-sm text-ink mb-2">
        Bu değerlendirmeye itiraz et
      </p>
      <textarea
        value={metin}
        onChange={(e) => setMetin(e.target.value)}
        minLength={ITIRAZ_MIN}
        maxLength={ITIRAZ_MAX}
        rows={4}
        placeholder="Hangi bileşenin neden hatalı olduğunu yaz; inceleyip not düşeceğiz."
        aria-label="İtiraz metni"
        className="w-full bg-card border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-brand-ink"
      />
      <div className="flex items-center justify-between gap-3 flex-wrap mt-2">
        <span className="font-mono text-[10px] text-ink-50 tabular-nums">
          {uzunluk}/{ITIRAZ_MAX}
        </span>
        <div className="flex items-center gap-2">
          {kapaliBaslar && (
            <button
              type="button"
              onClick={() => {
                setAcik(false);
                setHata(null);
              }}
              disabled={bekliyor}
              className="kashe-tap px-3 py-1.5 border border-line text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink transition-colors disabled:opacity-50"
            >
              Vazgeç
            </button>
          )}
          <button
            type="button"
            onClick={gonder}
            disabled={bekliyor || !gecerli}
            className="kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50"
          >
            {bekliyor ? 'Gönderiliyor…' : 'İtirazı gönder'}
          </button>
        </div>
      </div>
      {hata && <p className="text-sm text-danger mt-2">{hata}</p>}
    </div>
  );
}
