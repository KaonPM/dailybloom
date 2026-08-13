"use client";

import Link from "next/link";
import { useState } from "react";

export type PriorityItem = {
  title: string;
  detail: string;
  href: string;
  action: string;
  tone?: "blue" | "yellow" | "pink";
};

export default function TodaysPriorities({
  items,
}: {
  items: PriorityItem[];
}) {
  const [open, setOpen] = useState(false);
  const visibleItems = items.slice(0, 5);

  return (
    <section
      style={{
        marginBottom: "18px",
        border: "1px solid #E8DDD3",
        borderRadius: "22px",
        background: "#FFFFFF",
        overflow: "hidden",
        boxShadow: "0 8px 18px rgba(45, 42, 62, 0.04)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{
          width: "100%",
          border: 0,
          background: "linear-gradient(135deg, #F4FAFD 0%, #FFFDF8 100%)",
          padding: "15px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          cursor: "pointer",
          color: "#2D2A3E",
          textAlign: "left",
        }}
      >
        <span>
          <strong style={{ display: "block", fontSize: "18px" }}>
            Today&apos;s Priorities
          </strong>
          <span style={{ color: "#6D6888", fontSize: "13px" }}>
            {visibleItems.length > 0
              ? `${visibleItems.length} item${visibleItems.length === 1 ? "" : "s"} needing attention`
              : "Nothing urgent needs attention"}
          </span>
        </span>
        <span style={{ fontWeight: 700, color: "#296B87", whiteSpace: "nowrap" }}>
          {open ? "Hide" : "Open"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "12px", display: "grid", gap: "8px" }}>
          {visibleItems.length === 0 ? (
            <div
              style={{
                padding: "14px",
                borderRadius: "15px",
                background: "#EEF9EE",
                color: "#37653B",
                fontSize: "14px",
              }}
            >
              You&apos;re up to date. New priorities will appear here when action is needed.
            </div>
          ) : (
            visibleItems.map((item, index) => {
              const palette =
                item.tone === "yellow"
                  ? { background: "#FFF9E6", border: "#F3E4A3" }
                  : item.tone === "pink"
                    ? { background: "#FFF4F8", border: "#EBC9D8" }
                    : { background: "#F1FAFE", border: "#CBEAF7" };

              return (
                <div
                  key={`${item.href}-${index}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                    padding: "12px 14px",
                    borderRadius: "15px",
                    border: `1px solid ${palette.border}`,
                    background: palette.background,
                  }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                    <strong style={{ color: "#2D2A3E", fontSize: "14px" }}>
                      {item.title}
                    </strong>
                    <p
                      style={{
                        margin: "3px 0 0",
                        color: "#625D78",
                        fontSize: "13px",
                        lineHeight: 1.45,
                      }}
                    >
                      {item.detail}
                    </p>
                  </div>
                  <Link
                    href={item.href}
                    style={{
                      color: "#255E76",
                      fontSize: "13px",
                      fontWeight: 700,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.action} →
                  </Link>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
