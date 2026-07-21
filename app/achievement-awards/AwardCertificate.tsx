"use client";

type AwardCertificateProps = {
  school?: {
    school_name?: string | null;
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
  } | null;
  learnerName: string;
  awardName: string;
  awardSubtitle: string;
  awardReason: string;
  academicYear: number | string;
  teacherName: string;
  principalName: string;
  preview?: boolean;
};

export function AwardCertificate({
  school,
  learnerName,
  awardSubtitle,
  awardReason,
  academicYear,
  teacherName,
  principalName,
  preview = false,
}: AwardCertificateProps) {
  const primary = school?.primary_color || "#4f6fbd";
  const secondary = school?.secondary_color || "#D4AF37";
  const learnerSize = learnerName.length > 60 ? 40 : learnerName.length > 40 ? 48 : 58;

  return (
    <div
      className="award-certificate-document"
      style={{
        position: "relative",
        minHeight: "690px",
        border: `24px solid ${primary}`,
        background: "#fff",
        overflow: "hidden",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "absolute", inset: 22, border: "1px solid rgba(212,175,55,.75)" }} />
      <div style={{ position: "absolute", left: 120, top: 0, width: 170, height: "100%", background: secondary }} />
      <div style={{ position: "absolute", right: -54, top: -34, width: 260, height: 88, background: secondary, transform: "rotate(45deg)" }} />
      <div style={{ position: "absolute", right: -54, bottom: -34, width: 260, height: 88, background: secondary, transform: "rotate(-45deg)" }} />

      {school?.logo_url ? (
        <img
          src={school.logo_url}
          alt="School logo"
          style={{ position: "absolute", top: "50%", left: "58%", width: 310, height: 310, objectFit: "contain", opacity: 0.12, transform: "translate(-50%, -50%)" }}
        />
      ) : null}

      {preview ? (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", transform: "rotate(-24deg)", fontSize: 76, fontWeight: 900, color: "rgba(79,111,189,.10)", zIndex: 2, pointerEvents: "none" }}>
          DRAFT PREVIEW
        </div>
      ) : null}

      <div style={{ position: "relative", zIndex: 1, padding: "74px 70px 44px 330px", minHeight: 642, display: "flex", flexDirection: "column", justifyContent: "space-between", boxSizing: "border-box" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 66, color: "#D4AF37", letterSpacing: 2, fontWeight: 900, lineHeight: 1 }}>CERTIFICATE</h1>
          <h2 style={{ margin: "10px auto 54px", fontSize: 34, color: "#111", fontWeight: 400, letterSpacing: 1 }}>{awardSubtitle}</h2>
          <p style={{ margin: "0 0 28px", fontSize: 18, color: "#111", letterSpacing: 4, fontWeight: 700 }}>PROUDLY PRESENTED TO</p>
          <h2 style={{ margin: "0 auto 38px", fontSize: learnerSize, color: "#D4AF37", fontWeight: 400, fontFamily: "Georgia, serif", fontStyle: "italic", maxWidth: 820, lineHeight: 1.05, overflowWrap: "break-word" }}>{learnerName || "Learner Name"}</h2>
          <p style={{ margin: "0 auto", maxWidth: 620, fontSize: 18, color: "#111", fontWeight: 800, fontStyle: "italic", lineHeight: 1.35 }}>
            FOR {(awardReason || "AWARD REASON").toUpperCase()}
            <br />YEAR {academicYear}
          </p>
          <p style={{ marginTop: 34, fontSize: 16, color: "#333" }}>{school?.school_name || "School Name"}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 90, alignItems: "end" }}>
          {[{ name: teacherName, label: "CLASS PRACTITIONER" }, { name: principalName, label: "PRINCIPAL" }].map((signature) => (
            <div key={signature.label}>
              <p style={{ borderBottom: "2px solid #D4AF37", paddingBottom: 4, margin: "0 auto 8px", maxWidth: 220, color: "#111", fontSize: 16, fontWeight: 700 }}>{signature.name || "Not recorded"}</p>
              <p style={{ margin: 0, fontSize: 14, color: "#111" }}>{signature.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
