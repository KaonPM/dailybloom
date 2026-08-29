import type { ReactNode } from "react";

export default function RouteStateCard({
  eyebrow,
  title,
  message,
  accent = "var(--db-blue)",
  actions,
  busy = false,
}: {
  eyebrow: string;
  title: string;
  message: string;
  accent?: string;
  actions?: ReactNode;
  busy?: boolean;
}) {
  return (
    <section
      aria-busy={busy}
      aria-live={busy ? "polite" : undefined}
      className="db-card"
      style={{
        width: "min(680px, 100%)",
        margin: "24px auto",
        padding: "18px",
        borderTop: `6px solid ${accent}`,
      }}
    >
      <p
        style={{
          margin: "0 0 8px",
          color: "var(--db-text-soft)",
          fontSize: "13px",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </p>

      <h1 className="db-page-title" style={{ marginBottom: "10px" }}>
        {title}
      </h1>

      <p className="db-page-subtitle">{message}</p>

      {busy ? (
        <div
          aria-hidden="true"
          style={{
            height: "6px",
            marginTop: "14px",
            overflow: "hidden",
            borderRadius: "999px",
            background: "#edf6fb",
          }}
        >
          <div
            className="db-route-loading-bar"
            style={{
              width: "42%",
              height: "100%",
              borderRadius: "999px",
              background: "var(--db-blue)",
            }}
          />
        </div>
      ) : null}

      {actions ? (
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginTop: "14px",
          }}
        >
          {actions}
        </div>
      ) : null}
    </section>
  );
}
