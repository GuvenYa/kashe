// Kashe KELIME ISARETI — kucuk harf "kashe" ozel cizimi (Duzeltme 10-B,
// bulgu 74). Kilavuz logo: oynat ucgeni + bu kelime isareti; sitede isaretin
// yaninda `font-display` BUYUK HARF "Kashe" METNI duruyordu, yani logo
// kilavuzdakinden farkli gorunuyordu. Artik metin yerine bu varlik cizilir.
//
// Varliklar lockup'tan kesildi: /kashe-wordmark.png (lacivert, 325x96) ve
// /kashe-wordmark-white.png (beyaz, 326x96). Yukseklik CAGIRANIN sinifindan
// gelir, genislik `w-auto` ile orana gore — oran lockup'takiyle ayni kalsin
// (isaret `h-8` yaninda kelime isareti `h-4`).
type Variant = 'default' | 'dark';

const SRC: Record<Variant, string> = {
  default: '/kashe-wordmark.png', // acik zeminler — lacivert
  dark: '/kashe-wordmark-white.png', // koyu zeminler — beyaz
};

export function KasheWordmark({
  variant = 'default',
  className,
  title = 'Kashe',
}: {
  variant?: Variant;
  className?: string;
  title?: string;
}) {
  // Bos title -> dekoratif (aria-hidden): baglantinin erisilebilir adi baska
  // bir yerde veriliyorsa kelime isareti iki kez okunmasin.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[variant]}
      alt={title || 'Kashe'}
      className={`w-auto ${className ?? ''}`}
      {...(title ? {} : { 'aria-hidden': true })}
    />
  );
}
