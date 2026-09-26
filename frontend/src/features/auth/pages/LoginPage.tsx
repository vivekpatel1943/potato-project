import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";

import api from "../../../shared/lib/api";
import { useAuthStore } from "../stores/authStore";
import { emailSchema, type EmailFormData } from "../schemas/auth";
import OTPInput from "../../../shared/components/OTPInput";

export default function LoginPage() {
  const navigate = useNavigate();
  const {
    authStep,
    email,
    otpCooldown,
    setAuthStep,
    setEmail,
    setOtpCooldown,
    setTokens,
    setUser,
    setPhoneVerified,
    accessToken,
  } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (accessToken) {
      navigate("/dashboard", { replace: true });
    }
  }, [accessToken, navigate]);

  // Cooldown countdown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown(otpCooldown - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown, setOtpCooldown]);

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  // ── Send OTP ────────────────────────────────────────────────────────────
  const handleSendOTP = useCallback(
    async (data: EmailFormData) => {
      setIsLoading(true);
      setError(null);

      try {
        await api.post("/auth/request-otp", { email: data.email });
        setEmail(data.email);
        setAuthStep("otp");
        setOtpCooldown(60);
      } catch (err) {
        const axiosErr = err as AxiosError<{ detail: string }>;
        if (axiosErr.response?.status === 429) {
          // Read Retry-After header for accurate countdown
          const retryAfter = axiosErr.response.headers["retry-after"];
          if (retryAfter) {
            setOtpCooldown(parseInt(retryAfter, 10));
          }
          setError(
            `Too many requests. Please wait ${retryAfter || "a moment"} seconds.`
          );
        } else {
          setError(
            axiosErr.response?.data?.detail || "Failed to send OTP. Please try again."
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [setEmail, setAuthStep, setOtpCooldown]
  );

  // ── Resend OTP ──────────────────────────────────────────────────────────
  const handleResendOTP = useCallback(async () => {
    if (!email || otpCooldown > 0) return;
    setIsLoading(true);
    setError(null);

    try {
      await api.post("/auth/request-otp", { email });
      setOtpCooldown(60);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail: string }>;
      if (axiosErr.response?.status === 429) {
        const retryAfter = axiosErr.response.headers["retry-after"];
        if (retryAfter) {
          setOtpCooldown(parseInt(retryAfter, 10));
        }
      }
      setError(
        axiosErr.response?.data?.detail || "Failed to resend OTP."
      );
    } finally {
      setIsLoading(false);
    }
  }, [email, otpCooldown, setOtpCooldown]);

  // ── Verify OTP ──────────────────────────────────────────────────────────
  const handleVerifyOTP = useCallback(
    async (code: string) => {
      setIsLoading(true);
      setError(null);
      setOtpCode(code);

      try {
        const { data } = await api.post("/auth/verify-otp", {
          email,
          otp_code: code,
        });

        setTokens(data.access_token, data.refresh_token);
        setUser(data.user_name, data.is_new_user, data.role);
        setPhoneVerified(data.is_phone_verified);
        setAuthStep("authenticated");

        navigate("/dashboard", { replace: true });
      } catch (err) {
        const axiosErr = err as AxiosError<{ detail: string }>;
        setError(
          axiosErr.response?.data?.detail || "Invalid or expired OTP."
        );
        setOtpCode("");
      } finally {
        setIsLoading(false);
      }
    },
    [email, navigate, setTokens, setUser, setPhoneVerified, setAuthStep]
  );

  // ── Back to email step ──────────────────────────────────────────────────
  const handleBackToEmail = useCallback(() => {
    setAuthStep("email");
    setError(null);
    setOtpCode("");
  }, [setAuthStep]);

  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-text tracking-tight">
            🥔 Potato
          </h1>
          <p className="mt-2 text-text-secondary text-sm sm:text-base">
            {authStep === "email"
              ? "Sign in or create an account"
              : "Enter the code we sent to your email"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-10 shadow-md">
          {/* Error banner */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm font-medium animate-[fadeIn_200ms_ease-out]">
              {error}
            </div>
          )}

          {/* ── Email Step ──────────────────────────────────────── */}
          {authStep === "email" && (
            <form
              onSubmit={handleSubmit(handleSendOTP)}
              className="space-y-5"
              noValidate
            >
              <div>
                <label
                  htmlFor="email-input"
                  className="block text-sm font-medium text-text mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="email-input"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  className={`w-full px-4 py-3 border-[1.5px] rounded-lg bg-surface text-text
                    placeholder:text-text-secondary/50 font-sans text-base
                    transition-all duration-150 outline-none
                    focus:border-primary focus:ring-2 focus:ring-primary-light
                    ${formErrors.email ? "border-error" : "border-border"}`}
                  {...register("email")}
                />
                {formErrors.email && (
                  <p className="mt-1.5 text-xs text-error font-medium">
                    {formErrors.email.message}
                  </p>
                )}
              </div>

              <button
                id="send-otp-btn"
                type="submit"
                disabled={isLoading || otpCooldown > 0}
                className="w-full py-3 px-6 bg-primary text-white font-semibold rounded-lg
                  transition-all duration-200 cursor-pointer
                  hover:bg-primary-dark active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
              >
                {isLoading
                  ? "Sending..."
                  : otpCooldown > 0
                    ? `Resend in ${otpCooldown}s`
                    : "Send OTP"}
              </button>
            </form>
          )}

          {/* ── OTP Step ────────────────────────────────────────── */}
          {authStep === "otp" && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-text-secondary">
                  We sent a 6-digit code to
                </p>
                <p className="font-semibold text-text mt-0.5">{email}</p>
              </div>

              <OTPInput
                onComplete={handleVerifyOTP}
                disabled={isLoading}
              />

              {/* Resend + Back */}
              <div className="flex items-center justify-between text-sm">
                <button
                  id="back-to-email-btn"
                  type="button"
                  onClick={handleBackToEmail}
                  className="text-text-secondary hover:text-text transition-colors cursor-pointer"
                >
                  ← Change email
                </button>

                <button
                  id="resend-otp-btn"
                  type="button"
                  onClick={handleResendOTP}
                  disabled={otpCooldown > 0 || isLoading}
                  className="text-primary font-medium hover:text-primary-dark transition-colors cursor-pointer
                    disabled:text-text-secondary disabled:cursor-not-allowed"
                >
                  {otpCooldown > 0
                    ? `Resend in ${otpCooldown}s`
                    : "Resend code"}
                </button>
              </div>

              {isLoading && (
                <p className="text-center text-sm text-text-secondary animate-pulse">
                  Verifying...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-xs text-text-secondary/60">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
