"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { restorePasswordSession } from "../lib/password-session";
import { authenticatedFetch } from "../lib/authenticated-fetch";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionMessage, setSessionMessage] = useState(
    "Confirming your secure password-reset link..."
  );

  useEffect(() => {
    let active = true;

    async function confirmSession() {
      const result = await restorePasswordSession("recovery");
      if (!active) return;
      setSessionReady(result.ready);
      setSessionMessage(
        result.ready
          ? ""
          : "This password-reset link is invalid or has expired. Please request a new link."
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
      setSessionMessage(
        "This password-reset link is invalid or has expired. Please request a new link."
      );
      return;
    }

    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!strongPasswordRegex.test(newPassword)) {
      alert(
        "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
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
      alert(result.error || "DailyBloom could not update your password.");
      setSaving(false);
      return;
    }

    window.sessionStorage.removeItem("dailybloom-password-recovery-user");
    await supabase.auth.signOut({ scope: "local" });

    setSaving(false);

    alert("Password reset successfully. Please log in with your new password.");

    router.push("/login");
  }

  return (
    <div className="db-auth-page">
      <div className="db-auth-card">
        <h1 className="db-auth-title">Create a new password</h1>

        <p className="db-auth-subtitle">
          Your new password must include uppercase, lowercase, a number, and a special character.
        </p>

        {sessionMessage ? (
          <p className="db-auth-subtitle">{sessionMessage}</p>
        ) : null}

        <input
          className="db-input"
          type={showPassword ? "text" : "password"}
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <button
          type="button"
          className="db-button-secondary"
          style={{ width: "100%", marginBottom: "12px" }}
          onClick={() => setShowPassword(!showPassword)}
          disabled={saving}
        >
          {showPassword ? "Hide" : "Show"}
        </button>

        <input
          className="db-input"
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          type="button"
          className="db-button-secondary"
          style={{ width: "100%", marginBottom: "12px" }}
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          disabled={saving}
        >
          {showConfirmPassword ? "Hide" : "Show"}
        </button>

        <button
          type="button"
          className="db-button-primary"
          style={{ width: "100%", marginBottom: "14px" }}
          onClick={resetPassword}
          disabled={saving || !sessionReady}
        >
          {saving ? "Saving..." : "Update Password"}
        </button>

        <p className="db-auth-subtitle">
          Password must be at least 8 characters and include uppercase, lowercase, a number and a special character.
        </p>
      </div>
    </div>
  );
}
