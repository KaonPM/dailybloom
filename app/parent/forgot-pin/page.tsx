"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPinPage() {
  const router = useRouter();

  const [phone, setPhone] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleReset() {
    if (!phone) {
      alert(
        "Enter contact number"
      );
      return;
    }

    setLoading(true);

    try {
      const res =
        await fetch(
          "/api/parent-forgot-pin",
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

      const data =
        await res.json();

      if (!res.ok) {
        alert(
          data.error
        );
        return;
      }

      alert(
        "PIN reset successful. Please login again."
      );

      router.push(
        "/parent-login"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="parent-login-wrapper"
    >
      <div
        className="parent-login-card"
      >
        <h1>
          Forgot PIN
        </h1>

        <p>
          Enter your contact
          number to reset
          your PIN.
        </p>

        <input
          type="text"
          placeholder="Contact Number"
          className="parent-input"
          value={phone}
          onChange={(e) =>
            setPhone(
              e.target.value
            )
          }
        />

        <button
          className="parent-button"
          onClick={handleReset}
          disabled={loading}
        >
          {loading
            ? "Resetting..."
            : "Reset PIN"}
        </button>
      </div>
    </div>
  );
}