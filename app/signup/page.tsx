"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function SignUpPage() {
  const [schoolName, setSchoolName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!schoolName || !fullName || !email) {
      setMessage("Please complete all fields.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("school_signup_requests").insert([
      {
        school_name: schoolName.trim(),
        principal_full_name: fullName.trim(),
        principal_email: email.trim().toLowerCase(),
        status: "pending",
      },
    ]);

    if (error) {
      setMessage(error.message || "Could not submit request.");
      setLoading(false);
      return;
    }

    setSchoolName("");
    setFullName("");
    setEmail("");

    setMessage(
      "Your sign-up request has been submitted and is pending review. DailyBloom will create your school and principal login after approval."
    );

    setLoading(false);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FFF8F2",
        padding: "32px 20px",
      }}
    >
      <div
        style={{
          maxWidth: "520px",
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            color: "#6D6888",
            fontWeight: 700,
            fontSize: "14px",
          }}
        >
          ← Back to Home
        </Link>

        <div
          style={{
            marginTop: "18px",
            background: "#FFFFFF",
            border: "1px solid #E9E0D4",
            borderRadius: "24px",
            padding: "26px",
            boxShadow: "0 10px 24px rgba(86, 118, 158, 0.06)",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#F66BA0",
              fontWeight: 800,
              fontSize: "14px",
            }}
          >
            DailyBloom
          </p>

          <h1
            style={{
              margin: "10px 0 8px 0",
              fontSize: "34px",
              lineHeight: 1.1,
              color: "#2D2A3E",
              fontWeight: 800,
            }}
          >
            Sign up your school
          </h1>

          <p
            style={{
              margin: 0,
              color: "#5F6275",
              fontSize: "15px",
              lineHeight: 1.6,
            }}
          >
            Submit your school details for review. A DailyBloom administrator
            will create your school and principal login after approval.
          </p>

          <form onSubmit={handleSignUp} style={{ marginTop: "20px" }}>
            <Input
              placeholder="School Name"
              value={schoolName}
              onChange={setSchoolName}
            />

            <Input
              placeholder="Principal Full Name"
              value={fullName}
              onChange={setFullName}
            />

            <Input
              placeholder="Principal Email Address"
              value={email}
              onChange={setEmail}
              type="email"
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: "48px",
                border: "none",
                borderRadius: "14px",
                background: "#7CCCF3",
                color: "#24324A",
                fontWeight: 800,
                fontSize: "15px",
                cursor: "pointer",
                marginTop: "8px",
              }}
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </form>

          {message ? (
            <p
              style={{
                margin: "14px 0 0 0",
                fontSize: "14px",
                color: "#6D6888",
                lineHeight: 1.6,
              }}
            >
              {message}
            </p>
          ) : null}

          <p
            style={{
              margin: "18px 0 0 0",
              fontSize: "14px",
              color: "#6D6888",
            }}
          >
            Already have login details?{" "}
            <Link
              href="/login"
              style={{
                color: "#F66BA0",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Input({
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        height: "46px",
        padding: "0 14px",
        marginBottom: "12px",
        borderRadius: "14px",
        border: "1px solid #E3D9CD",
        fontSize: "15px",
        outline: "none",
        color: "#2D2A3E",
        background: "#FFFFFF",
      }}
    />
  );
}