/**
 * Hero kolaj — sağ sütun, 3 görsel asimetrik grid.
 * Spec: HERO-REF.md §4-5
 * - ci-1: sol, 540px tam boy (grid-row: span 2)
 * - ci-2/ci-3: sağ üst/alt, her biri 263px (263+14gap+263=540)
 * - Mercan ★4.9 rozeti: sağ-üst köşede taşar, rotate(8deg)
 */
export function HeroCollage() {
  return (
    <div
      className="relative"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "14px",
        height: "540px",
      }}
    >
      {/* ★4.9 mercan rozeti — kolajın sağ-üst köşesinden taşar */}
      <div
        className="font-display absolute z-10"
        style={{
          top: "-14px",
          right: "-14px",
          background: "var(--color-plum)", /* mercan #E2674A */
          color: "#fff",
          width: "84px",
          height: "84px",
          borderRadius: "50%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: "rotate(8deg)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        <span style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1 }}>★4.9</span>
        <small style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "3px" }}>
          puan
        </small>
      </div>

      {/* ci-1 — sol kolon, iki satır kaplayan (Sahne & DJ) */}
      <div
        className="rounded-2xl overflow-hidden relative group"
        style={{ gridRow: "span 2", height: "540px" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-event.jpg"
          alt="Konser sahnesi"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 bottom-3 bg-white/95 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-xs font-semibold text-ink flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-terracotta inline-block" />
          Sahne &amp; DJ
        </div>
      </div>

      {/* ci-2 — sağ üst (Müzik) */}
      <div
        className="rounded-2xl overflow-hidden relative group"
        style={{ height: "263px" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/vibes-band.jpg"
          alt="Canlı müzik grubu"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 bottom-3 bg-white/95 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-xs font-semibold text-ink flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-terracotta inline-block" />
          Müzik
        </div>
      </div>

      {/* ci-3 — sağ alt (Fotoğraf) */}
      <div
        className="rounded-2xl overflow-hidden relative group"
        style={{ height: "263px" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/selin-aksoy.jpg"
          alt="Fotoğrafçı"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 bottom-3 bg-white/95 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-xs font-semibold text-ink flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-terracotta inline-block" />
          Fotoğraf
        </div>
      </div>
    </div>
  );
}
