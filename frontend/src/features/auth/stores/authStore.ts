import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthStep = "email" | "otp" | "authenticated";

interface AuthState {
  // Tokens
  accessToken: string | null;
  refreshToken: string | null;

  // User identity
  userName: string | null;
  isNewUser: boolean;
  isPhoneVerified: boolean;

  // Auth flow UI state (transient — not persisted)
  authStep: AuthStep;
  email: string | null;
  otpCooldown: number;

  // Actions
  setTokens: (access: string, refresh: string) => void;
  setUser: (userName: string, isNew: boolean) => void;
  setPhoneVerified: (verified: boolean) => void;
  setAuthStep: (step: AuthStep) => void;
  setEmail: (email: string) => void;
  setOtpCooldown: (seconds: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userName: null,
      isNewUser: false,
      isPhoneVerified: false,
      authStep: "email",
      email: null,
      otpCooldown: 0,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      setUser: (userName, isNew) => set({ userName, isNewUser: isNew }),

      setPhoneVerified: (verified) => set({ isPhoneVerified: verified }),

      setAuthStep: (step) => set({ authStep: step }),

      setEmail: (email) => set({ email }),

      setOtpCooldown: (seconds) => set({ otpCooldown: seconds }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          userName: null,
          isNewUser: false,
          isPhoneVerified: false,
          authStep: "email",
          email: null,
          otpCooldown: 0,
        }),
    }),
    {
      name: "potato-auth",
      // Only persist tokens and user info — not transient UI state
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        userName: state.userName,
        isNewUser: state.isNewUser,
        isPhoneVerified: state.isPhoneVerified,
      }),
    }
  )
);
