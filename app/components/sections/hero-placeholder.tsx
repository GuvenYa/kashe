/**
 * Hero davulu yüklenirken gösterilen NÖTR placeholder (HeroCollage flash'ı yerine).
 * Işıması, Hero3D kök DOM'undaki zümrüt gradyanla BİREBİR aynı → davul belirince
 * placeholder→davul swap'ında zemin sürekli kalır, sadece canvas fade-in olur (flash yok).
 * Boyut davulla aynı: masaüstü relative 540px / mobil absolute inset-0 (CLS yok). Animasyon yok.
 */
export function HeroPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 lg:relative lg:inset-auto lg:h-[540px]"
      style={{
        background:
          "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(31,92,74,0.07) 0%, transparent 70%)",
      }}
    />
  );
}
