export function BrandMark({ size = "default" }: { size?: "default" | "lg" }) {
  const dimensions = {
    default: { box: "w-8 h-8", text: "text-2xl" },
    lg: { box: "w-12 h-12", text: "text-3xl" },
  };
  const d = dimensions[size];
  return (
    <a href="/" className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="Kashe" className={`${d.box} rounded-lg`} />
      <span className={`font-display font-semibold ${d.text} text-ink tracking-tight`}>
        Kashe
      </span>
    </a>
  );
}