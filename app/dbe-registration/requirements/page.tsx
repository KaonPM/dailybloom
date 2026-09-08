"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentProfile } from "@/app/lib/auth";
import { resolveSchoolContext } from "@/app/lib/school-context";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { ComplianceHeader, formatComplianceDate } from "../components";
import { hasRequirementGuidance, nextRequirementAction, READY_EXPLANATION } from "@/app/lib/compliance-guidance";

type Item = Record<string, unknown>;
const statuses = ["Not Started", "In Progress", "Ready", "Needs Review", "Missing", "Expired", "Not Applicable"];

export default function RequirementsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [school, setSchool] = useState<number>();
  const [catalogue, setCatalogue] = useState<Item[]>([]);
  const [states, setStates] = useState<Item[]>([]);
  const [docs, setDocs] = useState<Item[]>([]);
  const [links, setLinks] = useState<Item[]>([]);
  const [open, setOpen] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = async (id: number) => {
    setLoadError(false);
    try {
      const [catalogueResponse, statesResponse, documentsResponse, linksResponse] = await Promise.all([
        authenticatedFetch(`/api/compliance?school_id=${id}&resource=catalogue`),
        authenticatedFetch(`/api/compliance?school_id=${id}&resource=requirements`),
        authenticatedFetch(`/api/dbe-compliance-documents?school_id=${id}`),
        authenticatedFetch(`/api/compliance?school_id=${id}&resource=evidence`),
      ]);
      if (![catalogueResponse, statesResponse, documentsResponse, linksResponse].every((response) => response.ok)) throw new Error();
      const [catalogueBody, statesBody, documentsBody, linksBody] = await Promise.all([
        catalogueResponse.json(), statesResponse.json(), documentsResponse.json(), linksResponse.json(),
      ]);
      setCatalogue(catalogueBody.items || []); setStates(statesBody.items || []);
      setDocs(documentsBody.documents || []); setLinks(linksBody.items || []);
    } catch { setLoadError(true); }
  };

  useEffect(() => { void (async () => {
    const { profile } = await getCurrentProfile();
    if (!profile || profile.role === "teacher") { router.replace(profile ? "/teacher" : "/login"); return; }
    const context = await resolveSchoolContext(params.get("school"));
    if (!context.schoolId) { router.replace("/login"); return; }
    setSchool(context.schoolId); await load(context.schoolId);
  })(); }, [params, router]);

  const stateFor = (id: string) => states.find((item) => item.requirement_id === id);
  const save = async (requirementId: string, form: HTMLFormElement) => {
    if (!school) return; setSaving(true);
    const data = new FormData(form);
    try {
      const response = await authenticatedFetch("/api/compliance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_requirement", school_id: school, requirement_id: requirementId, status: data.get("status"), notes: data.get("notes"), due_date: data.get("due_date"), expires_at: data.get("expires_at"), verify: data.get("verify") === "on" }) });
      if (!response.ok) { alert((await response.json()).error || "Could not save this requirement."); return; }
      await load(school);
    } finally { setSaving(false); }
  };
  const link = async (requirementId: string, documentId: string, unlink = false) => {
    if (!school || !documentId) return;
    const response = await authenticatedFetch("/api/compliance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: unlink ? "unlink_evidence" : "link_evidence", school_id: school, school_requirement_id: requirementId, document_id: documentId }) });
    if (!response.ok) { alert((await response.json()).error || "Could not update linked evidence."); return; }
    await load(school);
  };

  if (!school) return <p>Loading compliance requirements...</p>;
  if (loadError) return <div className="db-card" style={{ padding: 16 }}><p>We couldn’t load compliance requirements. Please try again.</p><button className="db-button-secondary" onClick={() => void load(school)}>Try again</button></div>;

  return <div>
    <ComplianceHeader title="Requirements" description="Track the compliance requirements your school needs to prepare and maintain." />
    {!catalogue.length ? <section className="db-card db-card-lavender" style={{ padding: 16 }}><h3 style={{ marginTop: 0 }}>No requirements configured</h3><p className="db-helper">No compliance requirements have been configured for this school yet.</p></section> : <div style={{ display: "grid", gap: 12 }}>{catalogue.map((requirement) => {
      const existing = stateFor(String(requirement.id));
      const requirementLinks = existing ? links.filter((item) => item.school_requirement_id === existing.id) : [];
      const actionEligible = existing && ["Missing", "Needs Review", "Expired"].includes(String(existing.status));
      const expanded = open === requirement.id;
      return <article className="db-card db-card-lavender" style={{ padding: 16 }} key={String(requirement.id)}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div><h3 style={{ margin: "0 0 4px" }}>{String(requirement.plain_language_title || requirement.title)}</h3><p className="db-helper" style={{ margin: 0 }}>{String(requirement.plain_language_description || requirement.what_this_is || requirement.description || "")}</p></div>
          <button className="db-button-secondary" onClick={() => setOpen(expanded ? undefined : String(requirement.id))}>{expanded ? "Close" : "Manage requirement"}</button>
        </div>
        <div className="db-helper" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}><Badge label="Stage" value={String(requirement.registration_stage)} /><Badge label="Category" value={String(requirement.requirement_category || requirement.requirement_group || "Other")} /><Badge label="Source" value={authorityLabel(requirement)} help={sourceHelp(requirement)} /><Badge label="Applies" value={applicabilityLabel(requirement)} help={String(requirement.applicability_notes || "Confirm applicability with the relevant authority where needed.")} /><Badge label="Status" value={String(existing?.status || "Not Started")} /><Badge label="Evidence" value={requirement.minimum_evidence_count ? `${requirementLinks.length}/${String(requirement.minimum_evidence_count)}` : String(requirementLinks.length)} /><Badge label="Verification" value={String(existing?.verification_status || "Not verified")} />{existing?.expires_at ? <Badge label="Expiry" value={formatComplianceDate(String(existing.expires_at))} /> : null}</div>
        <p className="db-helper" style={{ margin: "10px 0 0" }}><strong>Next action:</strong> {nextRequirementAction(String(existing?.status || "Not Started"), existing?.verification_status === "Verified", String(requirement.next_action_guidance || "") || null)}</p>
        {hasRequirementGuidance(requirement) ? <details style={{ marginTop: 10 }}><summary style={{ cursor: "pointer", fontWeight: 700 }}>View guidance</summary><div className="db-helper" style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {requirement.why_it_matters ? <Guidance label="Why it matters" value={String(requirement.why_it_matters)} /> : null}
          {requirement.preparation_guidance || requirement.what_to_prepare ? <Guidance label="What the school should prepare" value={String(requirement.preparation_guidance || requirement.what_to_prepare)} /> : null}
          {requirement.authority_review_guidance || requirement.what_authority_may_ask_to_see ? <Guidance label="What may be reviewed" value={String(requirement.authority_review_guidance || requirement.what_authority_may_ask_to_see)} /> : null}
          {requirement.owner_guidance ? <Guidance label="Who normally owns the work" value={String(requirement.owner_guidance)} /> : null}
          {requirement.applicability_guidance ? <Guidance label="When it applies" value={String(requirement.applicability_guidance)} /> : null}
          <Guidance label="What Ready means" value={String(requirement.ready_definition || READY_EXPLANATION)} />
          <Guidance label="Source" value={sourceHelp(requirement)} />
          {requirement.source_url ? <a className="db-button-secondary" href={String(requirement.source_url)} target="_blank" rel="noreferrer">Open source</a> : null}
        </div></details> : null}
        {actionEligible ? <Link className="db-button-secondary" style={{ display: "inline-block", marginTop: 10, textDecoration: "none" }} href={`/dbe-registration/corrective-actions?school=${school}&source_type=requirement&source_id=${encodeURIComponent(String(existing.id))}`}>Create Corrective Action</Link> : null}
        {expanded ? <div style={{ marginTop: 14 }}><form onSubmit={(event) => { event.preventDefault(); void save(String(requirement.id), event.currentTarget); }} style={{ display: "grid", gap: 8 }}><label>Status<select name="status" className="db-input" defaultValue={String(existing?.status || "Not Started")}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label><label>Due date<input name="due_date" className="db-input" type="date" defaultValue={String(existing?.due_date || "")} /></label><label>Expiry date<input name="expires_at" className="db-input" type="date" defaultValue={String(existing?.expires_at || "")} /></label><label>Notes<textarea name="notes" className="db-input" defaultValue={String(existing?.notes || "")} /></label><label><input type="checkbox" name="verify" defaultChecked={existing?.verification_status === "Verified"} /> Mark this recorded status as verified</label><button className="db-button-primary" disabled={saving}>{saving ? "Saving..." : "Save status"}</button></form>{existing ? <section style={{ marginTop: 16 }}><h4>Linked Evidence</h4>{requirementLinks.length === 0 ? <p className="db-helper">No evidence linked yet. Link an existing document to support this requirement.</p> : requirementLinks.map((linkRow) => { const document = docs.find((item) => item.id === linkRow.document_id); return <div key={String(linkRow.id)} className="db-list-card">{String(document?.document_name || "Document")} <button className="db-button-secondary" onClick={() => void link(String(existing.id), String(linkRow.document_id), true)}>Unlink</button></div>; })}<label>Link Evidence<select className="db-input" defaultValue="" onChange={(event) => void link(String(existing.id), event.target.value)}><option value="">Choose document</option>{docs.map((document) => <option key={String(document.id)} value={String(document.id)}>{String(document.document_name)}</option>)}</select></label></section> : null}</div> : null}
      </article>;
    })}</div>}
  </div>;
}

function Guidance({ label, value }: { label: string; value: string }) { return <p style={{ margin: 0 }}><strong>{label}:</strong> {value}</p>; }
function Badge({ label, value, help }: { label: string; value: string; help?: string }) { return <span title={help || `${label}: ${value}`} style={{ border: "1px solid #E2D9F3", borderRadius: 999, padding: "3px 8px", background: "#FFFDFB" }}><strong>{label}:</strong> {value}</span>; }
function authorityLabel(item: Item) { const type = String(item.authority_type || "other"); if (type === "dailybloom_guidance") return "DailyBloom Guidance"; return String(item.authority_name || (type === "unclassified" || type === "other" ? "Source needs review" : type.replaceAll("_", " "))); }
function applicabilityLabel(item: Item) { const scope = String(item.applicability_scope || "needs_review"); if (scope === "needs_review") return "Needs confirmation"; if (scope === "guidance_only") return "Guidance only"; return item.province ? String(item.province) : scope.replaceAll("_", " "); }
function sourceHelp(item: Item) { const source = String(item.source_title || item.source_reference || "Source and applicability have not yet been verified. Confirm with the relevant authority."); return `${authorityLabel(item)} — ${source}`; }
