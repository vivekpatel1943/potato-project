import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { taskApi } from "../lib/taskApi";
import TaskForm, { type TaskFormValues } from "../components/TaskForm";
import ApplicationCard from "../components/ApplicationCard";
import { TaskStatusBadge, ApplicationStatusBadge } from "../components/StatusBadge";
import { emojiFor } from "../components/ServiceSearch";
import ConfirmDialog from "../../../shared/components/ConfirmDialog";
import { useToast } from "../../../shared/components/Toast";
import { useAppStore } from "../../app/stores/appStore";
import {
  formatMoney,
  formatSchedule,
  getErrorMessage,
  timeAgo,
  timeUntil,
  type Application,
  type Task,
} from "../schemas/taskSchemas";

type Confirm =
  | { kind: "approve"; app: Application }
  | { kind: "cancelTask" }
  | { kind: "cancelAssignment" }
  | { kind: "withdraw" }
  | null;

export default function TaskDetailPage() {
  const { id: taskId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, Toast } = useToast();
  const { isAvailable } = useAppStore();

  const [task, setTask] = useState<Task | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [justCreated, setJustCreated] = useState(Boolean((location.state as { justCreated?: boolean } | null)?.justCreated));

  // Apply form (worker)
  const [message, setMessage] = useState("");
  const [counter, setCounter] = useState("");
  const [applying, setApplying] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const t = await taskApi.get(taskId);
        setTask(t);
        if (t.is_owner) setApps(await taskApi.applications(taskId));
      } catch {
        if (!silent) setNotFound(true);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [taskId]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Owner: quietly refresh while the task is open so new applications show up
  useEffect(() => {
    if (!task?.is_owner || task.status !== "open" || editing) return;
    const id = setInterval(() => load(true), 20_000);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [task?.is_owner, task?.status, editing, load]);

  useEffect(() => {
    if (!justCreated) return;
    const t = setTimeout(() => setJustCreated(false), 8000);
    return () => clearTimeout(t);
  }, [justCreated]);

  // ── Owner actions ──
  const saveEdit = async (values: TaskFormValues) => {
    setSaving(true);
    try {
      const t = await taskApi.update(taskId, values);
      setTask(t);
      setEditing(false);
      toast(t.worker_cancelled ? "Saved. Now re-notify workers when you're ready." : "Task updated", "success");
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const reopenNotify = async () => {
    setBusy(true);
    try {
      const { task: t, notified_workers } = await taskApi.reopenNotify(taskId);
      setTask(t);
      setApps(await taskApi.applications(taskId));
      toast(
        notified_workers > 0
          ? `🔔 ${notified_workers} worker${notified_workers === 1 ? "" : "s"} notified`
          : "Task reopened. No workers are online nearby right now — it's visible in their feed.",
        "success"
      );
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (app: Application, action: "approve" | "reject") => {
    setDeciding({ id: app.id, action });
    try {
      if (action === "approve") {
        const t = await taskApi.approve(taskId, app.id);
        setTask(t);
        toast(`🎉 @${app.worker_name} is on it!`, "success");
      } else {
        await taskApi.reject(taskId, app.id);
        toast(`Declined @${app.worker_name}`);
      }
      setApps(await taskApi.applications(taskId));
    } catch (err) {
      toast(getErrorMessage(err), "error");
      load(true);
    } finally {
      setDeciding(null);
      setConfirm(null);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    if (confirm.kind === "approve") return decide(confirm.app, "approve");
    setBusy(true);
    try {
      if (confirm.kind === "cancelTask") {
        setTask(await taskApi.cancel(taskId));
        toast("Task cancelled");
      } else if (confirm.kind === "cancelAssignment") {
        setTask(await taskApi.cancelAssignment(taskId));
        toast("You've cancelled this job. The customer has been notified.");
      } else if (confirm.kind === "withdraw") {
        setTask(await taskApi.withdraw(taskId));
        toast("Application withdrawn");
      }
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  // ── Worker actions ──
  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplying(true);
    try {
      const c = parseFloat(counter);
      const t = await taskApi.apply(taskId, {
        message: message.trim() || null,
        proposed_budget: counter && !isNaN(c) && c > 0 ? c : null,
      });
      setTask(t);
      setMessage("");
      setCounter("");
      toast("Application sent! You'll be notified when the customer decides.", "success");
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setApplying(false);
    }
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-24 rounded-3xl skeleton" />
        <div className="h-64 rounded-3xl skeleton" />
      </div>
    );
  }

  if (notFound || !task) {
    return (
      <div className="max-w-xl mx-auto text-center bg-surface border border-border rounded-3xl p-10">
        <div className="text-5xl mb-3">🔍</div>
        <h1 className="text-xl font-bold text-text mb-2">Task not found</h1>
        <p className="text-sm text-text-secondary mb-6">It may have been removed or is no longer available.</p>
        <button onClick={() => navigate(-1)} className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold cursor-pointer">
          Go back
        </button>
      </div>
    );
  }

  const owner = task.is_owner;
  const myApp = task.my_application;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`;
  const pendingApps = apps.filter((a) => a.status === "pending");
  const otherApps = apps.filter((a) => a.status !== "pending");
  const canApply = !owner && task.status === "open" && (!myApp || myApp.status === "withdrawn");

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-6">
      {Toast}

      <button
        onClick={() => navigate(owner ? "/my-tasks" : myApp ? "/my-jobs" : "/find-tasks")}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {owner ? "My tasks" : myApp ? "My jobs" : "Find tasks"}
      </button>

      {/* Just created */}
      {owner && justCreated && (
        <div className="animate-slide-up relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10" />
          <p className="text-lg font-bold">Task posted! 🚀</p>
          <p className="text-sm text-white/90">Nearby verified workers are being notified. Applications will appear below.</p>
        </div>
      )}

      {/* Worker cancelled → reopen flow */}
      {owner && task.status === "open" && task.worker_cancelled && !editing && (
        <div className="animate-slide-up rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-surface p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h2 className="font-bold text-text">The assigned worker cancelled</h2>
              <p className="text-sm text-text-secondary mt-1">
                Your task is open again. Edit the details if needed, then re-notify workers — previously
                unselected workers will be able to apply again.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 mt-4">
                <button
                  id="edit-task-btn"
                  onClick={() => setEditing(true)}
                  className="px-5 py-2.5 rounded-xl border border-border bg-surface text-sm font-semibold text-text hover:border-text transition-colors cursor-pointer"
                >
                  ✏️ Edit task
                </button>
                <button
                  id="reopen-notify-btn"
                  onClick={reopenNotify}
                  disabled={busy}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-bold shadow-md shadow-primary/25 hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-60"
                >
                  {busy ? "Notifying…" : "🔔 Reopen & notify workers"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header + details */}
      <article className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="relative p-5 sm:p-7 bg-gradient-to-br from-primary-ghost via-surface to-surface">
          <div className="absolute right-5 top-5 text-6xl opacity-15 select-none animate-floaty">
            {emojiFor(`${task.subcategory_name} ${task.category_name}`)}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <TaskStatusBadge status={task.status} />
            {myApp && <ApplicationStatusBadge status={myApp.status} />}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{task.category_name}</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text">{task.subcategory_name}</h1>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-text">{formatMoney(task.budget)}</span>
            <span className="text-sm text-text-secondary">budget</span>
          </div>
        </div>

        {editing ? (
          <div className="p-5 sm:p-7 border-t border-border">
            <h2 className="text-lg font-bold text-text mb-5">Edit task</h2>
            <TaskForm
              initial={{
                description: task.description,
                scheduled_at: task.scheduled_at,
                latitude: task.latitude,
                longitude: task.longitude,
                address: task.address,
                budget: parseFloat(task.budget),
                specific_requirements: task.specific_requirements,
              }}
              submitLabel="Save changes"
              submitting={saving}
              onSubmit={saveEdit}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="p-5 sm:p-7 border-t border-border space-y-5">
            <p className="text-base text-text whitespace-pre-line">{task.description}</p>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-bg border border-border/70 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">When</dt>
                <dd className="text-sm font-semibold text-text">{formatSchedule(task.scheduled_at)}</dd>
                {task.status === "open" && <dd className="text-xs text-primary font-medium mt-0.5">{timeUntil(task.scheduled_at)}</dd>}
              </div>
              <div className="rounded-2xl bg-bg border border-border/70 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">Where</dt>
                <dd className="text-sm font-semibold text-text truncate">{task.address || "Pinned location"}</dd>
                <dd className="text-xs mt-0.5 flex items-center gap-2">
                  {task.distance_km != null && <span className="text-text-secondary">{task.distance_km} km from you ·</span>}
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-primary font-medium hover:underline">
                    Open in Maps ↗
                  </a>
                </dd>
              </div>
            </dl>

            {task.specific_requirements && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">Requirements</p>
                <p className="text-sm text-text whitespace-pre-line">{task.specific_requirements}</p>
              </div>
            )}

            {!owner && (
              <p className="text-xs text-text-secondary">
                Posted by @{task.customer_name} · {timeAgo(task.created_at)}
              </p>
            )}

            {owner && ["open", "assigned"].includes(task.status) && (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {task.status === "open" && !task.worker_cancelled && (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text hover:border-text transition-colors cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                )}
                <button
                  id="cancel-task-btn"
                  onClick={() => setConfirm({ kind: "cancelTask" })}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  Cancel task
                </button>
              </div>
            )}
          </div>
        )}
      </article>

      {/* ── OWNER: assigned worker + applications ── */}
      {owner && task.status === "assigned" && task.assigned_worker_name && (
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-surface p-5 flex items-center gap-4 animate-slide-up">
          <div className="w-12 h-12 rounded-full bg-sky-500 text-white flex items-center justify-center text-xl font-bold shadow-lg shadow-sky-500/30">
            {task.assigned_worker_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Assigned worker</p>
            <p className="text-base font-bold text-text">@{task.assigned_worker_name}</p>
          </div>
        </div>
      )}

      {owner && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text">
              Applications{" "}
              {pendingApps.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-bold rounded-full bg-primary text-white">
                  {pendingApps.length}
                </span>
              )}
            </h2>
            {task.status === "open" && <span className="text-xs text-text-secondary">Auto-refreshing</span>}
          </div>

          {apps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
              <div className="text-4xl mb-2 animate-floaty">📡</div>
              <p className="text-sm font-semibold text-text">
                {task.status === "open" ? "Waiting for workers to apply" : "No applications"}
              </p>
              {task.status === "open" && (
                <p className="text-xs text-text-secondary mt-1">You'll get a notification as soon as someone applies.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {[...pendingApps, ...otherApps].map((a) => (
                <ApplicationCard
                  key={a.id}
                  app={a}
                  taskBudget={task.budget}
                  canDecide={task.status === "open"}
                  busy={deciding?.id === a.id ? deciding.action : null}
                  onApprove={() => setConfirm({ kind: "approve", app: a })}
                  onReject={() => decide(a, "reject")}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── WORKER panel ── */}
      {!owner && (
        <section className="animate-slide-up">
          {canApply ? (
            <form onSubmit={apply} className="bg-surface border border-border rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-text">
                {myApp?.status === "withdrawn" ? "Apply again" : "Apply for this task"}
              </h2>
              {!isAvailable && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  You're offline. Go online from your Profile to apply.
                </p>
              )}
              <div>
                <label htmlFor="apply-message" className="block text-sm font-semibold text-text mb-1.5">
                  Message <span className="font-normal text-text-secondary">(optional)</span>
                </label>
                <textarea
                  id="apply-message"
                  rows={3}
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell the customer why you're a great fit…"
                  className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:border-primary focus:outline-none resize-none"
                />
              </div>
              <div>
                <label htmlFor="apply-counter" className="block text-sm font-semibold text-text mb-1.5">
                  Counter-offer <span className="font-normal text-text-secondary">(optional — leave empty to accept {formatMoney(task.budget)})</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-text-secondary">₹</span>
                  <input
                    id="apply-counter"
                    type="number"
                    min={1}
                    inputMode="decimal"
                    value={counter}
                    onChange={(e) => setCounter(e.target.value)}
                    placeholder={String(parseFloat(task.budget))}
                    className="w-full pl-9 pr-4 py-3 bg-surface border border-border rounded-xl text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <button
                id="apply-btn"
                type="submit"
                disabled={applying || !isAvailable}
                className="w-full px-6 py-3.5 bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/25
                  hover:-translate-y-0.5 hover:shadow-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {applying ? "Sending…" : "Apply now"}
              </button>
            </form>
          ) : myApp?.status === "pending" ? (
            <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-surface p-6">
              <p className="text-lg font-bold text-text">Application sent ⏳</p>
              <p className="text-sm text-text-secondary mt-1">
                The customer is reviewing applications. We'll notify you when they decide.
              </p>
              {myApp.message && <p className="mt-3 text-sm italic text-text-secondary">“{myApp.message}”</p>}
              <button
                id="withdraw-btn"
                onClick={() => setConfirm({ kind: "withdraw" })}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-text-secondary border border-border hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer"
              >
                Withdraw application
              </button>
            </div>
          ) : myApp?.status === "approved" && task.status === "assigned" ? (
            <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/20">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/10" />
              <p className="text-2xl font-extrabold">You got the job! 🎉</p>
              <p className="text-sm text-white/90 mt-1">
                {formatSchedule(task.scheduled_at)} · {formatMoney(myApp.proposed_budget ?? task.budget)}
              </p>
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-block mt-4 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-semibold transition-colors">
                📍 Directions
              </a>
              <div className="mt-5 pt-4 border-t border-white/20">
                <button
                  id="cancel-assignment-btn"
                  onClick={() => setConfirm({ kind: "cancelAssignment" })}
                  className="text-sm font-semibold text-white/80 hover:text-white underline underline-offset-4 cursor-pointer"
                >
                  Can't make it? Cancel this job
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-surface p-6 text-center">
              <p className="text-base font-semibold text-text">
                {myApp?.status === "rejected" && "The customer declined your application."}
                {myApp?.status === "not_selected" && "The customer chose another worker for this task."}
                {myApp?.status === "cancelled" && "You cancelled this job."}
                {myApp?.status === "approved" && task.status !== "assigned" && "This task is no longer active."}
                {!myApp && "This task is no longer accepting applications."}
              </p>
              <button onClick={() => navigate("/find-tasks")} className="mt-4 text-sm font-semibold text-primary hover:underline cursor-pointer">
                Browse other tasks →
              </button>
            </div>
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirm !== null}
        busy={busy || deciding !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        tone={confirm?.kind === "approve" ? "success" : confirm?.kind === "withdraw" ? "primary" : "danger"}
        title={
          confirm?.kind === "approve"
            ? `Approve @${confirm.app.worker_name}?`
            : confirm?.kind === "cancelTask"
              ? "Cancel this task?"
              : confirm?.kind === "cancelAssignment"
                ? "Cancel this job?"
                : "Withdraw your application?"
        }
        body={
          confirm?.kind === "approve"
            ? "They'll be assigned to this task. All other pending applicants will be notified that the task was assigned to someone else."
            : confirm?.kind === "cancelTask"
              ? "Workers who applied will be notified. This can't be undone."
              : confirm?.kind === "cancelAssignment"
                ? "The customer will be notified and the task will reopen for other workers."
                : "You can apply again later while the task is still open."
        }
        confirmLabel={
          confirm?.kind === "approve"
            ? "Approve"
            : confirm?.kind === "cancelTask"
              ? "Cancel task"
              : confirm?.kind === "cancelAssignment"
                ? "Cancel job"
                : "Withdraw"
        }
      />
    </div>
  );
}
