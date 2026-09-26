import { useAuthStore } from "../../../features/auth/stores/authStore";

interface Props {
  onNext: () => void;
}

export default function StepPhoneVerify({ onNext }: Props) {
  const isPhoneVerified = useAuthStore((s) => s.isPhoneVerified);

  if (isPhoneVerified) {
    // Auto-advance if already verified
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-text mb-1">Phone Verified ✓</h3>
        <p className="text-sm text-text-secondary mb-6">
          Your phone number is already verified.
        </p>
        <button
          onClick={onNext}
          className="px-8 py-3 bg-primary text-white font-semibold rounded-lg
            hover:bg-primary-dark active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-primary-ghost flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-text mb-1">Verify Your Phone</h3>
      <p className="text-sm text-text-secondary mb-6">
        Phone verification is required before creating a worker profile.
      </p>
      <a
        href="/verify-phone"
        className="inline-block px-8 py-3 bg-primary text-white font-semibold rounded-lg
          hover:bg-primary-dark active:scale-[0.98] transition-all duration-200"
      >
        Verify Phone Number
      </a>
    </div>
  );
}
