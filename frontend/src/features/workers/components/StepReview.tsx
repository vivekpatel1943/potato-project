import type { DocumentData } from "../schemas/workerOnboarding";

interface Props {
  avatarUrl: string;
  documents: DocumentData[];
  subcategoryIds: string[];
  isSubmitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  driving_license: "Driving License",
  passport: "Passport",
  other: "Other",
};

export default function StepReview({
  avatarUrl,
  documents,
  subcategoryIds,
  isSubmitting,
  onSubmit,
  onBack,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-bold text-text mb-1">Review Your Profile</h3>
        <p className="text-sm text-text-secondary">
          Make sure everything looks good before submitting.
        </p>
      </div>

      {/* Profile Picture */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Profile Picture
        </h4>
        <div className="flex items-center gap-3">
          <img
            src={avatarUrl}
            alt="Profile"
            className="w-14 h-14 rounded-full object-cover border-2 border-border"
          />
          <span className="text-sm text-success font-medium">✓ Uploaded</span>
        </div>
      </div>

      {/* Documents */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Verification Documents
        </h4>
        <div className="space-y-2">
          {documents.map((doc, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-text">{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</span>
              {doc.document_number && (
                <span className="text-text-secondary">• {doc.document_number}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Services */}
      <div className="bg-surface border border-border rounded-xl p-4 sm:p-5">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Selected Services
        </h4>
        <p className="text-sm text-text">
          <span className="font-semibold text-primary">{subcategoryIds.length}</span>{" "}
          service{subcategoryIds.length !== 1 ? "s" : ""} selected
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-primary-ghost border border-primary-light rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm text-text">
            After submitting, your profile will be <span className="font-semibold">under review</span>.
          </p>
          <p className="text-xs text-text-secondary mt-1">
            This usually takes 1–2 business days. You'll be notified once approved.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="px-8 py-3 bg-primary text-white font-semibold rounded-lg
            hover:bg-primary-dark active:scale-[0.98] transition-all duration-200 cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting…
            </span>
          ) : (
            "Submit Profile"
          )}
        </button>
      </div>
    </div>
  );
}
