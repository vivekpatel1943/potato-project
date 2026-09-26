export default function BrowseWorkersPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text">Browse Workers</h2>
        <p className="text-sm text-text-secondary mt-1">
          Find skilled professionals for your tasks.
        </p>
      </div>

      {/* Placeholder Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-2xl p-5 shadow-sm animate-pulse"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-border" />
              <div className="flex-1">
                <div className="h-4 bg-border rounded w-24 mb-2" />
                <div className="h-3 bg-border/60 rounded w-16" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-6 bg-border/40 rounded-full w-16" />
              <div className="h-6 bg-border/40 rounded-full w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon notice */}
      <div className="bg-primary-ghost border border-primary-light rounded-2xl p-6 text-center">
        <p className="text-sm text-text">
          <span className="font-semibold">Coming soon!</span>{" "}
          Worker browsing and profiles will be available once workers start joining the platform.
        </p>
      </div>
    </div>
  );
}
