"use client";

import Link from "next/link";
import { useState } from "react";

const menuItems = [
  { label: "Dashboard", href: "/parent/dashboard" },
  { label: "Messages", href: "/parent/messages" },
];

export default function ParentTopBar({
  parent,
}: {
  parent: any;
  child: any;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #eee",
          padding: "18px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: "#2D2A3E",
              fontSize: "22px",
              fontWeight: 800,
            }}
          >
            DailyBloom
          </h2>

          <p
            style={{
              margin: "4px 0 0",
              color: "#6f6680",
              fontSize: "14px",
            }}
          >
            Welcome {parent?.name || "Parent"} 👋
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={iconButton}
        >
          ☰
        </button>
      </header>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            style={menuBackdrop}
          />

          <div style={menuPanel}>
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={menuLink}
              >
                {item.label}
              </Link>
            ))}

            <Link
              href="/api/parent-logout"
              onClick={() => setOpen(false)}
              style={{
                ...menuLink,
                color: "#E53935",
                fontWeight: 700,
                borderBottom: "none",
              }}
            >
              Logout
            </Link>
          </div>
        </>
      )}
    </>
  );
}

const iconButton = {
  border: "none",
  background: "transparent",
  fontSize: "24px",
  cursor: "pointer",
  color: "#2D2A3E",
  padding: 0,
} as const;

const menuBackdrop = {
  position: "fixed",
  inset: 0,
  border: "none",
  background: "transparent",
  cursor: "default",
  zIndex: 400,
} as const;

const menuPanel = {
  position: "absolute",
  right: "20px",
  top: "82px",
  background: "#fff",
  width: "260px",
  maxWidth: "calc(100vw - 32px)",
  borderRadius: "16px",
  boxShadow: "0 12px 30px rgba(0,0,0,.12)",
  overflow: "hidden",
  zIndex: 500,
  border: "1px solid #eee",
} as const;

const menuLink = {
  display: "block",
  padding: "16px 20px",
  textDecoration: "none",
  color: "#2D2A3E",
  borderBottom: "1px solid #f4f4f4",
} as const;
