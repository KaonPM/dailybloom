"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function resetPassword() {
    const strongPasswordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!strongPasswordRegex.test(newPassword)) {
      alert(
        "Password must be at least 8 characters and include letters, numbers, and a special character."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setSaving(true);

    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (passwordError) {
      alert(passwordError.message);
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id);
    }

    await supabase.auth.signOut();

    setSaving(false);

    alert("Password reset successfully. Please log in with your new password.");

    router.push("/login");
  }

  return (
    <div className="db-auth-page">
      <div className="db-auth-card">
        <h1 className="db-auth-title">Create New Password</h1>

        <p className="db-auth-subtitle">
          Please enter your new password below.
        </p>

        <input
          className="db-input"
          type={showPassword ? "text" : "password"}
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <input
          className="db-input"
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          type="button"
          className="db-button-primary"
          style={{ width: "100%", marginBottom: "10px" }}
          onClick={resetPassword}
          disabled={saving}
        >
          {saving ? "Saving..." : "Reset Password"}
        </button>

        <button
          type="button"
          className="db-button-secondary"
          style={{ width: "100%" }}
          onClick={() => {
            setShowPassword(!showPassword);
            setShowConfirmPassword(!showConfirmPassword);
          }}
          disabled={saving}
        >
          {showPassword ? "Hide Passwords" : "Show Passwords"}
        </button>
      </div>
    </div>
  );
}