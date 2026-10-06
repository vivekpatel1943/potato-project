import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { approvalApi, type PendingWorker } from "../lib/approvalApi";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AdminApprovalsPage() {
  const [workers, setWorkers] = useState<PendingWorker[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWorkers(await approvalApi.listPending());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Worker Approvals</h1>
        <p className="mt-1 text-text-secondary">
          Review and approve pending worker profiles.
        </p>
      </div>

      {loading ? (
        /* Skeleton rows */
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-surface border border-border rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : workers.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 text-text-secondary">
          <p className="text-5xl mb-4">✅</p>
          <p className="text-lg font-semibold text-text">All caught up!</p>
          <p className="text-sm mt-1">No workers waiting for approval.</p>
        </div>
      ) : (
        /* Table */
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg/50">
                  <th className="text-left px-5 py-3.5 font-semibold text-text-secondary text-xs uppercase tracking-wider">
                    Worker
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-secondary text-xs uppercase tracking-wider hidden sm:table-cell">
                    Email
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-secondary text-xs uppercase tracking-wider hidden md:table-cell">
                    Phone
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-secondary text-xs uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-5 py-3.5 font-semibold text-text-secondary text-xs uppercase tracking-wider hidden sm:table-cell">
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w, i) => (
                  <tr
                    key={w.user_id}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    className="animate-slide-up border-b border-border last:border-0 hover:bg-primary-ghost/30 transition-colors"
                  >
                    {/* Worker — Avatar + Username link */}
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/admin/approvals/${w.user_id}`}
                        className="inline-flex items-center gap-3 group"
                      >
                        <img
                          src={w.avatar_url}
                          alt={w.user_name}
                          className="w-10 h-10 rounded-full object-cover border border-border group-hover:ring-2 group-hover:ring-primary-light transition-all"
                        />
                        <span className="font-semibold text-text group-hover:text-primary transition-colors">
                          {w.user_name}
                        </span>
                      </Link>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-3.5 text-text-secondary hidden sm:table-cell">
                      {w.email}
                    </td>

                    {/* Phone */}
                    <td className="px-5 py-3.5 text-text-secondary hidden md:table-cell">
                      {w.phone ?? "—"}
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60 animate-ping" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                        </span>
                        Pending
                      </span>
                    </td>

                    {/* Submitted */}
                    <td className="px-5 py-3.5 text-text-secondary text-xs hidden sm:table-cell">
                      {timeAgo(w.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
