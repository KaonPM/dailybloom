"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function ParentLoginPage() {
  const router = useRouter();

  const [showPin, setShowPin] = useState(false);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installHelp, setInstallHelp] = useState("");

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setIsInstalled(standalone);

    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallHelp("");
    };

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setIsInstalled(true);
      setInstallPrompt(null);
      return;
    }

    const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setInstallHelp(
      isAppleMobile
        ? "On iPhone or iPad: tap Share in Safari, then choose Add to Home Screen."
        : "Open your browser menu and choose Install app or Add to Home screen."
    );
  };

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
      const res = await fetch("/api/parent-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          pin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Login failed");
        return;
      }

      if (data.needsPinCreation) {
        router.push("/create-parent-pin");
        return;
      }

      const children = data.children || [];

      localStorage.setItem("parentChildren", JSON.stringify(children));

      if (children.length > 0) {
        localStorage.setItem("selectedChild", JSON.stringify(children[0]));
      }

      router.push("/parent/dashboard");
      return;
    } catch (error) {
      console.log(error);
      alert("Something went wrong");
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
            WHERE PRESCHOOLS BLOOM EVERY DAY
          </div>
        </div>

        <div className="parent-portal-badge">Parent Portal</div>

        <h2 className="parent-title">Welcome Back</h2>

        <p className="parent-subtitle">Login to continue.</p>

        <div className="parent-input-wrap">
          <input
            type="text"
            placeholder="Contact Number"
            className="parent-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\s/g, ""))}
          />
        </div>

        <div className="parent-input-wrap">
          <input
            type={showPin ? "text" : "password"}
            placeholder="PIN"
            className="parent-input"
            value={pin}
            maxLength={10}
            inputMode="numeric"
            pattern="[0-9]*"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />

          <button
            type="button"
            className="parent-eye"
            onClick={() => setShowPin(!showPin)}
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
            marginTop: "16px",
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/forgot-parent-pin")}
            style={{
              border: "none",
              background: "transparent",
              color: "#FF5EA8",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Forgot PIN?
          </button>
        </div>

        {!isInstalled ? (
          <div className="parent-install-area">
            <button type="button" className="parent-install-button" onClick={handleInstall}>
              Install DailyBloom App
            </button>
            {installHelp ? <p className="parent-install-help" aria-live="polite">{installHelp}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
