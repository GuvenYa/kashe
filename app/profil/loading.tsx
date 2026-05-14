export default function ProfilLoading() {
  return (
    <div className="min-h-screen bg-paper px-6 md:px-12 py-16">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-12 gap-4">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-line rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-24 bg-line rounded animate-pulse" />
              <div className="h-9 w-48 bg-line rounded animate-pulse" />
              <div className="h-4 w-24 bg-line rounded animate-pulse" />
            </div>
          </div>
          <div className="w-24 h-11 bg-line rounded-lg animate-pulse" />
        </div>

        {/* Info card */}
        <div className="bg-white border border-line rounded-lg p-8 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 bg-line rounded animate-pulse" />
              <div className="h-5 w-2/3 bg-line rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}