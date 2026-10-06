import { Link } from "react-router-dom";
import { TaskStatusBadge, ApplicationStatusBadge } from "./StatusBadge";
import { emojiFor } from "./ServiceSearch";
import {
  formatMoney,
  formatSchedule,
  timeAgo,
  timeUntil,
  type ApplicationStatus,
  type Task,
} from "../schemas/taskSchemas";

interface Props {
  task: Task;
  /** Worker views: show the worker's own application status instead of the task status */
  applicationStatus?: ApplicationStatus;
  index?: number;
}

export default function TaskCard({ task, applicationStatus, index = 0 }: Props) {
  const needsAttention = task.is_owner && task.status === "open" && (task.worker_cancelled || (task.pending_applications ?? 0) > 0);

  return (
    <Link
      to={`/tasks/${task.id}`}
      id={`task-card-${task.id}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className={`animate-slide-up group relative block bg-surface border rounded-2xl p-5 transition-all duration-300
        hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-900/5
        ${needsAttention ? "border-primary-light ring-1 ring-primary-light/60" : "border-border hover:border-primary-light"}`}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-ghost to-primary-light/70 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
          {emojiFor(`${task.subcategory_name ?? ""} ${task.category_name ?? ""}`)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-text truncate">{task.subcategory_name ?? "Task"}</h3>
              <p className="text-xs text-text-secondary truncate">{task.category_name}</p>
            </div>
            <p className="text-lg font-extrabold text-text whitespace-nowrap">{formatMoney(task.budget)}</p>
          </div>

          <p className="mt-2 text-sm text-text-secondary line-clamp-2">{task.description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-text-secondary">
            {applicationStatus ? <ApplicationStatusBadge status={applicationStatus} /> : <TaskStatusBadge status={task.status} />}

            <span className="inline-flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatSchedule(task.scheduled_at)}
              {task.status === "open" && <span className="text-primary font-medium">· {timeUntil(task.scheduled_at)}</span>}
            </span>

            {task.distance_km != null && (
              <span className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {task.distance_km} km away
              </span>
            )}

            {!task.is_owner && <span>Posted {timeAgo(task.created_at)}</span>}
          </div>

          {task.is_owner && task.status === "open" && (
            <div className="mt-3">
              {task.worker_cancelled ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                  ⚠️ Worker cancelled — review &amp; re-notify
                </span>
              ) : (task.pending_applications ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  {task.pending_applications} new application{task.pending_applications === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-xs text-text-secondary">Waiting for workers to apply…</span>
              )}
            </div>
          )}

          {task.is_owner && task.status === "assigned" && task.assigned_worker_name && (
            <p className="mt-3 text-xs font-medium text-sky-700">Assigned to @{task.assigned_worker_name}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex gap-4">
        <div className="w-12 h-12 rounded-2xl skeleton" />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 w-1/3 rounded skeleton" />
          <div className="h-3 w-2/3 rounded skeleton" />
          <div className="h-3 w-1/2 rounded skeleton" />
        </div>
      </div>
    </div>
  );
}
