'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KISI_TURLERI, KISI_TURU_ETIKETLERI, type KisiTuru } from '@/app/lib/crm';
import { kisiGuncelle, kisiOlustur } from '@/app/lib/crm-actions';

/**
 * FAZ 8b — kisi formu (8a `gorev-formu.tsx` kalibi).
 *
 * Yeni kayit ve duzenleme AYNI bilesen: alanlar birebir ayni, tek fark hangi
 * action'in cagrildigi. Iki form yazmak, bir alan eklendiginde birini
 * guncellemeyi unutmak demekti.
 *
 * DOGRULAMA BURADA TEKRARLANMAZ: uzunluk ve bicim kurallari DB CHECK'inde,
 * action onlari Turkce cumleye ceviriyor. Buradaki `required` ve `maxLength`
 * yalniz tarayici kolayligi (sunucu kapisi degil).
 */
const ALAN =
  'w-full bg-card border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-brand-ink';
const ETIKET =
  'block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1.5';
const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-4 py-2 border border-line text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink transition-colors disabled:opacity-50';

export type KisiFormDegerleri = {
  id?: string;
  kind: KisiTuru;
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  notes: string;
};

export const BOS_KISI: KisiFormDegerleri = {
  kind: 'person',
  fullName: '',
  companyName: '',
  email: '',
  phone: '',
  notes: '',
};

export function KisiFormu({
  organizationId,
  baslangic = BOS_KISI,
  onIptal,
  onBitti,
}: {
  organizationId: string;
  baslangic?: KisiFormDegerleri;
  onIptal?: () => void;
  /** Kayit basarili olunca cagrilir (yeni kayitta olusan kimlikle). */
  onBitti?: (kisiId: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [deger, setDeger] = useState<KisiFormDegerleri>(baslangic);

  const duzenleme = !!baslangic.id;

  function alan<K extends keyof KisiFormDegerleri>(
    anahtar: K,
    v: KisiFormDegerleri[K]
  ) {
    setDeger((o) => ({ ...o, [anahtar]: v }));
  }

  function kaydet() {
    setHata(null);
    startTransition(async () => {
      const res = duzenleme
        ? await kisiGuncelle({
            id: baslangic.id as string,
            kind: deger.kind,
            fullName: deger.fullName,
            companyName: deger.companyName,
            email: deger.email,
            phone: deger.phone,
            notes: deger.notes,
          })
        : await kisiOlustur({
            organizationId,
            kind: deger.kind,
            fullName: deger.fullName,
            companyName: deger.companyName,
            email: deger.email,
            phone: deger.phone,
            notes: deger.notes,
          });

      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      if (!duzenleme) setDeger(BOS_KISI);
      router.refresh();
      if (res.id) onBitti?.(res.id);
      else onBitti?.(baslangic.id ?? '');
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={ETIKET} htmlFor="kisi-tur">
            Tür
          </label>
          <select
            id="kisi-tur"
            value={deger.kind}
            onChange={(e) => alan('kind', e.target.value as KisiTuru)}
            className={ALAN}
          >
            {KISI_TURLERI.map((t) => (
              <option key={t} value={t}>
                {KISI_TURU_ETIKETLERI[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIKET} htmlFor="kisi-ad">
            Ad
          </label>
          <input
            id="kisi-ad"
            value={deger.fullName}
            onChange={(e) => alan('fullName', e.target.value)}
            maxLength={200}
            required
            placeholder="Ad soyad ya da firma adı"
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="kisi-firma">
            Firma
          </label>
          <input
            id="kisi-firma"
            value={deger.companyName}
            onChange={(e) => alan('companyName', e.target.value)}
            maxLength={200}
            placeholder="İsteğe bağlı"
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="kisi-eposta">
            E-posta
          </label>
          <input
            id="kisi-eposta"
            type="email"
            value={deger.email}
            onChange={(e) => alan('email', e.target.value)}
            maxLength={254}
            placeholder="ornek@firma.com"
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="kisi-telefon">
            Telefon
          </label>
          <input
            id="kisi-telefon"
            value={deger.phone}
            onChange={(e) => alan('phone', e.target.value)}
            maxLength={40}
            placeholder="İsteğe bağlı"
            className={ALAN}
          />
        </div>
      </div>

      <div>
        <label className={ETIKET} htmlFor="kisi-not">
          Not
        </label>
        <textarea
          id="kisi-not"
          value={deger.notes}
          onChange={(e) => alan('notes', e.target.value)}
          maxLength={4000}
          rows={3}
          placeholder="Kuruluş içi not — müşteriye gösterilmez."
          className={ALAN}
        />
      </div>

      {hata && <p className="text-sm text-danger">{hata}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={kaydet}
          disabled={isPending || deger.fullName.trim().length < 2}
          className={BTN_BIRINCIL}
        >
          {isPending ? 'Kaydediliyor…' : duzenleme ? 'Kaydet' : 'Kişi ekle'}
        </button>
        {onIptal && (
          <button
            type="button"
            onClick={onIptal}
            disabled={isPending}
            className={BTN_IKINCIL}
          >
            Vazgeç
          </button>
        )}
      </div>
    </div>
  );
}
