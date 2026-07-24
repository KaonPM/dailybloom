"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccessResetShell from "../components/AccessResetShell";
import PasswordInput from "../components/PasswordInput";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import { restorePasswordSession } from "../lib/password-session";
import { supabase } from "../lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    tone: "info" | "success" | "error";
  }>({
    message: "Confirming your secure password-reset link...",
    tone: "info",
  });

  useEffect(() => {
    let active = true;

    async function confirmSession() {
      const result = await restorePasswordSession("recovery");
      if (!active) return;
      setSessionReady(result.ready);
      setStatus(
        result.ready
          ? {
              message: "Secure link confirmed. You can now create a new password.",
              tone: "success",
            }
          : {
              message:
                "This password-reset link is invalid or has expired. Please request a new link.",
              tone: "error",
            }
      );
    }

    void confirmSession();
    return () => {
      active = false;
    };
  }, []);

  async function resetPassword() {
    const sessionResult = await restorePasswordSession("recovery");
    if (!sessionResult.ready) {
      setSessionReady(false);
      setStatus({
        message:
          "This password-reset link is invalid or has expired. Please request a new link.",
        tone: "error",
      });
      return;
    }

    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!strongPasswordRegex.test(newPassword)) {
      setStatus({
        message:
          "Use at least 8 characters with uppercase, lowercase, a number and a special character.",
        tone: "error",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({ message: "The passwords do not match.", tone: "error" });
      return;
    }

    setSaving(true);
    const response = await authenticatedFetch("/api/update-own-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const result = await response.json();

    if (!response.ok) {
      setStatus({
        message: result.error || "DailyBloom could not update your password.",
        tone: "error",
      });
      setSaving(false);
      return;
    }

    window.sessionStorage.removeItem("dailybloom-password-recovery-user");
    await supabase.auth.signOut({ scope: "local" });
    setSaving(false);
    router.push("/login?passwordReset=success");
  }

  return (
    <AccessResetShell
      title="Create a new password"
      subtitle="Choose a strong password that you do not use for another account."
      status={status}
      backHref={sessionReady ? "/login" : "/forgot-password"}
      backLabel={sessionReady ? "Back to login" : "Request a new reset link"}
    >
      <label style={labelStyle}>
        New password
        <PasswordInput
          className="db-input"
          placeholder="Enter your new password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
        />
      </label>

      <label style={labelStyle}>
        Confirm new password
        <PasswordInput
          className="db-input"
          placeholder="Enter it again"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
        />
      </label>

      <p style={helperStyle}>
        At least 8 characters · uppercase · lowercase · number · special character
      </p>

      <button
        type="button"
        className="db-button-primary"
        style={primaryButtonStyle}
        onClick={resetPassword}
        disabled={saving || !sessionReady}
      >
        {saving ? "Updating password..." : "Update password"}
      </button>
    </AccessResetShell>
  );
}

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  color: "#3D3550",
  fontWeight: 700,
};

const helperStyle: React.CSSProperties = {
  margin: "-2px 0 2px",
  color: "#746D80",
  fontSize: 13,
  lineHeight: 1.5,
  textAlign: "center",
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 52,
  borderRadius: 14,
};
