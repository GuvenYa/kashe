/**
 * Tarih kutusuna tiklayinca takvimi acar.
 *
 * Neden: `<input type="date">` / `type="datetime-local"` tarayici varsayilaninda
 * YALNIZ sagdaki takvim ikonuna tiklayinca acilir; kutunun govdesine tiklamak
 * metin imleci birakir. Kullanici "takvim acilsin" bekliyor.
 *
 * `showPicker()` Chromium, Firefox ve Safari 16+ destekler; desteklemeyen
 * tarayicida cagri atar ve tarayici varsayilani kalir (bozulma yok).
 *
 * `onClick` KULLANILIR, `onFocus` DEGIL: klavyeyle sekme tusuyla gezinirken
 * takvimin kendiliginden acilmasi gezinmeyi kirar.
 *
 * 'use client' YOKTUR: saf fonksiyon, cagiran istemci bilesenidir.
 */
export function takvimiAc(e: React.MouseEvent<HTMLInputElement>): void {
  const el = e.currentTarget;
  if (el.disabled || el.readOnly) return;
  try {
    el.showPicker?.();
  } catch {
    // Destek yoksa ya da tarayici engellediyse: varsayilan davranis kalir.
  }
}
