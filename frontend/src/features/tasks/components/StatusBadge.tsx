import {
  APPLICATION_STATUS_META,
  TASK_STATUS_META,
  type ApplicationStatus,
  type TaskStatus,
} from "../schemas/taskSchemas";

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border ${meta.className}`}>
      {status === "open" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      {meta.label}
    </span>
  );
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = APPLICATION_STATUS_META[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full border ${meta.className}`}>
      {meta.label}
    </span>
  );
}
