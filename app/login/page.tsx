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
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    setLoading(true);

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
        must_change_password,
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

    if (profileData.must_change_password) {
      router.push("/change-password");
      setLoading(false);
      return;
    }

    if (role === "master") {
      router.push("/master?view=dashboard");
      setLoading(false);
      return;
    }

    if (role === "teacher") {
      router.push("/teacher");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
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
        ? `${window.location.origin}/reset-password`
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
            Daily<span style={{ color: "#F66BA0" }}>Bloom</span>
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
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div style={{ position: "relative" }}>
         <input
          className="db-input"
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ paddingRight: "46px" }}
         />

         <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={{
          position: "absolute",
          right: "12px",
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: "18px",
         }}
          aria-label={showPassword ? "Hide password" : "Show password"}
         >
         {showPassword ? "🙈" : "👁️"}
         </button>
       </div>

        <button
          type="button"
          className="db-button-primary"
          style={{ width: "100%", marginTop: "8px" }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <button
          type="button"
          onClick={handleForgotPassword}
          style={{
            width: "100%",
            marginTop: "14px",
            background: "transparent",
            border: "none",
            color: "#F66BA0",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Forgot password?
        </button>

        <p
          style={{
            margin: "22px 0 0 0",
            textAlign: "center",
            color: "#5F6275",
            fontSize: "14px",
          }}
        >
          New school?{" "}
          <Link
            href="/signup"
            style={{
              color: "#2D2A3E",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}