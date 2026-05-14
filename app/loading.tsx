export default function Loading() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-line border-t-terracotta rounded-full animate-spin" />
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-72">
          Yükleniyor
        </p>
      </div>
    </div>
  );
}