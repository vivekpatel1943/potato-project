import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../shared/lib/api";
import { useAuthStore } from "../../auth/stores/authStore";
import { useAppStore } from "../../app/stores/appStore";

interface WorkerProfileData {
  user_id: string;
  avatar_url: string;
  is_available: boolean;
  verification_status: string;
  capabilities: {
    id: string;
    subcategory_id: string;
    subcategory_name: string | null;
  }[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", label: "Pending Review" },
  under_review: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "Under Review" },
  verified: { bg: "bg-green-50 border-green-200", text: "text-success", label: "Verified ✓" },
  rejected: { bg: "bg-red-50 border-red-200", text: "text-error", label: "Rejected" },
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { userName, isPhoneVerified } = useAuthStore();
  const { hasWorkerProfile, isAvailable, setAvailable } = useAppStore();

  const [workerProfile, setWorkerProfile] = useState<WorkerProfileData | null>(null);
  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Fetch worker profile if exists
  useEffect(() => {
    if (!hasWorkerProfile) return;
    const fetchProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const { data } = await api.get("/workers/me");
        setWorkerProfile(data);
        setAvailable(data.is_available);
      } catch {
        // Profile might not exist yet
      } finally {
        setIsLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [hasWorkerProfile, setAvailable]);

  const handleToggleAvailability = useCallback(async () => {
    if (!workerProfile) return;
    setIsTogglingAvailability(true);
    try {
      const newValue = !isAvailable;
      await api.patch("/workers/me/availability", { is_available: newValue });
      setAvailable(newValue);
      setWorkerProfile((prev) => prev ? { ...prev, is_available: newValue } : prev);

      setShowToast(
        newValue
          ? "You're now visible to customers! 🎉"
          : "You've gone offline. Customers won't see you."
      );
      setTimeout(() => setShowToast(null), 3000);
    } catch {
      setShowToast("Failed to update availability");
      setTimeout(() => setShowToast(null), 3000);
    } finally {
      setIsTogglingAvailability(false);
    }
  }, [isAvailable, workerProfile, setAvailable]);

  const statusInfo = workerProfile
    ? STATUS_STYLES[workerProfile.verification_status] || STATUS_STYLES.pending
    : null;

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      {showToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-[fadeIn_200ms_ease-out]">
          <div className="px-5 py-3 bg-text text-white text-sm font-medium rounded-xl shadow-lg">
            {showToast}
          </div>
        </div>
      )}

      {/* User Info Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-md">
        <div className="flex items-center gap-4">
          {workerProfile?.avatar_url ? (
            <img
              src={workerProfile.avatar_url}
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-ghost flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {userName?.charAt(0).toUpperCase() || "?"}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-text">@{userName}</h2>
            <div className="flex items-center gap-2 mt-1">
              {isPhoneVerified ? (
                <span className="text-xs font-medium text-success flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Phone Verified
                </span>
              ) : (
                <span className="text-xs font-medium text-text-secondary">Phone not verified</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Phone Verification Banner */}
      {!isPhoneVerified && (
        <div className="bg-primary-ghost border border-primary-light rounded-2xl p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-text mb-1">Verify your phone number</h3>
            <p className="text-sm text-text-secondary mb-3">
              Phone verification is required to post tasks or create a worker profile.
            </p>
            <button
              onClick={() => navigate("/verify-phone")}
              className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg
                hover:bg-primary-dark active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              Verify Now
            </button>
          </div>
        </div>
      )}

      {/* Worker Profile Section */}
      {hasWorkerProfile && workerProfile ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
              Worker Profile
            </h3>
            <button
              onClick={() => navigate("/become-worker?edit=true")}
              className="text-sm text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer"
            >
              ✏️ Edit Profile
            </button>
          </div>

          {/* Availability Toggle */}
          <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-text">Availability</h4>
                <p className="text-xs text-text-secondary mt-0.5">
                  {workerProfile.verification_status === "verified"
                    ? (isAvailable ? "You're visible to customers" : "Toggle on to start seeing tasks")
                    : "You must be verified to go online."}
                </p>
              </div>
              <button
                onClick={handleToggleAvailability}
                disabled={isTogglingAvailability || workerProfile.verification_status !== "verified"}
                className={`relative w-14 h-8 rounded-full transition-all duration-300 cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isAvailable ? "bg-success" : "bg-border"}`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300
                    ${isAvailable ? "left-7" : "left-1"}`}
                />
              </button>
            </div>
          </div>

          {/* Verification Status */}
          {statusInfo && (
            <div className={`border rounded-2xl p-4 ${statusInfo.bg}`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${statusInfo.text}`}>
                  {statusInfo.label}
                </span>
              </div>
              {workerProfile.verification_status === "pending" && (
                <p className="text-xs text-text-secondary mt-1">
                  Your profile is being reviewed. This usually takes 1–2 business days.
                </p>
              )}
            </div>
          )}

          {/* Services */}
          {workerProfile.capabilities.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6">
              <h4 className="text-sm font-semibold text-text mb-3">Your Services</h4>
              <div className="flex flex-wrap gap-2">
                {workerProfile.capabilities.map((cap) => (
                  <span
                    key={cap.id}
                    className="px-3 py-1.5 bg-primary-ghost text-primary text-sm font-medium rounded-full"
                  >
                    {cap.subcategory_name || "Service"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : !isLoadingProfile ? (
        /* Become a Worker CTA */
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 text-center shadow-md">
          <div className="w-14 h-14 rounded-full bg-primary-ghost flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-text mb-1">Want to earn on Potato?</h3>
          <p className="text-sm text-text-secondary mb-5">
            Create a worker profile to start offering your services and accepting tasks.
          </p>
          <button
            onClick={() => navigate("/become-worker")}
            className="px-8 py-3 bg-primary text-white font-semibold rounded-lg
              hover:bg-primary-dark active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            Become a Worker
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
