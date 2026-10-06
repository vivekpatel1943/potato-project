import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import TaskCard, { TaskCardSkeleton } from "../components/TaskCard";
import { taskApi } from "../lib/taskApi";
import { getErrorMessage, type Task } from "../schemas/taskSchemas";
import { useAppStore } from "../../app/stores/appStore";

export default function AvailableTasksPage() {
  const { hasWorkerProfile, isWorkerVerified, isAvailable } = useAppStore();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setTasks(await taskApi.available());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load tasks."));
      setTasks([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hasWorkerProfile && isWorkerVerified) load();
  }, [hasWorkerProfile, isWorkerVerified, load]);

  // Refresh when the tab regains focus (e.g. after tapping a push notification)
  useEffect(() => {
    const onFocus = () => hasWorkerProfile && isWorkerVerified && load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hasWorkerProfile, isWorkerVerified, load]);

  if (!hasWorkerProfile || !isWorkerVerified) {
    return (
      <div className="max-w-xl mx-auto text-center bg-surface border border-border rounded-3xl p-10">
        <div className="text-5xl mb-3">🛠️</div>
        <h1 className="text-xl font-bold text-text mb-2">
          {hasWorkerProfile ? "Your profile is under review" : "Become a worker to find tasks"}
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          {hasWorkerProfile
            ? "Once you're verified, nearby tasks matching your services will appear here."
            : "Create a worker profile to start earning on Potato."}
        </p>
        <Link to={hasWorkerProfile ? "/profile" : "/become-worker"} className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold">
          {hasWorkerProfile ? "View profile" : "Get started"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text">Tasks near you</h1>
          <p className="text-sm text-text-secondary mt-1">Open tasks within 10 km that match your services.</p>
        </div>
        <button
          id="refresh-tasks-btn"
          onClick={load}
          disabled={refreshing}
          className="shrink-0 p-2.5 rounded-xl border border-border bg-surface text-text-secondary hover:text-primary hover:border-primary transition-colors cursor-pointer disabled:opacity-60"
          aria-label="Refresh"
        >
          <svg className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {!isAvailable && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <span className="text-xl">🌙</span>
          <div className="text-sm">
            <p className="font-semibold text-text">You're offline</p>
            <p className="text-text-secondary">
              You can browse, but you won't get notified or be able to apply.{" "}
              <Link to="/profile" className="text-primary font-semibold hover:underline">Go online</Link>
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      {tasks === null ? (
        <div className="space-y-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center bg-surface border border-dashed border-border rounded-3xl p-10">
          <div className="text-5xl mb-3 animate-floaty">🛰️</div>
          <p className="font-semibold text-text">No open tasks nearby right now</p>
          <p className="text-sm text-text-secondary mt-1">
            {isAvailable
              ? "Stay online — we'll send you a notification the moment one is posted."
              : "Go online to get notified when new tasks are posted."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t, i) => (
            <TaskCard key={t.id} task={t} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
