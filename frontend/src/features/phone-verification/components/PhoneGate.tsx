import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../auth/stores/authStore";

interface PhoneGateProps {
  children: ReactNode;
}

/**
 * Wraps pages that require phone verification (task creation, worker profile).
 * Does NOT block the entire app — only gates specific actions.
 */
export default function PhoneGate({ children }: PhoneGateProps) {
  const navigate = useNavigate();
  const isPhoneVerified = useAuthStore((state) => state.isPhoneVerified);

  if (!isPhoneVerified) {
    return (
      <div className="min-h-[50dvh] flex items-center justify-center px-4">
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-10 shadow-md max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-primary-ghost flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
          </div>

          <h2 className="text-lg font-bold text-text mb-1">
            Phone Verification Required
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            You need to verify your phone number before you can proceed with
            this action.
          </p>

          <button
            id="verify-phone-btn"
            onClick={() => navigate("/verify-phone")}
            className="w-full py-3 px-6 bg-primary text-white font-semibold rounded-lg
              transition-all duration-200 cursor-pointer
              hover:bg-primary-dark active:scale-[0.98]"
          >
            Verify Phone Number
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
