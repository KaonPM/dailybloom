"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreatePinPage() {
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [showPin, setShowPin] =
    useState(false);

  const [
    showConfirmPin,
    setShowConfirmPin,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const handleSavePin =
    async () => {

      if (pin.length !== 4) {
        alert(
          "PIN must be exactly 4 digits"
        );
        return;
      }

      if (pin !== confirmPin) {
        alert(
          "PINs do not match"
        );
        return;
      }

      setLoading(true);

      try {

        const res =
          await fetch(
            "/api/create-parent-pin",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                pin,
              }),
            }
          );

        const data =
          await res.json();

        if (!res.ok) {
          alert(
            data.error ||
            "Could not create PIN"
          );

          return;
        }

        setSuccess(true);

        setPin("");
        setConfirmPin("");

        setTimeout(() => {
          router.push(
            "/parent-login"
          );
        }, 3000);

      } catch (error) {

        console.log(error);

        alert(
          "Something went wrong"
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
            Daily
            <span>Bloom</span>
          </h1>

          <div className="parent-tagline">
            WHERE PRESCHOOLS
            BLOOM EVERY DAY
          </div>
        </div>

        <h2 className="parent-title">
          Create Your PIN
        </h2>

        <p className="parent-subtitle">
          Create a secure
          4 digit PIN for
          future logins.
        </p>

        {success && (
          <div
            style={{
              marginBottom: "20px",
              padding: "16px",
              borderRadius: "12px",
              background:
                "#E8FFF1",
              color:
                "#0F7B42",
              textAlign:
                "center",
              fontWeight: 600,
              lineHeight: 1.6,
            }}
          >
            ✓ PIN created successfully

            <div
              style={{
                marginTop:
                  "8px",
                fontWeight: 400,
                fontSize:
                  "14px",
              }}
            >
              Redirecting you
              to login page...
            </div>
          </div>
        )}

        {!success && (
          <>
            <div className="parent-input-wrap">

              <input
                type={
                  showPin
                    ? "text"
                    : "password"
                }
                maxLength={4}
                value={pin}
                className="parent-input"
                placeholder="Enter 4 digit PIN"
                onChange={(e) =>
                  setPin(
                    e.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
              />

              <button
                type="button"
                className="parent-eye"
                onClick={() =>
                  setShowPin(
                    !showPin
                  )
                }
              >
                {showPin
                  ? "🙈"
                  : "👁️"}
              </button>

            </div>

            <div className="parent-input-wrap">

              <input
                type={
                  showConfirmPin
                    ? "text"
                    : "password"
                }
                maxLength={4}
                value={
                  confirmPin
                }
                className="parent-input"
                placeholder="Confirm PIN"
                onChange={(e) =>
                  setConfirmPin(
                    e.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
              />

              <button
                type="button"
                className="parent-eye"
                onClick={() =>
                  setShowConfirmPin(
                    !showConfirmPin
                  )
                }
              >
                {showConfirmPin
                  ? "🙈"
                  : "👁️"}
              </button>

            </div>

            <button
              onClick={
                handleSavePin
              }
              className="parent-button"
              disabled={
                loading
              }
            >
              {loading
                ? "Saving..."
                : "Continue"}
            </button>
          </>
        )}

      </div>
    </div>
  );
}