"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { getCurrentProfile } from "@/app/lib/auth";
import { resolveSchoolContext } from "@/app/lib/school-context";
import { summarizeStaffCompliance } from "@/app/lib/staff-compliance";
import type { RenewalSummary } from "@/app/lib/renewal-aggregation";
import { ComplianceHeader, formatComplianceDate } from "../components";

type Row = Record<string, unknown>;
type CorrectiveActionSummary = { open: number; inProgress: number; readyForVerification: number; overdue: number; dueSoon: number; active: number };
type Overview = { registration: Row | null; requirements: Row[]; documents: Row[]; evidence: Row[]; staff: Row[]; active_staff_count: number; inspections: Row[]; findings: Row[]; actions: Row[]; certificates: Row[]; renewal_summary?: RenewalSummary; corrective_action_summary?: CorrectiveActionSummary };
type Attention = { key: string; severity: string; title: string; description: string; due_date: string | null; action_url: string; action_label: string };
const value = (input: unknown) => String(input || "").trim() || "Not recorded";
const dateValue = (input: unknown) => formatComplianceDate(input ? String(input) : null);

function Metric({ label, value: metric, help }: { label: string; value: string | number; help?: string }) {
  return <div className="db-list-card"><strong>{label}</strong><p style={{ fontSize: 24, margin: "8px 0 0", color: "#2D2A3E" }}>{metric}</p>{help ? <p className="db-helper">{help}</p> : null}</div>;
}

function WorkspaceTile({ title, summary, tags, href, action }: { title: string; summary: string; tags: string[]; href: string; action: string }) {
  return <article className="db-list-card" style={{ padding: 12, display: "grid", gap: 9, alignContent: "start" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}><h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3><span className="db-helper" style={{ margin: 0, fontWeight: 700 }}>{summary}</span></div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{tags.map((tag) => <span key={tag} style={{ border: "1px solid #E9E0D8", borderRadius: 999, padding: "3px 7px", fontSize: 12, color: "#5E5875", background: "#FFFDFB" }}>{tag}</span>)}</div>
    <Link href={href} style={{ justifySelf: "start", color: "#3D6583", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>{action}</Link>
  </article>;
}

export default function OverviewPage() {
  const router = useRouter(); const params = useSearchParams(); const [data, setData] = useState<Overview | null>(null); const [attentionItems, setAttentionItems] = useState<Attention[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { void (async () => { const { profile } = await getCurrentProfile(); if (!profile || profile.role === "teacher") { router.replace(profile ? "/teacher" : "/login"); return; } const context = await resolveSchoolContext(params.get("school")); if (!context.schoolId) { router.replace(context.shouldReturnToMaster ? "/master" : "/login"); return; } const [response, attentionResponse] = await Promise.all([authenticatedFetch(`/api/compliance?school_id=${context.schoolId}`), authenticatedFetch(`/api/compliance/attention?school_id=${context.schoolId}`)]); const result = await response.json(); const attentionResult = await attentionResponse.json(); if (!response.ok) alert(result.error || "Could not load the compliance overview."); else setData(result); if (attentionResponse.ok) setAttentionItems(attentionResult.items || []); setLoading(false); })(); }, [params, router]);
  const route = (path: string) => `${path}${params.get("school") ? `?school=${params.get("school")}` : ""}`;
  const staffSummary = summarizeStaffCompliance((data?.staff || []).map((item) => ({ status: String(item.status || "Not Started"), expiry_date: String(item.expiry_date || "") || null })));
  const openFindings = (data?.findings || []).filter((item) => !["Closed", "Resolved"].includes(String(item.status))).length;
  const actionSummary = data?.corrective_action_summary || { open: 0, inProgress: 0, readyForVerification: 0, overdue: 0, dueSoon: 0, active: 0 };
  const renewalSummary = data?.renewal_summary || { total: 0, expiringSoon: 0, expired: 0, renewalInProgress: 0, current: 0, noExpiry: 0, attention: 0 };
  const upcomingInspections = (data?.inspections || []).filter((item) => { const date = String(item.scheduled_date || ""); return date >= new Date().toISOString().slice(0, 10) && !["Closed", "Cancelled", "Completed"].includes(String(item.status)); });
  const nextInspection = upcomingInspections.map((item) => String(item.scheduled_date)).sort()[0];
  if (loading) return <p>Loading Compliance &amp; Registration overview...</p>;
  const registration = data?.registration;
  return <div><ComplianceHeader title="Overview" description="A practical readiness view. Official government status and DailyBloom preparation are kept separate." />
    <section className="db-card db-card-blue" style={{ padding: 16, marginBottom: 14 }}><h3 style={{ marginTop: 0 }}>Official registration</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: 10 }}><div><strong>Status</strong><p className="db-helper">{value(registration?.official_status || registration?.registration_status)}</p></div><div><strong>Registration/reference</strong><p className="db-helper">{value(registration?.registration_number)}</p></div><div><strong>Registration date</strong><p className="db-helper">{dateValue(registration?.registration_date)}</p></div><div><strong>Renewal/expiry</strong><p className="db-helper">{dateValue(registration?.renewal_date)}</p></div><div><strong>Last verified</strong><p className="db-helper">{dateValue(registration?.last_verified_at)}{registration?.verified_by ? " · verifier recorded" : ""}</p></div></div><p className="db-helper">Recorded by the school. DailyBloom does not issue official DBE or eCARES status.</p></section>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}><Metric label="Active staff" value={data?.active_staff_count || 0} help="School-scoped staff directory" /><Metric label="Open findings" value={openFindings} /><Metric label="Open corrective actions" value={actionSummary.active} help={`In progress ${actionSummary.inProgress} · Awaiting verification ${actionSummary.readyForVerification}`} /></section>
    <section className="db-card db-card-lavender" style={{ padding: 16, marginTop: 14 }}><h3 style={{ marginTop: 0 }}>Needs Attention</h3>{attentionItems.length ? <div style={{ display: "grid", gap: 8 }}>{attentionItems.slice(0, 5).map((item) => <div className="db-list-card" key={item.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div><strong style={{ textTransform: "capitalize" }}>{item.severity} · {item.title}</strong><p className="db-helper">{item.description}</p></div><Link className="db-button-secondary" href={route(item.action_url)}>{item.action_label}</Link></div>)}{attentionItems.length > 5 ? <Link className="db-button-secondary" href={route("/dbe-registration/certificates")}>View All</Link> : null}</div> : <p className="db-helper">No compliance items currently require urgent attention.</p>}</section>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))", gap: 10, marginTop: 14 }}>
      <WorkspaceTile title="Staff compliance" summary={`${data?.active_staff_count || 0} active staff`} tags={[`${staffSummary.missing} missing`, `${staffSummary.expiringSoon} expiring`, `${staffSummary.expired} expired`]} href={route("/dbe-registration/staff-compliance")} action="View staff records" />
      <WorkspaceTile title="Inspections" summary={nextInspection ? `Next ${dateValue(nextInspection)}` : "No inspection booked"} tags={[`${upcomingInspections.length} upcoming`, `${openFindings} findings`]} href={route("/dbe-registration/inspections")} action="View inspections" />
      <WorkspaceTile title="Certificates & renewals" summary={renewalSummary.attention ? `${renewalSummary.attention} need attention` : "No urgent renewals"} tags={[`${renewalSummary.expiringSoon} expiring`, `${renewalSummary.expired} expired`, `${renewalSummary.renewalInProgress} in renewal`]} href={route("/dbe-registration/certificates")} action="View certificates" />
    </section>
    <section className="db-card" style={{ padding: 16, marginTop: 14 }}><h3 style={{ marginTop: 0 }}>How this workspace helps</h3><p className="db-helper">DailyBloom helps the school organise registration information, requirements, evidence, staff compliance, inspections, corrective actions and renewals. Official registration stages and outcomes remain with the relevant authority and eCARES.</p></section>
  </div>;
}
