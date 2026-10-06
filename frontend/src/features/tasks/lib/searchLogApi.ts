import { useAuthStore } from "../../auth/stores/authStore";
import { getCachedSearchLocation } from "../../../shared/lib/searchLocation";

/**
 * Fire-and-forget search analytics log.
 * Uses fetch + keepalive (not axios) so it survives page navigation / tab close,
 * and still carries the Bearer token (navigator.sendBeacon can't set headers).
 */
export function sendSearchLog(p: {
  query: string;
  results_count: number;
  selected_subcategory_id?: string | null;
}): void {
  try {
    const token = useAuthStore.getState().accessToken;
    const loc = getCachedSearchLocation();

    fetch(`${import.meta.env.VITE_API_BASE_URL}/search-logs`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...p, ...(loc ?? {}) }),
    }).catch(() => {});
  } catch {
    // analytics must never surface errors
  }
}
