"use client";

import { InputHTMLAttributes, useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  visibleLabel?: string;
  hiddenLabel?: string;
};

export default function PasswordInput({
  style,
  className,
  visibleLabel = "Hide password",
  hiddenLabel = "Show password",
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        {...props}
        className={["db-password-input", className].filter(Boolean).join(" ")}
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
          fontSize: 20,
        }}
      >
        <span aria-hidden="true">{visible ? "🙈" : "👁️"}</span>
      </button>
    </div>
  );
}
