import { useAuthStore } from "../../auth/stores/authStore";
import { useAppStore } from "../../app/stores/appStore";

export default function DashboardPage() {
  const { userName } = useAuthStore();
  const { mode, hasWorkerProfile, isAvailable } = useAppStore();

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-10 shadow-md">
        <h2 className="text-2xl font-bold text-text mb-2">
          Welcome back, {userName}! 👋
        </h2>
        <p className="text-text-secondary">
          {mode === "worker"
            ? "Here's your worker dashboard. Check for new tasks and manage your services."
            : "Looking for help? Browse workers or post a new task."}
        </p>
      </div>

      {/* Worker mode: availability nudge */}
      {mode === "worker" && hasWorkerProfile && !isAvailable && (
        <div className="bg-primary-ghost border border-primary-light rounded-2xl p-5 sm:p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text mb-1">
              You're currently unavailable
            </h3>
            <p className="text-sm text-text-secondary">
              Toggle your availability in your{" "}
              <a href="/profile" className="text-primary font-medium hover:text-primary-dark transition-colors">
                Profile
              </a>{" "}
              to start seeing tasks from customers.
            </p>
          </div>
        </div>
      )}

      {/* Customer mode: phone verification nudge */}
      {mode === "customer" && !useAuthStore.getState().isPhoneVerified && (
        <div className="bg-primary-ghost border border-primary-light rounded-2xl p-5 sm:p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text mb-1">
              Verify your phone
            </h3>
            <p className="text-sm text-text-secondary">
              Verify your phone number to start posting tasks and hiring workers.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
