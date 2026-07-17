"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const fieldStyle = { width: "100%", padding: 16, borderRadius: 14, border: "1px solid #ddd", marginBottom: 14, fontSize: 16 };
const buttonStyle = { width: "100%", padding: 16, background: "#6EC1E4", color: "#fff", border: "none", borderRadius: 14, fontWeight: 700, cursor: "pointer" };

export default function ForgotParentPinPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "done">("phone");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function requestCode() {
    if (!phone.trim()) return alert("Please enter your contact number.");
    setLoading(true);
    try {
      const response = await fetch("/api/parent-forgot-pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      const result = await response.json();
      if (!response.ok) alert(result.error || "The verification code could not be requested.");
      else { setMessage(result.message); setStep("code"); }
    } catch { alert("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  async function resetPin() {
    if (!/^\d{6}$/.test(otp)) return alert("Enter the 6-digit verification code from the SMS.");
    if (!/^\d{4}$/.test(newPin)) return alert("Your new PIN must contain exactly 4 digits.");
    if (newPin !== confirmPin) return alert("The new PINs do not match.");
    setLoading(true);
    try {
      const response = await fetch("/api/reset-parent-pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, otp, new_pin: newPin }) });
      const result = await response.json();
      if (!response.ok) alert(result.error || "Your PIN could not be updated.");
      else setStep("done");
    } catch { alert("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  return <div style={{ minHeight: "100vh", background: "#FFF8F5", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
    <div style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 28, padding: 36, border: "1px solid #eee", boxShadow: "0 16px 40px rgba(50,40,70,.08)" }}>
      <h1 style={{ margin: "0 0 10px", color: "#2D2A3E" }}>Reset Parent Portal PIN</h1>
      {step === "phone" && <>
        <p style={{ color: "#666", lineHeight: 1.6 }}>Enter the contact number registered with your preschool. We will send a private verification code by SMS.</p>
        <input inputMode="tel" autoComplete="tel" placeholder="Contact number" value={phone} onChange={(event) => setPhone(event.target.value)} style={fieldStyle} />
        <button type="button" onClick={requestCode} disabled={loading} style={buttonStyle}>{loading ? "Sending..." : "Send Verification Code"}</button>
      </>}
      {step === "code" && <>
        <p style={{ color: "#666", lineHeight: 1.6 }}>{message} The code expires in 10 minutes.</p>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit verification code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} style={fieldStyle} />
        <input inputMode="numeric" autoComplete="new-password" maxLength={4} type="password" placeholder="New 4-digit PIN" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ""))} style={fieldStyle} />
        <input inputMode="numeric" autoComplete="new-password" maxLength={4} type="password" placeholder="Confirm new PIN" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ""))} style={fieldStyle} />
        <button type="button" onClick={resetPin} disabled={loading} style={buttonStyle}>{loading ? "Updating..." : "Update PIN"}</button>
        <button type="button" onClick={requestCode} disabled={loading} style={{ ...buttonStyle, background: "transparent", color: "#5A4C72", marginTop: 10 }}>Send a New Code</button>
      </>}
      {step === "done" && <>
        <div style={{ background: "#F5FFF8", border: "1px solid #D8F0DD", padding: 20, borderRadius: 16 }}><h3 style={{ color: "#2F855A", marginTop: 0 }}>PIN updated</h3><p style={{ color: "#555", marginBottom: 0 }}>You can now sign in with your contact number and new PIN.</p></div>
        <button type="button" onClick={() => router.push("/parent-login")} style={{ ...buttonStyle, background: "#FF5EA8", marginTop: 18 }}>Back to Login</button>
      </>}
    </div>
  </div>;
}
