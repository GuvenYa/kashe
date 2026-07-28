// Kashe işareti — public PNG varlıkları kullanılır. Props (variant/className/
// title) ve boyut davranışı sabittir (TopNav w-8 h-8, footer variant="dark").
//
// CANLI İŞARET: iç içe geçmiş PLAY ÜÇGENİ — dış çerçeveler ink #040D26, iç halka
// --gradient-brand (cyan #00ACE2 → magenta #FA0B96), ortası negatif, zemin saydam.
// Eski "k" işareti (daire + huzme kol + nokta) TERK EDİLDİ; SVG'leri
// docs/archive/logo-k-mark/ altında tarihsel referans olarak duruyor.
//
// FAZ-2 (inline SVG): play üçgeni SIFIRDAN çizilecek — arşivdeki k-mark SVG'leri
// kaynak alınmaz. Gradyan, SVG <linearGradient> ile --gradient-brand'i yeniden
// üretecek (tek kaynak globals.css). Bkz. DESIGN.md → Marka İşareti.
type Variant = 'default' | 'dark' | 'mono';

const SRC: Record<Variant, string> = {
  default: '/kashe-mark.png', // açık zeminler — lacivert logo
  dark: '/kashe-mark-white.png', // koyu zeminler — beyaz logo
  mono: '/kashe-mark.png', // Faz-1: ayrı mono PNG yok → standart mark
};

export function KasheMark({
  variant = 'default',
  className,
  title = 'Kashe',
}: {
  variant?: Variant;
  className?: string;
  title?: string;
}) {
  // Boş title → dekoratif (aria-hidden); yanında görünür "Kashe" metni olan
  // kullanımlar (footer) böyle işaretlenir.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC[variant]}
      alt={title || 'Kashe'}
      className={className}
      {...(title ? {} : { 'aria-hidden': true })}
    />
  );
}
