import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TaskCard, { TaskCardSkeleton } from "../components/TaskCard";
import { taskApi } from "../lib/taskApi";
import type { Task } from "../schemas/taskSchemas";

type Filter = "active" | "past";

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [filter, setFilter] = useState<Filter>("active");

  useEffect(() => {
    taskApi.mine().then(setTasks).catch(() => setTasks([]));
  }, []);

  const { active, past } = useMemo(() => {
    const a: Task[] = [];
    const p: Task[] = [];
    for (const t of tasks ?? []) (["open", "assigned", "in_progress"].includes(t.status) ? a : p).push(t);
    // tasks needing attention first
    a.sort((x, y) => Number(y.worker_cancelled || (y.pending_applications ?? 0) > 0) - Number(x.worker_cancelled || (x.pending_applications ?? 0) > 0));
    return { active: a, past: p };
  }, [tasks]);

  const list = filter === "active" ? active : past;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text">My tasks</h1>
          <p className="text-sm text-text-secondary mt-1">Track applications and manage your posted tasks.</p>
        </div>
        <Link
          to="/tasks/new"
          id="new-task-btn"
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-bold rounded-xl shadow-md shadow-primary/25 hover:-translate-y-0.5 transition-all"
        >
          <span className="text-lg leading-none">+</span> Post a task
        </Link>
      </div>

      <div className="inline-flex bg-surface border border-border rounded-xl p-1">
        {(["active", "past"] as Filter[]).map((f) => (
          <button
            key={f}
            id={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              filter === f ? "bg-text text-white shadow" : "text-text-secondary hover:text-text"
            }`}
          >
            {f === "active" ? `Active (${active.length})` : `Past (${past.length})`}
          </button>
        ))}
      </div>

      {tasks === null ? (
        <div className="space-y-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center bg-surface border border-dashed border-border rounded-3xl p-10">
          <div className="text-5xl mb-3 animate-floaty">{filter === "active" ? "📝" : "🗂️"}</div>
          <p className="font-semibold text-text">{filter === "active" ? "No active tasks" : "No past tasks yet"}</p>
          {filter === "active" && (
            <Link to="/tasks/new" className="inline-block mt-4 text-sm font-semibold text-primary hover:underline">
              Post your first task →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((t, i) => (
            <TaskCard key={t.id} task={t} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
