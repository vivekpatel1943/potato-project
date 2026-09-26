import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppMode = "customer" | "worker";

interface AppState {
  // Current UI mode
  mode: AppMode;

  // Worker profile status (synced from backend)
  hasWorkerProfile: boolean;
  isWorkerVerified: boolean;
  isAvailable: boolean;

  // Actions
  setMode: (mode: AppMode) => void;
  setWorkerProfile: (
    has: boolean,
    verified: boolean,
    available: boolean
  ) => void;
  setAvailable: (available: boolean) => void;
  resetWorkerState: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: "customer",
      hasWorkerProfile: false,
      isWorkerVerified: false,
      isAvailable: false,

      setMode: (mode) => set({ mode }),

      setWorkerProfile: (has, verified, available) =>
        set({
          hasWorkerProfile: has,
          isWorkerVerified: verified,
          isAvailable: available,
        }),

      setAvailable: (available) => set({ isAvailable: available }),

      resetWorkerState: () =>
        set({
          mode: "customer",
          hasWorkerProfile: false,
          isWorkerVerified: false,
          isAvailable: false,
        }),
    }),
    {
      name: "potato-app-mode",
      partialize: (state) => ({
        mode: state.mode,
        hasWorkerProfile: state.hasWorkerProfile,
        isWorkerVerified: state.isWorkerVerified,
        isAvailable: state.isAvailable,
      }),
    }
  )
);
