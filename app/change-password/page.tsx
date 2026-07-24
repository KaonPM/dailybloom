"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { restorePasswordSession } from "../lib/password-session";
import { authenticatedFetch } from "../lib/authenticated-fetch";
import AccessResetShell from "../components/AccessResetShell";
import PasswordInput from "../components/PasswordInput";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    tone: "info" | "success" | "error";
  }>({ message: "Confirming your secure session...", tone: "info" });

  useEffect(() => {
    let active = true;

    async function confirmSession() {
      const result = await restorePasswordSession();
      if (!active) return;
      setSessionReady(result.ready);
      setStatus(
        result.ready
          ? {
              message: "Secure session confirmed. Please replace your temporary password.",
              tone: "success",
            }
          : {
              message:
                "Your password session has expired. Please log in again or request a new password reset link.",
              tone: "error",
            }
      );
    }

    void confirmSession();
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function updatePassword() {
    const sessionResult = await restorePasswordSession();
    if (!sessionResult.ready) {
      setSessionReady(false);
      setStatus({
        message:
          "Your password session has expired. Please log in again or request a new password reset link.",
        tone: "error",
      });
      return;
    }

    if (!newPassword || !confirmPassword) {
      setStatus({
        message: "Please enter and confirm your new password.",
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

    const { profile, error: profileError } = await getCurrentProfile();

    if (profileError || !profile) {
      setStatus({
        message: "Could not confirm your profile. Please log in again.",
        tone: "error",
      });
      setSaving(false);
      router.push("/login");
      return;
    }

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

    setSaving(false);

    if (profile.role === "master" || result.role === "master") {
      router.push("/master");
      return;
    }

    if (profile.role === "master_admin" || result.role === "master_admin") {
      router.push("/master-admin");
      return;
    }

    if (profile.role === "teacher" || result.role === "teacher") {
      router.push("/teacher");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <AccessResetShell
      title="Create your new password"
      subtitle="For security, replace your temporary password before continuing."
      status={status}
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
        onClick={updatePassword}
        disabled={saving || !sessionReady}
      >
        {saving ? "Updating password..." : "Update password"}
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <button
          type="button"
          className="db-button-secondary"
          style={secondaryButtonStyle}
          onClick={() => router.push("/")}
        >
          Homepage
        </button>

        <button
          type="button"
          className="db-button-secondary"
          style={secondaryButtonStyle}
          onClick={logout}
        >
          Logout
        </button>
      </div>
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

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  borderRadius: 14,
};
