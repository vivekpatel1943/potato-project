import { useState, useEffect, useRef, useCallback } from "react";
import api from "../../../shared/lib/api";

interface PublicWorker {
  user_id: string;
  user_name: string;
  avatar_url: string;
  rating: number;
  tasks_delivered: number;
  capabilities: string[];
}

export default function BrowseWorkersPage() {
  const [workers, setWorkers] = useState<PublicWorker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  
  const observer = useRef<IntersectionObserver | null>(null);
  const lastWorkerElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (isLoading) return;
      if (observer.current) observer.current.disconnect();
      
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      
      if (node) observer.current.observe(node);
    },
    [isLoading, hasMore]
  );

  useEffect(() => {
    let isMounted = true;
    const fetchWorkers = async () => {
      if (!hasMore) return;
      
      try {
        setIsLoading(true);
        const limit = 10;
        const skip = page * limit;
        const { data } = await api.get(`/workers/?skip=${skip}&limit=${limit}`);
        
        if (isMounted) {
          setWorkers((prev) => {
            // Filter out duplicates just in case
            const existingIds = new Set(prev.map(w => w.user_id));
            const newWorkers = data.filter((w: PublicWorker) => !existingIds.has(w.user_id));
            return [...prev, ...newWorkers];
          });
          if (data.length < limit) {
            setHasMore(false); // No more workers to load
          }
        }
      } catch (err) {
        console.error("Failed to load workers", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    fetchWorkers();
    
    return () => { isMounted = false; };
  }, [page, hasMore]); // Add hasMore to deps to be safe

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text">Browse Workers</h2>
        <p className="text-sm text-text-secondary mt-1">
          Find skilled professionals for your tasks.
        </p>
      </div>

      {workers.length === 0 && !isLoading ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-text-secondary">No workers are currently available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker, index) => {
            const isLast = index === workers.length - 1;
            return (
              <div
                key={worker.user_id}
                ref={isLast ? lastWorkerElementRef : null}
                onClick={() => console.log("Navigate to", worker.user_id)}
                className="group bg-surface border border-border rounded-2xl p-5 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col"
              >
                {/* Avatar & Header */}
                <div className="flex flex-col items-center mb-4">
                  <div className="relative">
                    <img
                      src={worker.avatar_url}
                      alt={worker.user_name}
                      className="w-20 h-20 rounded-full object-cover border-4 border-surface shadow-sm"
                    />
                    {/* Online Indicator */}
                    <div className="absolute bottom-1 right-1 w-4 h-4 bg-success border-2 border-surface rounded-full shadow-sm" />
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-text">@{worker.user_name}</h3>
                  
                  {/* Stats Row */}
                  <div className="flex items-center gap-3 mt-1.5 text-sm">
                    <span className="flex items-center gap-1 font-medium text-text">
                      <span className="text-yellow-500">⭐</span> {worker.rating}
                    </span>
                    <span className="w-1 h-1 bg-border rounded-full" />
                    <span className="text-text-secondary">
                      {worker.tasks_delivered} delivered
                    </span>
                  </div>
                </div>

                {/* Capabilities Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-6 flex-1">
                  {worker.capabilities.map((cap, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase bg-primary-ghost text-primary rounded-full border border-primary-light"
                    >
                      {cap}
                    </span>
                  ))}
                </div>

                {/* Action Button */}
                <button
                  disabled
                  onClick={(e) => e.stopPropagation()}
                  className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg opacity-50 cursor-not-allowed text-sm"
                >
                  Request Service
                </button>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Loading Indicator for Infinite Scroll */}
      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
