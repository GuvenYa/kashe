'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KisiFormu, type KisiFormDegerleri } from './kisi-formu';
import { kisiSil } from '@/app/lib/crm-actions';

/**
 * FAZ 8b — kisi sayfasindaki "Duzenle" / "Sil" kutusu.
 *
 * Formu acik/kapali tutan ve silme onayini tasiyan ISTEMCI kabuk: sunucu
 * sayfasi `KisiFormu`'na `onIptal`/`onBitti` gibi FONKSIYON geciremez
 * (sunucu -> istemci fonksiyon prop'u D2'de uretimi dusurdu), bu yuzden durum
 * burada yasiyor.
 *
 * SILME KAPISI: `silinebilir` yalniz firsati OLMAYAN kisi icin true gelir.
 * Yine de yanlis bir durumda butona basilirsa DB 23503 doner ve `crmHataMetni`
 * "Once firsatlari sil ya da tasi" cumlesini yazar — kural tek yerde (DB).
 */
const BTN_IKINCIL =
  'kashe-tap px-3 py-1.5 border border-line text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink transition-colors disabled:opacity-50';
const BTN_TEHLIKE =
  'kashe-tap px-3 py-1.5 border border-danger/40 text-danger rounded-lg font-display font-semibold text-xs hover:bg-danger/[0.06] transition-colors disabled:opacity-50';

export function KisiDuzenle({
  organizationId,
  kisi,
  silinebilir,
  kurulusId,
}: {
  organizationId: string;
  kisi: KisiFormDegerleri & { id: string };
  silinebilir: boolean;
  kurulusId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formAcik, setFormAcik] = useState(false);
  const [silOnayi, setSilOnayi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  function sil() {
    setHata(null);
    startTransition(async () => {
      const res = await kisiSil(kisi.id);
      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      router.push(`/ajans/musteriler?kurulus=${kurulusId}`);
    });
  }

  if (formAcik) {
    return (
      <KisiFormu
        organizationId={organizationId}
        baslangic={kisi}
        onIptal={() => setFormAcik(false)}
        onBitti={() => {
          setFormAcik(false);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setFormAcik(true)}
        className={BTN_IKINCIL}
      >
        Bilgileri düzenle
      </button>

      {silOnayi ? (
        <div className="pt-3 border-t border-line space-y-2">
          <p className="text-sm text-ink">
            Bu kişi silinsin mi? Geri alınamaz.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={sil}
              disabled={isPending}
              className={BTN_TEHLIKE}
            >
              {isPending ? 'Siliniyor…' : 'Evet, sil'}
            </button>
            <button
              type="button"
              onClick={() => setSilOnayi(false)}
              disabled={isPending}
              className={BTN_IKINCIL}
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-3 border-t border-line">
          <button
            type="button"
            onClick={() => setSilOnayi(true)}
            className={BTN_TEHLIKE}
          >
            Kişiyi sil
          </button>
          {!silinebilir && (
            <p className="text-xs text-ink-50 mt-2 leading-relaxed">
              Bu kişinin fırsatları var; silmek için önce fırsatları sil ya da
              başka bir kişiye taşı.
            </p>
          )}
        </div>
      )}

      {hata && <p className="text-sm text-danger">{hata}</p>}
    </div>
  );
}
