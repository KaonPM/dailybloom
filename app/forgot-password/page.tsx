"use client";

import { useState } from "react";
import AccessResetShell from "../components/AccessResetShell";
import { supabase } from "../lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);

  async function sendResetLink() {
    if (!email.trim()) {
      setStatus({ message: "Please enter your email address.", tone: "error" });
      return;
    }

    setSending(true);
    setStatus(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSending(false);

    if (error) {
      setStatus({ message: error.message, tone: "error" });
      return;
    }

    setStatus({
      message: "Reset link sent. Please check your email and follow the secure link.",
      tone: "success",
    });
  }

  return (
    <AccessResetShell
      title="Reset your password"
      subtitle="Enter the email address linked to your DailyBloom account."
      status={status ?? undefined}
      backHref="/login"
    >
      <label style={labelStyle}>
        Email address
        <input
          className="db-input"
          type="email"
          placeholder="name@example.com"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <button
        type="button"
        className="db-button-primary"
        style={primaryButtonStyle}
        onClick={sendResetLink}
        disabled={sending}
      >
        {sending ? "Sending secure link..." : "Send reset link"}
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

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 52,
  borderRadius: 14,
};
