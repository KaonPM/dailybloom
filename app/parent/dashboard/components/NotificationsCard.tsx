"use client";

import { useState } from "react";

export default function NotificationsCard() {
  const [open, setOpen] = useState(false);

  const notifications = [
    "Daily summary posted",
    "Attendance marked Present",
    "Teacher sent a message",
    "New broadcast",
    "Event added",
    "Another daily summary",
    "New activity",
    "Photo uploaded",
  ];

  return (
    <div
      className="db-soft-card"
      style={{
        marginBottom: "18px",
        borderTop: "4px solid #FFC857",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "18px 20px",
          border: "none",
          background: "transparent",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "17px",
          fontWeight: 700,
          cursor: "pointer",
          color: "#12304a",
        }}
      >
        <span>🔔 New Updates ({notifications.length})</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 20px 18px" }}>
          {notifications.map((item, index) => (
            <p key={index} style={{ margin: "10px 0", color: "#444" }}>
              • {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}