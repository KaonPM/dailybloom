"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function sendResetLink() {
    if (!email) {
      alert("Please enter your email address.");
      return;
    }

    setSending(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSending(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password reset link sent. Please check your email.");
  }

  return (
    <div className="db-auth-page">
      <div className="db-auth-card">
        <h1 className="db-auth-title">Reset Your Password</h1>

        <p className="db-auth-subtitle">
          Enter your email address and we will send you a secure password reset link.
        </p>

        <input
          className="db-input"
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          type="button"
          className="db-button-primary"
          style={{ width: "100%" }}
          onClick={sendResetLink}
          disabled={sending}
        >
          {sending ? "Sending..." : "Send Reset Link"}
        </button>

        <p style={{ marginTop: "18px", textAlign: "center" }}>
          <Link href="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}