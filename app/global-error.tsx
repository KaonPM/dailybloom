"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[DailyBloom client error]", {
      message: error.message,
      digest: error.digest || null,
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#fff9f5" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <section
            style={{
              width: "min(100%, 520px)",
              padding: 32,
              borderRadius: 28,
              border: "1px solid #eadfd7",
              background: "white",
              textAlign: "center",
              boxShadow: "0 12px 32px rgba(79, 111, 189, 0.12)",
            }}
          >
            <div style={{ color: "#6f42ff", fontSize: 32, fontWeight: 900 }}>
              Daily<span style={{ color: "#f66ba0" }}>Bloom</span>
            </div>
            <h1 style={{ color: "#2d2a3e", margin: "24px 0 10px" }}>
              Something went wrong
            </h1>
            <p style={{ color: "#6f6780", lineHeight: 1.6 }}>
              Your information is safe. Please try this page again. If the problem continues,
              share the reference below with DailyBloom support.
            </p>
            {error.digest ? (
              <p style={{ color: "#7a6f86", fontSize: 13 }}>
                Reference: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={unstable_retry}
              style={{
                width: "100%",
                marginTop: 18,
                padding: "14px 18px",
                border: 0,
                borderRadius: 999,
                background: "#6f42ff",
                color: "white",
                fontSize: 16,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
