"use client";

/** Browser side of phone alerts: the service worker, the browser's
 * permission, and telling the server about this device. */

export type PushState = "loading" | "unsupported" | "needsInstall" | "denied" | "off" | "on";

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export async function currentPushState(): Promise<PushState> {
  // On iPhone, alerts only work from the app added to the home screen.
  if (isIos() && !isStandalone()) return "needsInstall";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Asks the browser, then registers this device for `who`'s alerts. */
export async function enablePush(who: "member" | "staff", locale: string, publicKey: string): Promise<PushState> {
  if (!supported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ who, locale: locale === "en" ? "en" : "fr", subscription: sub.toJSON() }),
  });
  if (!res.ok) throw new Error(`push subscribe failed: ${res.status}`);
  return "on";
}

/** Stops alerts on this device (also used when a member signs out). */
export async function disablePush(): Promise<void> {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
