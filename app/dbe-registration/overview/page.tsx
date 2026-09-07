"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { getCurrentProfile } from "@/app/lib/auth";
import { resolveSchoolContext } from "@/app/lib/school-context";
import { calculateReadiness, classifyExpiry, correctiveActionState } from "@/app/lib/compliance";
import { ComplianceHeader } from "../components";

type Overview = { registration: Record<string, unknown> | null; requirements: Array<Record<string, unknown>>; documents: Array<Record<string, unknown>>; staff: Array<Record<string, unknown>>; inspections: Array<Record<string, unknown>>; actions: Array<Record<string, unknown>>; certificates: Array<Record<string, unknown>> };
const Card = ({ label, value, help }: { label: string; value: string | number; help?: string }) => <div className="db-list-card"><strong>{label}</strong><p style={{ fontSize: 24, margin: "8px 0 0", color: "#2D2A3E" }}>{value}</p>{help ? <p className="db-helper">{help}</p> : null}</div>;

export default function OverviewPage() {
  const router = useRouter(); const params = useSearchParams(); const [data, setData] = useState<Overview | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { void (async () => { const { profile } = await getCurrentProfile(); if (!profile || profile.role === "teacher") { router.replace(profile ? "/teacher" : "/login"); return; } const context = await resolveSchoolContext(params.get("school")); if (!context.schoolId) { router.replace(context.shouldReturnToMaster ? "/master" : "/login"); return; } const result = await authenticatedFetch(`/api/compliance?school_id=${context.schoolId}`).then((r) => r.json()); setData(result); setLoading(false); })(); }, [params, router]);
  if (loading) return <p>Loading Compliance &amp; Registration overview...</p>;
  const requirements = data?.requirements || [];
  const stage = (name: string) => requirements.filter((item) => { const req = item.compliance_requirements as Record<string, unknown> | null; return req?.registration_stage === name; }).map((item) => ({ status: String(item.status || "Not Started"), ...(item.compliance_requirements as Record<string, unknown>) }));
  const apply = calculateReadiness(stage("APPLY"));
  const expiring = [...(data?.documents || []), ...(data?.certificates || [])].filter((item) => ["Expiring Soon", "Expired"].includes(classifyExpiry(String(item.expiry_date || "") || null))).length;
  const openActions = (data?.actions || []).filter((a) => correctiveActionState(String(a.status), String(a.due_date || "") || null) !== "Closed").length;
  return <div><ComplianceHeader title="Overview" description="A practical readiness view. Official government status and DailyBloom preparation are kept separate." />
    <div className="db-card db-card-blue" style={{ padding: 16, marginBottom: 14 }}><h3 style={{ marginTop: 0 }}>Official registration</h3><p><strong>Recorded official status:</strong> {String(data?.registration?.official_status || data?.registration?.registration_status || "Not recorded")}</p><p className="db-helper">Recorded by the school. DailyBloom does not issue or award official registration status.</p></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}><Card label="Bronze / APPLY readiness" value={apply.percent === null ? "Not configured" : `${apply.percent}%`} help={apply.total ? `${apply.ready} of ${apply.total} ready` : "Requirements not fully configured"} /><Card label="Evidence" value={(data?.documents || []).length} help="Documents remain private and school-scoped" /><Card label="Needs attention" value={requirements.filter((r) => ["Missing", "Needs Review", "Expired"].includes(String(r.status))).length} /><Card label="Expiring soon or expired" value={expiring} /><Card label="Open corrective actions" value={openActions} /><Card label="Inspections" value={(data?.inspections || []).length} /></div>
    <div className="db-card db-card-lavender" style={{ padding: 16, marginTop: 14 }}><h3 style={{ marginTop: 0 }}>Registration journey</h3><p style={{ margin: 0, fontWeight: 800 }}>APPLY → Bronze → COMPLY → Silver → Gold</p><p className="db-helper">This is an informational journey. Readiness is preparation progress, not an official DBE/eCARES outcome. Silver and Gold readiness are unavailable until their verified requirement catalogues are configured.</p></div>
  </div>;
}
