import { useEffect } from "react";
import api from "../lib/api";
import { useAuthStore } from "../../features/auth/stores/authStore";
import { useAppStore } from "../../features/app/stores/appStore";

/**
 * Invisible component that fetches /users/me on mount
 * and syncs the result into the Zustand auth store.
 * Mount inside AppShell so it runs on every authenticated page load.
 */
export default function UserSync() {
  const { setUser, setPhoneVerified } = useAuthStore();
  const { setWorkerProfile } = useAppStore();

  useEffect(() => {
    let cancelled = false;

    const syncUser = async () => {
      try {
        const { data } = await api.get("/users/me");
        if (cancelled) return;

        setUser(data.user_name, false, data.role);
        setPhoneVerified(data.is_phone_verified);

        if (!data.has_worker_profile) {
          setWorkerProfile(false, false, false);
          return;
        }

        // Pull verification + online state so location tracking
        // (WorkerPresence) starts/stops from fresh data, not stale localStorage.
        try {
          const { data: wp } = await api.get("/workers/me");
          if (!cancelled) {
            setWorkerProfile(true, wp.verification_status === "verified", wp.is_available);
          }
        } catch {
          if (!cancelled) {
            const s = useAppStore.getState();
            setWorkerProfile(true, s.isWorkerVerified, s.isAvailable);
          }
        }
      } catch {
        // Silent fail — token might be expired, interceptor handles it
      }
    };

    syncUser();
    return () => { cancelled = true; };
  }, [setUser, setPhoneVerified, setWorkerProfile]);

  return null;
}
