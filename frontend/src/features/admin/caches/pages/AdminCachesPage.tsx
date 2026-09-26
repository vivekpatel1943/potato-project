import { useState, useEffect, useCallback } from "react";
import api from "../../../../shared/lib/api";

interface CacheEntry {
  key: string;
  ttl_seconds: number;
}

export default function AdminCachesPage() {
  const [caches, setCaches] = useState<CacheEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFlushing, setIsFlushing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCaches = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/admin/caches");
      setCaches(data.caches);
    } catch {
      showToast("Failed to load caches.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCaches();
  }, [fetchCaches]);

  const handleFlushSingle = async (key: string) => {
    // Strip the "cache:" prefix since the backend adds it back
    const shortKey = key.startsWith("cache:") ? key.slice(6) : key;
    setIsFlushing(key);
    try {
      await api.delete(`/admin/caches/${shortKey}`);
      setCaches((prev) => prev.filter((c) => c.key !== key));
      showToast(`✅ Flushed: ${key}`);
    } catch {
      showToast(`❌ Failed to flush: ${key}`);
    } finally {
      setIsFlushing(null);
    }
  };

  const handleFlushAll = async () => {
    setIsFlushing("all");
    try {
      const { data } = await api.delete("/admin/caches");
      setCaches([]);
      showToast(`✅ Flushed ${data.deleted_count} cache(s).`);
    } catch {
      showToast("❌ Failed to flush all caches.");
    } finally {
      setIsFlushing(null);
    }
  };

  const formatTTL = (seconds: number): string => {
    if (seconds < 0) return "No expiry";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-[fadeIn_200ms_ease-out]">
          <div className="px-5 py-3 bg-text text-white text-sm font-medium rounded-xl shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Cache Management</h1>
          <p className="mt-1 text-text-secondary">
            View and flush server-side Redis caches.
          </p>
        </div>
        {caches.length > 0 && (
          <button
            id="flush-all-btn"
            onClick={handleFlushAll}
            disabled={isFlushing !== null}
            className="px-5 py-2.5 bg-red-500 text-white font-semibold rounded-lg
              transition-all duration-200 cursor-pointer
              hover:bg-red-600 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFlushing === "all" ? "Flushing..." : "Flush All"}
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : caches.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <p className="text-text-secondary text-sm">
            No active caches found. Caches are created automatically when data is fetched.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/50">
                <th className="text-left px-6 py-3.5 font-semibold text-text-secondary uppercase tracking-wider text-xs">
                  Cache Key
                </th>
                <th className="text-left px-6 py-3.5 font-semibold text-text-secondary uppercase tracking-wider text-xs">
                  TTL Remaining
                </th>
                <th className="text-right px-6 py-3.5 font-semibold text-text-secondary uppercase tracking-wider text-xs">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {caches.map((entry) => (
                <tr
                  key={entry.key}
                  className="border-b border-border/50 last:border-none hover:bg-bg/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <code className="text-sm font-mono text-text bg-bg px-2 py-1 rounded">
                      {entry.key}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-text-secondary">
                    {formatTTL(entry.ttl_seconds)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleFlushSingle(entry.key)}
                      disabled={isFlushing !== null}
                      className="px-4 py-1.5 text-sm font-medium rounded-lg border border-border
                        text-text-secondary cursor-pointer
                        hover:bg-red-50 hover:border-red-200 hover:text-error
                        transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFlushing === entry.key ? "Flushing..." : "Flush"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
