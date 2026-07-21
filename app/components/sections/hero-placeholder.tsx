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
        // Hero3D base glow ile BİREBİR aynı: nötr lacivert merkez + çok düşük
        // opaklık cyan(üst-sol)/pembe(alt-sağ) dokunuş — statik, hafif. Tek başına
        // "bitmiş" görünsün (WebGL fallback yolu).
        background: [
          "radial-gradient(ellipse 70% 55% at 28% 22%, rgba(0,172,226,0.06) 0%, transparent 60%)",
          "radial-gradient(ellipse 65% 55% at 78% 82%, rgba(250,11,150,0.05) 0%, transparent 60%)",
          "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(4,13,38,0.07) 0%, transparent 70%)",
        ].join(", "),
      }}
    />
  );
}
