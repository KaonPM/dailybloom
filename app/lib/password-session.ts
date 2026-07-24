"use client";

import { supabase } from "./supabase";

type PasswordSessionMode = "authenticated" | "recovery";

function clearRecoveryCredentials(url: URL) {
  url.searchParams.delete("code");
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  url.hash = "";
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

export async function restorePasswordSession(
  mode: PasswordSessionMode = "authenticated"
) {
  if (typeof window === "undefined") {
    return { ready: false, error: new Error("Password changes require a browser session.") };
  }

  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const recoveryError =
    url.searchParams.get("error_description") ||
    hash.get("error_description");
  if (recoveryError) {
    return { ready: false, error: new Error(decodeURIComponent(recoveryError)) };
  }

  if (mode === "recovery") {
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    let recoverySession = null;
    let recoverySessionError: Error | null = null;

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      recoverySession = data.session;
      recoverySessionError = error;
    } else if (tokenHash) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });
      recoverySession = data.session;
      recoverySessionError = error;
    } else if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      recoverySession = data.session;
      recoverySessionError = error;
    }

    if (recoverySession) {
      window.sessionStorage.setItem(
        "dailybloom-password-recovery-user",
        recoverySession.user.id
      );
      clearRecoveryCredentials(url);
      return { ready: true, error: null };
    }

    if (recoverySessionError) {
      return { ready: false, error: recoverySessionError };
    }

    const recoveryUserId = window.sessionStorage.getItem(
      "dailybloom-password-recovery-user"
    );
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (session?.user.id && session.user.id === recoveryUserId) {
      return { ready: true, error: null };
    }

    return {
      ready: false,
      error:
        error ||
        new Error(
          "This password-reset link is invalid, expired, or has already been used."
        ),
    };
  }

  const {
    data: { session: existingSession },
    error: existingSessionError,
  } = await supabase.auth.getSession();

  if (existingSession) return { ready: true, error: null };

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
