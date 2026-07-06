"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotParentPinPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  async function handleReset() {
    if (!phone) {
      alert("Please enter your contact number");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        "/api/reset-parent-pin",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            phone,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(
          data.error ||
          "Could not reset PIN"
        );
        return;
      }

      setResetDone(true);

    } catch {
      alert(
        "Something went wrong"
      );
    }

    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFF8F5",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "250px",
          height: "250px",
          background: "#FBE8AA",
          borderBottomLeftRadius:
            "100%",
          opacity: 0.6,
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          background: "#fff",
          borderRadius: "30px",
          padding: "40px",
          border:
            "1px solid #eee",
        }}
      >
        <h1
          style={{
            marginBottom: "12px",
            color: "#2D2A3E",
          }}
        >
          Forgot PIN
        </h1>

        {!resetDone ? (
          <>
            <p
              style={{
                color: "#666",
                marginBottom: "25px",
              }}
            >
              Enter your contact number
              to reset your PIN.
            </p>

            <input
              type="text"
              placeholder="Contact Number"
              value={phone}
              onChange={(e) =>
                setPhone(
                  e.target.value
                )
              }
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "14px",
                border:
                  "1px solid #ddd",
                marginBottom: "20px",
              }}
            />

            <button
              onClick={
                handleReset
              }
              disabled={loading}
              style={{
                width: "100%",
                padding: "16px",
                background:
                  "#6EC1E4",
                color: "#fff",
                border: "none",
                borderRadius:
                  "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {loading
                ? "Resetting..."
                : "Reset PIN"}
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                background:
                  "#F5FFF8",
                border:
                  "1px solid #D8F0DD",
                padding: "20px",
                borderRadius:
                  "16px",
              }}
            >
              <h3
                style={{
                  color:
                    "#2F855A",
                }}
              >
                PIN reset successful ✓
              </h3>

              <p
                style={{
                  lineHeight: 1.7,
                  color: "#555",
                }}
              >
                Your PIN has been reset.

                On your next login,
                use your full contact
                number as your
                temporary PIN.

                You will then be asked
                to create a new PIN.
              </p>
            </div>

            <button
              onClick={() =>
                router.push(
                  "/parent-login"
                )
              }
              style={{
                width: "100%",
                marginTop: "20px",
                padding: "16px",
                background:
                  "#FF5EA8",
                color: "#fff",
                border: "none",
                borderRadius:
                  "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}