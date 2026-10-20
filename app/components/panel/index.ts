/**
 * Panel bilesenleri — dis aktarim noktasi (tasarim dili v2, D1a).
 *
 * Sayfalar buradan import eder; tek tek dosya yollari sayfalara dagilmaz.
 * Ayrinti: DESIGN.md bolum 9.
 */
export { PanelKabugu } from './panel-kabugu';
export { PanelBaslik } from './panel-baslik';
export { KpiKutu, KpiSatir } from './kpi-kutu';
export { OzetKutuSatiri, type OzetKutusu } from './ozet-kutu-satiri';
export {
  VeriTablosu,
  type VeriSutunu,
  type VeriSatiri,
} from './veri-tablosu';
export { PanelYanMenu, type PanelHesap } from './panel-yan-menu';

/** Panel kartlarinin ortak kabu — gosterge listeleri bunu kullanir. */
export { PanelKart } from './panel-kart';
