import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../shared/lib/api";
import { useAppStore } from "../../app/stores/appStore";
import type { DocumentData } from "../schemas/workerOnboarding";

import StepPhoneVerify from "../components/StepPhoneVerify";
import StepAvatar from "../components/StepAvatar";
import StepDocuments from "../components/StepDocuments";
import StepServices from "../components/StepServices";
import StepProofs from "../components/StepProofs";
import StepReview from "../components/StepReview";

const STEPS = [
  "Phone Verification",
  "Profile Picture",
  "Identity Documents",
  "Services",
  "Proof of Work",
  "Review",
];

export default function WorkerOnboardingPage() {
  const navigate = useNavigate();
  const { setWorkerProfile, setMode } = useAppStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);

  // Form data accumulated across steps
  const [avatarUrl, setAvatarUrl] = useState("");
  const [documents, setDocuments] = useState<DocumentData[]>([]);
  const [subcategoryIds, setSubcategoryIds] = useState<string[]>([]);

  // ── Load draft on mount ─────────────────────────────────────────
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const { data } = await api.get("/workers/onboarding/draft");
        setCurrentStep(data.current_step);
        setAvatarUrl(data.draft_data.avatar_url || "");
        setDocuments(data.draft_data.documents || []);
        setSubcategoryIds(data.draft_data.subcategory_ids || []);
      } catch {
        // No draft found (404) — start fresh at step 0
      } finally {
        setIsLoadingDraft(false);
      }
    };
    loadDraft();
  }, []);

  // ── Save draft helper (best-effort, non-blocking) ──────────────
  const saveDraft = useCallback(
    async (step: number, overrides?: { avatar_url?: string; documents?: DocumentData[]; subcategory_ids?: string[] }) => {
      const draftData = {
        avatar_url: overrides?.avatar_url ?? avatarUrl,
        documents: overrides?.documents ?? documents,
        subcategory_ids: overrides?.subcategory_ids ?? subcategoryIds,
      };
      try {
        await api.put("/workers/onboarding/draft", {
          current_step: step,
          draft_data: draftData,
        });
      } catch {
        // Draft save is best-effort; don't block the user
      }
    },
    [avatarUrl, documents, subcategoryIds]
  );

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await api.post("/workers/profile", {
        avatar_url: avatarUrl,
        subcategory_ids: subcategoryIds,
        verification_documents: documents.map((d) => ({
          document_type: d.document_type,
          document_url: d.document_url,
          document_number: d.document_number || null,
        })),
        proofs: {},
      });

      // Update app state
      setWorkerProfile(true, false, false);
      setMode("worker");
      setSuccess(true);

      // Redirect after success animation
      setTimeout(() => navigate("/dashboard", { replace: true }), 2500);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setSubmitError(
        error.response?.data?.detail || "Failed to create profile. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading Screen ──────────────────────────────────────────────
  if (isLoadingDraft) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Success Screen ───────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center px-4">
        <div className="text-center animate-[fadeIn_300ms_ease-out] max-w-sm">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text mb-2">Profile Submitted! 🎉</h2>
          <p className="text-text-secondary text-sm">
            Your worker profile is under review. This usually takes 1–2 business days.
            We'll notify you once it's approved.
          </p>
          <p className="text-xs text-text-secondary/60 mt-4">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  // ── Wizard Layout ────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-border px-4 sm:px-8 py-3 sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-text-secondary hover:text-text transition-colors cursor-pointer"
          >
            ← Cancel
          </button>
          <h1 className="text-sm font-semibold text-text">Become a Worker</h1>
          <span className="text-xs text-text-secondary">
            {currentStep + 1}/{STEPS.length}
          </span>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-border/30 h-1">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step Content */}
      <div className="max-w-lg mx-auto px-4 sm:px-8 py-8">
        {/* Step label */}
        <p className="text-xs font-medium text-primary uppercase tracking-wider mb-6 text-center">
          Step {currentStep + 1}: {STEPS[currentStep]}
        </p>

        {submitError && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm font-medium text-center">
            {submitError}
          </div>
        )}

        {currentStep === 0 && (
          <StepPhoneVerify onNext={() => { saveDraft(1); goNext(); }} />
        )}
        {currentStep === 1 && (
          <StepAvatar
            avatarUrl={avatarUrl}
            onNext={(url) => { setAvatarUrl(url); saveDraft(2, { avatar_url: url }); goNext(); }}
            onBack={goBack}
          />
        )}
        {currentStep === 2 && (
          <StepDocuments
            documents={documents}
            onNext={(docs) => { setDocuments(docs); saveDraft(3, { documents: docs }); goNext(); }}
            onBack={goBack}
          />
        )}
        {currentStep === 3 && (
          <StepServices
            selectedIds={subcategoryIds}
            onNext={(ids) => { setSubcategoryIds(ids); saveDraft(4, { subcategory_ids: ids }); goNext(); }}
            onBack={goBack}
          />
        )}
        {currentStep === 4 && (
          <StepProofs
            onNext={() => { saveDraft(5); goNext(); }}
            onBack={goBack}
          />
        )}
        {currentStep === 5 && (
          <StepReview
            avatarUrl={avatarUrl}
            documents={documents}
            subcategoryIds={subcategoryIds}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onBack={goBack}
          />
        )}
      </div>
    </div>
  );
}
