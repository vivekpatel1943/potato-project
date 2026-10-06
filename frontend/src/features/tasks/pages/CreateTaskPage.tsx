import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ServiceSearch, { emojiFor } from "../components/ServiceSearch";
import TaskForm, { type TaskFormValues } from "../components/TaskForm";
import { taskApi } from "../lib/taskApi";
import { getErrorMessage, type ServiceSearchResult } from "../schemas/taskSchemas";
import { useAuthStore } from "../../auth/stores/authStore";
import { ensurePushSubscription } from "../../../shared/lib/pushManager";
import { useToast } from "../../../shared/components/Toast";

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isPhoneVerified } = useAuthStore();
  const { toast, Toast } = useToast();

  const [service, setService] = useState<ServiceSearchResult | null>(
    (location.state as { service?: ServiceSearchResult } | null)?.service ?? null
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: TaskFormValues) => {
    if (!service) return;
    // Ask for notification permission in the submit gesture so the customer
    // hears about applications even when the tab is closed.
    ensurePushSubscription({ prompt: true });
    setSubmitting(true);
    try {
      const task = await taskApi.create({ ...values, subcategory_id: service.id });
      navigate(`/tasks/${task.id}`, { replace: true, state: { justCreated: true } });
    } catch (err) {
      toast(getErrorMessage(err), "error");
      setSubmitting(false);
    }
  };

  if (!isPhoneVerified) {
    return (
      <div className="max-w-xl mx-auto bg-surface border border-border rounded-3xl p-8 text-center shadow-md animate-slide-up">
        <div className="text-5xl mb-4">📱</div>
        <h1 className="text-xl font-bold text-text mb-2">Verify your phone to post a task</h1>
        <p className="text-sm text-text-secondary mb-6">Workers need a verified number to reach you.</p>
        <button
          onClick={() => navigate("/verify-phone")}
          className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-colors cursor-pointer"
        >
          Verify now
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {Toast}

      <button
        onClick={() => (service ? setService(null) : navigate(-1))}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {service ? "Change service" : "Back"}
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map((s) => {
          const active = (service ? 2 : 1) >= s;
          return <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${active ? "bg-primary" : "bg-border"}`} />;
        })}
      </div>

      {!service ? (
        <section className="animate-slide-up">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text mb-2">What do you need help with?</h1>
          <p className="text-text-secondary mb-6">Search by what you need — we'll find the right service.</p>
          <ServiceSearch onSelect={setService} autoFocus />
        </section>
      ) : (
        <section className="animate-slide-up">
          <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-r from-primary-ghost to-surface border border-primary-light/70 rounded-2xl">
            <span className="w-14 h-14 rounded-2xl bg-surface shadow-sm flex items-center justify-center text-3xl">
              {emojiFor(`${service.name} ${service.category_name}`)}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{service.category_name}</p>
              <h1 className="text-xl font-extrabold text-text truncate">{service.name}</h1>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-3xl p-5 sm:p-8 shadow-sm">
            <TaskForm submitLabel="Post task & notify workers" submitting={submitting} onSubmit={handleSubmit} />
          </div>
          <p className="text-xs text-text-secondary text-center mt-4">
            Verified workers offering this service within 10 km will be notified instantly.
          </p>
        </section>
      )}
    </div>
  );
}
