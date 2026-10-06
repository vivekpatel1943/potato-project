/**
 * Background location cache for search analytics.
 *
 * Rules: never block search, and never surprise a guest with a permission prompt.
 */
type Coords = { latitude: number; longitude: number };

let cached: Coords | null = null;
let inFlight = false;

/**
 * Starts a background location fetch (call it when the search box gets focus).
 * - Logged-in users: may show the browser permission prompt once (the browser remembers the answer).
 * - Guests: only reads location if permission is ALREADY granted (no prompt).
 * Never awaited by search code.
 */
export async function warmSearchLocation(isLoggedIn: boolean): Promise<void> {
  if (cached || inFlight || !("geolocation" in navigator) || !window.isSecureContext) return;

  if (!isLoggedIn) {
    try {
      const p = await navigator.permissions.query({ name: "geolocation" });
      if (p.state !== "granted") return;
    } catch {
      return;
    }
  }

  inFlight = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      cached = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      inFlight = false;
    },
    () => {
      inFlight = false; // denied / unavailable => log without location
    },
    // Cheap network/Wi-Fi fix; reuse a fix up to 10 min old (no GPS spin-up)
    { enableHighAccuracy: false, maximumAge: 10 * 60_000, timeout: 10_000 }
  );
}

export const getCachedSearchLocation = (): Coords | null => cached;
