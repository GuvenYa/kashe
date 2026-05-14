export default function KesfetLoading() {
  return (
    <div className="min-h-screen bg-paper px-6 md:px-12 py-16">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="h-3 w-20 bg-line rounded animate-pulse mb-3" />
          <div className="h-12 w-2/3 bg-line rounded animate-pulse mb-4" />
          <div className="h-5 w-1/2 bg-line rounded animate-pulse" />
        </div>

        {/* Filter bar */}
        <div className="bg-white border border-line rounded-lg p-5 mb-8">
          <div className="h-11 bg-line rounded animate-pulse" />
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-line rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-line rounded-full animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 bg-line rounded animate-pulse" />
                  <div className="h-5 w-3/4 bg-line rounded animate-pulse" />
                  <div className="h-3 w-20 bg-line rounded animate-pulse" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-full bg-line rounded animate-pulse" />
                <div className="h-3 w-4/5 bg-line rounded animate-pulse" />
              </div>
              <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
                <div className="h-3 w-20 bg-line rounded animate-pulse" />
                <div className="h-3 w-24 bg-line rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}