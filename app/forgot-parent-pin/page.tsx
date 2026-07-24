"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AccessResetShell from "../components/AccessResetShell";
import PasswordInput from "../components/PasswordInput";

type ResetStep = "phone" | "code" | "done";
type Status = { message: string; tone: "info" | "success" | "error" };

export default function ForgotParentPinPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<ResetStep>("phone");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  async function requestCode() {
    if (!phone.trim()) {
      setStatus({ message: "Please enter your contact number.", tone: "error" });
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/parent-forgot-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await response.json();

      if (!response.ok) {
        setStatus({
          message: result.error || "The verification code could not be requested.",
          tone: "error",
        });
      } else {
        setStatus({
          message: `${result.message} The code expires in 10 minutes.`,
          tone: "success",
        });
        setStep("code");
      }
    } catch {
      setStatus({
        message: "Something went wrong. Please try again.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function resetPin() {
    if (!/^\d{6}$/.test(otp)) {
      setStatus({
        message: "Enter the 6-digit verification code from the SMS.",
        tone: "error",
      });
      return;
    }

    if (!/^\d{4}$/.test(newPin)) {
      setStatus({
        message: "Your new PIN must contain exactly 4 digits.",
        tone: "error",
      });
      return;
    }

    if (newPin !== confirmPin) {
      setStatus({ message: "The new PINs do not match.", tone: "error" });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/reset-parent-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, new_pin: newPin }),
      });
      const result = await response.json();

      if (!response.ok) {
        setStatus({
          message: result.error || "Your PIN could not be updated.",
          tone: "error",
        });
      } else {
        setStatus({
          message: "Your PIN was updated successfully.",
          tone: "success",
        });
        setStep("done");
      }
    } catch {
      setStatus({
        message: "Something went wrong. Please try again.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccessResetShell
      title={step === "done" ? "PIN updated" : "Reset your parent PIN"}
      subtitle={
        step === "phone"
          ? "We will send a private verification code to the contact number registered with your preschool."
          : step === "code"
            ? "Enter the SMS code and choose a new 4-digit PIN."
            : "You can now sign in using your contact number and new PIN."
      }
      status={status ?? undefined}
      backHref={step === "done" ? undefined : "/parent-login"}
      backLabel="Back to parent login"
    >
      {step === "phone" ? (
        <>
          <label style={labelStyle}>
            Registered contact number
            <input
              className="db-input"
              inputMode="tel"
              autoComplete="tel"
              placeholder="e.g. 071 234 5678"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="db-button-primary"
            style={primaryButtonStyle}
            onClick={requestCode}
            disabled={loading}
          >
            {loading ? "Sending code..." : "Send verification code"}
          </button>
        </>
      ) : null}

      {step === "code" ? (
        <>
          <label style={labelStyle}>
            Verification code
            <input
              className="db-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6-digit SMS code"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            />
          </label>

          <label style={labelStyle}>
            New PIN
            <PasswordInput
              className="db-input"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              placeholder="4-digit PIN"
              value={newPin}
              onChange={(event) =>
                setNewPin(event.target.value.replace(/\D/g, ""))
              }
              visibleLabel="Hide PIN"
              hiddenLabel="Show PIN"
            />
          </label>

          <label style={labelStyle}>
            Confirm new PIN
            <PasswordInput
              className="db-input"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              placeholder="Enter the PIN again"
              value={confirmPin}
              onChange={(event) =>
                setConfirmPin(event.target.value.replace(/\D/g, ""))
              }
              visibleLabel="Hide PIN"
              hiddenLabel="Show PIN"
            />
          </label>

          <button
            type="button"
            className="db-button-primary"
            style={primaryButtonStyle}
            onClick={resetPin}
            disabled={loading}
          >
            {loading ? "Updating PIN..." : "Update PIN"}
          </button>

          <button
            type="button"
            className="db-button-secondary"
            style={secondaryButtonStyle}
            onClick={requestCode}
            disabled={loading}
          >
            Send a new code
          </button>
        </>
      ) : null}

      {step === "done" ? (
        <button
          type="button"
          className="db-button-primary"
          style={primaryButtonStyle}
          onClick={() => router.push("/parent-login")}
        >
          Continue to parent login
        </button>
      ) : null}
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

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 14,
};
