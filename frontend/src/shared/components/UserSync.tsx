import { useEffect } from "react";
import api from "../lib/api";
import { useAuthStore } from "../../features/auth/stores/authStore";

/**
 * Invisible component that fetches /users/me on mount
 * and syncs the result into the Zustand auth store.
 * Mount inside AppShell so it runs on every authenticated page load.
 */
export default function UserSync() {
  const { setUser, setPhoneVerified } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    const syncUser = async () => {
      try {
        const { data } = await api.get("/users/me");
        if (!cancelled) {
          setUser(data.user_name, false, data.role);
          setPhoneVerified(data.is_phone_verified);
        }
      } catch {
        // Silent fail — token might be expired, interceptor handles it
      }
    };

    syncUser();
    return () => { cancelled = true; };
  }, [setUser, setPhoneVerified]);

  return null;
}
