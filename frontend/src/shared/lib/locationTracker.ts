import api from "./api";

/**
 * Interval-based worker location polling.
 *
 * Started AUTOMATICALLY whenever the worker is online (is_available = true) —
 * there is no separate "share location" button. See WorkerPresence.tsx.
 *
 * Two mechanisms, so we always have a fresh position:
 *  1. setInterval — pings every POLL_INTERVAL_MS even if the worker is stationary
 *     (keeps the 2h Redis TTL alive).
 *  2. watchPosition — catches real movement in between; throttled so we only
 *     send if MIN_SEND_GAP_MS has passed or the worker moved > MIN_MOVE_METERS.
 */

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_SEND_GAP_MS = 60 * 1000;      // at most once a minute from watchPosition
const MIN_MOVE_METERS = 250;

export type TrackerStatus = "idle" | "active" | "denied" | "unsupported" | "error";

let watchId: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let lastSent: { lat: number; lng: number; at: number } | null = null;
const listeners = new Set<(s: TrackerStatus) => void>();
let status: TrackerStatus = "idle";

function setStatus(next: TrackerStatus) {
  status = next;
  listeners.forEach((l) => l(next));
}

export function subscribeTrackerStatus(fn: (s: TrackerStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function send(lat: number, lng: number, force = false) {
  const now = Date.now();
  if (!force && lastSent) {
    const recent = now - lastSent.at < MIN_SEND_GAP_MS;
    const barelyMoved = distanceMeters(lastSent, { lat, lng }) < MIN_MOVE_METERS;
    if (recent && barelyMoved) return;
  }
  try {
    await api.post("/workers/me/location", { latitude: lat, longitude: lng });
    lastSent = { lat, lng, at: now };
    setStatus("active");
  } catch (err: unknown) {
    // 409 = backend says we're not online/verified anymore → stop quietly
    const code = (err as { response?: { status?: number } })?.response?.status;
    if (code === 409 || code === 404) stopLocationTracking();
    else setStatus("error");
  }
}

function handleGeoError(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) {
    setStatus("denied");
    stopLocationTracking(false);
  }
  // TIMEOUT / POSITION_UNAVAILABLE: keep trying on the next tick
}

function pollOnce() {
  navigator.geolocation.getCurrentPosition(
    (pos) => send(pos.coords.latitude, pos.coords.longitude, true),
    handleGeoError,
    { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 }
  );
}

export function isTracking() {
  return intervalId !== null;
}

export function startLocationTracking() {
  if (isTracking()) return;
  if (!("geolocation" in navigator) || !window.isSecureContext) {
    setStatus("unsupported");
    return;
  }

  // Initial position right away (this is what triggers the browser permission prompt)
  pollOnce();

  // Fixed-interval ping
  intervalId = setInterval(pollOnce, POLL_INTERVAL_MS);

  // Movement in between
  watchId = navigator.geolocation.watchPosition(
    (pos) => send(pos.coords.latitude, pos.coords.longitude),
    handleGeoError,
    { enableHighAccuracy: false, maximumAge: 120_000 }
  );
}

export function stopLocationTracking(resetStatus = true) {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  if (intervalId !== null) clearInterval(intervalId);
  watchId = null;
  intervalId = null;
  lastSent = null;
  if (resetStatus) setStatus("idle");
}
