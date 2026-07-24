"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";
import { restorePasswordSession } from "../lib/password-session";
import { authenticatedFetch } from "../lib/authenticated-fetch";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionMessage, setSessionMessage] = useState(
    "Confirming your secure session..."
  );

  useEffect(() => {
    let active = true;

    async function confirmSession() {
      const result = await restorePasswordSession();
      if (!active) return;
      setSessionReady(result.ready);
      setSessionMessage(
        result.ready
          ? ""
          : "Your password session has expired. Please log in again or request a new password reset link."
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
      setSessionMessage(
        "Your password session has expired. Please log in again or request a new password reset link."
      );
      return;
    }

    if (!newPassword || !confirmPassword) {
      alert("Please enter and confirm your new password.");
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

    const { profile, error: profileError } = await getCurrentProfile();

    if (profileError || !profile) {
      alert("Could not confirm your profile. Please log in again.");
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
      alert(result.error || "DailyBloom could not update your password.");
      setSaving(false);
      return;
    }

    setSaving(false);
    alert("Password updated successfully.");

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
    <main style={pageStyle}>
      <header style={topBarStyle}>
        <strong>DailyBloom</strong>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" style={smallButton} onClick={() => router.push("/")}>
            Homepage
          </button>

          <button type="button" style={smallButton} onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <section style={formWrapStyle}>
        <h1 style={titleStyle}>Create Your New Password</h1>

        <p style={subtitleStyle}>
          For security, please replace your temporary password before continuing.
        </p>

        {sessionMessage ? <p style={subtitleStyle}>{sessionMessage}</p> : null}

        <div style={passwordWrapStyle}>
          <input
            style={inputStyle}
            type={showNewPassword ? "text" : "password"}
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <button
            type="button"
            style={viewButtonStyle}
            onClick={() => setShowNewPassword((prev) => !prev)}
          >
            {showNewPassword ? "Hide" : "View"}
          </button>
        </div>

        <div style={passwordWrapStyle}>
          <input
            style={inputStyle}
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <button
            type="button"
            style={viewButtonStyle}
            onClick={() => setShowConfirmPassword((prev) => !prev)}
          >
            {showConfirmPassword ? "Hide" : "View"}
          </button>
        </div>

        <button
          type="button"
          style={updateButtonStyle}
          onClick={updatePassword}
          disabled={saving || !sessionReady}
        >
          {saving ? "Updating..." : "Update Password"}
        </button>
      </section>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#FBF8F4",
  color: "#2F2440",
};

const topBarStyle: React.CSSProperties = {
  height: 64,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 32px",
  borderBottom: "1px solid #E8DED4",
  background: "#FBF8F4",
};

const formWrapStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: "48px auto",
  padding: "0 24px",
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  marginBottom: 12,
};

const subtitleStyle: React.CSSProperties = {
  marginBottom: 18,
  color: "#5B5675",
};

const passwordWrapStyle: React.CSSProperties = {
  position: "relative",
  marginBottom: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 70px 14px 16px",
  borderRadius: 12,
  border: "1px solid #D8D0C8",
  fontSize: 14,
};

const viewButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "transparent",
  color: "#2F80A8",
  fontWeight: 700,
  cursor: "pointer",
};

const updateButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 12,
  border: "none",
  background: "#26AEE4",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const smallButton: React.CSSProperties = {
  border: "1px solid #E0C7B8",
  borderRadius: 12,
  padding: "8px 14px",
  background: "#F7E5D6",
  color: "#5A3B2E",
  cursor: "pointer",
};
