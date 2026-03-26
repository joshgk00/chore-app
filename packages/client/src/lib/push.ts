import { useState, useEffect, useCallback } from "react";
import type { PushRole } from "@chore-app/shared";
import { api } from "../api/client.js";

interface PushSupport {
  isSupported: boolean;
  permission: NotificationPermission | null;
  subscribe: (role: PushRole) => Promise<void>;
  isSubscribing: boolean;
  error: string | null;
}

function checkSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    typeof Notification.requestPermission === "function"
  );
}

function getPermission(): NotificationPermission | null {
  if (typeof Notification === "undefined") return null;
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function usePushSupport(): PushSupport {
  const [isSupported] = useState(checkSupported);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    getPermission,
  );
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupported) return;
    setPermission(getPermission());
  }, [isSupported]);

  const subscribe = useCallback(
    async (role: PushRole) => {
      if (!isSupported) return;

      setIsSubscribing(true);
      setError(null);

      try {
        const result = await Notification.requestPermission();

        if (result !== "granted") {
          setPermission(result);
          setError("Notification permission was not granted.");
          return;
        }

        const vapidResult = await api.get<{ key: string }>(
          "/api/push/vapid-public-key",
        );
        if (!vapidResult.ok) {
          setError("Could not retrieve push configuration from the server.");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const applicationServerKey = urlBase64ToUint8Array(vapidResult.data.key);
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        });

        const json = subscription.toJSON();
        const p256dh = json.keys?.p256dh;
        const auth = json.keys?.auth;

        if (!json.endpoint || !p256dh || !auth) {
          setError("Could not retrieve subscription details from the browser.");
          return;
        }

        const subscribeResult = await api.post("/api/push/subscribe", {
          role,
          endpoint: json.endpoint,
          p256dh,
          auth,
        });

        if (!subscribeResult.ok) {
          setError("Could not save your subscription. Please try again.");
          return;
        }

        setPermission("granted");
      } catch {
        setError("Something went wrong while enabling notifications.");
      } finally {
        setIsSubscribing(false);
      }
    },
    [isSupported],
  );

  return { isSupported, permission, subscribe, isSubscribing, error };
}
