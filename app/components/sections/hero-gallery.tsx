"use client";

/**
 * Hero kayan foto galerisi — iki kolon, farklı hızlarda dikey kayar.
 * Görseller /public/hero/ altında sabit (pro-1..4.jpg).
 * (Dinamik avatar versiyonu git geçmişinde mevcut — gerçek profillere
 *  geçilmek istenirse geri alınabilir.)
 */

const COL_A = ["/hero/pro-1.jpg", "/hero/pro-3.jpg"];
const COL_B = ["/hero/pro-2.jpg", "/hero/pro-4.jpg"];

function Column({
  images,
  duration,
  offset,
}: {
  images: string[];
  duration: number;
  offset?: string;
}) {
  // İçeriği 2x tekrar et → kesintisiz döngü (-50% kayınca başa sarar)
  const doubled = [...images, ...images];
  return (
    <div
      className="flex-1 flex flex-col gap-3.5 kashe-scroll-up"
      style={
        {
          marginTop: offset,
          ["--kashe-scroll-dur" as string]: `${duration}s`,
        } as React.CSSProperties
      }
    >
      {doubled.map((src, i) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={`${src}-${i}`}
          src={src}
          alt=""
          className="w-full h-[210px] object-cover rounded-[18px]"
        />
      ))}
    </div>
  );
}

export function HeroGallery() {
  return (
    <div
      aria-hidden
      className="relative h-[560px] overflow-hidden rounded-3xl"
      style={{
        background: "linear-gradient(135deg, #faf7ff, #fdf4f9)",
      }}
    >
      <div className="absolute inset-0 flex gap-3.5 p-3.5">
        <Column images={COL_A} duration={22} />
        <Column images={COL_B} duration={28} offset="-70px" />
      </div>
      {/* Üst/alt yumuşak fade */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(0deg, #fff 0%, rgba(255,255,255,0.85) 8%, transparent 28%, transparent 72%, rgba(253,244,249,0.85) 92%, #fff 100%)",
        }}
      />
    </div>
  );
}