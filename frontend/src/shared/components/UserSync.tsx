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
        if (!cancelled) {
          setUser(data.user_name, false, data.role);
          setPhoneVerified(data.is_phone_verified);

          // Sync worker profile presence without overwriting other cached states
          const currentStore = useAppStore.getState();
          if (data.has_worker_profile !== currentStore.hasWorkerProfile) {
            setWorkerProfile(
              data.has_worker_profile,
              currentStore.isWorkerVerified,
              currentStore.isAvailable
            );
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
