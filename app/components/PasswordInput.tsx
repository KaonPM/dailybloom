"use client";

import { InputHTMLAttributes, useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  visibleLabel?: string;
  hiddenLabel?: string;
};

export default function PasswordInput({
  style,
  visibleLabel = "Hide password",
  hiddenLabel = "Show password",
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        style={{ ...style, width: "100%", paddingRight: 48 }}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? visibleLabel : hiddenLabel}
        title={visible ? visibleLabel : hiddenLabel}
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          display: "grid",
          placeItems: "center",
          border: "none",
          background: "transparent",
          color: "#5B526E",
          cursor: "pointer",
          lineHeight: 1,
          padding: 4,
        }}
      >
        {visible ? (
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 6 9 6a15.8 15.8 0 01-2.1 2.8M6.2 6.2C4.1 7.7 3 10 3 10s3.5 6 9 6a9.8 9.8 0 004-.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        )}
      </button>
    </div>
  );
}
