import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { approvalApi, type WorkerFullDetail } from "../lib/approvalApi";
import ConfirmDialog from "../../../../shared/components/ConfirmDialog";

type ConfirmAction = { kind: "approve" } | { kind: "reject" } | null;

const DOC_TYPE_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar Card",
  driving_license: "Driving License",
  passport: "Passport",
  pan: "PAN Card",
  other: "Other Document",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
    verified: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Verified" },
    rejected: { bg: "bg-rose-100", text: "text-rose-700", label: "Rejected" },
    under_review: { bg: "bg-sky-100", text: "text-sky-700", label: "Under Review" },
  };
  const s = map[status] ?? { bg: "bg-zinc-100", text: "text-zinc-600", label: status };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

export default function AdminWorkerDetailPage() {
  const { userId = "" } = useParams();
  const navigate = useNavigate();

  const [worker, setWorker] = useState<WorkerFullDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setWorker(await approvalApi.getDetail(userId));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "approve") {
        await approvalApi.approve(userId);
        setActionResult({ type: "success", message: "Worker approved! They've been notified." });
      } else {
        await approvalApi.reject(userId, rejectReason || undefined);
        setActionResult({ type: "success", message: "Worker rejected. They've been notified." });
      }
      // Refresh the detail to show updated status
      setWorker(await approvalApi.getDetail(userId));
    } catch {
      setActionResult({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
      setConfirm(null);
      setRejectReason("");
    }
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-5 pb-8">
        <div className="h-5 w-32 bg-border rounded animate-pulse" />
        <div className="h-48 bg-surface border border-border rounded-3xl animate-pulse" />
        <div className="h-40 bg-surface border border-border rounded-3xl animate-pulse" />
        <div className="h-32 bg-surface border border-border rounded-3xl animate-pulse" />
      </div>
    );
  }

  // ── Not found ──
  if (notFound || !worker) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-5xl mb-4">🔍</p>
        <h2 className="text-xl font-bold text-text mb-2">Worker not found</h2>
        <p className="text-sm text-text-secondary mb-6">
          This worker profile may have been removed.
        </p>
        <button
          onClick={() => navigate("/admin/approvals")}
          className="px-5 py-2.5 rounded-xl bg-primary text-white font-semibold cursor-pointer hover:bg-primary-dark transition-colors"
        >
          Back to queue
        </button>
      </div>
    );
  }

  const isPending = worker.verification_status === "pending";

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8">
      {/* Back button */}
      <button
        onClick={() => navigate("/admin/approvals")}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Approval queue
      </button>

      {/* Action result banner */}
      {actionResult && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium animate-slide-up ${
            actionResult.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-rose-50 border border-rose-200 text-rose-700"
          }`}
        >
          {actionResult.message}
        </div>
      )}

      {/* ─── Section 1: Identity ─── */}
      <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="p-5 sm:p-7 bg-gradient-to-br from-primary-ghost via-surface to-surface">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">
            Identity
          </h2>
          <div className="flex items-center gap-5">
            <img
              src={worker.avatar_url}
              alt={worker.user_name}
              className="w-24 h-24 rounded-full object-cover border-2 border-border shadow-sm"
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-text truncate">
                {worker.user_name}
              </h1>
              <div className="mt-1.5 space-y-0.5">
                <p className="text-sm text-text-secondary flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {worker.email}
                </p>
                <p className="text-sm text-text-secondary flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {worker.phone ?? "No phone number"}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge status={worker.verification_status} />
                {worker.is_available && (
                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-700">
                    Online
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 2: Verification Documents ─── */}
      <section className="bg-surface border border-border rounded-3xl p-5 sm:p-7 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">
          Verification Documents ({worker.verification_documents.length})
        </h2>
        {worker.verification_documents.length === 0 ? (
          <p className="text-sm text-text-secondary italic">No documents uploaded.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {worker.verification_documents.map((doc) => (
              <div
                key={doc.id}
                className="border border-border rounded-2xl p-4 hover:border-primary-light transition-colors"
              >
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                </p>
                {doc.document_number && (
                  <p className="text-sm font-medium text-text mb-3">
                    # {doc.document_number}
                  </p>
                )}
                {doc.preview_url ? (
                  <a href={doc.preview_url} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={doc.preview_url}
                      alt={doc.document_type}
                      className="w-full rounded-xl border border-border hover:opacity-90 transition-opacity"
                    />
                  </a>
                ) : (
                  <p className="text-xs text-text-secondary italic">Preview not available</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Section 3: Capabilities & Proofs ─── */}
      <section className="bg-surface border border-border rounded-3xl p-5 sm:p-7 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">
          Services & Proofs ({worker.capabilities.length})
        </h2>
        {worker.capabilities.length === 0 ? (
          <p className="text-sm text-text-secondary italic">No capabilities registered.</p>
        ) : (
          <div className="space-y-5">
            {worker.capabilities.map((cap) => (
              <div key={cap.id}>
                <h3 className="text-base font-bold text-text mb-2.5">
                  {cap.subcategory_name ?? "Unknown service"}
                </h3>
                {cap.proofs.length === 0 ? (
                  <p className="text-sm text-text-secondary italic">No proofs uploaded</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {cap.proofs.map((proof) => (
                      <div
                        key={proof.id}
                        className="border border-border rounded-xl p-2 hover:border-primary-light transition-colors"
                      >
                        {proof.proof_type === "image" && proof.preview_url ? (
                          <a href={proof.preview_url} target="_blank" rel="noreferrer">
                            <img
                              src={proof.preview_url}
                              alt={proof.title ?? "Proof"}
                              className="rounded-lg w-full aspect-square object-cover hover:opacity-90 transition-opacity"
                            />
                          </a>
                        ) : proof.proof_type === "video" && proof.preview_url ? (
                          <video
                            src={proof.preview_url}
                            controls
                            className="rounded-lg w-full aspect-square object-cover"
                          />
                        ) : (
                          <a
                            href={proof.preview_url ?? proof.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center h-24 text-primary text-sm font-medium hover:underline"
                          >
                            📄 View {proof.proof_type}
                          </a>
                        )}
                        {proof.title && (
                          <p className="text-xs text-text mt-1.5 truncate">{proof.title}</p>
                        )}
                        {proof.description && (
                          <p className="text-xs text-text-secondary truncate">{proof.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Action Buttons ─── */}
      {isPending && (
        <div className="flex gap-3">
          <button
            id="approve-worker-btn"
            onClick={() => setConfirm({ kind: "approve" })}
            className="flex-1 px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            ✅ Approve Worker
          </button>
          <button
            id="reject-worker-btn"
            onClick={() => setConfirm({ kind: "reject" })}
            className="flex-1 px-5 py-3.5 rounded-xl border-2 border-rose-300 text-rose-600 font-bold hover:bg-rose-50 transition-all cursor-pointer"
          >
            ❌ Reject
          </button>
        </div>
      )}

      {/* ─── Confirm Dialog ─── */}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => {
          setConfirm(null);
          setRejectReason("");
        }}
        onConfirm={handleConfirm}
        busy={busy}
        tone={confirm?.kind === "approve" ? "success" : "danger"}
        title={
          confirm?.kind === "approve"
            ? "Approve this worker?"
            : "Reject this worker?"
        }
        body={
          confirm?.kind === "approve" ? (
            "They will be able to go online and receive task notifications immediately."
          ) : (
            <div className="space-y-3">
              <p>They will be notified that their profile was not approved.</p>
              <textarea
                id="reject-reason-input"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Optional reason for rejection…"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-text
                  placeholder:text-text-secondary/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-all"
                rows={3}
              />
            </div>
          )
        }
        confirmLabel={confirm?.kind === "approve" ? "Approve" : "Reject"}
      />
    </div>
  );
}
