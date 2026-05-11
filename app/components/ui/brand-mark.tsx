export function BrandMark({ size = "default" }: { size?: "default" | "lg" }) {
  const dimensions = {
    default: { box: "w-8 h-8", text: "text-2xl", letter: "text-xl" },
    lg: { box: "w-12 h-12", text: "text-3xl", letter: "text-2xl" },
  };
  const d = dimensions[size];

  return (
    <a href="/" className="inline-flex items-center gap-2.5">
      <span
        className={`${d.box} bg-terracotta flex items-center justify-center text-paper font-display font-semibold ${d.letter} leading-none`}
      >
        <em
          className="text-paper not-italic font-light"
          style={{
            fontStyle: "italic",
            fontVariationSettings: '"SOFT" 100',
          }}
        >
          k
        </em>
      </span>
      <span className={`font-display font-semibold ${d.text} text-ink tracking-tight`}>
        Kashe
      </span>
    </a>
  );
}