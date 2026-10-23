/**
 * GRAFIK TEMASI — recharts icin renk ve yazi sabitleri (TEK KAYNAK, FAZ 9a).
 *
 * 'use client' YOKTUR ve React de yok: hem `/admin/istatistikler` hem
 * `/admin/zeka` buradan okur. Ikinci bir grafik sayfasi acilinca sabitler
 * kopyalanacakti; kopya zamanla kayar ve iki sayfa farkli renklerde ayni seyi
 * anlatirdi.
 *
 * NEDEN HEX: recharts inline renk ister, CSS degiskeni (`var(--color-...)`)
 * almaz. Degerler `globals.css`'teki token'larla BIREBIR ayni tutulur; bir
 * token degisirse burasi da degisir.
 */
export const C = {
  paper: '#FFFFFF',
  brandInk: '#00ACE2', // Faz-1: CYAN — başat seri (lacivert grafikte siyaha kaçar, tek taşımaz)
  ink: '#040D26', // lacivert — eksen/ızgara/metin
  brandAccent: '#FA0B96', // Faz-1: pembe seri
  moss: '#1F8A5F', // yeşil — SEMANTİK başarı/onay (korunur)
  brandInkDeep: '#040D26', // lacivert — ikincil seri
};

export const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${C.ink}1A`,
  fontFamily: 'var(--font-body), sans-serif',
  fontSize: 13,
  background: '#fff',
};

export const SERIF = 'var(--font-display), sans-serif';
export const MONO = 'var(--font-mono), monospace';

/** Pasta/kategori serileri — sira sabit (ayni veri ayni renkte kalsin). */
export const PIE_PALETTE = [
  C.brandInk,
  C.brandAccent,
  C.moss,
  C.brandInkDeep,
  '#D98C3F',
  '#8C6B4F',
  '#4F6B8C',
  '#A86B2E',
];
