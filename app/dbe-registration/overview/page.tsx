"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { getCurrentProfile } from "@/app/lib/auth";
import { resolveSchoolContext } from "@/app/lib/school-context";
import { calculateReadiness, classifyExpiry, correctiveActionState } from "@/app/lib/compliance";
import { summarizeStaffCompliance } from "@/app/lib/staff-compliance";
import { ComplianceHeader } from "../components";

type Row = Record<string, unknown>;
type Overview = { registration: Row | null; requirements: Row[]; documents: Row[]; evidence: Row[]; staff: Row[]; active_staff_count: number; inspections: Row[]; findings: Row[]; actions: Row[]; certificates: Row[] };
const value = (input: unknown) => String(input || "").trim() || "Not recorded";
const dateValue = (input: unknown) => input ? new Date(String(input)).toLocaleDateString() : "Not recorded";

function Metric({ label, value: metric, help }: { label: string; value: string | number; help?: string }) {
  return <div className="db-list-card"><strong>{label}</strong><p style={{ fontSize: 24, margin: "8px 0 0", color: "#2D2A3E" }}>{metric}</p>{help ? <p className="db-helper">{help}</p> : null}</div>;
}

export default function OverviewPage() {
  const router = useRouter(); const params = useSearchParams(); const [data, setData] = useState<Overview | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { void (async () => { const { profile } = await getCurrentProfile(); if (!profile || profile.role === "teacher") { router.replace(profile ? "/teacher" : "/login"); return; } const context = await resolveSchoolContext(params.get("school")); if (!context.schoolId) { router.replace(context.shouldReturnToMaster ? "/master" : "/login"); return; } const response = await authenticatedFetch(`/api/compliance?school_id=${context.schoolId}`); const result = await response.json(); if (!response.ok) alert(result.error || "Could not load the compliance overview."); else setData(result); setLoading(false); })(); }, [params, router]);
  const route = (path: string) => `${path}${params.get("school") ? `?school=${params.get("school")}` : ""}`;
  const requirements = data?.requirements || [];
  const apply = requirements.filter((item) => { const req = item.compliance_requirements as Row | null; return req?.registration_stage === "APPLY"; }).map((item) => ({ status: String(item.status || "Not Started"), ...(item.compliance_requirements as Row) }));
  const readiness = calculateReadiness(apply);
  const staffSummary = summarizeStaffCompliance((data?.staff || []).map((item) => ({ status: String(item.status || "Not Started"), expiry_date: String(item.expiry_date || "") || null })));
  const documentIds = new Set((data?.documents || []).map((document) => String(document.id))); const linkedDocumentIds = new Set((data?.evidence || []).map((link) => String(link.document_id)));
  const unlinkedDocuments = [...documentIds].filter((id) => !linkedDocumentIds.has(id)).length;
  const expiredRequirements = requirements.filter((item) => String(item.status) === "Expired").length;
  const missingRequirements = requirements.filter((item) => ["Missing", "Not Started"].includes(String(item.status))).length;
  const reviewRequirements = requirements.filter((item) => String(item.status) === "Needs Review").length;
  const expiringDocuments = (data?.documents || []).filter((item) => classifyExpiry(String(item.expiry_date || "") || null) === "Expiring Soon").length;
  const expiredDocuments = (data?.documents || []).filter((item) => classifyExpiry(String(item.expiry_date || "") || null) === "Expired").length;
  const openFindings = (data?.findings || []).filter((item) => !["Closed", "Resolved"].includes(String(item.status))).length;
  const overdueActions = (data?.actions || []).filter((item) => correctiveActionState(String(item.status), String(item.due_date || "") || null) === "Overdue").length;
  const openActions = (data?.actions || []).filter((item) => !["Closed", "Cancelled"].includes(String(item.status))).length;
  const certificateExpiring = (data?.certificates || []).filter((item) => classifyExpiry(String(item.expiry_date || "") || null) === "Expiring Soon").length;
  const certificateExpired = (data?.certificates || []).filter((item) => classifyExpiry(String(item.expiry_date || "") || null) === "Expired").length;
  const renewalInProgress = (data?.certificates || []).filter((item) => String(item.renewal_status) === "In Progress").length;
  const upcomingInspections = (data?.inspections || []).filter((item) => { const date = String(item.scheduled_date || ""); return date >= new Date().toISOString().slice(0, 10) && !["Closed", "Cancelled"].includes(String(item.status)); });
  const nextInspection = upcomingInspections.map((item) => String(item.scheduled_date)).sort()[0];
  const attention = [
    [expiredRequirements + expiredDocuments + staffSummary.expired + certificateExpired, "Expired item needs attention", "/dbe-registration/documents", "Expired"], [overdueActions, "Overdue corrective action", "/dbe-registration/corrective-actions", "Overdue"], [missingRequirements + staffSummary.missing, "Missing compliance item", "/dbe-registration/requirements", "Missing"], [reviewRequirements, "Requirement needs review", "/dbe-registration/requirements", "Needs Review"], [expiringDocuments + staffSummary.expiringSoon + certificateExpiring, "Item expiring soon", "/dbe-registration/certificates", "Expiring Soon"], [unlinkedDocuments, "Document needs to be linked to a requirement", "/dbe-registration/requirements", "Link Evidence"], [upcomingInspections.length, "Upcoming inspection", "/dbe-registration/inspections", nextInspection ? `Scheduled ${dateValue(nextInspection)}` : "View inspections"],
  ] as const;
  if (loading) return <p>Loading Compliance &amp; Registration overview...</p>;
  const registration = data?.registration;
  return <div><ComplianceHeader title="Overview" description="A practical readiness view. Official government status and DailyBloom preparation are kept separate." />
    <section className="db-card db-card-blue" style={{ padding: 16, marginBottom: 14 }}><h3 style={{ marginTop: 0 }}>Official registration</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 10 }}><div><strong>Status</strong><p className="db-helper">{value(registration?.official_status || registration?.registration_status)}</p></div><div><strong>Registration/reference</strong><p className="db-helper">{value(registration?.registration_number)}</p></div><div><strong>Registration date</strong><p className="db-helper">{dateValue(registration?.registration_date)}</p></div><div><strong>Renewal/expiry</strong><p className="db-helper">{dateValue(registration?.renewal_date)}</p></div><div><strong>Last verified</strong><p className="db-helper">{dateValue(registration?.last_verified_at)}{registration?.verified_by ? " · verifier recorded" : ""}</p></div></div><p className="db-helper">Recorded by the school. DailyBloom does not issue official DBE or eCARES status.</p></section>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}><Metric label="Bronze / APPLY readiness" value={readiness.percent === null ? "Not configured" : `${readiness.percent}%`} help={readiness.total ? `${readiness.ready} of ${readiness.total} ready` : "Requirements not fully configured"} /><Metric label="Active staff" value={data?.active_staff_count || 0} help="School-scoped staff directory" /><Metric label="Open findings" value={openFindings} /><Metric label="Open corrective actions" value={openActions} /></section>
    <section className="db-card db-card-lavender" style={{ padding: 16, marginTop: 14 }}><h3 style={{ marginTop: 0 }}>What needs attention</h3>{attention.filter(([count]) => count > 0).length ? <div style={{ display: "grid", gap: 8 }}>{attention.filter(([count]) => count > 0).map(([count, label, href, action]) => <div className="db-list-card" key={`${label}-${href}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><strong>{count} {count === 1 ? label : `${label}s`}</strong><Link className="db-button-secondary" href={route(href)}>{action}</Link></div>)}</div> : <p className="db-helper">No recorded items need attention right now. Requirements without an explicit status are not treated as non-compliant.</p>}</section>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginTop: 14 }}><div className="db-card" style={{ padding: 16 }}><h3 style={{ marginTop: 0 }}>Staff compliance</h3><p className="db-helper">Missing {staffSummary.missing} · Expiring soon {staffSummary.expiringSoon} · Expired {staffSummary.expired}</p><Link className="db-button-secondary" href={route("/dbe-registration/staff-compliance")}>Open Staff Compliance</Link></div><div className="db-card" style={{ padding: 16 }}><h3 style={{ marginTop: 0 }}>Inspections</h3><p className="db-helper">{upcomingInspections.length} upcoming · {openFindings} open findings{nextInspection ? ` · Next ${dateValue(nextInspection)}` : ""}</p><Link className="db-button-secondary" href={route("/dbe-registration/inspections")}>Open Inspections</Link></div><div className="db-card" style={{ padding: 16 }}><h3 style={{ marginTop: 0 }}>Certificates &amp; renewals</h3><p className="db-helper">Expiring soon {certificateExpiring} · Expired {certificateExpired} · Renewal in progress {renewalInProgress}</p><Link className="db-button-secondary" href={route("/dbe-registration/certificates")}>Open Certificates</Link></div></section>
    <section className="db-card" style={{ padding: 16, marginTop: 14 }}><h3 style={{ marginTop: 0 }}>Registration journey</h3><p style={{ margin: 0, fontWeight: 800 }}>APPLY → Bronze → COMPLY → Silver → Gold</p><p className="db-helper">This is an informational journey. Readiness is preparation progress, not an official DBE/eCARES outcome. Silver and Gold readiness will appear only when their verified requirement catalogues are configured.</p></section>
  </div>;
}
