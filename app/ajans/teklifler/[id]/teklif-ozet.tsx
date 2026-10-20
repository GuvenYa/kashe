'use client';

import { OzetKutuSatiri, type OzetKutusu } from '@/app/components/panel';
import {
  kdvYuzdesi,
  paraMetni,
  type IcKalemSatiri,
  type SurumSatiri,
} from '../teklif-data';

/**
 * TEKLIF OZET KUTULARI (D1b-3 / madde 3).
 *
 * "MUSTERIYE TEKLIF" kutusu hero (lacivert): ekranin cevabi bu sayidir.
 * `maliyetGorulur` ise solunda iki kutu daha — ic maliyet ve marj.
 *
 * RAKAM URETMEZ: ara toplam, KDV ve genel toplam DB'nin surum alanlari
 * (`subtotal`, `tax_amount`, `total_amount`). Tek turetme marj = musteri
 * toplami - ic maliyet; bu bir FIYAT degil, iki DB degerinin farkinin
 * GOSTERIMI. Ic maliyet yuklenmemisse ("—") marj da hesaplanmaz: eksik veriyle
 * uretilen bir marj yanlis bilgi olurdu.
 */
export function TeklifOzet({
  gecerliSurum,
  icKalemler,
  maliyetGorulur,
}: {
  gecerliSurum: SurumSatiri;
  /** `null` = ic maliyet henuz yuklenmedi. */
  icKalemler: IcKalemSatiri[] | null;
  maliyetGorulur: boolean;
}) {
  const kdv = kdvYuzdesi(gecerliSurum.tax_rate);
  const genelToplam =
    paraMetni(gecerliSurum.total_amount, gecerliSurum.currency) ?? '—';
  const araToplam =
    paraMetni(gecerliSurum.subtotal, gecerliSurum.currency) ?? '—';
  const kdvTutari =
    paraMetni(gecerliSurum.tax_amount, gecerliSurum.currency) ?? '—';

  const heroKutusu: OzetKutusu = {
    etiket: 'Müşteriye teklif',
    deger: genelToplam,
    altNot: `KDV %${kdv} dahil`,
    hero: true,
  };

  if (!maliyetGorulur) {
    return (
      <OzetKutuSatiri
        kutular={[
          heroKutusu,
          {
            etiket: 'Ara toplam / KDV',
            deger: araToplam,
            altNot: `KDV %${kdv}: ${kdvTutari}`,
          },
        ]}
      />
    );
  }

  // Ic maliyet toplami: birim maliyet x adet (satir bazinda), kalemler uzerinden.
  const yuklendi = icKalemler !== null;
  let icToplam: number | null = null;
  if (yuklendi) {
    let acc = 0;
    let enAzBirDeger = false;
    for (const k of icKalemler) {
      if (k.internal_cost == null) continue;
      const birim = Number(k.internal_cost);
      const adet = Number(k.quantity);
      if (!Number.isFinite(birim) || !Number.isFinite(adet)) continue;
      acc += birim * adet;
      enAzBirDeger = true;
    }
    icToplam = enAzBirDeger ? acc : null;
  }

  // Marj: musteri ara toplami (KDV HARIC) - ic maliyet. KDV devlete gider,
  // marjin icinde sayilamaz.
  const musteriAraToplam = Number(gecerliSurum.subtotal);
  const marjTutari =
    icToplam !== null && Number.isFinite(musteriAraToplam)
      ? musteriAraToplam - icToplam
      : null;
  const marjYuzde =
    marjTutari !== null && icToplam !== null && icToplam > 0
      ? Math.round((marjTutari / icToplam) * 100)
      : null;

  return (
    <OzetKutuSatiri
      kutular={[
        {
          etiket: 'İç maliyet · yalnız ajans',
          deger: icToplam !== null ? (paraMetni(icToplam) ?? '—') : '—',
          altNot: yuklendi
            ? icToplam !== null
              ? 'Kalem maliyetleri toplamı'
              : 'Kalem maliyeti girilmedi'
            : 'Tabloda "Yükle" ile gelir',
        },
        {
          etiket: 'Marj · yalnız ajans',
          deger: marjTutari !== null ? (paraMetni(marjTutari) ?? '—') : '—',
          altNot:
            marjYuzde !== null
              ? `%${marjYuzde} · KDV hariç ara toplam üzerinden`
              : yuklendi
                ? 'İç maliyet olmadan hesaplanmaz'
                : 'Tabloda "Yükle" ile gelir',
        },
        heroKutusu,
      ]}
    />
  );
}
