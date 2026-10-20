'use client';

import { useState, useTransition } from 'react';
import {
  GOREV_DURUMLARI,
  gorevDurumEtiketi,
} from '@/app/lib/gorevler';
import { gorevOlustur, gorevGuncelle } from '@/app/lib/gorev-actions';
import { takvimiAc } from '@/app/lib/tarih-girdisi';
import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import type { Atanabilir, GorevSatiri } from '@/app/lib/gorev-data';

/**
 * FAZ 8a — gorev ayrinti formu (yeni / duzenle).
 *
 * Atanan TEK secimdir: uye ya da havuz kaydi. Iki ayri alan verilse ikisi birden
 * doldurulabilirdi; tetikleyici bunu reddetmiyor ama "kime atandi" sorusunun iki
 * yaniti olurdu. Deger `user:<uuid>` / `talent:<uuid>` bicimli.
 */
const ALAN =
  'w-full px-3 py-2 bg-card border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand-ink';
const ETIKET =
  'block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1.5';

/** ISO -> `datetime-local` degeri (Istanbul). */
function yereleCevir(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const parcalar = new Intl.DateTimeFormat('sv-SE', {
    timeZone: KASHE_SAAT_DILIMI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  // sv-SE: "2027-05-14 18:30" -> datetime-local "2027-05-14T18:30"
  return parcalar.replace(' ', 'T');
}

export function GorevFormu({
  organizationId,
  gorev,
  sabitEventId,
  atanabilirler,
  etkinlikSecenekleri,
  bagliSecenekleri,
  onKapat,
}: {
  organizationId: string;
  /** Yoksa yeni gorev. */
  gorev?: GorevSatiri | null;
  /** Etkinlik sekmesinde etkinlik SABIT (secici gosterilmez). */
  sabitEventId?: string | null;
  atanabilirler: Atanabilir[];
  etkinlikSecenekleri: { id: string; ad: string }[];
  bagliSecenekleri: { id: string; ad: string }[];
  onKapat: () => void;
}) {
  const [baslik, setBaslik] = useState(gorev?.title ?? '');
  const [aciklama, setAciklama] = useState(gorev?.description ?? '');
  const [durum, setDurum] = useState(gorev?.status ?? 'todo');
  const [atanan, setAtanan] = useState(
    gorev?.assignee_user_id
      ? `user:${gorev.assignee_user_id}`
      : gorev?.assignee_talent_record_id
        ? `talent:${gorev.assignee_talent_record_id}`
        : ''
  );
  const [sonTarih, setSonTarih] = useState(yereleCevir(gorev?.due_at ?? null));
  const [kilometre, setKilometre] = useState(gorev?.is_milestone ?? false);
  const [bagli, setBagli] = useState(gorev?.depends_on_task_id ?? '');
  const [etkinlik, setEtkinlik] = useState(
    sabitEventId ?? gorev?.event_id ?? ''
  );
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  const yeni = !gorev;

  function kaydet() {
    setHata(null);
    basla(async () => {
      const sonuc = yeni
        ? await gorevOlustur({
            organizationId,
            title: baslik,
            eventId: sabitEventId ?? (etkinlik || null),
            description: aciklama,
            status: durum,
            atanan: atanan || null,
            dueAt: sonTarih,
            isMilestone: kilometre,
            dependsOnTaskId: bagli || null,
          })
        : await gorevGuncelle({
            id: gorev.id,
            title: baslik,
            description: aciklama,
            status: durum,
            atanan: atanan || null,
            dueAt: sonTarih,
            isMilestone: kilometre,
            dependsOnTaskId: bagli || null,
            // Etkinlik sabitse DOKUNULMAZ (undefined gecer).
            ...(sabitEventId ? {} : { eventId: etkinlik || null }),
          });
      if (sonuc.ok) onKapat();
      else setHata(sonuc.hata);
    });
  }

  return (
    <div className="bg-card border border-brand-ink/25 rounded-xl p-5 space-y-4">
      <p className="font-display font-semibold text-base text-ink">
        {yeni ? 'Yeni görev' : 'Görevi düzenle'}
      </p>

      <div>
        <label className={ETIKET} htmlFor="gorev-baslik">
          Başlık
        </label>
        <input
          id="gorev-baslik"
          type="text"
          value={baslik}
          onChange={(e) => setBaslik(e.target.value)}
          maxLength={200}
          className={ALAN}
          placeholder="Sahne kurulumu"
        />
      </div>

      <div>
        <label className={ETIKET} htmlFor="gorev-aciklama">
          Açıklama
        </label>
        <textarea
          id="gorev-aciklama"
          value={aciklama}
          onChange={(e) => setAciklama(e.target.value)}
          rows={3}
          maxLength={4000}
          className={ALAN}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={ETIKET} htmlFor="gorev-durum">
            Durum
          </label>
          <select
            id="gorev-durum"
            value={durum}
            onChange={(e) => setDurum(e.target.value)}
            className={ALAN}
          >
            {GOREV_DURUMLARI.map((d) => (
              <option key={d} value={d}>
                {gorevDurumEtiketi(d)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIKET} htmlFor="gorev-atanan">
            Atanan
          </label>
          <select
            id="gorev-atanan"
            value={atanan}
            onChange={(e) => setAtanan(e.target.value)}
            className={ALAN}
          >
            <option value="">Atanmamış</option>
            {atanabilirler.map((a) => (
              <option key={`${a.tur}:${a.id}`} value={`${a.tur}:${a.id}`}>
                {a.ad} — {a.altNot}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIKET} htmlFor="gorev-son-tarih">
            Son tarih
          </label>
          <input
            id="gorev-son-tarih"
            type="datetime-local"
            value={sonTarih}
            onChange={(e) => setSonTarih(e.target.value)}
            onClick={takvimiAc}
            className={ALAN}
          />
        </div>

        {!sabitEventId && etkinlikSecenekleri.length > 0 && (
          <div>
            <label className={ETIKET} htmlFor="gorev-etkinlik">
              Etkinlik
            </label>
            <select
              id="gorev-etkinlik"
              value={etkinlik}
              onChange={(e) => setEtkinlik(e.target.value)}
              className={ALAN}
            >
              <option value="">Kuruluş geneli</option>
              {etkinlikSecenekleri.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.ad}
                </option>
              ))}
            </select>
          </div>
        )}

        {bagliSecenekleri.length > 0 && (
          <div>
            <label className={ETIKET} htmlFor="gorev-bagli">
              Bu görevden sonra
            </label>
            <select
              id="gorev-bagli"
              value={bagli}
              onChange={(e) => setBagli(e.target.value)}
              className={ALAN}
            >
              <option value="">Bağımlılık yok</option>
              {bagliSecenekleri
                .filter((b) => b.id !== gorev?.id)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.ad}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={kilometre}
          onChange={(e) => setKilometre(e.target.checked)}
          className="w-4 h-4 accent-brand-ink"
        />
        <span className="text-sm text-ink">Kilometre taşı</span>
      </label>

      {hata && (
        <p className="px-3 py-2 bg-danger-08 border border-danger/30 rounded-lg text-sm text-danger">
          {hata}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={kaydet}
          disabled={bekliyor}
          className="px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep disabled:opacity-50 transition-colors"
        >
          {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button
          type="button"
          onClick={onKapat}
          disabled={bekliyor}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-72 hover:text-ink disabled:opacity-50"
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
