"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentProfile } from "@/app/lib/auth";
import { resolveSchoolContext } from "@/app/lib/school-context";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { ComplianceHeader, formatComplianceDate } from "../components";

type Item = Record<string, unknown>;

export default function InspectionsPage() {
  const router = useRouter(); const params = useSearchParams();
  const [school, setSchool] = useState<number>(); const [inspections, setInspections] = useState<Item[]>([]);
  const [findings, setFindings] = useState<Item[]>([]); const [open, setOpen] = useState<string>();
  const [saving, setSaving] = useState(false); const [loadError, setLoadError] = useState(false);
  const load = async (id: number) => {
    setLoadError(false);
    try {
      const [inspectionsResponse, findingsResponse] = await Promise.all([authenticatedFetch(`/api/compliance?school_id=${id}&resource=inspections`), authenticatedFetch(`/api/compliance?school_id=${id}&resource=findings`)]);
      if (!inspectionsResponse.ok || !findingsResponse.ok) throw new Error();
      const [inspectionData, findingData] = await Promise.all([inspectionsResponse.json(), findingsResponse.json()]);
      setInspections(inspectionData.items || []); setFindings(findingData.items || []);
    } catch { setLoadError(true); }
  };
  useEffect(() => { void (async () => { const { profile } = await getCurrentProfile(); if (!profile || profile.role === "teacher") { router.replace(profile ? "/teacher" : "/login"); return; } const context = await resolveSchoolContext(params.get("school")); if (!context.schoolId) { router.replace("/login"); return; } setSchool(context.schoolId); await load(context.schoolId); })(); }, [params, router]);
  const submit = async (resource: string, event: FormEvent<HTMLFormElement>, more: Record<string, unknown> = {}) => { event.preventDefault(); if (!school) return; setSaving(true); try { const form = new FormData(event.currentTarget); const response = await authenticatedFetch("/api/compliance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ school_id: school, resource, ...Object.fromEntries(form), ...more }) }); if (!response.ok) { alert((await response.json()).error || "Could not save this inspection information."); return; } event.currentTarget.reset(); await load(school); } finally { setSaving(false); } };
  const makeAction = (finding: Item) => { if (school) router.push(`/dbe-registration/corrective-actions?school=${school}&source_type=inspection_finding&source_id=${encodeURIComponent(String(finding.id))}`); };
  if (!school) return <p>Loading inspections...</p>;
  if (loadError) return <div className="db-card" style={{ padding: 16 }}><p>We couldn’t load inspections. Please try again.</p><button className="db-button-secondary" onClick={() => void load(school)}>Try again</button></div>;
  return <div><ComplianceHeader title="Inspections" description="Record internal and official or external inspections separately. DailyBloom entries are not official DBE inspection results." />
    <section className="db-card db-card-blue" style={{ padding: 16, marginBottom: 14 }}><h3 style={{ marginTop: 0 }}>Add Inspection</h3><p className="db-helper">Use Internal for a school review. Use Official / External only for a recorded external inspection.</p><form onSubmit={(event) => void submit("inspections", event)} style={{ display: "grid", gap: 8 }}><label>Inspection type<input className="db-input" required name="inspection_type" placeholder="Example: Fire safety review" /></label><label>Inspection scope<select className="db-input" name="inspection_scope"><option>Internal</option><option>Official / External</option></select></label><label>Inspection date<input className="db-input" type="date" name="scheduled_date" /></label><button className="db-button-primary" disabled={saving}>{saving ? "Saving..." : "Add Inspection"}</button></form></section>
    {!inspections.length ? <section className="db-card db-card-lavender" style={{ padding: 16 }}><p className="db-helper">No inspections have been recorded yet.</p></section> : inspections.map((inspection) => { const inspectionFindings = findings.filter((finding) => finding.inspection_id === inspection.id); const expanded = open === inspection.id; const unresolved = inspectionFindings.filter((finding) => !["Closed", "Resolved"].includes(String(finding.status))).length; return <article key={String(inspection.id)} className="db-card db-card-lavender" style={{ padding: 16, marginBottom: 12 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}><div><h3 style={{ margin: 0 }}>{String(inspection.inspection_type)}</h3><p className="db-helper" style={{ margin: "6px 0 0" }}>{String(inspection.inspection_scope)} · {String(inspection.status || "Not started")}{inspection.scheduled_date ? ` · ${formatComplianceDate(String(inspection.scheduled_date))}` : ""} · {unresolved} unresolved finding{unresolved === 1 ? "" : "s"}</p></div><button className="db-button-secondary" onClick={() => setOpen(expanded ? undefined : String(inspection.id))}>{expanded ? "Close findings" : "View findings"}</button></div>{expanded ? <section style={{ marginTop: 14 }}><h4>Findings ({inspectionFindings.length})</h4>{inspectionFindings.length ? inspectionFindings.map((finding) => <div className="db-list-card" key={String(finding.id)}><strong>{String(finding.category || "Finding")}</strong><p>{String(finding.description)}</p><p className="db-helper">Priority: {String(finding.priority || "Normal")} · {String(finding.status || "Open")}</p>{finding.corrective_action_required ? <button className="db-button-secondary" onClick={() => makeAction(finding)}>Create Corrective Action</button> : null}</div>) : <p className="db-helper">No findings have been added for this inspection.</p>}<form onSubmit={(event) => void submit("findings", event, { inspection_id: inspection.id })} style={{ display: "grid", gap: 8, marginTop: 12 }}><h4 style={{ margin: 0 }}>Add Finding</h4><label>Category<input className="db-input" name="category" placeholder="Example: Safety" /></label><label>Description<textarea className="db-input" required name="description" placeholder="What was found?" /></label><label>Priority<select className="db-input" name="priority"><option>Normal</option><option>Low</option><option>High</option></select></label><label><input type="checkbox" name="corrective_action_required" /> Corrective action required</label><button className="db-button-primary" disabled={saving}>{saving ? "Saving..." : "Add Finding"}</button></form></section> : null}</article>; })}
  </div>;
}
