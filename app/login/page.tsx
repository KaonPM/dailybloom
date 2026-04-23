"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);

    if (!email || !password) {
      alert("Please enter email and password");
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

    if (authError || !authData.user) {
      alert(authError?.message || "Could not sign in.");
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        role,
        school_id,
        is_active,
        schools (
          is_active
        )
      `
      )
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profileData) {
      alert("Could not load your account profile.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    const role = profileData.role;
    const userIsActive = profileData.is_active !== false;
    const schoolRow = Array.isArray(profileData.schools)
  ? profileData.schools[0]
  : profileData.schools;

const schoolIsActive = schoolRow?.is_active !== false;
    const isSchoolUser = role === "principal" || role === "teacher";

    if (!userIsActive) {
      alert(
        "Your access has been deactivated. Please contact the platform administrator."
      );
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (isSchoolUser && !schoolIsActive) {
      alert(
        "Your school's access has been deactivated. Please contact the platform administrator."
      );
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (role === "master") {
      router.push("/master");
    } else {
      router.push("/dashboard");
    }

    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) {
      alert("Please enter your email address first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/login`
            : undefined,
      }
    );

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password reset email sent.");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FFF8F2",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-60px",
          right: "-40px",
          width: "260px",
          height: "260px",
          background: "#FFD166",
          borderRadius: "50%",
          opacity: 0.18,
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: "-90px",
          left: "-60px",
          width: "260px",
          height: "260px",
          background: "#57C785",
          borderRadius: "50%",
          opacity: 0.16,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "480px",
          background: "#FFFFFF",
          border: "1px solid #E9E0D4",
          borderRadius: "28px",
          padding: "30px",
          boxShadow: "0 10px 24px rgba(86, 118, 158, 0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "22px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "44px",
              lineHeight: 1,
              fontWeight: 800,
              color: "#2D2A3E",
            }}
          >
            Daily<span style={{ color: "#F66BA03" }}>Bloom</span>
          </h1>

          <p
            style={{
              margin: "10px 0 0 0",
              color: "#7A6F86",
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "0.3px",
            }}
          >
            WHERE PRESCHOOLS BLOOM EVERY DAY
          </p>
        </div>

        <h2
          style={{
            margin: "0 0 8px 0",
            color: "#2D2A3E",
            fontSize: "28px",
            fontWeight: 800,
            textAlign: "center",
          }}
        >
          Welcome Back
        </h2>

        <p
          style={{
            margin: "0 0 20px 0",
            color: "#5F6275",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Login to continue to your school dashboard.
        </p>

        <input
          className="db-input"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="db-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleForgotPassword}
          style={{
            border: "none",
            background: "transparent",
            color: "#F66BA0",
            fontWeight: 800,
            padding: 0,
            marginBottom: "16px",
            cursor: "pointer",
          }}
        >
          I forgot my password
        </button>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%",
            minHeight: "48px",
            border: "none",
            borderRadius: "16px",
            background: "#7CCCF3",
            color: "#24324A",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {loading ? "Please wait..." : "Login"}
        </button>

        <button
          onClick={() => router.push("/signup")}
          style={{
            width: "100%",
            minHeight: "48px",
            borderRadius: "16px",
            background: "#FFFFFF",
            color: "#24324A",
            fontWeight: 800,
            border: "1px solid #E6EEF5",
            marginTop: "12px",
            cursor: "pointer",
          }}
        >
          New school? Start Free Trial
        </button>

        <div style={{ textAlign: "center", marginTop: "18px" }}>
          <Link
            href="/"
            style={{
              color: "#7A6F86",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}