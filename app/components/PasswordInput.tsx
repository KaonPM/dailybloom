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
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          padding: 4,
        }}
      >
        {visible ? "🙈" : "👁️"}
      </button>
    </div>
  );
}
