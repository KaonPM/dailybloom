"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AccessResetShell from "../components/AccessResetShell";
import PasswordInput from "../components/PasswordInput";

export default function CreatePinPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSavePin() {
    if (!/^\d{4}$/.test(pin)) {
      setError("Your PIN must contain exactly 4 digits.");
      return;
    }

    if (pin !== confirmPin) {
      setError("The PINs do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/create-parent-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "DailyBloom could not create your PIN.");
        return;
      }

      setSuccess(true);
      setPin("");
      setConfirmPin("");

      window.setTimeout(() => {
        router.push("/parent-login");
      }, 3000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccessResetShell
      title={success ? "Your PIN is ready" : "Create your parent PIN"}
      subtitle={
        success
          ? "Your secure parent access has been set up."
          : "Choose a private 4-digit PIN for future parent portal logins."
      }
      status={
        success
          ? {
              message: "PIN created successfully. Redirecting you to parent login...",
              tone: "success",
            }
          : error
            ? { message: error, tone: "error" }
            : undefined
      }
      backHref={success ? undefined : "/parent-login"}
      backLabel="Back to parent login"
    >
      {!success ? (
        <>
          <label style={labelStyle}>
            New PIN
            <PasswordInput
              className="db-input"
              maxLength={4}
              value={pin}
              placeholder="Enter a 4-digit PIN"
              inputMode="numeric"
              autoComplete="new-password"
              visibleLabel="Hide PIN"
              hiddenLabel="Show PIN"
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, ""))
              }
            />
          </label>

          <label style={labelStyle}>
            Confirm PIN
            <PasswordInput
              className="db-input"
              maxLength={4}
              value={confirmPin}
              placeholder="Enter the PIN again"
              inputMode="numeric"
              autoComplete="new-password"
              visibleLabel="Hide PIN"
              hiddenLabel="Show PIN"
              onChange={(event) =>
                setConfirmPin(event.target.value.replace(/\D/g, ""))
              }
            />
          </label>

          <p style={helperStyle}>
            Keep this PIN private. DailyBloom staff will never ask you to share it.
          </p>

          <button
            type="button"
            className="db-button-primary"
            style={primaryButtonStyle}
            onClick={handleSavePin}
            disabled={loading}
          >
            {loading ? "Creating PIN..." : "Create PIN"}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="db-button-primary"
          style={primaryButtonStyle}
          onClick={() => router.push("/parent-login")}
        >
          Continue to parent login
        </button>
      )}
    </AccessResetShell>
  );
}

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  color: "#3D3550",
  fontWeight: 700,
};

const helperStyle: React.CSSProperties = {
  margin: "-2px 0 2px",
  color: "#746D80",
  fontSize: 13,
  lineHeight: 1.5,
  textAlign: "center",
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 52,
  borderRadius: 14,
};
