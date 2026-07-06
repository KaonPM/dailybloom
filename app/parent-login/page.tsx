"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ParentLoginPage() {
  const router = useRouter();

  const [showPin, setShowPin] = useState(false);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const digitsOnly = phone.replace(/\D/g, "");

    const normalizedPhone = digitsOnly.startsWith("27")
      ? "0" + digitsOnly.slice(2)
      : digitsOnly;

    if (!normalizedPhone) {
      alert("Please enter contact number");
      return;
    }

    if (!pin) {
      alert("Please enter your PIN");
      return;
    }

    setLoading(true);

    try {
      // Authenticate via server-side API (uses service role + bcrypt safely)
      const res = await fetch("/api/parent-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Login failed");
        return;
      }

      // FIRST LOGIN — temp PIN accepted, needs to set a real PIN
      if (data.needsPinCreation) {
        router.push("/parent/create-pin");
        return;
      }

      // EXISTING LOGIN — children returned by the API.
      // Auth state itself lives in the server-set session cookie, not here —
      // this is just UI convenience data for the next screen.
      const children = data.children;

      localStorage.setItem(
        "parentChildren",
        JSON.stringify(children)
      );

      // Single child → skip selector
      if (children.length === 1) {
        localStorage.setItem(
          "selectedChild",
          JSON.stringify(children[0])
        );

        router.push(
          "/parent/dashboard"
        );

        return;
      }

      // Multiple children
      router.push(
        "/parent/select-child"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="parent-login-wrapper">
      <div className="parent-login-card">

        <div className="parent-logo">
          <h1>
            Daily<span>Bloom</span>
          </h1>

          <div className="parent-tagline">
            WHERE PRESCHOOLS BLOOM EVERY DAY
          </div>
        </div>

        <div className="parent-portal-badge">
          Parent Portal
        </div>

        <h2 className="parent-title">
          Welcome Back
        </h2>

        <p className="parent-subtitle">
          Login to continue.
        </p>

        <div className="parent-input-wrap">
          <input
            type="text"
            placeholder="Contact Number"
            className="parent-input"
            value={phone}
            onChange={(e) =>
              setPhone(
                e.target.value.replace(/\s/g, "")
              )
            }
          />
        </div>

        <div className="parent-input-wrap">
          <input
            type={showPin ? "text" : "password"}
            placeholder="PIN"
            className="parent-input"
            value={pin}
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(e) =>
              setPin(
                e.target.value.replace(/\D/g, "")
              )
            }
          />

          <button
            type="button"
            className="parent-eye"
            onClick={() =>
              setShowPin(!showPin)
            }
          >
            {showPin ? "🙈" : "👁️"}
          </button>
        </div>

        <button
          className="parent-button"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <div
  style={{
    textAlign: "center",
    marginTop: "16px"
  }}
>
  <button
    type="button"
    onClick={() =>
      router.push(
        "/parent/forgot-pin"
      )
    }
    style={{
      border: "none",
      background: "transparent",
      color: "#FF5EA8",
      cursor: "pointer",
      fontWeight: 600
    }}
  >
    Forgot PIN?
  </button>
</div>


      </div>
    </div>
  );
}