import Link from "next/link";

// Esprili boş durum. Her sayfa kendi ikon/başlık/mesaj/aksiyonunu verir.
// Eğlence sektörü diliyle: "sahne senin", "perde", "backstage" vb.
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      {/* İllüstrasyon dairesi */}
      <div className="w-20 h-20 rounded-2xl bg-terracotta-08 flex items-center justify-center mb-6 text-terracotta">
        {icon ?? (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M3 8l9 5 9-5M12 13v8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <h3 className="font-display text-2xl md:text-3xl text-ink mb-2 tracking-tight">
        {title}
      </h3>
      <p className="text-ink-72 max-w-md mb-7 leading-relaxed">{description}</p>

      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="kashe-tap inline-flex items-center gap-2 px-6 py-3 bg-terracotta text-paper rounded-lg font-display font-semibold hover:bg-ember transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
