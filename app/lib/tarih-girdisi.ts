/**
 * Tarih kutusuna tiklayinca takvimi acar.
 *
 * Neden: `<input type="date">` / `type="datetime-local"` tarayici varsayilaninda
 * YALNIZ sagdaki takvim ikonuna tiklayinca acilir; kutunun govdesine tiklamak
 * metin imleci birakir. Kullanici "takvim acilsin" bekliyor.
 *
 * CIFT TETIK (Tamamlayici 3): ikona tiklandiginda tarayici takvimi KENDI acar,
 * hemen ardindan bizim `showPicker()` cagrimiz ayni takvimi bir daha acmaya
 * calisir — acilan panel kapanir ya da cagri atar. Cozum: destek varsa
 * `preventDefault()` ile tarayicinin kendi acma davranisi bastirilir, acilis
 * TEK kaynaktan (bizden) olur. Destek yoksa hic karismayiz: `preventDefault`
 * cagrilmaz, tarayicinin ikon davranisi aynen calisir.
 *
 * `onClick` KULLANILIR, `onFocus` DEGIL: klavyeyle sekme tusuyla gezinirken
 * takvimin kendiliginden acilmasi gezinmeyi kirar.
 *
 * 'use client' YOKTUR: saf fonksiyon, cagiran istemci bilesenidir.
 */
export function takvimiAc(e: React.MouseEvent<HTMLInputElement>): void {
  const el = e.currentTarget;
  if (el.disabled || el.readOnly) return;
  // Destek yok: tarayici varsayilani (ikon tiklamasi) calissin.
  if (typeof el.showPicker !== 'function') return;
  e.preventDefault();
  try {
    el.showPicker();
  } catch {
    // Kullanici hareketi disinda cagrildiysa tarayici reddeder; sessiz gec.
  }
}
