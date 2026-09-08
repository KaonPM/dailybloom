"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentProfile } from "@/app/lib/auth";
import { authenticatedFetch } from "@/app/lib/authenticated-fetch";
import { resolveSchoolContext } from "@/app/lib/school-context";
import { staffMatchesFilters, summarizeStaffCompliance, type StaffComplianceItem } from "@/app/lib/staff-compliance";
import { ComplianceHeader } from "../components";

type Staff = { id: string; full_name: string | null; role: string; active: boolean };
type Item = StaffComplianceItem & { id: string; staff_user_id: string; requirement_id: string | null; title: string; status: string; issue_date: string | null; verification_status: string; verified_at: string | null; document_id: string | null; notes: string | null };
type Requirement = { id: string; title: string; required: boolean };
type Document = { id: string; document_name: string };

const statuses = ["Not Started", "In Progress", "Ready", "Needs Review", "Missing", "Expired", "Not Applicable"];
const blankItem = (staffUserId: string): Item => ({ id: "", staff_user_id: staffUserId, requirement_id: null, title: "", status: "Not Started", issue_date: null, expiry_date: null, verification_status: "Unverified", verified_at: null, document_id: null, notes: null });

export default function StaffCompliancePage() {
  const router = useRouter();
  const params = useSearchParams();
  const [schoolId, setSchoolId] = useState<number>();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [catalogue, setCatalogue] = useState<Requirement[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selected, setSelected] = useState<Staff>();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All");
  const [activity, setActivity] = useState("Active");
  const [state, setState] = useState("All");
  const [editing, setEditing] = useState<Item>();
  const [saving, setSaving] = useState(false);

  const load = async (id: number) => {
    const response = await authenticatedFetch(`/api/staff-compliance?school_id=${id}`);
    const result = await response.json();
    if (!response.ok) { alert(result.error || "Could not load staff compliance."); return; }
    setStaff(result.staff || []); setItems(result.items || []); setCatalogue(result.catalogue || []); setDocuments(result.documents || []);
  };

  useEffect(() => { void (async () => {
    const { profile } = await getCurrentProfile();
    if (!profile || profile.role === "teacher") { router.replace(profile ? "/teacher" : "/login"); return; }
    const context = await resolveSchoolContext(params.get("school"));
    if (!context.schoolId) { router.replace("/login"); return; }
    setSchoolId(context.schoolId); await load(context.schoolId);
  })(); }, [params, router]);

  const summaries = useMemo(() => new Map(staff.map((person) => [person.id, summarizeStaffCompliance(items.filter((item) => item.staff_user_id === person.id))])), [staff, items]);
  const visible = staff.filter((person) => staffMatchesFilters({ ...person, summary: summaries.get(person.id) || summarizeStaffCompliance([]) }, { search, role, activity, state }));
  const schoolSummary = useMemo(() => staff.filter((person) => person.active).reduce((all, person) => {
    const summary = summaries.get(person.id) || summarizeStaffCompliance([]);
    return { total: all.total + 1, missing: all.missing + summary.missing, expiringSoon: all.expiringSoon + summary.expiringSoon, expired: all.expired + summary.expired, readyPeople: all.readyPeople + (summary.missing === 0 && summary.expired === 0 && (summary.ready > 0 || summary.notApplicable > 0) ? 1 : 0) };
  }, { total: 0, missing: 0, expiringSoon: 0, expired: 0, readyPeople: 0 }), [staff, summaries]);
  const displayItems = selected ? items.filter((item) => item.staff_user_id === selected.id) : [];

  async function save(form: HTMLFormElement) {
    if (!schoolId || !selected) return;
    setSaving(true);
    const data = new FormData(form);
    const response = await authenticatedFetch("/api/staff-compliance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", school_id: schoolId, staff_user_id: selected.id, id: editing?.id, item_type: data.get("item_type") || null, title: data.get("title"), status: data.get("status"), issue_date: data.get("issue_date"), expiry_date: data.get("expiry_date"), document_id: data.get("document_id") || null, notes: data.get("notes"), verify: data.get("verify") === "on" }) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { alert(result.error || "Could not save staff compliance."); return; }
    setEditing(undefined); await load(schoolId);
  }

  async function changeEvidence(item: Item, documentId: string | null) {
    if (!schoolId || !selected) return;
    const response = await authenticatedFetch("/api/staff-compliance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: documentId ? "link_evidence" : "unlink_evidence", school_id: schoolId, staff_user_id: selected.id, id: item.id, document_id: documentId }) });
    const result = await response.json();
    if (!response.ok) alert(result.error || "Could not update linked evidence."); else await load(schoolId);
  }
  async function openEvidence(documentId: string) {
    if (!schoolId) return;
    const response = await authenticatedFetch(`/api/dbe-compliance-documents?school_id=${schoolId}&document_id=${documentId}`); const result = await response.json();
    if (!response.ok) alert(result.error || "Could not open evidence."); else window.open(result.url, "_blank", "noopener,noreferrer");
  }

  if (!schoolId) return <p>Loading staff compliance...</p>;
  const roles = [...new Set(staff.map((person) => person.role))];
  const standardItemTypes: Record<string, string> = { "Police Clearance": "police_clearance", "National Child Protection Register Clearance": "child_protection_register_clearance", "Affidavit: No Previous Sexual Offences": "sexual_offences_affidavit", "Certified Identity Document": "certified_identity_document", "ECD Qualification / Education Evidence": "qualification_evidence" };
  const itemTypeDefault = editing?.requirement_id || standardItemTypes[editing?.title || ""] || "";
  return <div>
    <ComplianceHeader title="Staff Compliance" description="Review school staff records and supporting evidence. Only configured, applicable items should be treated as required." />
    <div className="db-card db-card-blue" style={summaryStyle}>
      <Stat value={schoolSummary.total} label="Active staff" /><Stat value={catalogue.length ? schoolSummary.readyPeople : "—"} label="Fully ready/current" /><Stat value={catalogue.length ? schoolSummary.missing : "—"} label="Missing compliance" /><Stat value={catalogue.length ? schoolSummary.expiringSoon : "—"} label="Expiring soon" /><Stat value={catalogue.length ? schoolSummary.expired : "—"} label="Expired" />
    </div>
    {catalogue.length === 0 ? <p className="db-helper">Staff compliance requirements have not been configured yet. You may record a clearly named school item, but no absence is treated as non-compliance.</p> : null}
    <div className="db-card" style={filterStyle}>
      <input className="db-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff" aria-label="Search staff" />
      <select className="db-input" value={role} onChange={(event) => setRole(event.target.value)}><option>All</option>{roles.map((value) => <option key={value}>{value}</option>)}</select>
      <select className="db-input" value={activity} onChange={(event) => setActivity(event.target.value)}><option>Active</option><option>Inactive</option><option>All</option></select>
      <select className="db-input" value={state} onChange={(event) => setState(event.target.value)}><option>All</option><option>Missing</option><option>Expiring Soon</option><option>Expired</option><option>Current/Ready</option></select>
    </div>
    {!staff.length ? <p className="db-helper">No staff members are currently available for this school.</p> : <div style={contentStyle}>
      <div style={{ display: "grid", gap: 8 }}>{visible.map((person) => {
        const summary = summaries.get(person.id) || summarizeStaffCompliance([]);
        return <button key={person.id} className="db-list-card" onClick={() => { setSelected(person); setEditing(undefined); }} style={{ textAlign: "left", border: selected?.id === person.id ? "2px solid #6D6888" : undefined }}><strong>{person.full_name || "Unnamed staff member"}</strong><br /><span className="db-helper">{person.role} · {person.active ? "Active" : "Inactive"}</span><br /><span className="db-helper">Missing {summary.missing} · Expiring {summary.expiringSoon} · Expired {summary.expired} · Ready {summary.ready}</span></button>;
      })}{!visible.length ? <p className="db-helper">No staff match these filters.</p> : null}</div>
      <section className="db-card db-card-lavender" style={{ padding: 16 }}>{!selected ? <p className="db-helper">Select a staff member to see and record their compliance information.</p> : <>
        <h3 style={{ marginTop: 0 }}>{selected.full_name || "Unnamed staff member"}</h3><p className="db-helper">{selected.role} · {selected.active ? "Active" : "Inactive"} · This school</p><p className="db-helper">{displayItems.length ? "Use Not Applicable only where this configured item does not apply to this person." : "No compliance information has been recorded for this staff member."}</p>
        {displayItems.map((item) => { const evidence = documents.find((document) => document.id === item.document_id); return <div className="db-list-card" key={item.id}><strong>{item.title}</strong><br /><span className="db-helper">{item.status} · {item.verification_status} {item.expiry_date ? `· Expires ${item.expiry_date}` : ""}</span>{item.notes ? <p className="db-helper">{item.notes}</p> : null}{evidence ? <p><button className="db-button-secondary" onClick={() => void openEvidence(evidence.id)}>View linked evidence</button> <button className="db-button-secondary" onClick={() => void changeEvidence(item, null)}>Unlink</button></p> : null}<button className="db-button-secondary" onClick={() => setEditing(item)}>Edit</button></div>; })}
        <button className="db-button-primary" style={{ marginTop: 12 }} onClick={() => setEditing(blankItem(selected.id))}>Add compliance item</button>
        {editing ? <form onSubmit={(event) => { event.preventDefault(); void save(event.currentTarget); }} style={{ display: "grid", gap: 8, marginTop: 16 }}><h4>{editing.id ? "Update compliance item" : "Add compliance item"}</h4><label>Item type<select name="item_type" className="db-input" defaultValue={itemTypeDefault}><option value="">Other school item</option><optgroup label="Staff registration documents"><option value="police_clearance">Police Clearance</option><option value="child_protection_register_clearance">National Child Protection Register Clearance</option><option value="sexual_offences_affidavit">Affidavit: No Previous Sexual Offences</option><option value="certified_identity_document">Certified Identity Document</option><option value="qualification_evidence">ECD Qualification / Education Evidence</option></optgroup><optgroup label="Configured school requirements">{catalogue.map((requirement) => <option value={requirement.id} key={requirement.id}>{requirement.title} {requirement.required ? "(Required where applicable)" : "(Optional)"}</option>)}</optgroup></select></label><label>Item name (only for Other)<input name="title" className="db-input" defaultValue={editing.title} maxLength={180} /></label><label>Status<select name="status" className="db-input" defaultValue={editing.status}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label><label>Issue date<input name="issue_date" className="db-input" type="date" defaultValue={editing.issue_date || ""} /></label><label>Expiry date<input name="expiry_date" className="db-input" type="date" defaultValue={editing.expiry_date || ""} /></label><label>Evidence<select name="document_id" className="db-input" defaultValue={editing.document_id || ""}><option value="">No linked evidence</option>{documents.map((document) => <option value={document.id} key={document.id}>{document.document_name}</option>)}</select></label><p className="db-helper">Upload evidence securely in Documents &amp; Evidence, then link it here. Unlinking never deletes the file.</p><label>Notes<textarea name="notes" className="db-input" defaultValue={editing.notes || ""} /></label><label><input type="checkbox" name="verify" defaultChecked={editing.verification_status === "Verified"} /> Mark this recorded status as verified</label><div><button className="db-button-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button> <button type="button" className="db-button-secondary" onClick={() => setEditing(undefined)}>Cancel</button></div></form> : null}
      </>}</section>
    </div>}
  </div>;
}

function Stat({ value, label }: { value: number | string; label: string }) { return <div><strong>{value}</strong><br /><span className="db-helper">{label}</span></div>; }
const summaryStyle = { padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 };
const filterStyle = { padding: 16, marginTop: 14, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" };
const contentStyle = { display: "grid", gridTemplateColumns: "minmax(250px, 1fr) minmax(330px, 2fr)", gap: 14, marginTop: 14 };
