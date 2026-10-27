import {
  PanelKart,
  VeriTablosu,
  type VeriSatiri,
  type VeriSutunu,
} from '@/app/components/panel';
import { ItirazFormu } from './itiraz-formu';
import {
  BILESENLER,
  ITIRAZ_DURUMU,
  bilesenPuani,
  hamDeger,
  skorMetni,
  skorSinifi,
  skorZemini,
  type ItirazDurumu,
} from '@/app/lib/guven';
import type { GuvenDokumu } from '@/app/lib/guven-data';
import { tarihMetni } from '@/app/lib/tarih';

/**
 * GUVEN DOKUMU KARTI (FAZ 9c) — SUNUCU bileseni.
 *
 * 'use client' YOKTUR: veriyi sayfa hazir veriyor, kart yalniz ciziyor. Tek
 * istemci parcasi itiraz formu.
 *
 * SKOR YALNIZ SAGLAYICIYA GORUNUR. Bu kart `/profil` ve `/ajans` panellerinde
 * cizilir; `/p/[id]`, Kesfet ve portal gibi MUSTERIYE DONUK yuzeylere
 * eklenmez. Yetkiyi RPC zorluyor (`fn_faz9c_provider_yetkisi`) — yetkisizde
 * sayfa `null` dokum alir ve karti hic cizmez.
 *
 * UC DURUM:
 *   1. `visible = false` -> yayinda olmayan saglayicinin skoru HESAPLANMAZ.
 *   2. `snapshot = null` -> yayinda ama gece hesabi henuz kosmamis.
 *   3. Dolu -> skor, bilesen dokumu ve itiraz blogu.
 */
export function GuvenDokumuKarti({
  dokum,
  providerId,
  itirazEdebilir,
}: {
  dokum: GuvenDokumu;
  providerId: string;
  /** Ajansta `settings.manage` yoksa form cizilmez; mevcut itiraz salt okunur. */
  itirazEdebilir: boolean;
}) {
  if (!dokum.visible) {
    return (
      <PanelKart baslik="Güven dökümü">
        <p className="text-sm text-ink-72">
          Profilin yayında değilken güven puanı hesaplanmaz.
        </p>
      </PanelKart>
    );
  }

  const anlik = dokum.snapshot;
  if (!anlik) {
    return (
      <PanelKart baslik="Güven dökümü">
        <p className="text-sm text-ink-72">
          Puanın ilk gece hesaplamasında oluşacak.
        </p>
      </PanelKart>
    );
  }

  const bilesenler = anlik.components ?? {};

  const sutunlar: VeriSutunu[] = [
    { anahtar: 'bilesen', baslik: 'Bileşen', kartEtiketiGizle: true },
    // `sayisal` DEGIL: saga yasli puan, hemen sagindaki "Deger" sutununa
    // yapisiyordu ("18 / 254 tamamlanan is" diye okunuyordu). Sola yasli kalir.
    { anahtar: 'puan', baslik: 'Puan' },
    { anahtar: 'deger', baslik: 'Değer' },
    { anahtar: 'nasil', baslik: 'Nasıl artar', dar: true },
  ];

  const satirlar: VeriSatiri[] = BILESENLER.map((b) => {
    const puan = bilesenPuani(b.anahtar, bilesenler);
    return {
      anahtar: b.anahtar,
      hucreler: {
        bilesen: (
          <span className="block text-ink break-words">{b.etiket}</span>
        ),
        // Iptal bileseni NEGATIF yonde isler: ust siniri 0, alt siniri -15.
        puan: (
          <span className="tabular-nums">
            {b.anahtar === 'cancel'
              ? `${puan} / 0 (en az −15)`
              : `${puan} / ${b.maks}`}
          </span>
        ),
        deger: hamDeger(b.anahtar, bilesenler),
        nasil: (
          <span className="text-ink-72 text-sm break-words">
            {b.nasilArtar}
          </span>
        ),
      },
    };
  });

  const itiraz = dokum.appeal;
  const durum = itiraz ? ITIRAZ_DURUMU[itiraz.status as ItirazDurumu] : null;

  return (
    <PanelKart baslik="Güven dökümü">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
        Trust Score V0 · {tarihMetni(anlik.computed_at) ?? ''} · günlük
        hesaplanır
      </p>

      <div className="flex items-end gap-4 flex-wrap mt-2">
        <p className="font-display text-4xl text-ink tabular-nums leading-none">
          <span className={skorSinifi(anlik.score)}>
            {skorMetni(anlik.score)}
          </span>
          <span className="text-ink-50 text-2xl">/100</span>
        </p>
        <div className="min-w-0 flex-1 basis-48 pb-2">
          <div className="h-1.5 rounded-full bg-paper-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${skorZemini(anlik.score)}`}
              style={{ width: `${Math.max(0, Math.min(100, anlik.score))}%` }}
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-ink-50 mt-2 leading-relaxed">
        70 ve üzeri eşleştirmede &quot;yüksek güven&quot; olarak işaretlenir.
        Puan yalnız sana görünür; müşteriler sayıyı görmez.
      </p>

      <div className="mt-5">
        <VeriTablosu
          sutunlar={sutunlar}
          satirlar={satirlar}
          bosMetin="Bileşen dökümü yok."
        />
      </div>

      {/* ── ITIRAZ ── */}
      <div className="mt-5 border-t border-line pt-4">
        {itiraz && durum ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.12em] ${durum.sinif}`}
              >
                {durum.etiket}
              </span>
              <span className="text-xs text-ink-50">
                {tarihMetni(itiraz.created_at) ?? ''}
              </span>
            </div>
            <p className="text-sm text-ink mt-2 whitespace-pre-wrap break-words">
              {itiraz.message}
            </p>

            {itiraz.admin_note && (
              <div className="bg-paper-2 rounded-lg p-3 mt-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
                  Kashe notu · {tarihMetni(itiraz.reviewed_at) ?? ''}
                </p>
                <p className="text-sm text-ink mt-1 whitespace-pre-wrap break-words">
                  {itiraz.admin_note}
                </p>
              </div>
            )}

            {itiraz.status === 'open' ? (
              <p className="text-sm text-ink-72 mt-3">İtirazın inceleniyor.</p>
            ) : (
              itirazEdebilir && (
                <ItirazFormu providerId={providerId} kapaliBaslar />
              )
            )}
          </>
        ) : (
          itirazEdebilir && <ItirazFormu providerId={providerId} />
        )}
      </div>
    </PanelKart>
  );
}
