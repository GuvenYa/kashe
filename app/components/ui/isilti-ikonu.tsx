/**
 * Isilti (sparkle) ikonu — Kashe AI / "Etkinliğini planla" eylemini isaretler.
 *
 * Duzeltme 11-A2: ayni yol ust barda iki yerde ve mobil menude cizilecekti;
 * uc kopya yerine tek bilesen. Suslemedir: `aria-hidden`.
 */
export function IsiltiIkonu({
  className = '',
  size = 14,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
    </svg>
  );
}
