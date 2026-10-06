import { ApplicationStatusBadge } from "./StatusBadge";
import { formatMoney, timeAgo, type Application } from "../schemas/taskSchemas";

interface Props {
  app: Application;
  taskBudget: string;
  canDecide: boolean;
  busy: "approve" | "reject" | null;
  onApprove: () => void;
  onReject: () => void;
}

export default function ApplicationCard({ app, taskBudget, canDecide, busy, onApprove, onReject }: Props) {
  const isPending = app.status === "pending";
  const counter = app.proposed_budget && parseFloat(app.proposed_budget) !== parseFloat(taskBudget);
  const dimmed = ["rejected", "not_selected", "cancelled"].includes(app.status);

  return (
    <div
      id={`application-${app.id}`}
      className={`animate-slide-up bg-surface border rounded-2xl p-4 sm:p-5 transition-all duration-200
        ${app.status === "approved" ? "border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/30" : "border-border"}
        ${dimmed ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3.5">
        {app.worker_avatar_url ? (
          <img src={app.worker_avatar_url} alt={app.worker_name ?? "Worker"} className="w-12 h-12 rounded-full object-cover border-2 border-surface shadow" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary-ghost flex items-center justify-center text-lg font-bold text-primary">
            {(app.worker_name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-text truncate">@{app.worker_name}</p>
              <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
                <span className="text-yellow-500">★</span> 4.8
                {app.distance_km != null && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    {app.distance_km} km away
                  </>
                )}
                <span className="w-1 h-1 rounded-full bg-border" />
                {timeAgo(app.created_at)}
              </div>
            </div>
            {!isPending && <ApplicationStatusBadge status={app.status} />}
          </div>

          {app.message && (
            <p className="mt-2.5 text-sm text-text bg-bg rounded-xl px-3.5 py-2.5 border border-border/70">“{app.message}”</p>
          )}

          <p className="mt-2.5 text-sm">
            <span className="font-bold text-text">{formatMoney(app.proposed_budget ?? taskBudget)}</span>
            {counter && <span className="ml-2 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">counter-offer</span>}
          </p>

          {isPending && canDecide && (
            <div className="mt-4 flex gap-2.5">
              <button
                id={`reject-${app.id}`}
                type="button"
                onClick={onReject}
                disabled={busy !== null}
                className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-border text-text-secondary
                  hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all duration-150 cursor-pointer disabled:opacity-50"
              >
                {busy === "reject" ? "Declining…" : "Reject"}
              </button>
              <button
                id={`approve-${app.id}`}
                type="button"
                onClick={onApprove}
                disabled={busy !== null}
                className="flex-[1.4] px-4 py-2.5 text-sm font-bold rounded-xl text-white bg-gradient-to-r from-emerald-500 to-emerald-600
                  shadow-md shadow-emerald-500/25 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {busy === "approve" ? "Approving…" : "Approve ✓"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
