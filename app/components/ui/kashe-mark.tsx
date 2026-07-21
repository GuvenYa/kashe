// Kashe işareti — Faz-1 rebrand: inline SVG (daire+nokta) İPTAL edildi; public
// PNG varlıkları kullanılır. Props (variant/className/title) ve boyut davranışı
// AYNI kalır (TopNav w-8 h-8, footer variant="dark"). Faz-2'de gerçek SVG gelince
// inline'a dönülecek.
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
