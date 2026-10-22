'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  KATEGORI_ETIKETLERI,
  TEDARIKCI_KATEGORILERI,
  type TedarikciKategorisi,
} from '@/app/lib/tedarikci';
import {
  tedarikciGuncelle,
  tedarikciOlustur,
} from '@/app/lib/tedarikci-actions';

/**
 * FAZ 8c — tedarikci formu (8b `kisi-formu.tsx` kalibi).
 *
 * Yeni kayit ve duzenleme AYNI bilesen: alanlar birebir ayni, tek fark hangi
 * action'in cagrildigi.
 *
 * DOGRULAMA BURADA TEKRARLANMAZ: uzunluk, bicim ve "kendi saglayicisi olamaz"
 * kurallari DB'de; action onlari Turkce cumleye ceviriyor. Buradaki `required`
 * ve `maxLength` yalniz tarayici kolayligi (sunucu kapisi degil).
 *
 * KASHE BAGI: saglayici listesi SUNUCUDAN hazir gelir (`v_providers_public`);
 * form yeni sorgu atmaz, filtre bellekte. Kendi kurulusunun kaydi listede
 * olabilir — DB reddeder ve mesaj gosterilir (kural tek yerde).
 */
const ALAN =
  'w-full bg-card border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-50 focus:outline-none focus:border-brand-ink';
const ETIKET =
  'block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1.5';
const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-4 py-2 border border-line text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink transition-colors disabled:opacity-50';

export type SehirSecenegi = { id: number; ad: string };
export type SaglayiciSecenegi = { id: string; ad: string; tur: string };

export type TedarikciFormDegerleri = {
  id?: string;
  name: string;
  category: TedarikciKategorisi;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  cityId: string;
  rating: string;
  notes: string;
  linkedProviderId: string;
  /** Duzenlemede bagli saglayicinin adi (arama yapmadan gorunsun). */
  linkedProviderName?: string | null;
};

export const BOS_TEDARIKCI: TedarikciFormDegerleri = {
  name: '',
  category: 'other',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  cityId: '',
  rating: '',
  notes: '',
  linkedProviderId: '',
};

export function TedarikciFormu({
  organizationId,
  sehirler,
  saglayicilar,
  baslangic = BOS_TEDARIKCI,
  onIptal,
  onBitti,
}: {
  organizationId: string;
  sehirler: SehirSecenegi[];
  saglayicilar: SaglayiciSecenegi[];
  baslangic?: TedarikciFormDegerleri;
  onIptal?: () => void;
  onBitti?: (id: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [deger, setDeger] = useState<TedarikciFormDegerleri>(baslangic);
  const [saglayiciArama, setSaglayiciArama] = useState('');

  const duzenleme = !!baslangic.id;

  function alan<K extends keyof TedarikciFormDegerleri>(
    anahtar: K,
    v: TedarikciFormDegerleri[K]
  ) {
    setDeger((o) => ({ ...o, [anahtar]: v }));
  }

  const secilenSaglayici = useMemo(() => {
    if (!deger.linkedProviderId) return null;
    const bulunan = saglayicilar.find((s) => s.id === deger.linkedProviderId);
    if (bulunan) return bulunan;
    // Duzenlemede bagli kayit arama listesinde olmayabilir; adi proptan gelir.
    return baslangic.linkedProviderName
      ? {
          id: deger.linkedProviderId,
          ad: baslangic.linkedProviderName,
          tur: 'professional',
        }
      : null;
  }, [deger.linkedProviderId, saglayicilar, baslangic.linkedProviderName]);

  const suzulmus = useMemo(() => {
    const q = saglayiciArama.trim().toLocaleLowerCase('tr');
    if (!q) return [];
    return saglayicilar
      .filter((s) => s.ad.toLocaleLowerCase('tr').includes(q))
      .slice(0, 12);
  }, [saglayicilar, saglayiciArama]);

  function kaydet() {
    setHata(null);
    const ortak = {
      name: deger.name,
      category: deger.category,
      contactName: deger.contactName,
      email: deger.email,
      phone: deger.phone,
      website: deger.website,
      cityId: deger.cityId ? Number(deger.cityId) : null,
      rating: deger.rating ? Number(deger.rating) : null,
      notes: deger.notes,
      linkedProviderId: deger.linkedProviderId || null,
    };

    startTransition(async () => {
      const res = duzenleme
        ? await tedarikciGuncelle({ id: baslangic.id as string, ...ortak })
        : await tedarikciOlustur({ organizationId, ...ortak });

      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      if (!duzenleme) {
        setDeger(BOS_TEDARIKCI);
        setSaglayiciArama('');
      }
      router.refresh();
      onBitti?.(res.id ?? baslangic.id ?? '');
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={ETIKET} htmlFor="ted-ad">
            Ad
          </label>
          <input
            id="ted-ad"
            value={deger.name}
            onChange={(e) => alan('name', e.target.value)}
            maxLength={200}
            required
            placeholder="Firma ya da kişi adı"
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="ted-kategori">
            Kategori
          </label>
          <select
            id="ted-kategori"
            value={deger.category}
            onChange={(e) =>
              alan('category', e.target.value as TedarikciKategorisi)
            }
            className={ALAN}
          >
            {TEDARIKCI_KATEGORILERI.map((k) => (
              <option key={k} value={k}>
                {KATEGORI_ETIKETLERI[k]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIKET} htmlFor="ted-yetkili">
            Yetkili
          </label>
          <input
            id="ted-yetkili"
            value={deger.contactName}
            onChange={(e) => alan('contactName', e.target.value)}
            maxLength={120}
            placeholder="İsteğe bağlı"
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="ted-telefon">
            Telefon
          </label>
          <input
            id="ted-telefon"
            value={deger.phone}
            onChange={(e) => alan('phone', e.target.value)}
            maxLength={40}
            placeholder="İsteğe bağlı"
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="ted-eposta">
            E-posta
          </label>
          <input
            id="ted-eposta"
            type="email"
            value={deger.email}
            onChange={(e) => alan('email', e.target.value)}
            maxLength={254}
            placeholder="ornek@firma.com"
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="ted-web">
            Web
          </label>
          <input
            id="ted-web"
            value={deger.website}
            onChange={(e) => alan('website', e.target.value)}
            maxLength={300}
            placeholder="firma.com"
            className={ALAN}
          />
        </div>

        <div>
          <label className={ETIKET} htmlFor="ted-sehir">
            Şehir
          </label>
          <select
            id="ted-sehir"
            value={deger.cityId}
            onChange={(e) => alan('cityId', e.target.value)}
            className={ALAN}
          >
            <option value="">Belirtilmedi</option>
            {sehirler.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.ad}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={ETIKET} htmlFor="ted-puan">
            Puan
          </label>
          {/* Puan bir KURULUS ICI degerlendirme; pazaryeri puaniyla ilgisi yok
              ve hicbir siralamaya girmez. */}
          <select
            id="ted-puan"
            value={deger.rating}
            onChange={(e) => alan('rating', e.target.value)}
            className={ALAN}
          >
            <option value="">Puan yok</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                {'★'.repeat(n)} ({n})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={ETIKET} htmlFor="ted-not">
          Not
        </label>
        <textarea
          id="ted-not"
          value={deger.notes}
          onChange={(e) => alan('notes', e.target.value)}
          maxLength={4000}
          rows={3}
          placeholder="Kuruluş içi not — tedarikçiye gösterilmez."
          className={ALAN}
        />
      </div>

      {/* Kashe bagi — istege bagli. */}
      <div>
        <label className={ETIKET} htmlFor="ted-saglayici">
          Kashe kaydı
        </label>
        {secilenSaglayici ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-ink">{secilenSaglayici.ad}</span>
            <button
              type="button"
              onClick={() => {
                alan('linkedProviderId', '');
                setSaglayiciArama('');
              }}
              className="kashe-tap text-xs text-brand-ink hover:underline"
            >
              Bağlantıyı kaldır
            </button>
          </div>
        ) : (
          <>
            <input
              id="ted-saglayici"
              value={saglayiciArama}
              onChange={(e) => setSaglayiciArama(e.target.value)}
              placeholder="Kashe'deki ajans ya da profesyoneli ara"
              className={ALAN}
            />
            {suzulmus.length > 0 && (
              <div className="mt-2 border border-line rounded-lg divide-y divide-line max-h-44 overflow-y-auto">
                {suzulmus.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => alan('linkedProviderId', s.id)}
                    className="kashe-tap w-full text-left px-3 py-2 text-sm text-ink hover:bg-paper-2"
                  >
                    {s.ad}
                    <span className="text-ink-72">
                      {' '}
                      · {s.tur === 'organization' ? 'Ajans' : 'Profesyonel'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-ink-50 mt-1.5 leading-relaxed">
              Tedarikçi Kashe&apos;de kayıtlıysa bağla; profil sayfasına
              bağlantı çıkar. Kendi kuruluşunun kaydı bağlanamaz.
            </p>
          </>
        )}
      </div>

      {hata && <p className="text-sm text-danger">{hata}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={kaydet}
          disabled={isPending || deger.name.trim().length < 2}
          className={BTN_BIRINCIL}
        >
          {isPending
            ? 'Kaydediliyor…'
            : duzenleme
              ? 'Kaydet'
              : 'Tedarikçi ekle'}
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
