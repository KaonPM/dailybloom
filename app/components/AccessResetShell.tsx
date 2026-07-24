import Link from "next/link";
import type { ReactNode } from "react";

type StatusTone = "info" | "success" | "error";

type AccessResetShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  status?: { message: string; tone?: StatusTone };
  backHref?: string;
  backLabel?: string;
};

const statusColours: Record<
  StatusTone,
  { background: string; border: string; colour: string }
> = {
  info: { background: "#EEF8FD", border: "#BEE5F6", colour: "#245C75" },
  success: { background: "#EFFAF2", border: "#C8EBCF", colour: "#257044" },
  error: { background: "#FFF1F3", border: "#F2C4CC", colour: "#9A3346" },
};

export default function AccessResetShell({
  title,
  subtitle,
  children,
  status,
  backHref,
  backLabel = "Back to login",
}: AccessResetShellProps) {
  const statusStyle = statusColours[status?.tone ?? "info"];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 18px",
        background:
          "radial-gradient(circle at top left, #FFF0F5 0, transparent 34%), radial-gradient(circle at bottom right, #EAF8FE 0, transparent 38%), #FFF9F5",
        color: "#2F2942",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 520,
          overflow: "hidden",
          border: "1px solid #EADFD8",
          borderRadius: 28,
          background: "rgba(255, 255, 255, 0.97)",
          boxShadow: "0 22px 60px rgba(62, 44, 76, 0.12)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            height: 7,
            background:
              "linear-gradient(90deg, #FF6FAE 0 34%, #79C9EC 34% 68%, #F2C85B 68%)",
          }}
        />

        <div style={{ padding: "34px clamp(22px, 7vw, 38px) 30px" }}>
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                marginBottom: 17,
                padding: "8px 13px",
                borderRadius: 999,
                background: "#F3ECFF",
                color: "#6846A5",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.04em",
              }}
            >
              <span aria-hidden="true">🔒</span>
              SECURE ACCESS
            </div>

            <div
              style={{
                marginBottom: 13,
                fontSize: 23,
                fontWeight: 900,
                letterSpacing: "-0.03em",
              }}
            >
              Daily<span style={{ color: "#FF5EA8" }}>Bloom</span>
            </div>

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "clamp(25px, 6vw, 32px)",
                lineHeight: 1.16,
                letterSpacing: "-0.035em",
              }}
            >
              {title}
            </h1>

            <p
              style={{
                margin: 0,
                color: "#6F6880",
                fontSize: 16,
                lineHeight: 1.6,
              }}
            >
              {subtitle}
            </p>
          </div>

          {status?.message ? (
            <div
              role={status.tone === "error" ? "alert" : "status"}
              style={{
                marginBottom: 18,
                padding: "13px 15px",
                border: `1px solid ${statusStyle.border}`,
                borderRadius: 14,
                background: statusStyle.background,
                color: statusStyle.colour,
                fontSize: 14,
                lineHeight: 1.5,
                textAlign: "center",
              }}
            >
              {status.message}
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 14 }}>{children}</div>

          {backHref ? (
            <div
              style={{
                marginTop: 22,
                paddingTop: 20,
                borderTop: "1px solid #EEE5DF",
                textAlign: "center",
              }}
            >
              <Link
                href={backHref}
                style={{
                  color: "#664C87",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                ← {backLabel}
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
