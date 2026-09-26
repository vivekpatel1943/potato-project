interface Props {
  onNext: () => void;
  onBack: () => void;
}

export default function StepProofs({ onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-bold text-text mb-1">Proof of Work</h3>
        <p className="text-sm text-text-secondary">
          Upload photos, videos, or documents showing your past work. This helps customers trust your skills.
        </p>
      </div>

      {/* Skip notice */}
      <div className="bg-primary-ghost border border-primary-light rounded-xl p-4 text-center">
        <p className="text-sm text-text-secondary">
          <span className="font-semibold text-text">This step is optional.</span>{" "}
          You can always add proof of work later from your profile.
        </p>
      </div>

      {/* Placeholder for future proof upload UI */}
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <svg className="w-12 h-12 text-text-secondary/30 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-text-secondary">
          Proof of work uploads coming soon.
        </p>
        <p className="text-xs text-text-secondary/60 mt-1">
          You can skip this for now and add them from your profile later.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNext}
            className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={onNext}
            className="px-8 py-3 bg-primary text-white font-semibold rounded-lg
              hover:bg-primary-dark active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
