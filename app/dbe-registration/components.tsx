"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

function BackToOverviewPill() {
  const params = useSearchParams(); const school = params.get("school");
  return <Link className="db-button-secondary" style={{ textDecoration: "none", padding: "7px 11px", fontSize: 12, whiteSpace: "nowrap" }} href={`/dbe-registration/overview${school ? `?school=${school}` : ""}`}>Back to Overview</Link>;
}

export function ComplianceHeader({ title, description }: { title: string; description: string }) {
  const pathname = usePathname();
  return <div className="db-soft-card" style={{ padding: 18, marginBottom: 14 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}><div><p style={{ margin: 0, fontWeight: 800, color: "#6D6888" }}>COMPLIANCE &amp; REGISTRATION</p><h2 className="db-page-title">{title}</h2><p className="db-page-subtitle">{description}</p></div>{pathname !== "/dbe-registration/overview" ? <BackToOverviewPill /> : null}</div></div>;
}
