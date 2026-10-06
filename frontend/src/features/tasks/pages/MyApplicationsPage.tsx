import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TaskCard, { TaskCardSkeleton } from "../components/TaskCard";
import { taskApi } from "../lib/taskApi";
import type { MyApplication } from "../schemas/taskSchemas";

type Filter = "upcoming" | "pending" | "history";

export default function MyApplicationsPage() {
  const [apps, setApps] = useState<MyApplication[] | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");

  useEffect(() => {
    taskApi.myApplications().then(setApps).catch(() => setApps([]));
  }, []);

  const groups = useMemo(() => {
    const g: Record<Filter, MyApplication[]> = { upcoming: [], pending: [], history: [] };
    for (const a of apps ?? []) {
      if (a.status === "approved" && a.task.status === "assigned") g.upcoming.push(a);
      else if (a.status === "pending" && a.task.status === "open") g.pending.push(a);
      else g.history.push(a);
    }
    g.upcoming.sort((x, y) => +new Date(x.task.scheduled_at) - +new Date(y.task.scheduled_at));
    return g;
  }, [apps]);

  // Default to whichever tab has something
  useEffect(() => {
    if (!apps) return;
    if (groups.upcoming.length === 0 && groups.pending.length > 0) setFilter("pending");
  }, [apps, groups.upcoming.length, groups.pending.length]);

  const labels: Record<Filter, string> = { upcoming: "Upcoming", pending: "Pending", history: "History" };
  const list = groups[filter];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-text">My jobs</h1>
        <p className="text-sm text-text-secondary mt-1">Jobs you've been hired for and tasks you've applied to.</p>
      </div>

      <div className="inline-flex bg-surface border border-border rounded-xl p-1">
        {(Object.keys(labels) as Filter[]).map((f) => (
          <button
            key={f}
            id={`jobs-filter-${f}`}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              filter === f ? "bg-text text-white shadow" : "text-text-secondary hover:text-text"
            }`}
          >
            {labels[f]} ({groups[f].length})
          </button>
        ))}
      </div>

      {apps === null ? (
        <div className="space-y-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center bg-surface border border-dashed border-border rounded-3xl p-10">
          <div className="text-5xl mb-3 animate-floaty">{filter === "upcoming" ? "📅" : filter === "pending" ? "⏳" : "🗂️"}</div>
          <p className="font-semibold text-text">
            {filter === "upcoming" ? "No upcoming jobs" : filter === "pending" ? "No pending applications" : "Nothing here yet"}
          </p>
          <Link to="/find-tasks" className="inline-block mt-4 text-sm font-semibold text-primary hover:underline">
            Find tasks near you →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a, i) => (
            <TaskCard key={a.id} task={{ ...a.task, distance_km: a.distance_km }} applicationStatus={a.status} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
