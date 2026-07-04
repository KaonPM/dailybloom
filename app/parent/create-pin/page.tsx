"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabase } from "@/app/lib/supabase";

export default function CreatePinPage() {
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const handleSavePin = async () => {
    if (pin.length !== 4) {
      alert("PIN must be 4 digits");
      return;
    }

    if (pin !== confirmPin) {
      alert("PINs do not match");
      return;
    }

    const phone = localStorage.getItem("parentPhone");

    if (!phone) {
      alert("Phone not found. Please login again.");
      return;
    }

    const hashedPin = await bcrypt.hash(pin, 10);

    const { error } = await supabase
      .from("learners")
      .update({
        pin_hash: hashedPin,
      })
      .eq("parent_phone", phone)

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/parent/select-child");
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

        <h2 className="parent-title">
          Create Your PIN
        </h2>

        <p className="parent-subtitle">
          Create a secure 4 digit PIN for future logins.
        </p>

        <div className="parent-input-wrap">
          <input
            type={showPin ? "text" : "password"}
            maxLength={4}
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, ""))
            }
            placeholder="Enter 4 digit PIN"
            className="parent-input"
          />

          <button
            type="button"
            className="parent-eye"
            onClick={() => setShowPin(!showPin)}
            aria-label={showPin ? "Hide PIN" : "Show PIN"}
          >
            {showPin ? "🙈" : "👁️"}
          </button>
        </div>

        <div className="parent-input-wrap">
          <input
            type={showConfirmPin ? "text" : "password"}
            maxLength={4}
            value={confirmPin}
            onChange={(e) =>
              setConfirmPin(e.target.value.replace(/\D/g, ""))
            }
            placeholder="Confirm PIN"
            className="parent-input"
          />

          <button
            type="button"
            className="parent-eye"
            onClick={() => setShowConfirmPin(!showConfirmPin)}
            aria-label={showConfirmPin ? "Hide PIN" : "Show PIN"}
          >
            {showConfirmPin ? "🙈" : "👁️"}
          </button>
        </div>

        <button
          onClick={handleSavePin}
          className="parent-button"
        >
          Continue
        </button>

      </div>
    </div>
  );
}