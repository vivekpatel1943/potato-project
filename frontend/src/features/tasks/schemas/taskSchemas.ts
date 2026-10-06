import { isAxiosError } from "axios";

// ── Enums ────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

export type ApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "not_selected"
  | "withdrawn"
  | "cancelled";

// ── API types (mirror backend/app/features/tasks/schemas.py) ─────────────

export interface ServiceSearchResult {
  id: string;
  name: string;
  description: string | null;
  keywords: string[];
  category_id: string;
  category_name: string;
}

export interface MyApplicationSummary {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  proposed_budget: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  customer_id: string;
  customer_name: string | null;
  subcategory_id: string;
  subcategory_name: string | null;
  category_name: string | null;
  description: string;
  scheduled_at: string;
  latitude: number;
  longitude: number;
  address: string | null;
  budget: string; // Decimal serialised as string
  specific_requirements: string | null;
  status: TaskStatus;
  assigned_worker_id: string | null;
  assigned_worker_name: string | null;
  assigned_at: string | null;
  created_at: string;
  updated_at: string;

  is_owner: boolean;
  pending_applications: number | null;
  worker_cancelled: boolean;
  distance_km: number | null;
  my_application: MyApplicationSummary | null;
}

export interface Application {
  id: string;
  task_id: string;
  worker_id: string;
  worker_name: string | null;
  worker_avatar_url: string | null;
  status: ApplicationStatus;
  message: string | null;
  proposed_budget: string | null;
  distance_km: number | null;
  created_at: string;
}

export interface MyApplication {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  proposed_budget: string | null;
  distance_km: number | null;
  created_at: string;
  task: Task;
}

export interface TaskCreatePayload {
  subcategory_id: string;
  description: string;
  scheduled_at: string; // ISO with timezone
  latitude: number;
  longitude: number;
  address?: string | null;
  budget: number;
  specific_requirements?: string | null;
}

export type TaskUpdatePayload = Partial<Omit<TaskCreatePayload, "subcategory_id">>;

// ── Display helpers ──────────────────────────────────────────────────────

export const TASK_STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  assigned: { label: "Assigned", className: "bg-sky-50 text-sky-700 border-sky-200" },
  in_progress: { label: "In progress", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  completed: { label: "Completed", className: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  cancelled: { label: "Cancelled", className: "bg-rose-50 text-rose-700 border-rose-200" },
  expired: { label: "Expired", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approved 🎉", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Declined", className: "bg-rose-50 text-rose-700 border-rose-200" },
  not_selected: { label: "Not selected", className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  withdrawn: { label: "Withdrawn", className: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  cancelled: { label: "You cancelled", className: "bg-rose-50 text-rose-600 border-rose-200" },
};

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatSchedule(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function timeUntil(iso: string): string {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (s <= 0) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.round(h / 24)}d`;
}

/** Convert an ISO string to the value format of <input type="datetime-local"> (local time). */
export function toLocalInputValue(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error, /, "");
  }
  return fallback;
}
