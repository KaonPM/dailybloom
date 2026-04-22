"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSignup, setIsSignup] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    fetchBranding();

    const mode = searchParams.get("mode");
    setIsSignup(mode === "signup");
  }, [searchParams]);

  async function fetchBranding() {
    const { data } = await supabase
      .from("schools")
      .select("logo_url")
      .limit(1)
      .single();

    if (data?.logo_url) {
      setLogoUrl(data.logo_url);
    }
  }

  async function handleSubmit() {
    setLoading(true);

    if (isSignup) {
      if (!schoolName || !fullName || !email || !password) {
        alert("Please complete all fields");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      const user = data.user;

      if (!user) {
        alert("Could not create user account.");
        setLoading(false);
        return;
      }

      const { data: schoolData, error: schoolError } = await supabase
        .from("schools")
        .insert([
          {
            school_name: schoolName,
          },
        ])
        .select()
        .single();

      if (schoolError) {
        alert(schoolError.message);
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: user.id,
          email,
          full_name: fullName,
          school_id: schoolData.id,
          role: "owner",
        },
      ]);

      if (profileError) {
        alert(profileError.message);
        setLoading(false);
        return;
      }

      alert("Trial account created successfully. You can now log in.");
      setIsSignup(false);
      setSchoolName("");
      setFullName("");
      setPassword("");
      setLoading(false);
      return;
    }

    if (!email || !password) {
      alert("Please enter email and password");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("email", email)
      .single();

    if (profileError) {
      alert(profileError.message);
      setLoading(false);
      return;
    }

    if (profileData?.role === "master") {
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

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/login",
    });

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

      {logoUrl ? (
        <img
          src={logoUrl}
          alt="DailyBloom Logo"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "280px",
            opacity: 0.08,
            pointerEvents: "none",
          }}
        />
      ) : null}

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
          {isSignup ? "Start Your Free Trial" : "Welcome Back"}
        </h2>

        <p
          style={{
            margin: "0 0 20px 0",
            color: "#5F6275",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          {isSignup
            ? "Create your school account and begin using DailyBloom."
            : "Login to continue to your school dashboard."}
        </p>

        {isSignup && (
          <>
            <input
              className="db-input"
              placeholder="School Name"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />

            <input
              className="db-input"
              placeholder="Your Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </>
        )}

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

        {!isSignup && (
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
        )}

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
          {loading
            ? "Please wait..."
            : isSignup
            ? "Create Trial Account"
            : "Login"}
        </button>

        <button
          onClick={() => setIsSignup(!isSignup)}
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
          {isSignup
            ? "Already have an account? Login"
            : "New school? Start Free Trial"}
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