"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const sections = [
  ["Overview", "/dbe-registration/overview"], ["Registration", "/dbe-registration"],
  ["Requirements", "/dbe-registration/requirements"], ["Documents & Evidence", "/dbe-registration/documents"],
  ["Staff Compliance", "/dbe-registration/staff-compliance"], ["Inspections", "/dbe-registration/inspections"],
  ["Corrective Actions", "/dbe-registration/corrective-actions"], ["Certificates & Renewals", "/dbe-registration/certificates"],
] as const;

export function ComplianceNav() {
  const params = useSearchParams(); const pathname = usePathname(); const school = params.get("school");
  return <nav aria-label="Compliance & Registration" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 18px" }}>
    {sections.map(([label, href]) => { const active = href === "/dbe-registration" ? pathname === href : pathname.startsWith(href); return <Link key={href} className={active ? "db-button-primary" : "db-button-secondary"} style={{ textDecoration: "none" }} href={`${href}${school ? `?school=${school}` : ""}`}>{label}</Link>; })}
  </nav>;
}

export function ComplianceHeader({ title, description }: { title: string; description: string }) {
  return <><div className="db-soft-card" style={{ padding: 18, marginBottom: 14 }}><p style={{ margin: 0, fontWeight: 800, color: "#6D6888" }}>COMPLIANCE &amp; REGISTRATION</p><h2 className="db-page-title">{title}</h2><p className="db-page-subtitle">{description}</p></div><ComplianceNav /></>;
}
