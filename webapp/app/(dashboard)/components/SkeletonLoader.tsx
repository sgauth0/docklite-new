export default function SkeletonLoader({
  type = 'card',
  count = 3
}: {
  type?: 'card' | 'list' | 'database';
  count?: number;
}) {
  const items = Array.from({ length: count });

  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((_, i) => (
          <div
            key={i}
            className="card-vapor p-6 rounded-xl border border-purple-500/20 animate-pulse"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-purple-500/20"></div>
              <div className="w-20 h-6 rounded bg-purple-500/20"></div>
            </div>
            <div className="h-6 w-3/4 bg-purple-500/20 rounded mb-3"></div>
            <div className="h-4 w-1/2 bg-purple-500/20 rounded mb-4"></div>
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-purple-500/20 rounded"></div>
              <div className="h-8 w-20 bg-purple-500/20 rounded"></div>
              <div className="h-8 w-20 bg-purple-500/20 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="space-y-3">
        {items.map((_, i) => (
          <div
            key={i}
            className="card-vapor p-4 rounded-xl border border-purple-500/20 animate-pulse flex items-center justify-between"
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="w-10 h-10 rounded-full bg-purple-500/20"></div>
              <div className="flex-1">
                <div className="h-5 w-48 bg-purple-500/20 rounded mb-2"></div>
                <div className="h-4 w-32 bg-purple-500/20 rounded"></div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-16 bg-purple-500/20 rounded"></div>
              <div className="h-8 w-16 bg-purple-500/20 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'database') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {items.map((_, i) => (
          <div
            key={i}
            className="card-vapor p-6 rounded-xl border border-purple-500/20 animate-pulse"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20"></div>
              <div className="h-6 w-40 bg-purple-500/20 rounded"></div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-4 w-full bg-purple-500/20 rounded"></div>
              <div className="h-4 w-3/4 bg-purple-500/20 rounded"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-24 bg-purple-500/20 rounded"></div>
              <div className="h-8 w-24 bg-purple-500/20 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
