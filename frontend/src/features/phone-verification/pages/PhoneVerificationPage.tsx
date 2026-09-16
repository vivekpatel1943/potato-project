import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AxiosError } from "axios";

import api from "../../../shared/lib/api";
import { useAuthStore } from "../../auth/stores/authStore";
import { phoneSchema, type PhoneFormData } from "../schemas/phone";
import OTPInput from "../../../shared/components/OTPInput";

type VerifyStep = "phone" | "code";

export default function PhoneVerificationPage() {
  const navigate = useNavigate();
  const { isPhoneVerified, setPhoneVerified } = useAuthStore();

  const [step, setStep] = useState<VerifyStep>("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Redirect if already verified
  useEffect(() => {
    if (isPhoneVerified) {
      navigate(-1);
    }
  }, [isPhoneVerified, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
  });

  // ── Request Verification ────────────────────────────────────────────────
  const handleRequestVerification = useCallback(
    async (data: PhoneFormData) => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: res } = await api.post("/phone/request-verification", {
          phone: data.phone,
        });

        setPhone(data.phone);
        setWhatsappLink(res.whatsapp_link);
        setStep("code");
        setCooldown(60);
      } catch (err) {
        const axiosErr = err as AxiosError<{ detail: string }>;
        if (axiosErr.response?.status === 429) {
          const retryAfter = axiosErr.response.headers["retry-after"];
          if (retryAfter) setCooldown(parseInt(retryAfter, 10));
          setError(
            `Too many requests. Please wait ${retryAfter || "a moment"} seconds.`
          );
        } else {
          setError(
            axiosErr.response?.data?.detail ||
              "Failed to start verification. Please try again."
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ── Confirm Verification ────────────────────────────────────────────────
  const handleConfirmCode = useCallback(
    async (code: string) => {
      setIsLoading(true);
      setError(null);

      try {
        await api.post("/phone/confirm-verification", {
          phone,
          code,
        });

        setPhoneVerified(true);
        setSuccess(true);

        // Navigate back after a brief success animation
        setTimeout(() => navigate(-1), 1500);
      } catch (err) {
        const axiosErr = err as AxiosError<{ detail: string }>;
        setError(
          axiosErr.response?.data?.detail ||
            "Invalid code. Please check and try again."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [phone, setPhoneVerified, navigate]
  );

  // ── Resend Code ─────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (cooldown > 0 || !phone) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data: res } = await api.post("/phone/request-verification", {
        phone,
      });
      setWhatsappLink(res.whatsapp_link);
      setCooldown(60);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail: string }>;
      if (axiosErr.response?.status === 429) {
        const retryAfter = axiosErr.response.headers["retry-after"];
        if (retryAfter) setCooldown(parseInt(retryAfter, 10));
      }
      setError(axiosErr.response?.data?.detail || "Failed to resend code.");
    } finally {
      setIsLoading(false);
    }
  }, [cooldown, phone]);

  // ── Success State ───────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center px-4">
        <div className="text-center animate-[fadeIn_300ms_ease-out]">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text">Phone Verified!</h2>
          <p className="text-text-secondary mt-1 text-sm">Redirecting you back...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-text tracking-tight">
            Verify Your Phone
          </h1>
          <p className="mt-2 text-text-secondary text-sm sm:text-base">
            {step === "phone"
              ? "Enter your phone number to verify via WhatsApp"
              : "Send the code via WhatsApp, then enter it below"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-10 shadow-md">
          {/* Error banner */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-error text-sm font-medium">
              {error}
            </div>
          )}

          {/* ── Phone Step ─────────────────────────────────────── */}
          {step === "phone" && (
            <form
              onSubmit={handleSubmit(handleRequestVerification)}
              className="space-y-5"
              noValidate
            >
              <div>
                <label
                  htmlFor="phone-input"
                  className="block text-sm font-medium text-text mb-1.5"
                >
                  Phone number
                </label>
                <input
                  id="phone-input"
                  type="tel"
                  autoComplete="tel"
                  autoFocus
                  placeholder="+918103614609"
                  className={`w-full px-4 py-3 border-[1.5px] rounded-lg bg-surface text-text
                    placeholder:text-text-secondary/50 font-sans text-base
                    transition-all duration-150 outline-none
                    focus:border-primary focus:ring-2 focus:ring-primary-light
                    ${formErrors.phone ? "border-error" : "border-border"}`}
                  {...register("phone")}
                />
                {formErrors.phone && (
                  <p className="mt-1.5 text-xs text-error font-medium">
                    {formErrors.phone.message}
                  </p>
                )}
              </div>

              <button
                id="send-whatsapp-code-btn"
                type="submit"
                disabled={isLoading || cooldown > 0}
                className="w-full py-3 px-6 bg-primary text-white font-semibold rounded-lg
                  transition-all duration-200 cursor-pointer
                  hover:bg-primary-dark active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
              >
                {isLoading
                  ? "Sending..."
                  : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : "Send WhatsApp Code"}
              </button>
            </form>
          )}

          {/* ── Code Step ──────────────────────────────────────── */}
          {step === "code" && (
            <div className="space-y-6">
              {/* WhatsApp deep link button */}
              {whatsappLink && (
                <a
                  id="open-whatsapp-btn"
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 px-6
                    bg-[#25D366] text-white font-semibold rounded-lg
                    transition-all duration-200
                    hover:bg-[#1DA851] active:scale-[0.98]"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Open WhatsApp
                </a>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-surface text-text-secondary">
                    Then enter the code here
                  </span>
                </div>
              </div>

              <OTPInput onComplete={handleConfirmCode} disabled={isLoading} />

              {/* Resend + Back */}
              <div className="flex items-center justify-between text-sm">
                <button
                  id="back-to-phone-btn"
                  type="button"
                  onClick={() => {
                    setStep("phone");
                    setError(null);
                  }}
                  className="text-text-secondary hover:text-text transition-colors cursor-pointer"
                >
                  ← Change number
                </button>

                <button
                  id="resend-code-btn"
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || isLoading}
                  className="text-primary font-medium hover:text-primary-dark transition-colors cursor-pointer
                    disabled:text-text-secondary disabled:cursor-not-allowed"
                >
                  {cooldown > 0
                    ? `Resend in ${cooldown}s`
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
      </div>
    </div>
  );
}
