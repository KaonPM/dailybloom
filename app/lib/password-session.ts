"use client";

import { supabase } from "./supabase";

export async function restorePasswordSession() {
  if (typeof window === "undefined") {
    return { ready: false, error: new Error("Password changes require a browser session.") };
  }

  const url = new URL(window.location.href);
  const {
    data: { session: existingSession },
    error: existingSessionError,
  } = await supabase.auth.getSession();

  if (existingSession) return { ready: true, error: null };

  const code = url.searchParams.get("code");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ready: false, error };

    url.searchParams.delete("code");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    return {
      ready: false,
      error:
        error ||
        existingSessionError ||
        new Error("Your secure password session has expired."),
    };
  }

  return { ready: true, error: null };
}
