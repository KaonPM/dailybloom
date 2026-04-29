"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LegalAcceptancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewed = searchParams.get("reviewed") === "true";

  const [accepted, setAccepted] = useState(false);

  function continueToSignup() {
    if (!accepted) {
      alert("Please accept the Terms of Use and Privacy Policy before continuing.");
      return;
    }

    router.push("/signup");
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={titleStyle}>Before You Sign Up</h1>

        <p style={paragraphStyle}>
          Please read the DailyBloom Terms of Use and Privacy Policy before submitting your school signup request.
        </p>

        {!reviewed && (
          <>
            <p style={noticeText}>
              Start by reading the Terms of Use. From there, you will be guided to the Privacy Policy and then back here to accept.
            </p>

            <Link href="/terms?from=legal" style={documentLink}>
              Read Terms of Use
            </Link>
          </>
        )}

        {reviewed && (
          <>
            <label style={checkboxRow}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                style={{ marginTop: 4 }}
              />
              <span>
                I confirm that I have read and accept the DailyBloom Terms of Use and Privacy Policy.
              </span>
            </label>

            <button
              type="button"
              onClick={continueToSignup}
              style={{
                ...buttonStyle,
                opacity: accepted ? 1 : 0.6,
                cursor: accepted ? "pointer" : "not-allowed",
              }}
            >
              Continue to Sign Up
            </button>
          </>
        )}
      </section>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#FFF8F2",
  color: "#2D2A3E",
  padding: "32px 18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardStyle = {
  width: "100%",
  maxWidth: "680px",
  background: "#FFFFFF",
  border: "1px solid #E9E0D4",
  borderRadius: "24px",
  padding: "28px",
  boxShadow: "0 10px 24px rgba(86, 118, 158, 0.06)",
};

const titleStyle = {
  marginTop: 0,
  marginBottom: "12px",
  fontSize: "34px",
};

const paragraphStyle = {
  color: "#5F6275",
  lineHeight: 1.7,
  fontSize: "16px",
};

const noticeText = {
  color: "#7A6F86",
  lineHeight: 1.7,
  fontSize: "15px",
  marginTop: "16px",
};

const documentLink = {
  display: "block",
  marginTop: "22px",
  background: "#F8E8F0",
  border: "1px solid #EBC9D8",
  borderRadius: "16px",
  padding: "14px 16px",
  color: "#2D2A3E",
  fontWeight: 800,
  textDecoration: "none",
};

const checkboxRow = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
  color: "#5F6275",
  fontSize: "15px",
  lineHeight: 1.6,
  marginTop: "22px",
};

const buttonStyle = {
  width: "100%",
  marginTop: "22px",
  minHeight: "48px",
  border: "none",
  borderRadius: "16px",
  background: "#7CCCF3",
  color: "#24324A",
  fontWeight: 800,
};