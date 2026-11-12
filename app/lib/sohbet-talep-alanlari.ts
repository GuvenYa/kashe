/**
 * MEVCUT SOHBETE GELEN TALEP - `conversations` satirina yazilacak alanlar
 * (Duzeltme 15-F, bulgu 133). Saf fonksiyon: sorgu atmaz.
 *
 * Cift basina tek sohbet var; musteri ayni profesyonele ikinci kez yazinca
 * sohbetin tur / tarih / saat / yer / etkinlik bagi "en son is"i gosterir
 * (Yol A). Iki ayri durum:
 *
 *   1. AYNI TALEBIN GUNCELLEMESI - onceki talep henuz teklif almamis. Musteri
 *      eksik bilgiyi tamamliyor olabilir; BOS gelen alan eskisini EZMEZ
 *      (Duzeltme 12-A: yeni tarih saatsiz geldiyse eski saatler dusurulur).
 *
 *   2. YENI IS - onceki talep teklif almis (`fn_duz12_talep_yanitlandi`);
 *      ardindan sayac artar ve "Yeni talep #n" karti yazilir. Yeni is onceki
 *      isin bilgisini DEVRALMAZ: bos gelen alan TEMIZLENIR.
 *      Eskiden 1. kural burada da calisiyordu: tarihsiz yeni talep onceki isin
 *      (onayli rezervasyonun) tarihiyle gorunuyor, profesyonelin teklif formu o
 *      tarihle doluyor, etkinlik bagi da kaldigi icin musteri merkezinde yeni
 *      talep ayri kart acmayip eski etkinligin kartina giriyordu (14-B
 *      onizleme turu).
 *      Onceki isin teklifi ve rezervasyonu kendi tarihini / etkinlik bagini
 *      kendi satirinda tasir; sohbet alanlarinin temizlenmesi onlari etkilemez.
 */

export type SohbetTalepGirdisi = {
  /** `request_type` (bos gelirse 'quote'). */
  talepTuru: string | null | undefined;
  tarih: string | null;
  /** Taksonomiyle dogrulanmis tur anahtari (gecersizse null). */
  tur: string | null;
  yer: string | null;
  kisiSayisi: number | null;
  /** Enum ile dogrulanmis butce anahtari (gecersizse null). */
  butce: string | null;
  /** Temizlenmis brief (bossa null). */
  brief: Record<string, unknown> | null;
  baslangic: string | null | undefined;
  bitis: string | null | undefined;
  /** RLS ile dogrulanmis etkinlik kimligi (yoksa null). */
  etkinlikId: string | null;
};

export function sohbetTalepAlanlari(
  g: SohbetTalepGirdisi,
  yeniIs: boolean
): Record<string, unknown> {
  const talepTuru = g.talepTuru ?? 'quote';

  if (yeniIs) {
    return {
      request_type: talepTuru,
      event_date: g.tarih || null,
      event_type: g.tur,
      location: g.yer?.trim() || null,
      guest_count: g.kisiSayisi,
      budget_range: g.butce,
      brief_data: g.brief,
      start_time: g.baslangic || null,
      end_time: g.bitis || null,
      event_id: g.etkinlikId,
    };
  }

  // Ayni talebin guncellemesi: yalniz DOLU gelen alan yazilir.
  const alanlar: Record<string, unknown> = { request_type: talepTuru };
  if (g.tarih !== null) alanlar.event_date = g.tarih;
  if (g.tur !== null) alanlar.event_type = g.tur;
  if (g.yer !== null) alanlar.location = g.yer?.trim() || null;
  if (g.kisiSayisi !== null) alanlar.guest_count = g.kisiSayisi;
  if (g.butce !== null) alanlar.budget_range = g.butce;
  if (g.brief) alanlar.brief_data = g.brief;
  if (g.baslangic !== undefined && g.baslangic !== null)
    alanlar.start_time = g.baslangic;
  if (g.bitis !== undefined && g.bitis !== null) alanlar.end_time = g.bitis;
  // Duzeltme 12-A: yeni tarih saatsiz geldiyse onceki saatler bu tarihe ait
  // degildir; teklif formu eski saatle dolu acilmasin.
  if (g.tarih !== null && !g.baslangic) {
    alanlar.start_time = null;
    alanlar.end_time = null;
  }
  // Etkinlik bagi yalniz DOLU gelirse yazilir (bos deger eskisini ezmesin).
  if (g.etkinlikId) alanlar.event_id = g.etkinlikId;
  return alanlar;
}
