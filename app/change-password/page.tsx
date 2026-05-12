"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getCurrentProfile } from "../lib/auth";

export default function ChangePasswordPage() {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function updatePassword() {
    if (!newPassword || !confirmPassword) {
      alert("Please enter and confirm your new password.");
      return;
    }

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

    const { profile, error: profileError } = await getCurrentProfile();

    if (profileError || !profile) {
      alert("Could not confirm your profile. Please log in again.");
      setSaving(false);
      router.push("/login");
      return;
    }

    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (passwordError) {
      alert(passwordError.message);
      setSaving(false);
      return;
    }

    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({
        must_change_password: false,
      })
      .eq("id", profile.id);

    if (updateProfileError) {
      alert(updateProfileError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    alert("Password updated successfully.");

    if (profile.role === "master") {
      router.push("/master");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="db-auth-page">
      <div className="db-auth-card">
        <h1 className="db-auth-title">Create Your New Password</h1>

        <p className="db-auth-subtitle">
          For security, please replace your temporary password before continuing.
        </p>

        <input
          className="db-input"
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <input
          className="db-input"
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          type="button"
          className="db-button-primary"
          style={{ width: "100%" }}
          onClick={updatePassword}
          disabled={saving}
        >
          {saving ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}