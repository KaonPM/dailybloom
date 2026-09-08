"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

// The sidebar is the single navigator for this module. Pages retain only a
// compact return link so the content area is not a duplicate menu.
export function ComplianceNav() {
  const params = useSearchParams(); const school = params.get("school");
  return <div style={{ margin: "0 0 14px" }}><Link className="db-button-secondary" style={{ textDecoration: "none" }} href={`/dbe-registration/overview${school ? `?school=${school}` : ""}`}>← Compliance Overview</Link></div>;
}

export function ComplianceHeader({ title, description }: { title: string; description: string }) {
  return <><div className="db-soft-card" style={{ padding: 18, marginBottom: 14 }}><p style={{ margin: 0, fontWeight: 800, color: "#6D6888" }}>COMPLIANCE &amp; REGISTRATION</p><h2 className="db-page-title">{title}</h2><p className="db-page-subtitle">{description}</p></div><ComplianceNav /></>;
}
