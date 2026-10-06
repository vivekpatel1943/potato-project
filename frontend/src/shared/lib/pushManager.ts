import api from "./api";

/**
 * Web Push helper.
 *
 * - `isPushSupported()`   — browser + secure context check (http://localhost is OK,
 *                            plain http on a LAN IP is NOT a secure context).
 * - `ensurePushSubscription({ prompt })` — registers /sw.js, asks permission if
 *                            `prompt` is true, subscribes with the backend's VAPID
 *                            key and stores the subscription on the backend.
 *                            Safe to call repeatedly.
 */

let cachedVapidKey: string | null = null;

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  return isPushSupported() ? Notification.permission : "unsupported";
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getVapidKey(): Promise<string | null> {
  if (cachedVapidKey) return cachedVapidKey;
  const { data } = await api.get<{ public_key: string }>("/push/vapid-public-key");
  cachedVapidKey = data.public_key || null;
  return cachedVapidKey;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export async function ensurePushSubscription({ prompt = false } = {}): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    let permission = Notification.permission;
    if (permission === "default" && prompt) {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return false;

    const vapidKey = await getVapidKey();
    if (!vapidKey) return false;

    const reg = await getRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    await api.post("/push/subscribe", {
      endpoint: json.endpoint,
      p256dh_key: json.keys.p256dh,
      auth_key: json.keys.auth,
    });
    return true;
  } catch (err) {
    console.warn("[push] subscription failed", err);
    return false;
  }
}
