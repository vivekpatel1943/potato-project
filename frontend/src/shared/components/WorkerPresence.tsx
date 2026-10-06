import { useEffect } from "react";
import { useAppStore } from "../../features/app/stores/appStore";
import { startLocationTracking, stopLocationTracking } from "../lib/locationTracker";
import { ensurePushSubscription, getNotificationPermission } from "../lib/pushManager";

/**
 * Invisible component mounted in AppShell.
 *
 * - Location: polling starts AUTOMATICALLY the moment the worker is online
 *   (verified + is_available) and stops when they go offline or log out.
 *   No extra button for the worker to press.
 * - Push: if notification permission was already granted, silently make sure
 *   this browser's push subscription is registered with the backend.
 */
export default function WorkerPresence() {
  const { hasWorkerProfile, isWorkerVerified, isAvailable } = useAppStore();
  const isOnline = hasWorkerProfile && isWorkerVerified && isAvailable;

  // Keep push subscription fresh for every logged-in user (no prompt here)
  useEffect(() => {
    if (getNotificationPermission() === "granted") {
      ensurePushSubscription();
    }
  }, []);

  // Auto start/stop location polling based on online state
  useEffect(() => {
    if (isOnline) {
      startLocationTracking();
      ensurePushSubscription();
    } else {
      stopLocationTracking();
    }
  }, [isOnline]);

  // Stop when AppShell unmounts (logout / leaving the app shell)
  useEffect(() => () => stopLocationTracking(), []);

  return null;
}
