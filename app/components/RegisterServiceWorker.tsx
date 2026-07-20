"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

export type OneSignalClient = {
  init: (options: {
    appId: string;
    serviceWorkerParam: { scope: string };
    serviceWorkerPath: string;
  }) => Promise<void>;
  login?: (externalId: string) => Promise<void>;
  Notifications: {
    requestPermission: () => Promise<void>;
    permission: boolean;
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalClient) => Promise<void> | void>;
    DailyBloomOneSignalInitialized?: boolean;
  }
}

const ONESIGNAL_APP_ID =
  process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ||
  "3934f676-2dfd-4520-9145-3344ad88aa33";
const ONESIGNAL_ALLOWED_HOSTS = new Set([
  "dailybloom.co.za",
  "www.dailybloom.co.za",
]);

function canInitializeOneSignal() {
  if (typeof window === "undefined" || !ONESIGNAL_APP_ID) {
    return false;
  }

  return ONESIGNAL_ALLOWED_HOSTS.has(window.location.hostname);
}

export default function RegisterServiceWorker() {
  const pathname = usePathname();
  useEffect(() => {
    if ("serviceWorker" in navigator && !ONESIGNAL_APP_ID) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => {
          console.error("Service worker registration failed:", error);
        });
    }
  }, []);

  useEffect(() => {
    if (!canInitializeOneSignal()) {
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        if (!window.DailyBloomOneSignalInitialized) {
          await OneSignal.init({
            appId: ONESIGNAL_APP_ID,
            serviceWorkerParam: {
              scope: "/",
            },
            serviceWorkerPath: "OneSignalSDKWorker.js",
          });
          window.DailyBloomOneSignalInitialized = true;
        }

        const { profile } = await getCurrentProfile();

        if (profile?.id && profile.role !== "parent" && OneSignal.login) {
          await OneSignal.login(String(profile.id));
          return;
        }

        const identityResponse = await fetch("/api/onesignal/identity");
        const identity = await identityResponse.json();

        if (identity?.externalId && OneSignal.login) {
          await OneSignal.login(String(identity.externalId));
        }
      } catch (error) {
        console.error("OneSignal initialization failed:", error);
      }
    });
  }, [pathname]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function enableMessageNotifications() {
      if (
        typeof window === "undefined" ||
        ONESIGNAL_APP_ID ||
        !("Notification" in window) ||
        !("serviceWorker" in navigator)
      ) {
        return;
      }

      const { profile } = await getCurrentProfile();

      if (!profile?.id || profile.role === "parent") {
        return;
      }

      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }

      if (Notification.permission !== "granted") {
        return;
      }

      channel = supabase
        .channel(`message-notifications-${profile.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${profile.id}`,
          },
          async (payload) => {
            const message = payload.new as {
              sender_name?: string | null;
              message?: string | null;
              sender_id?: string | null;
            };

            if (String(message.sender_id || "") === String(profile.id)) {
              return;
            }

            const registration = await navigator.serviceWorker.ready;

            await registration.showNotification("New DailyBloom message", {
              body: `${message.sender_name || "DailyBloom"}: ${
                message.message || "You have a new message."
              }`,
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              data: {
                url: "/messages",
              },
            });
          }
        )
        .subscribe();
    }

    enableMessageNotifications();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return null;
}
