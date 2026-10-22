'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  TedarikciFormu,
  type SaglayiciSecenegi,
  type SehirSecenegi,
  type TedarikciFormDegerleri,
} from './tedarikci-formu';
import {
  tedarikciArsivle,
  tedarikciSil,
} from '@/app/lib/tedarikci-actions';

/**
 * FAZ 8c — tedarikci sayfasindaki "Duzenle / Arsivle / Sil" kutusu
 * (8b `kisi-duzenle.tsx` kalibi).
 *
 * Formu acik/kapali tutan ve onaylari tasiyan ISTEMCI kabuk: sunucu sayfasi
 * `TedarikciFormu`'na `onIptal`/`onBitti` gibi FONKSIYON geciremez
 * (sunucu -> istemci fonksiyon prop'u D2'de uretimi dusurdu).
 *
 * SILME KAPISI: etkinlige atanmis tedarikci silinemez — kontrol DB'de
 * (`event_suppliers.supplier_id` RESTRICT, 23503). Burada yalniz kullaniciya
 * ONCEDEN bilgi verilir; butona basilsa da kural DB'de uygulanir.
 */
const BTN_IKINCIL =
  'kashe-tap px-3 py-1.5 border border-line text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink transition-colors disabled:opacity-50';
const BTN_TEHLIKE =
  'kashe-tap px-3 py-1.5 border border-danger/40 text-danger rounded-lg font-display font-semibold text-xs hover:bg-danger/[0.06] transition-colors disabled:opacity-50';

export function TedarikciDuzenle({
  organizationId,
  tedarikci,
  sehirler,
  saglayicilar,
  atamaSayisi,
}: {
  organizationId: string;
  tedarikci: TedarikciFormDegerleri & { id: string; isActive: boolean };
  sehirler: SehirSecenegi[];
  saglayicilar: SaglayiciSecenegi[];
  /** Atanmis etkinlik sayisi — silme uyarisi icin. */
  atamaSayisi: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formAcik, setFormAcik] = useState(false);
  const [silOnayi, setSilOnayi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  function arsivle() {
    setHata(null);
    startTransition(async () => {
      const res = await tedarikciArsivle(tedarikci.id, !tedarikci.isActive);
      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      router.refresh();
    });
  }

  function sil() {
    setHata(null);
    startTransition(async () => {
      const res = await tedarikciSil(tedarikci.id);
      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      router.push(`/ajans/tedarikciler?kurulus=${organizationId}`);
    });
  }

  if (formAcik) {
    return (
      <TedarikciFormu
        organizationId={organizationId}
        sehirler={sehirler}
        saglayicilar={saglayicilar}
        baslangic={tedarikci}
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
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setFormAcik(true)}
          className={BTN_IKINCIL}
        >
          Bilgileri düzenle
        </button>
        <button
          type="button"
          onClick={arsivle}
          disabled={isPending}
          className={BTN_IKINCIL}
        >
          {tedarikci.isActive ? 'Arşivle' : 'Arşivden çıkar'}
        </button>
      </div>

      {tedarikci.isActive && (
        <p className="text-[11px] text-ink-50 leading-relaxed">
          Arşivlenen tedarikçi defterde kalır ama yeni etkinliklere atanamaz.
        </p>
      )}

      {silOnayi ? (
        <div className="pt-3 border-t border-line space-y-2">
          <p className="text-sm text-ink">
            Bu tedarikçi silinsin mi? Geri alınamaz.
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
            Tedarikçiyi sil
          </button>
          {atamaSayisi > 0 && (
            <p className="text-xs text-ink-50 mt-2 leading-relaxed">
              Bu tedarikçi {atamaSayisi} etkinliğe atanmış; silinemez. Defterden
              çıkarmak için arşivle.
            </p>
          )}
        </div>
      )}

      {hata && <p className="text-sm text-danger">{hata}</p>}
    </div>
  );
}
