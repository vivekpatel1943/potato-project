import { useState } from "react";
import api from "../../../../shared/lib/api";
import { AxiosError } from "axios";

export default function AssignAdminCard() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleAssign = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    setResult(null);

    try {
      const { data } = await api.post("/admin/assign-admin", { email });
      setResult({
        type: "success",
        message: `✅ ${data.user_name} (${data.email}) is now an admin.`,
      });
      setEmail("");
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail: string }>;
      setResult({
        type: "error",
        message: axiosErr.response?.data?.detail || "Failed to assign admin.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    setResult(null);

    try {
      const { data } = await api.post("/admin/revoke-admin", { email });
      setResult({
        type: "success",
        message: `✅ ${data.user_name} (${data.email}) has been demoted to a regular user.`,
      });
      setEmail("");
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail: string }>;
      setResult({
        type: "error",
        message: axiosErr.response?.data?.detail || "Failed to revoke admin.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm max-w-xl">
      <h2 className="text-lg font-semibold text-text mb-1">
        Manage Admin Roles
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        Promote or demote users by entering their email address.
      </p>

      {/* Result banner */}
      {result && (
        <div
          className={`mb-5 px-4 py-3 rounded-lg text-sm font-medium animate-[fadeIn_200ms_ease-out] ${result.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-error"
            }`}
        >
          {result.message}
        </div>
      )}

      {/* Email input */}
      <div className="mb-5">
        <label
          htmlFor="admin-email-input"
          className="block text-sm font-medium text-text mb-1.5"
        >
          User email
        </label>
        <input
          id="admin-email-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="w-full px-4 py-3 border-[1.5px] border-border rounded-lg bg-surface text-text
            placeholder:text-text-secondary/50 font-sans text-base
            transition-all duration-150 outline-none
            focus:border-primary focus:ring-2 focus:ring-primary-light"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          id="assign-admin-btn"
          onClick={handleAssign}
          disabled={isLoading || !email.trim()}
          className="px-5 py-2.5 bg-primary text-white font-semibold rounded-lg
            transition-all duration-200 cursor-pointer
            hover:bg-primary-dark active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
        >
          {isLoading ? "Processing..." : "Make Admin"}
        </button>
        <button
          id="revoke-admin-btn"
          onClick={handleRevoke}
          disabled={isLoading || !email.trim()}
          className="px-5 py-2.5 bg-surface border border-border text-text font-semibold rounded-lg
            transition-all duration-200 cursor-pointer
            hover:bg-red-50 hover:border-red-200 hover:text-error active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Processing..." : "Revoke Admin"}
        </button>
      </div>
    </div>
  );
}
